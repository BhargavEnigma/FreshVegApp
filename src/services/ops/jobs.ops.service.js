"use strict";

const { sequelize, Order, OrderStatusEvent, Notification, JobRun } = require("../../models");
const { AppError } = require("../../utils/errors");
const { Op, UniqueConstraintError } = require("sequelize");

const STALE_STARTED_MS = Number.parseInt(process.env.JOB_RUN_STALE_MS || "900000", 10) || 900000;

function isValidYyyyMmDd(v) {
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normalizeTriggerSource(v) {
    const s = String(v || "manual").trim().toLowerCase();
    if (["manual", "cron", "api", "system"].includes(s)) return s;
    return "manual";
}

function isStaleStartedRun(jobRun) {
    if (!jobRun || jobRun.status !== "started" || !jobRun.started_at) return false;
    return Date.now() - new Date(jobRun.started_at).getTime() >= STALE_STARTED_MS;
}

async function createOrGetJobRun({ job_name, run_key, scheduled_for, trigger_source }) {
    try {
        const created = await JobRun.create({
            job_name,
            run_key,
            status: "started",
            scheduled_for: scheduled_for || null,
            started_at: new Date(),
            finished_at: null,
            trigger_source: normalizeTriggerSource(trigger_source),
            meta: null,
            error_message: null,
        });
        return { jobRun: created, created: true };
    } catch (e) {
        if (e instanceof UniqueConstraintError) {
            const existing = await JobRun.findOne({ where: { job_name, run_key } });

            if (isStaleStartedRun(existing)) {  
                await existing.update({
                    status: "failed",
                    finished_at: new Date(),
                    error_message: "Marked failed automatically because a previous run was stuck in started state",
                });

                const retried = await JobRun.create({
                    job_name,
                    run_key: `${run_key}#retry-${Date.now()}`,
                    status: "started",
                    finished_at: null,
                    scheduled_for: scheduled_for || null,
                    trigger_source: normalizeTriggerSource(trigger_source),
                    meta: { retry_of_run_id: existing.id, original_run_key: run_key },
                    error_message: null,
                });

                return { jobRun: retried, created: true, staleRecovered: true };
            }

            return { jobRun: existing, created: false };
        }
        throw e;
    }
}

async function lockOrdersForDate({ delivery_date, trigger_source = "manual" }) {
    if (!isValidYyyyMmDd(delivery_date)) {
        throw new AppError("INVALID_DELIVERY_DATE", "delivery_date must be YYYY-MM-DD", 400);
    }

    const run_key = `lock_orders:${delivery_date}`;

    let jobRun;
    let created;

    try {
        const createdJobRun = await createOrGetJobRun({
            job_name: "lock_orders",
            run_key,
            scheduled_for: delivery_date,
            trigger_source,
        });
        jobRun = createdJobRun.jobRun;
        created = createdJobRun.created;
    } catch (_e) {
        throw new AppError("INTERNAL_ERROR", "Failed to create/read JobRun", 500);
    }

    if (!created) {
        if (jobRun.status === "finished") {
            return { delivery_date, locked: 0, idempotent: true, run_id: jobRun.id };
        }
        if (jobRun.status === "started") {
            return { delivery_date, locked: 0, already_running: true, run_id: jobRun.id };
        }
    }

    const summary = {
        total_candidates: 0,
        locked_count: 0,
        skipped_count: 0,
        failed_count: 0,
    };

    try {
        await sequelize.transaction(async (t) => {
            const BATCH_SIZE = 500;

            while (true) {
                const eligible = await Order.findAll({
                    attributes: ["id", "status", "user_id", "payment_status", "payment_method"],
                    where: {
                        delivery_date,
                        is_locked: false,
                        status: { [Op.in]: ["placed", "confirmed"] },
                        [Op.or]: [{ payment_status: "paid" }, { payment_method: "cod" }],
                    },
                    limit: BATCH_SIZE,
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                    skipLocked: true,
                });

                if (!eligible.length) break;

                summary.total_candidates += eligible.length;
                const ids = eligible.map((o) => o.id);

                const [updatedCount, updatedRows] = await Order.update(
                    {
                        status: "locked",
                        is_locked: true,
                        locked_at: new Date(),
                    },
                    {
                        where: {
                            id: ids,
                            is_locked: false,
                            status: { [Op.in]: ["placed", "confirmed"] },
                            [Op.or]: [{ payment_status: "paid" }, { payment_method: "cod" }],
                        },
                        transaction: t,
                        returning: ["id"],
                    }
                );

                summary.locked_count += Number(updatedCount || 0);
                if (updatedCount !== ids.length) {
                    summary.skipped_count += Math.max(0, ids.length - updatedCount);
                }

                const updatedIdsSet = new Set((updatedRows || []).map((r) => r.id));

                const eventsPayload = eligible
                    .filter((o) => updatedIdsSet.has(o.id))
                    .map((o) => ({
                        order_id: o.id,
                        from_status: o.status,
                        to_status: "locked",
                        actor_user_id: null,
                        note: "scheduler_lock",
                        meta: { delivery_date, job_run_id: jobRun.id },
                    }));

                if (eventsPayload.length) {
                    await OrderStatusEvent.bulkCreate(eventsPayload, { transaction: t });
                }

                const notificationsPayload = eligible
                    .filter((o) => updatedIdsSet.has(o.id))
                    .map((o) => ({
                        user_id: o.user_id,
                        channel: "push",
                        template: "order_locked",
                        payload: {
                            order_id: o.id,
                            delivery_date,
                            from_status: o.status,
                            to_status: "locked",
                        },
                        status: "queued",
                        attempt_count: 0,
                        scheduled_at: null,
                    }));

                if (notificationsPayload.length) {
                    await Notification.bulkCreate(notificationsPayload, { transaction: t });
                }
            }
        });

        await jobRun.update({
            status: "finished",
            finished_at: new Date(),
            error_message: null,
            meta: summary,
        });

        return { delivery_date, locked: summary.locked_count, run_id: jobRun.id, summary };
    } catch (e) {
        summary.failed_count = 1;
        try {
            await jobRun.update({
                status: "failed",
                finished_at: new Date(),
                error_message: String(e?.message || e),
                meta: summary,
            });
        } catch (persistErr) {
            console.error("[lock_orders] failed to persist JobRun failure", persistErr);
        }
        throw e;
    }
}

module.exports = { lockOrdersForDate };