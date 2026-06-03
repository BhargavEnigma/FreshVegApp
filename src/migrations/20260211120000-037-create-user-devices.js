"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create a multi-device table for FCM tokens.
        // Keep the existing users.fcm_token column for backward compatibility.
        const tableExists = await queryInterface
            .describeTable("user_devices")
            .then(() => true)
            .catch(() => false);

        if (!tableExists) {
            await queryInterface.createTable("user_devices", {
                id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: "users", key: "id" },
                    onDelete: "CASCADE",
                    onUpdate: "CASCADE",
                },
                device_id: {
                    // Client-generated stable ID per install (recommended).
                    type: Sequelize.TEXT,
                    allowNull: true,
                },
                platform: {
                    // 'android' | 'ios' | 'web' (optional)
                    type: Sequelize.STRING(20),
                    allowNull: true,
                },
                fcm_token: {
                    type: Sequelize.STRING(500),
                    allowNull: false,
                },
                is_active: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
                last_seen_at: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                disabled_reason: {
                    type: Sequelize.STRING(120),
                    allowNull: true,
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
        }

        // Unique token across all users (prevents accidental cross-account reuse).
        await queryInterface.sequelize
            .query(
                "CREATE UNIQUE INDEX IF NOT EXISTS user_devices_fcm_token_uniq ON user_devices (fcm_token);"
            )
            .catch(() => {});

        // Ensure one device_id per user (best-effort), while allowing null device_id.
        await queryInterface.sequelize
            .query(
                "CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_device_id_uniq ON user_devices (user_id, device_id) WHERE device_id IS NOT NULL;"
            )
            .catch(() => {});

        await queryInterface.sequelize
            .query(
                "CREATE INDEX IF NOT EXISTS user_devices_user_active_idx ON user_devices (user_id, is_active);"
            )
            .catch(() => {});
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS user_devices_user_active_idx;").catch(() => {});
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS user_devices_user_device_id_uniq;").catch(() => {});
        await queryInterface.sequelize.query("DROP INDEX IF EXISTS user_devices_fcm_token_uniq;").catch(() => {});
        await queryInterface.dropTable("user_devices").catch(() => {});
    },
};