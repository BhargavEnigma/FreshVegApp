"use strict";

const { createClient } = require("@supabase/supabase-js");

const { env } = require("./env");
const { AppError } = require("../utils/errors");

let client = null;

function ensureSupabaseConfigured() {
    if (!env.supabase || !env.supabase.url || !env.supabase.serviceRoleKey) {
        throw new AppError(
            "SUPABASE_NOT_CONFIGURED",
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            500
        );
    }
}

function getSupabaseAdminClient() {
    if (client) {
        return client;
    }

    ensureSupabaseConfigured();

    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    return client;
}

module.exports = {
    getSupabaseAdminClient,
};