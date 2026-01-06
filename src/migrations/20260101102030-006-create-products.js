"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {

const safeAddIndex = async (table, fields, options) => {
    try {
        await queryInterface.addIndex(table, fields, options);
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

        await queryInterface.createTable("products", {
            id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            category_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "categories", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT",
            },
            name: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            unit: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            base_quantity: {
                type: Sequelize.DECIMAL(10, 3),
                allowNull: false,
            },
            mrp_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            selling_price_paise: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            is_out_of_stock: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("now()"),
            },
        });

        await safeAddIndex("products", ["category_id"], { name: "products_category_idx" });
        await safeAddIndex("products", ["is_active", "is_out_of_stock"], { name: "products_active_idx" });
        await safeAddIndex("products", ["name"], { name: "products_name_idx" });

        await safeQuery(`
            ALTER TABLE products
            ADD CONSTRAINT products_mrp_paise_check
            CHECK (mrp_paise >= 0);
        `);

        await safeQuery(`
            ALTER TABLE products
            ADD CONSTRAINT products_selling_price_paise_check
            CHECK (selling_price_paise >= 0);
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("products");
    },
};
