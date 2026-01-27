const fs = require("fs");
const { getSupabaseAdminClient } = require("../config/supabase");
const { env } = require("../config/env");

const supabase = getSupabaseAdminClient();

async function getPublicOrSignedUrl({ storagePath }) {
    const bucket = env.supabase.bucket;

    if (!storagePath) return null;

    if (env.supabase.bucketIsPublic) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        return data?.publicUrl || null;
    }

    // Private bucket => signed URL
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60); // 1 hour
    if (error) return null;
    return data?.signedUrl || null;
}

async function uploadProductImage({ localFilePath, fileName, mimeType, productId }) {
    const bucket = env.supabase.bucket;
    const storagePath = `products/${productId}/${fileName}`;

    const fileBuffer = fs.readFileSync(localFilePath);

    const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) throw error;

    const url = await getPublicOrSignedUrl({ storagePath });

    return {
        path: storagePath,
        publicUrl: url,
    };
}

async function deleteStoredObject({ provider, storagePath }) {
    try {
        if (!provider) return { deleted: false };
        if (provider !== "supabase") return { deleted: false };
        if (!storagePath) return { deleted: false };

        const bucket = env.supabase.bucket;

        const { error } = await supabase.storage.from(bucket).remove([storagePath]);
        if (error) {
            // do not crash image deletion because storage remove failed
            return { deleted: false, error: error.message || String(error) };
        }
        return { deleted: true };
    } catch (e) {
        return { deleted: false, error: e?.message || String(e) };
    }
}

async function uploadBannerImage({ localFilePath, fileName, mimeType, bannerId }) {
    const bucket = env.supabase.bucket;
    const storagePath = `banners/${bannerId}/${fileName}`;

    const fileBuffer = fs.readFileSync(localFilePath);

    const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) throw error;

    const url = await getPublicOrSignedUrl({ storagePath });

    return {
        path: storagePath,
        publicUrl: url,
    };
}

async function uploadCategoryImage({ localFilePath, fileName, mimeType, categoryId }) {
    const bucket = env.supabase.bucket;
    const storagePath = `categories/${categoryId}/${fileName}`;

    const fileBuffer = fs.readFileSync(localFilePath);

    const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
    });

    if (error) throw error;

    const url = await getPublicOrSignedUrl({ storagePath });

    return { path: storagePath, publicUrl: url };
}


module.exports = {
    uploadProductImage,
    uploadBannerImage,
    deleteStoredObject,
    getPublicOrSignedUrl,
    uploadCategoryImage
};
