"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const safeQuery = async (sql) => {
            try {
                await queryInterface.sequelize.query(sql);
            } catch (e) {
                const msg = String(e?.message || "");
                if (
                    msg.includes("already exists") ||
                    msg.includes("Duplicate") ||
                    msg.includes("duplicate") ||
                    msg.includes("exists")
                ) {
                    return;
                }
                throw e;
            }
        };

        await queryInterface.createTable("banners", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },

            title: { type: Sequelize.TEXT, allowNull: true },
            subtitle: { type: Sequelize.TEXT, allowNull: true },

            image_url: { type: Sequelize.TEXT, allowNull: false },

            storage_provider: { type: Sequelize.TEXT, allowNull: true },
            storage_path: { type: Sequelize.TEXT, allowNull: true },

            placement: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "home",
            },

            action_type: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: "none",
            },
            action_value: { type: Sequelize.TEXT, allowNull: true },

            sort_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },

            start_at: { type: Sequelize.DATE, allowNull: true },
            end_at: { type: Sequelize.DATE, allowNull: true },

            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },

            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("now"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("now"),
            },
        });

        await queryInterface.addIndex("banners", ["placement", "is_active", "sort_order"], {
            name: "banners_active_order_idx",
        });

        await safeQuery(`ALTER TABLE banners ADD CONSTRAINT banners_sort_order_check CHECK (sort_order >= 0);`);
    },

    async down(queryInterface) {
        const safeQuery = async (sql) => {
            try {
                await queryInterface.sequelize.query(sql);
            } catch (e) {
                // ignore
            }
        };

        await safeQuery(`ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_sort_order_check;`);
        await queryInterface.dropTable("banners");
    },
};
