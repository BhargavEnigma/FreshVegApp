"use strict";

const multer = require("multer");
const path = require("path");

const { ensureDir, getUploadsRoot, randomFileName } = require("../utils/uploads");

function buildProductImagesUploader() {
    const uploadsRoot = getUploadsRoot();
    const productDir = path.join(uploadsRoot, "products");
    ensureDir(productDir);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, productDir);
        },
        filename: (req, file, cb) => {
            cb(null, randomFileName(file.originalname));
        },
    });

    const fileFilter = (req, file, cb) => {
        const type = String(file.mimetype || "").toLowerCase();
        if (type.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Only image uploads are allowed"));
    };

    return multer({
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB per image
            files: 10,
        },
    });
}

function buildBannerImagesUploader() {
    const uploadsRoot = getUploadsRoot();
    const bannerDir = path.join(uploadsRoot, "banners");
    ensureDir(bannerDir);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, bannerDir);
        },
        filename: (req, file, cb) => {
            cb(null, randomFileName(file.originalname));
        },
    });

    const fileFilter = (req, file, cb) => {
        const type = String(file.mimetype || "").toLowerCase();
        if (type.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Only image uploads are allowed"));
    };

    return multer({
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: 5,
        },
    });
}

const productImagesUpload = buildProductImagesUploader();
const bannerImagesUpload = buildBannerImagesUploader();

module.exports = {
    productImagesUpload,
    bannerImagesUpload
};
