"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { env } = require("../config/env");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function getProjectRoot() {
    // src/utils -> src -> project root
    return path.join(__dirname, "..", "..");
}

function getUploadsRoot() {
    return path.join(getProjectRoot(), env.uploadsDir || "uploads");
}

function getPublicUrlForRelativePath(relativePath) {
    // relativePath should start with /uploads/...
    if (!relativePath.startsWith("/")) {
        relativePath = `/${relativePath}`;
    }

    if (env.publicBaseUrl) {
        return `${env.publicBaseUrl.replace(/\/$/, "")}${relativePath}`;
    }
    return relativePath;
}

function randomFileName(originalName) {
    const ext = path.extname(originalName || "").toLowerCase();
    const id = crypto.randomUUID();
    return `${id}${ext}`;
}

function isLocalUploadUrl(url) {
    return typeof url === "string" && (url.startsWith("/uploads/") || url.includes("/uploads/"));
}

function localPathFromUploadUrl(url) {
    // Accept either absolute (PUBLIC_BASE_URL + /uploads/..) or relative (/uploads/..)
    const idx = url.indexOf("/uploads/");
    if (idx === -1) return null;

    const rel = url.substring(idx + 1); // remove leading '/'
    return path.join(getProjectRoot(), rel);
}

module.exports = {
    ensureDir,
    getUploadsRoot,
    getPublicUrlForRelativePath,
    randomFileName,
    isLocalUploadUrl,
    localPathFromUploadUrl,
};
