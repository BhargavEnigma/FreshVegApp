"use strict";

/**
 * Complete FreshVeg schema migration generated from the uploaded Sequelize models.
 * Target DB: PostgreSQL / Supabase.
 */

const uuidPk = (Sequelize) => ({
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: Sequelize.literal("gen_random_uuid()"),
});

const createdAt = (Sequelize) => ({
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("NOW()"),
});

const updatedAt = (Sequelize) => ({
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("NOW()"),
});

const fk = (Sequelize, table, key = "id", allowNull = false, onDelete = "CASCADE") => ({
    type: Sequelize.UUID,
    allowNull,
    references: { model: table, key },
    onUpdate: "CASCADE",
    onDelete,
});

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', { transaction });

            await queryInterface.createTable("users", {
                id: uuidPk(Sequelize),
                phone: { type: Sequelize.TEXT, allowNull: false, unique: true },
                full_name: { type: Sequelize.TEXT, allowNull: true },
                email: { type: Sequelize.TEXT, allowNull: true },
                fcm_token: { type: Sequelize.TEXT, allowNull: true },
                status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "active" },
                last_login_at: { type: Sequelize.DATE, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("warehouses", {
                id: uuidPk(Sequelize),
                name: { type: Sequelize.STRING(120), allowNull: false },
                address_line1: { type: Sequelize.STRING(250), allowNull: false },
                address_line2: { type: Sequelize.STRING(250), allowNull: true, defaultValue: null },
                city: { type: Sequelize.STRING(80), allowNull: true, defaultValue: null },
                state: { type: Sequelize.STRING(80), allowNull: true, defaultValue: null },
                pincode: { type: Sequelize.STRING(10), allowNull: true, defaultValue: null },
                lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true, defaultValue: null },
                lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true, defaultValue: null },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("categories", {
                id: uuidPk(Sequelize),
                name: { type: Sequelize.TEXT, allowNull: false, unique: true },
                slug: { type: Sequelize.TEXT, allowNull: false, unique: true },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                sort_order: { type: Sequelize.INTEGER, allowNull: true },
                image_url: { type: Sequelize.TEXT, allowNull: true },
                storage_provider: { type: Sequelize.TEXT, allowNull: true },
                storage_path: { type: Sequelize.TEXT, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("delivery_slots", {
                id: uuidPk(Sequelize),
                name: { type: Sequelize.TEXT, allowNull: false },
                start_time: { type: Sequelize.TIME, allowNull: false },
                end_time: { type: Sequelize.TIME, allowNull: false },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("products", {
                id: uuidPk(Sequelize),
                category_id: fk(Sequelize, "categories", "id", false, "RESTRICT"),
                name: { type: Sequelize.TEXT, allowNull: false },
                description: { type: Sequelize.TEXT, allowNull: true },
                unit: { type: Sequelize.TEXT, allowNull: false },
                base_quantity: { type: Sequelize.DECIMAL(10, 3), allowNull: false },
                mrp_paise: { type: Sequelize.INTEGER, allowNull: false },
                selling_price_paise: { type: Sequelize.INTEGER, allowNull: false },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                is_out_of_stock: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                tag: { type: Sequelize.TEXT, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("product_packs", {
                id: uuidPk(Sequelize),
                product_id: fk(Sequelize, "products", "id", false, "CASCADE"),
                label: { type: Sequelize.STRING(40), allowNull: false },
                base_quantity: { type: Sequelize.DECIMAL(10, 3), allowNull: false },
                base_unit: { type: Sequelize.STRING(10), allowNull: false },
                mrp_paise: { type: Sequelize.INTEGER, allowNull: true, defaultValue: null },
                selling_price_paise: { type: Sequelize.INTEGER, allowNull: false },
                pricing_mode: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "dynamic" },
                sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("product_images", {
                id: uuidPk(Sequelize),
                product_id: fk(Sequelize, "products", "id", false, "CASCADE"),
                image_url: { type: Sequelize.TEXT, allowNull: false },
                storage_provider: { type: Sequelize.TEXT, allowNull: true },
                storage_path: { type: Sequelize.TEXT, allowNull: true },
                sort_order: { type: Sequelize.INTEGER, allowNull: true },
                created_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("user_addresses", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                label: { type: Sequelize.TEXT, allowNull: true },
                name: { type: Sequelize.TEXT, allowNull: true },
                phone: { type: Sequelize.TEXT, allowNull: true },
                address_line1: { type: Sequelize.TEXT, allowNull: false },
                address_line2: { type: Sequelize.TEXT, allowNull: true },
                landmark: { type: Sequelize.TEXT, allowNull: true },
                area: { type: Sequelize.TEXT, allowNull: true },
                city: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Ahmedabad" },
                state: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Gujarat" },
                pincode: { type: Sequelize.TEXT, allowNull: false },
                lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
                lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
                is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                is_serviceable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("user_roles", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                role: { type: Sequelize.STRING(40), allowNull: false },
                created_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("otp_requests", {
                id: uuidPk(Sequelize),
                phone: { type: Sequelize.TEXT, allowNull: false },
                provider: { type: Sequelize.TEXT, allowNull: false, defaultValue: "msg91" },
                provider_request_id: { type: Sequelize.TEXT, allowNull: true },
                purpose: { type: Sequelize.TEXT, allowNull: false, defaultValue: "login" },
                status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "sent" },
                attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                ip_address: { type: Sequelize.TEXT, allowNull: true },
                user_agent: { type: Sequelize.TEXT, allowNull: true },
                expires_at: { type: Sequelize.DATE, allowNull: false },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("user_sessions", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                refresh_token_hash: { type: Sequelize.TEXT, allowNull: false },
                device_id: { type: Sequelize.TEXT, allowNull: true },
                device_name: { type: Sequelize.TEXT, allowNull: true },
                ip_address: { type: Sequelize.TEXT, allowNull: true },
                user_agent: { type: Sequelize.TEXT, allowNull: true },
                is_revoked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                revoked_at: { type: Sequelize.DATE, allowNull: true },
                expires_at: { type: Sequelize.DATE, allowNull: false },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("user_devices", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                device_id: { type: Sequelize.TEXT, allowNull: true },
                platform: { type: Sequelize.STRING(20), allowNull: true },
                fcm_token: { type: Sequelize.STRING(500), allowNull: false },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                last_seen_at: { type: Sequelize.DATE, allowNull: true },
                disabled_reason: { type: Sequelize.STRING(120), allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("warehouse_service_areas", {
                id: uuidPk(Sequelize),
                warehouse_id: fk(Sequelize, "warehouses"),
                area_name: { type: Sequelize.STRING(120), allowNull: false },
                city: { type: Sequelize.STRING(80), allowNull: true, defaultValue: null },
                pincode: { type: Sequelize.STRING(10), allowNull: true, defaultValue: null },
                lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true, defaultValue: null },
                lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true, defaultValue: null },
                radius_km: { type: Sequelize.DECIMAL(6, 2), allowNull: true, defaultValue: null },
                boundary_geojson: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("user_warehouse_assignments", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                warehouse_id: fk(Sequelize, "warehouses"),
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("carts", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users"),
                status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "active" },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("cart_items", {
                id: uuidPk(Sequelize),
                cart_id: fk(Sequelize, "carts"),
                product_id: fk(Sequelize, "products", "id", false, "RESTRICT"),
                product_pack_id: fk(Sequelize, "product_packs", "id", false, "RESTRICT"),
                quantity: { type: Sequelize.INTEGER, allowNull: false },
                price_paise: { type: Sequelize.INTEGER, allowNull: false },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("deals", {
                id: uuidPk(Sequelize),
                name: { type: Sequelize.TEXT, allowNull: false, defaultValue: "Deals of the Day" },
                description: { type: Sequelize.TEXT, allowNull: true },
                deal_date: { type: Sequelize.DATEONLY, allowNull: false },
                starts_at: { type: Sequelize.DATE, allowNull: true },
                ends_at: { type: Sequelize.DATE, allowNull: true },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("deal_items", {
                id: uuidPk(Sequelize),
                deal_id: fk(Sequelize, "deals"),
                product_pack_id: fk(Sequelize, "product_packs", "id", false, "CASCADE"),
                pricing_type: { type: Sequelize.TEXT, allowNull: false, defaultValue: "fixed_price" },
                deal_price_paise: { type: Sequelize.INTEGER, allowNull: true },
                discount_bps: { type: Sequelize.INTEGER, allowNull: true },
                discount_paise: { type: Sequelize.INTEGER, allowNull: true },
                max_qty_per_order: { type: Sequelize.INTEGER, allowNull: true },
                sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("orders", {
                id: uuidPk(Sequelize),
                order_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
                user_id: fk(Sequelize, "users", "id", false, "RESTRICT"),
                warehouse_id: fk(Sequelize, "warehouses", "id", false, "RESTRICT"),
                address_id: fk(Sequelize, "user_addresses", "id", true, "SET NULL"),
                delivery_partner_user_id: fk(Sequelize, "users", "id", true, "SET NULL"),
                delivery_assigned_at: { type: Sequelize.DATE, allowNull: true },
                delivery_assigned_by_user_id: fk(Sequelize, "users", "id", true, "SET NULL"),
                picked_at: { type: Sequelize.DATE, allowNull: true },
                out_for_delivery_at: { type: Sequelize.DATE, allowNull: true },
                delivered_at: { type: Sequelize.DATE, allowNull: true },
                delivery_failed_at: { type: Sequelize.DATE, allowNull: true },
                delivery_attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                delivery_failure_reason: { type: Sequelize.TEXT, allowNull: true },
                delivery_notes: { type: Sequelize.TEXT, allowNull: true },
                delivery_proof_image_url: { type: Sequelize.TEXT, allowNull: true },
                customer_delivery_otp_hash: { type: Sequelize.TEXT, allowNull: true },
                customer_delivery_otp_expires_at: { type: Sequelize.DATE, allowNull: true },
                delivery_label: { type: Sequelize.TEXT, allowNull: true },
                delivery_name: { type: Sequelize.TEXT, allowNull: true },
                delivery_phone: { type: Sequelize.TEXT, allowNull: true },
                delivery_address_line1: { type: Sequelize.TEXT, allowNull: true },
                delivery_address_line2: { type: Sequelize.TEXT, allowNull: true },
                delivery_landmark: { type: Sequelize.TEXT, allowNull: true },
                delivery_area: { type: Sequelize.TEXT, allowNull: true },
                delivery_city: { type: Sequelize.TEXT, allowNull: true },
                delivery_state: { type: Sequelize.TEXT, allowNull: true },
                delivery_pincode: { type: Sequelize.TEXT, allowNull: true },
                delivery_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
                delivery_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
                delivery_date: { type: Sequelize.DATEONLY, allowNull: false },
                delivery_slot_id: fk(Sequelize, "delivery_slots", "id", true, "SET NULL"),
                status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "placed" },
                subtotal_paise: { type: Sequelize.INTEGER, allowNull: false },
                delivery_fee_paise: { type: Sequelize.INTEGER, allowNull: false },
                discount_paise: { type: Sequelize.INTEGER, allowNull: false },
                total_paise: { type: Sequelize.INTEGER, allowNull: false },
                gst_rate_bps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                gst_amount_paise: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                grand_total_paise: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                payment_status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "pending" },
                payment_method: { type: Sequelize.TEXT, allowNull: false, defaultValue: "cod" },
                retry_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                refund_status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "none" },
                current_payment_attempt_id: { type: Sequelize.UUID, allowNull: true },
                is_locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                locked_at: { type: Sequelize.DATE, allowNull: true },
                cancelled_at: { type: Sequelize.DATE, allowNull: true },
                cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
                idempotency_key: { type: Sequelize.TEXT, allowNull: true, unique: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("payment_attempts", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                attempt_no: { type: Sequelize.INTEGER, allowNull: false },
                provider: { type: Sequelize.TEXT, allowNull: false, defaultValue: "razorpay" },
                provider_order_id: { type: Sequelize.TEXT, allowNull: true },
                provider_payment_id: { type: Sequelize.TEXT, allowNull: true },
                provider_signature: { type: Sequelize.TEXT, allowNull: true },
                amount_paise: { type: Sequelize.INTEGER, allowNull: false },
                currency: { type: Sequelize.TEXT, allowNull: false, defaultValue: "INR" },
                status: { type: Sequelize.TEXT, allowNull: false },
                failure_code: { type: Sequelize.TEXT, allowNull: true },
                failure_reason: { type: Sequelize.TEXT, allowNull: true },
                verify_response_raw: { type: Sequelize.JSONB, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.addConstraint("orders", {
                fields: ["current_payment_attempt_id"],
                type: "foreign key",
                name: "orders_current_payment_attempt_id_fkey",
                references: { table: "payment_attempts", field: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                transaction,
            });

            await queryInterface.createTable("order_items", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                product_id: fk(Sequelize, "products", "id", false, "RESTRICT"),
                product_pack_id: fk(Sequelize, "product_packs", "id", true, "SET NULL"),
                pack_label: { type: Sequelize.TEXT, allowNull: true },
                product_name: { type: Sequelize.TEXT, allowNull: false },
                unit: { type: Sequelize.TEXT, allowNull: false },
                quantity: { type: Sequelize.DECIMAL(10, 3), allowNull: false },
                unit_price_paise: { type: Sequelize.INTEGER, allowNull: false },
                line_total_paise: { type: Sequelize.INTEGER, allowNull: false },
                original_unit_price_paise: { type: Sequelize.INTEGER, allowNull: true },
                deal_id: fk(Sequelize, "deals", "id", true, "SET NULL"),
                deal_item_id: fk(Sequelize, "deal_items", "id", true, "SET NULL"),
                deal_price_paise: { type: Sequelize.INTEGER, allowNull: true },
                line_discount_paise: { type: Sequelize.INTEGER, allowNull: true },
                created_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("payments", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                method: { type: Sequelize.TEXT, allowNull: false },
                status: { type: Sequelize.TEXT, allowNull: false },
                amount_paise: { type: Sequelize.INTEGER, allowNull: false },
                provider: { type: Sequelize.TEXT, allowNull: true },
                provider_payment_id: { type: Sequelize.TEXT, allowNull: true },
                provider_order_id: { type: Sequelize.TEXT, allowNull: true },
                provider_event_id: { type: Sequelize.TEXT, allowNull: true },
                provider_payload: { type: Sequelize.JSONB, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("refunds", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                payment_id: fk(Sequelize, "payments", "id", true, "SET NULL"),
                status: { type: Sequelize.TEXT, allowNull: false },
                amount_paise: { type: Sequelize.INTEGER, allowNull: false },
                provider_refund_id: { type: Sequelize.TEXT, allowNull: true },
                provider_payload: { type: Sequelize.JSONB, allowNull: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("order_status_history", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                from_status: { type: Sequelize.TEXT, allowNull: true },
                to_status: { type: Sequelize.TEXT, allowNull: false },
                changed_by: { type: Sequelize.TEXT, allowNull: false },
                note: { type: Sequelize.TEXT, allowNull: true },
                created_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("order_status_events", {
                id: uuidPk(Sequelize),
                order_id: fk(Sequelize, "orders"),
                from_status: { type: Sequelize.STRING(40), allowNull: true, defaultValue: null },
                to_status: { type: Sequelize.STRING(40), allowNull: false },
                actor_user_id: fk(Sequelize, "users", "id", true, "SET NULL"),
                note: { type: Sequelize.STRING(500), allowNull: true, defaultValue: null },
                meta: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
                created_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("notifications", {
                id: uuidPk(Sequelize),
                user_id: fk(Sequelize, "users", "id", true, "SET NULL"),
                channel: { type: Sequelize.STRING(20), allowNull: false },
                template: { type: Sequelize.STRING(60), allowNull: false },
                payload: { type: Sequelize.JSONB, allowNull: false },
                status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "queued" },
                attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                last_error: { type: Sequelize.STRING(500), allowNull: true, defaultValue: null },
                scheduled_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                sent_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("banners", {
                id: uuidPk(Sequelize),
                title: { type: Sequelize.TEXT, allowNull: true },
                subtitle: { type: Sequelize.TEXT, allowNull: true },
                image_url: { type: Sequelize.TEXT, allowNull: false },
                storage_provider: { type: Sequelize.TEXT, allowNull: true },
                storage_path: { type: Sequelize.TEXT, allowNull: true },
                placement: { type: Sequelize.TEXT, allowNull: false, defaultValue: "home" },
                action_type: { type: Sequelize.TEXT, allowNull: false, defaultValue: "none" },
                action_value: { type: Sequelize.TEXT, allowNull: true },
                sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                start_at: { type: Sequelize.DATE, allowNull: true },
                end_at: { type: Sequelize.DATE, allowNull: true },
                is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("settings", {
                key: { type: Sequelize.STRING(80), allowNull: false, primaryKey: true },
                value: { type: Sequelize.JSONB, allowNull: false },
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("scheduler_settings", {
                id: uuidPk(Sequelize),
                job_name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
                cron_expr: { type: Sequelize.STRING(100), allowNull: false },
                timezone: { type: Sequelize.STRING(60), allowNull: false, defaultValue: "Asia/Kolkata" },
                is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                days_ahead: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                consecutive_failures: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                max_consecutive_failures: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
                paused_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                pause_reason: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
                last_error_message: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
                last_failed_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("job_runs", {
                id: uuidPk(Sequelize),
                job_name: { type: Sequelize.STRING(80), allowNull: false },
                run_key: { type: Sequelize.STRING(40), allowNull: false },
                status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "started" },
                finished_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                scheduled_for: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                error_message: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
                trigger_source: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
                meta: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
                started_at: createdAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("inventories", {
                id: uuidPk(Sequelize),
                warehouse_id: fk(Sequelize, "warehouses"),
                product_pack_id: fk(Sequelize, "product_packs", "id", false, "CASCADE"),
                available_qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                reserved_qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("procurement_costs", {
                id: uuidPk(Sequelize),
                delivery_date: { type: Sequelize.DATEONLY, allowNull: false },
                warehouse_id: fk(Sequelize, "warehouses", "id", true, "SET NULL"),
                product_id: fk(Sequelize, "products", "id", false, "RESTRICT"),
                product_pack_id: fk(Sequelize, "product_packs", "id", true, "SET NULL"),
                product_name: { type: Sequelize.TEXT, allowNull: false },
                pack_label: { type: Sequelize.TEXT, allowNull: true },
                ordered_quantity: { type: Sequelize.DECIMAL(10, 3), allowNull: false },
                unit_cost_paise: { type: Sequelize.INTEGER, allowNull: false },
                total_cost_paise: { type: Sequelize.INTEGER, allowNull: false },
                notes: { type: Sequelize.TEXT, allowNull: true },
                created_by: fk(Sequelize, "users", "id", true, "SET NULL"),
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            await queryInterface.createTable("cost_entries", {
                id: uuidPk(Sequelize),
                cost_date: { type: Sequelize.DATEONLY, allowNull: false },
                category: { type: Sequelize.TEXT, allowNull: false },
                warehouse_id: fk(Sequelize, "warehouses", "id", true, "SET NULL"),
                related_order_id: fk(Sequelize, "orders", "id", true, "SET NULL"),
                reference_type: { type: Sequelize.TEXT, allowNull: true },
                reference_no: { type: Sequelize.TEXT, allowNull: true },
                amount_paise: { type: Sequelize.INTEGER, allowNull: false },
                notes: { type: Sequelize.TEXT, allowNull: true },
                status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "active" },
                created_by: fk(Sequelize, "users", "id", true, "SET NULL"),
                created_at: createdAt(Sequelize),
                updated_at: updatedAt(Sequelize),
            }, { transaction });

            // Indexes from model definitions.
            const addIndex = (table, fields, options = {}) => queryInterface.addIndex(table, fields, { ...options, transaction });

            await addIndex("users", ["status"], { name: "users_status_idx" });
            await addIndex("users", ["phone"], { name: "users_phone_uniq", unique: true });
            await addIndex("categories", ["is_active"], { name: "categories_active_idx" });
            await addIndex("delivery_slots", ["is_active"], { name: "delivery_slots_active_idx" });
            await addIndex("products", ["category_id"], { name: "products_category_idx" });
            await addIndex("products", ["is_active", "is_out_of_stock"], { name: "products_active_idx" });
            await addIndex("products", ["name"], { name: "products_name_idx" });
            await addIndex("product_packs", ["product_id"], { name: "product_packs_product_id_idx" });
            await addIndex("product_packs", ["product_id", "is_active"], { name: "product_packs_product_id_is_active_idx" });
            await addIndex("product_packs", ["product_id", "label"], { name: "product_packs_product_label_uniq", unique: true });
            await addIndex("product_images", ["product_id", "sort_order"], { name: "product_images_product_idx" });
            await addIndex("user_addresses", ["user_id"], { name: "user_addresses_user_id_idx" });
            await addIndex("user_addresses", ["user_id", "is_default"], { name: "user_addresses_default_idx" });
            await addIndex("user_roles", ["user_id"], { name: "user_roles_user_id_idx" });
            await addIndex("user_roles", ["role"], { name: "user_roles_role_idx" });
            await addIndex("user_roles", ["user_id", "role"], { name: "user_roles_user_id_role_uniq", unique: true });
            await addIndex("otp_requests", ["phone", "created_at"], { name: "otp_requests_phone_created_idx" });
            await addIndex("otp_requests", ["status"], { name: "otp_requests_status_idx" });
            await addIndex("user_sessions", ["user_id"], { name: "user_sessions_user_id_idx" });
            await addIndex("user_sessions", ["refresh_token_hash"], { name: "user_sessions_token_hash_idx" });
            await addIndex("user_sessions", ["user_id", "is_revoked", "expires_at"], { name: "user_sessions_active_idx" });
            await addIndex("user_devices", ["fcm_token"], { name: "user_devices_fcm_token_uniq", unique: true });
            await addIndex("user_devices", ["user_id", "device_id"], { name: "user_devices_user_device_id_uniq", unique: true });
            await addIndex("user_devices", ["user_id", "is_active"], { name: "user_devices_user_active_idx" });
            await addIndex("user_warehouse_assignments", ["user_id", "warehouse_id"], { name: "user_warehouse_assignments_user_warehouse_uniq", unique: true });
            await addIndex("carts", ["user_id", "status"], { name: "carts_user_status_idx" });
            await addIndex("cart_items", ["cart_id"], { name: "cart_items_cart_idx" });
            await addIndex("cart_items", ["product_pack_id"], { name: "cart_items_pack_id_idx" });
            await addIndex("cart_items", ["cart_id", "product_pack_id"], { name: "cart_items_unique_cart_pack", unique: true });
            await addIndex("orders", ["user_id", "created_at"], { name: "orders_user_created_idx" });
            await addIndex("orders", ["status"], { name: "orders_status_idx" });
            await addIndex("orders", ["delivery_date"], { name: "orders_delivery_date_idx" });
            await addIndex("orders", ["is_locked"], { name: "orders_locked_idx" });
            await addIndex("orders", ["user_id", "idempotency_key"], { name: "orders_user_idempotency_key_uniq", unique: true });
            await addIndex("orders", ["delivery_partner_user_id"], { name: "orders_delivery_partner_idx" });
            await addIndex("orders", ["warehouse_id", "delivery_partner_user_id", "delivery_date"], { name: "orders_wh_delivery_partner_delivery_date_idx" });
            await addIndex("payment_attempts", ["order_id", "attempt_no"], { name: "payment_attempts_order_attempt_idx", unique: true });
            await addIndex("payment_attempts", ["order_id", "created_at"], { name: "payment_attempts_order_created_idx" });
            await addIndex("payment_attempts", ["status"], { name: "payment_attempts_status_idx" });
            await addIndex("payment_attempts", ["provider", "provider_order_id"], {
                name: "payment_attempts_provider_order_id_uniq",
                unique: true,
                where: { provider_order_id: { [Sequelize.Op.ne]: null } },
            });
            await addIndex("payment_attempts", ["provider", "provider_payment_id"], {
                name: "payment_attempts_provider_payment_id_uniq",
                unique: true,
                where: { provider_payment_id: { [Sequelize.Op.ne]: null } },
            });
            await addIndex("order_items", ["order_id"], { name: "order_items_order_idx" });
            await addIndex("payments", ["order_id"], { name: "payments_order_idx" });
            await addIndex("payments", ["status"], { name: "payments_status_idx" });
            await addIndex("payments", ["provider", "provider_payment_id"], {
                name: "payments_provider_payment_id_uniq",
                unique: true,
                where: { provider_payment_id: { [Sequelize.Op.ne]: null } },
            });
            await addIndex("payments", ["provider", "provider_order_id"], {
                name: "payments_provider_order_id_uniq",
                unique: true,
                where: { provider_order_id: { [Sequelize.Op.ne]: null } },
            });
            await addIndex("payments", ["provider", "provider_event_id"], {
                name: "payments_provider_event_id_uniq",
                unique: true,
                where: { provider_event_id: { [Sequelize.Op.ne]: null } },
            });
            await addIndex("refunds", ["order_id"], { name: "refunds_order_idx" });
            await addIndex("order_status_history", ["order_id", "created_at"], { name: "order_status_history_order_created_idx" });
            await addIndex("order_status_events", ["order_id", "created_at"], { name: "order_status_events_order_id_created_at_idx" });
            await addIndex("notifications", ["status", "scheduled_at"], { name: "notifications_status_scheduled_at_idx" });
            await addIndex("notifications", ["user_id"], { name: "notifications_user_id_idx" });
            await addIndex("banners", ["placement", "is_active", "sort_order"], { name: "banners_active_order_idx" });
            await addIndex("scheduler_settings", ["job_name"], { name: "scheduler_settings_job_name_uniq", unique: true });
            await addIndex("job_runs", ["job_name", "run_key"], { name: "job_runs_job_name_run_key_uniq", unique: true });
            await addIndex("job_runs", ["job_name", "started_at"], { name: "job_runs_job_name_started_at_idx" });
            await addIndex("inventories", ["warehouse_id", "product_pack_id"], { name: "inventories_wh_pack_uniq", unique: true });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeConstraint("orders", "orders_current_payment_attempt_id_fkey", { transaction }).catch(() => {});

            const tables = [
                "cost_entries",
                "procurement_costs",
                "inventories",
                "job_runs",
                "scheduler_settings",
                "settings",
                "banners",
                "notifications",
                "order_status_events",
                "order_status_history",
                "refunds",
                "payments",
                "order_items",
                "payment_attempts",
                "orders",
                "deal_items",
                "deals",
                "cart_items",
                "carts",
                "user_warehouse_assignments",
                "warehouse_service_areas",
                "user_devices",
                "user_sessions",
                "otp_requests",
                "user_roles",
                "user_addresses",
                "product_images",
                "product_packs",
                "products",
                "delivery_slots",
                "categories",
                "warehouses",
                "users",
            ];

            for (const table of tables) {
                await queryInterface.dropTable(table, { transaction });
            }
        });
    },
};
