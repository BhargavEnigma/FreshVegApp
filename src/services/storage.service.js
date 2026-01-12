"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { env } = require("../config/env");
const { getSupabaseAdminClient } = require("../config/supabase");
const { AppError } = require("../utils/errors");
const {
    getPublicUrlForRelativePath,
    isLocalUploadUrl,
    localPathFromUploadUrl,
} = require("../utils/uploads");

function requireSupabaseConfig() {
    if (!env.supabase || !env.supabase.url || !env.supabase.serviceRoleKey) {
        throw new AppError(
            "SUPABASE_NOT_CONFIGURED",
            "Supabase is not configured. Set DB_HOST and SUPABASE_SERVICE_ROLE_KEY.",
            500
        );
    }
}

function buildLocalProductImageUrl(filename) {
    const rel = `/uploads/products/${filename}`;
    return getPublicUrlForRelativePath(rel);
}

function buildSupabaseObjectPath({ productId, originalName }) {
    const ext = path.extname(originalName || "").toLowerCase();
    const id = crypto.randomUUID();
    // Keep productId in the path to make cleanup easy
    return `products/${productId}/${id}${ext}`;
}

async function uploadProductImages({ productId, files }) {
    if (!files || !files.length) return [];

    const provider = String(env.storageProvider || "local").toLowerCase();

    if (provider === "supabase") {
        requireSupabaseConfig();
        const supabase = getSupabaseAdminClient();
        const bucket = env.supabase.bucket;

        const results = [];
        for (const f of files) {
            const objectPath = buildSupabaseObjectPath({ productId, originalName: f.originalname });
            const fileBuffer = fs.readFileSync(f.path);

            const { error } = await supabase.storage
                .from(bucket)
                .upload(objectPath, fileBuffer, {
                    contentType: f.mimetype || "application/octet-stream",
                    upsert: false,
                });

            // Always cleanup temp local file (multer saved it on disk)
            try {
                fs.rmSync(f.path, { force: true });
            } catch (_) {}

            if (error) {
                throw new AppError(
                    "SUPABASE_UPLOAD_FAILED",
                    `Failed to upload product image to Supabase: ${error.message}`,
                    500
                );
            }

            const pub = supabase.storage.from(bucket).getPublicUrl(objectPath);
            const publicUrl = pub?.data?.publicUrl;

            if (!publicUrl) {
                throw new AppError(
                    "SUPABASE_PUBLIC_URL_FAILED",
                    "Unable to compute public URL for uploaded image. Ensure the bucket is public.",
                    500
                );
            }

            results.push({
                provider: "supabase",
                url: publicUrl,
                storage_path: objectPath,
            });
        }

        return results;
    }

    // Default: local disk
    const results = [];
    for (const f of files) {
        results.push({
            provider: "local",
            url: buildLocalProductImageUrl(f.filename),
            storage_path: `uploads/products/${f.filename}`,
        });
    }
    return results;
}

async function deleteStoredObject({ provider, storagePath, imageUrl }) {
    const p = String(provider || "").toLowerCase();

    if (p === "supabase") {
        // best effort
        try {
            requireSupabaseConfig();
            const supabase = getSupabaseAdminClient();
            const bucket = env.supabase.bucket;

            if (storagePath) {
                await supabase.storage.from(bucket).remove([storagePath]);
            }
        } catch (_) {
            // do not throw on delete failures
        }
        return;
    }

    // local (either explicitly or inferred)
    try {
        if (storagePath) {
            // storagePath is like uploads/products/<file>
            const full = path.join(__dirname, "..", "..", storagePath);
            fs.rmSync(full, { force: true });
            return;
        }

        if (isLocalUploadUrl(imageUrl)) {
            const filePath = localPathFromUploadUrl(imageUrl);
            if (filePath) fs.rmSync(filePath, { force: true });
        }
    } catch (_) {
        // ignore
    }
}

module.exports = {
    uploadProductImages,
    deleteStoredObject,
};
