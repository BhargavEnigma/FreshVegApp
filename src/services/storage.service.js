const fs = require("fs");
const {getSupabaseAdminClient} = require("../config/supabase");
const { env } = require("../config/env");

const supabase = getSupabaseAdminClient();

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

    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

    return {
        path: storagePath,
        publicUrl: data.publicUrl,
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

module.exports = {
    uploadProductImage,
    deleteStoredObject
};
