#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$REPO_ROOT"

PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-}}"
REGION="${GCP_REGION:-${REGION:-}}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-${SERVICE_NAME:-}}"
DEPLOY_PROJECT_ID="${PROJECT_ID:-${FIREBASE_PROJECT_ALIAS:-}}"
FIREBASE_CONFIG_PATH="${FIREBASE_CONFIG_FILE:-firebase.json}"

if [[ "$FIREBASE_CONFIG_PATH" != /* ]]; then
    FIREBASE_CONFIG_PATH="${REPO_ROOT}/${FIREBASE_CONFIG_PATH}"
fi

MISSING_VARS=()
MISSING_FILES=()

require_var() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        MISSING_VARS+=("$name")
    fi
}

require_file() {
    local path="$1"
    if [ ! -f "$path" ]; then
        MISSING_FILES+=("$path")
    fi
}

require_dir() {
    local path="$1"
    if [ ! -d "$path" ]; then
        MISSING_FILES+=("$path")
    fi
}

require_var "GCP_PROJECT_ID"
require_var "GCP_REGION"
require_var "CLOUD_RUN_SERVICE"
require_var "NODE_ENV"
require_var "DB_HOST"
require_var "DB_PORT"
require_var "DB_NAME"
require_var "DB_USER"
require_var "DB_SSL"
require_var "STORAGE_PROVIDER"
require_var "MSG91_TEMPLATE_ID"
require_var "CORS_ORIGINS"

if [ "${STORAGE_PROVIDER:-}" = "supabase" ]; then
    require_var "SUPABASE_URL"
fi

if [ -z "$DEPLOY_PROJECT_ID" ]; then
    MISSING_VARS+=("GCP_PROJECT_ID or FIREBASE_PROJECT_ALIAS")
fi

require_file "${REPO_ROOT}/package.json"
require_file "${REPO_ROOT}/src/scripts/deploy-cloudrun.sh"
require_file "${REPO_ROOT}/src/scripts/deploy-firebase-hosting.sh"
require_file "$FIREBASE_CONFIG_PATH"
require_dir "${REPO_ROOT}/public"

if [ "${#MISSING_VARS[@]}" -gt 0 ] || [ "${#MISSING_FILES[@]}" -gt 0 ]; then
    echo "Deployment preflight failed." >&2

    if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
        echo "Missing GitHub Environment variables:" >&2
        for name in "${MISSING_VARS[@]}"; do
            echo "  - ${name}" >&2
        done
    fi

    if [ "${#MISSING_FILES[@]}" -gt 0 ]; then
        echo "Missing required repository files/directories:" >&2
        for path in "${MISSING_FILES[@]}"; do
            echo "  - ${path}" >&2
        done
    fi

    exit 1
fi

echo "Deployment preflight passed."
echo "Cloud Run service: ${SERVICE_NAME}"
echo "GCP project: ${PROJECT_ID}"
echo "Firebase config: ${FIREBASE_CONFIG_PATH}"
