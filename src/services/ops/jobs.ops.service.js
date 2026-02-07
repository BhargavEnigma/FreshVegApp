"use strict";

const { sequelize, JobRun, Order, OrderStatusEvent, Notification } = require("../../models");
const { AppError } = require("../../utils/errors");
const { Op, UniqueConstraintError } = require("sequelize");

function isValidYyyyMmDd(v) {
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normalizeTriggerSource(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    return s;
}

async function createOrGetJobRun({ job_name, run_key, scheduled_for, trigger_source }) {
    // Create the job run row outside the order-locking transaction so failures are observable.
    try {
        const created = await JobRun.create({
            job_name,
            run_key,
            status: "started",
            finished_at: null,
            scheduled_for: scheduled_for || null,
            trigger_source: normalizeTriggerSource(trigger_source),
            meta: null,
            error_message: null,
        });
        return { jobRun: created, created: true };
    } catch (e) {
        // If another runner created it concurrently, treat as already running/finished.
        if (e instanceof UniqueConstraintError) {
            const existing = await JobRun.findOne({ where: { job_name, run_key } });
            return { jobRun: existing, created: false };
        }
        throw e;
    }
}

async function lockOrdersForDate({ delivery_date, scheduled_for = null, trigger_source = null }) {
    if (!delivery_date) {
        throw new AppError("VALIDATION_ERROR", "delivery_date is required", 400);
    }
    if (!isValidYyyyMmDd(delivery_date)) {
        throw new AppError("VALIDATION_ERROR", "delivery_date must be YYYY-MM-DD", 400);
    }

    const job_name = "lock_orders";
    const run_key = delivery_date;

    const { jobRun, created } = await createOrGetJobRun({
        job_name,
        run_key,
        scheduled_for,
        trigger_source,
    });

    if (!jobRun) {
        throw new AppError("INTERNAL_ERROR", "Failed to create/read JobRun", 500);
    }

    // Idempotency:
    // - If finished => safe no-op.
    // - If started => already running (avoid parallel corruption).
    // - If failed => allow rerun (job is rerun-safe).
    if (!created) {
        if (jobRun.status === "finished") {
            return { delivery_date, locked: 0, idempotent: true, run_id: jobRun.id };
        }
        if (jobRun.status === "started") {
            return { delivery_date, locked: 0, already_running: true, run_id: jobRun.id };
        }
        // status === "failed" -> continue and attempt again
    }

    const summary = {
        total_candidates: 0,
        locked_count: 0,
        skipped_count: 0,
        failed_count: 0,
        delivery_date,
    };

    try {
        await sequelize.transaction(async (t) => {
            // Batch to avoid loading huge datasets.
            const BATCH_SIZE = 500;

            // We'll loop until no more eligible rows.
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

                if (!eligible.length) {
                    break;
                }

                summary.total_candidates += eligible.length;

                const ids = eligible.map((o) => o.id);

                // Safety: update only rows that are still eligible.
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

                // If a row became ineligible between select + update (rare), count as skipped.
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

        return {
            delivery_date,
            locked: summary.locked_count,
            run_id: jobRun.id,
            summary,
        };
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
            // Best-effort; avoid masking original error.
            console.error("[lock_orders] failed to persist JobRun failure", persistErr);
        }
        throw e;
    }
}

module.exports = { lockOrdersForDate };