"use strict";

const { sequelize, JobRun, Order, OrderStatusEvent } = require("../../models");
const { AppError } = require("../../utils/errors");

async function lockOrdersForDate({ delivery_date }) {
    if (!delivery_date) {
        throw new AppError("VALIDATION_ERROR", "delivery_date is required", 400);
    }

    return sequelize.transaction(async (t) => {
        const job_name = "lock_orders";
        const run_key = delivery_date;

        try {
            await JobRun.create(
                { job_name, run_key, status: "started", meta: null },
                { transaction: t }
            );
        } catch (e) {
            const existing = await JobRun.findOne({
                where: { job_name, run_key },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (existing && existing.status === "finished") {
                return { delivery_date, locked: 0, idempotent: true };
            }

            throw new AppError("JOB_ALREADY_RUNNING", "Job already started for this date", 409);
        }

        // ✅ Find eligible orders first so we can write correct from_status -> to_status events
        const eligible = await Order.findAll({
            where: {
                delivery_date,
                is_locked: false,
                payment_status: "paid",
                status: ["placed", "confirmed"], // support both
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!eligible.length) {
            await JobRun.update(
                { status: "finished", finished_at: new Date(), meta: { locked: 0 } },
                { where: { job_name, run_key }, transaction: t }
            );

            return { delivery_date, locked: 0 };
        }

        // ✅ Update status + lock fields
        await Order.update(
            {
                status: "locked",
                is_locked: true,
                locked_at: new Date(),
            },
            {
                where: { id: eligible.map((o) => o.id) },
                transaction: t,
            }
        );

        // ✅ Write status events
        await OrderStatusEvent.bulkCreate(
            eligible.map((o) => ({
                order_id: o.id,
                from_status: o.status,
                to_status: "locked",
                actor_user_id: null,
                note: "scheduler_lock",
                meta: { delivery_date },
            })),
            { transaction: t }
        );

        await JobRun.update(
            { status: "finished", finished_at: new Date(), meta: { locked: eligible.length } },
            { where: { job_name, run_key }, transaction: t }
        );

        return { delivery_date, locked: eligible.length };
    });
}

module.exports = { lockOrdersForDate };
