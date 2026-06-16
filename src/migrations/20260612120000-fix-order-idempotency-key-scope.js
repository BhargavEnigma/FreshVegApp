"use strict";

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const [constraints] = await queryInterface.sequelize.query(
                `
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
                WHERE rel.relname = 'orders'
                  AND nsp.nspname = current_schema()
                  AND con.contype = 'u'
                  AND (
                    SELECT array_agg(att.attname ORDER BY keys.ord)
                    FROM unnest(con.conkey) WITH ORDINALITY AS keys(attnum, ord)
                    JOIN pg_attribute att
                      ON att.attrelid = con.conrelid
                     AND att.attnum = keys.attnum
                  ) = ARRAY['idempotency_key']::name[]
                `,
                { transaction }
            );

            for (const row of constraints) {
                await queryInterface.removeConstraint("orders", row.conname, { transaction });
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.addConstraint("orders", {
            fields: ["idempotency_key"],
            type: "unique",
            name: "orders_idempotency_key_key",
        });
    },
};
