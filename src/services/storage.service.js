const fs = require("fs");
const path = require("path");
const { getSupabaseAdminClient } = require("../config/supabase");
const { env } = require("../config/env");
const {
    getUploadsRoot,
    getPublicUrlForRelativePath,
    ensureDir,
} = require("../utils/uploads");

function getSupabaseClient() {
    if (env.storageProvider !== "supabase") return null;
    return getSupabaseAdminClient();
}

async function getPublicOrSignedUrl({ storagePath }) {
    if (!storagePath) return null;

    if (env.storageProvider === "local") {
        return getPublicUrlForRelativePath(`/uploads/${storagePath}`);
    }

    const bucket = env.supabase.bucket;
    const supabase = getSupabaseClient();

    if (!supabase) return null;

    if (env.supabase.bucketIsPublic) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        return data?.publicUrl || null;
    }

    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60);

    if (error) return null;
    return data?.signedUrl || null;
}

function moveToLocalStorage({ localFilePath, storagePath }) {
    const uploadsRoot = getUploadsRoot();
    const finalPath = path.join(uploadsRoot, storagePath);

    ensureDir(path.dirname(finalPath));
    fs.renameSync(localFilePath, finalPath);

    return {
        path: storagePath,
        publicUrl: getPublicUrlForRelativePath(`/uploads/${storagePath}`),
    };
}

async function uploadToSupabase({ localFilePath, storagePath, mimeType }) {
    const bucket = env.supabase.bucket;
    const supabase = getSupabaseClient();

    if (!supabase) {
        throw new Error("Supabase storage is not configured");
    }

    const fileBuffer = fs.readFileSync(localFilePath);

    const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) throw error;

    try {
        fs.unlinkSync(localFilePath);
    } catch (_) {}

    const publicUrl = await getPublicOrSignedUrl({ storagePath });

    return {
        path: storagePath,
        publicUrl,
    };
}

async function uploadByProvider({ localFilePath, storagePath, mimeType }) {
    if (env.storageProvider === "local") {
        return moveToLocalStorage({ localFilePath, storagePath });
    }

    return uploadToSupabase({ localFilePath, storagePath, mimeType });
}

async function uploadProductImage({ localFilePath, fileName, mimeType, productId }) {
    const storagePath = `products/${productId}/${fileName}`;
    return uploadByProvider({ localFilePath, storagePath, mimeType });
}

async function uploadBannerImage({ localFilePath, fileName, mimeType, bannerId }) {
    const storagePath = `banners/${bannerId}/${fileName}`;
    return uploadByProvider({ localFilePath, storagePath, mimeType });
}

async function uploadCategoryImage({ localFilePath, fileName, mimeType, categoryId }) {
    const storagePath = `categories/${categoryId}/${fileName}`;
    return uploadByProvider({ localFilePath, storagePath, mimeType });
}

async function deleteStoredObject({ provider, storagePath }) {
    try {
        if (!provider || !storagePath) return { deleted: false };

        if (provider === "local") {
            const filePath = path.join(getUploadsRoot(), storagePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { deleted: true };
            }
            return { deleted: false };
        }

        if (provider === "supabase") {
            const supabase = getSupabaseClient();
            if (!supabase) return { deleted: false, error: "SUPABASE_NOT_CONFIGURED" };

            const bucket = env.supabase.bucket;
            const { error } = await supabase.storage.from(bucket).remove([storagePath]);

            if (error) {
                return { deleted: false, error: error.message || String(error) };
            }

            return { deleted: true };
        }

        return { deleted: false };
    } catch (e) {
        return { deleted: false, error: e?.message || String(e) };
    }
}

module.exports = {
    uploadProductImage,
    uploadBannerImage,
    uploadCategoryImage,
    deleteStoredObject,
    getPublicOrSignedUrl,
};