"use strict";

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

        await queryInterface.createTable("warehouses", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
                defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            name: {
                type: Sequelize.STRING(120),
                allowNull: false,
            },
            address_line1: {
                type: Sequelize.STRING(250),
                allowNull: false,
            },
            address_line2: {
                type: Sequelize.STRING(250),
                allowNull: true,
            },
            city: {
                type: Sequelize.STRING(80),
                allowNull: true,
            },
            state: {
                type: Sequelize.STRING(80),
                allowNull: true,
            },
            pincode: {
                type: Sequelize.STRING(10),
                allowNull: true,
            },
            lat: {
                type: Sequelize.DECIMAL(10, 7),
                allowNull: true,
            },
            lng: {
                type: Sequelize.DECIMAL(10, 7),
                allowNull: true,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn("NOW"),
            },
        });

        await safeAddIndex("warehouses", ["is_active"], {
            name: "warehouses_is_active_idx",
        });

        // Seed single default warehouse (Phase 1)
        await safeQuery(`
            INSERT INTO warehouses (name, address_line1, city, state, is_active)
            VALUES ('Main Warehouse', 'Ahmedabad', 'Ahmedabad', 'Gujarat', true)
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("warehouses");
    },
};
