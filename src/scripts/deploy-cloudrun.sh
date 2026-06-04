#!/usr/bin/env bash
set -euo pipefail

if [ -f ".env.cloudrun" ]; then
    set -a
    source .env.cloudrun
    set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-}}"
REGION="${GCP_REGION:-${REGION:-}}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-${SERVICE_NAME:-}}"

export GCP_PROJECT_ID="${PROJECT_ID}"
export GCP_REGION="${REGION}"
export CLOUD_RUN_SERVICE="${SERVICE_NAME}"

require_env_var() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        echo "Missing required GitHub Environment variable: ${name}" >&2
        exit 1
    fi
}

set_default_if_empty() {
    local name="$1"
    local default_value="$2"
    if [ -z "${!name:-}" ]; then
        export "${name}=${default_value}"
    fi
}

append_env_if_set() {
    local name="$1"
    local value="${!name:-}"
    if [ -n "$value" ]; then
        ENV_VARS+=("${name}=${value}")
    fi
}

append_secret() {
    local name="$1"
    SECRET_VARS+=("${name}=${name}:latest")
}

choose_delimiter() {
    local values=("$@")
    local candidates=("@@__@@" "|~|" "#=#" "___DELIM___")
    local delimiter
    local candidate
    local value

    for candidate in "${candidates[@]}"; do
        delimiter="$candidate"
        for value in "${values[@]}"; do
            if [[ "$value" == *"$delimiter"* ]]; then
                delimiter=""
                break
            fi
        done
        if [ -n "$delimiter" ]; then
            printf '%s' "$delimiter"
            return 0
        fi
    done

    echo "Unable to find a safe delimiter for gcloud env/secrets arguments." >&2
    exit 1
}

join_with_delimiter() {
    local delimiter="$1"
    shift

    local item
    local joined=""
    local first="true"

    for item in "$@"; do
        if [ "$first" = "true" ]; then
            joined="$item"
            first="false"
        else
            joined="${joined}${delimiter}${item}"
        fi
    done

    printf '%s' "$joined"
}

require_env_var "GCP_PROJECT_ID"
require_env_var "GCP_REGION"
require_env_var "CLOUD_RUN_SERVICE"
require_env_var "NODE_ENV"
require_env_var "DB_HOST"
require_env_var "DB_PORT"
require_env_var "DB_NAME"
require_env_var "DB_USER"
require_env_var "DB_SSL"
require_env_var "STORAGE_PROVIDER"
require_env_var "MSG91_TEMPLATE_ID"
require_env_var "CORS_ORIGINS"

if [ "${STORAGE_PROVIDER}" = "supabase" ]; then
    require_env_var "SUPABASE_URL"
fi

set_default_if_empty "SUPABASE_STORAGE_BUCKET" "product-images"
set_default_if_empty "SUPABASE_BUCKET_PUBLIC" "true"
set_default_if_empty "JWT_ACCESS_EXPIRES_IN" "15m"
set_default_if_empty "JWT_REFRESH_EXPIRES_IN_DAYS" "30"
set_default_if_empty "MSG91_REALTIME_RESPONSE" "1"
set_default_if_empty "OTP_EXPIRY_MINUTES" "5"
set_default_if_empty "OTP_LENGTH" "4"
set_default_if_empty "OTP_BYPASS_ENABLED" "false"
set_default_if_empty "ENABLE_NOTIFICATIONS_WORKER" "false"
set_default_if_empty "ENABLE_SCHEDULER" "false"
set_default_if_empty "NOTIFICATION_MAX_ATTEMPTS" "3"
set_default_if_empty "GEMINI_MODEL" "gemini-2.0-flash"
set_default_if_empty "JOB_RUN_STALE_MS" "900000"
set_default_if_empty "UPLOADS_DIR" "uploads"

gcloud config set project "$PROJECT_ID"

ENV_VARS=()
append_env_if_set "NODE_ENV"
append_env_if_set "DB_HOST"
append_env_if_set "DB_PORT"
append_env_if_set "DB_NAME"
append_env_if_set "DB_USER"
append_env_if_set "DB_SSL"
append_env_if_set "SUPABASE_URL"
append_env_if_set "STORAGE_PROVIDER"
append_env_if_set "SUPABASE_STORAGE_BUCKET"
append_env_if_set "SUPABASE_BUCKET_PUBLIC"
append_env_if_set "DB_SYNC_MODE"
append_env_if_set "JWT_ACCESS_EXPIRES_IN"
append_env_if_set "JWT_REFRESH_EXPIRES_IN_DAYS"
append_env_if_set "MSG91_TEMPLATE_ID"
append_env_if_set "MSG91_BASE_URL"
append_env_if_set "MSG91_REALTIME_RESPONSE"
append_env_if_set "OTP_EXPIRY_MINUTES"
append_env_if_set "OTP_LENGTH"
append_env_if_set "OTP_BYPASS_ENABLED"
append_env_if_set "OTP_BYPASS_ALLOWED_PHONES"
append_env_if_set "RAZORPAY_KEY_ID"
append_env_if_set "RAZORPAY_TEST_CHECKOUT_PAGE_ENABLED"
append_env_if_set "ENABLE_NOTIFICATIONS_WORKER"
append_env_if_set "ENABLE_SCHEDULER"
append_env_if_set "NOTIFICATION_MAX_ATTEMPTS"
append_env_if_set "ORDER_LOCK_DAYS_AHEAD"
append_env_if_set "GEMINI_MODEL"
append_env_if_set "JOB_RUN_STALE_MS"
append_env_if_set "UPLOADS_DIR"
append_env_if_set "CORS_ORIGINS"

SECRET_VARS=()
append_secret "DB_PASSWORD"
append_secret "FIREBASE_SERVICE_ACCOUNT_JSON"
append_secret "GEMINI_API_KEY"
append_secret "INTERNAL_JOB_SECRET"
append_secret "JWT_ACCESS_SECRET"
append_secret "JWT_REFRESH_SECRET"
append_secret "MSG91_AUTH_KEY"
append_secret "OTP_BYPASS_CODE"
append_secret "RAZORPAY_KEY_SECRET"
append_secret "RAZORPAY_WEBHOOK_SECRET"

if [ "${STORAGE_PROVIDER}" = "supabase" ]; then
    append_secret "SUPABASE_SERVICE_ROLE_KEY"
fi

ENV_DELIMITER="$(choose_delimiter "${ENV_VARS[@]}")"
SECRET_DELIMITER="$(choose_delimiter "${SECRET_VARS[@]}")"
ENV_ARG="^${ENV_DELIMITER}^$(join_with_delimiter "${ENV_DELIMITER}" "${ENV_VARS[@]}")"
SECRET_ARG="^${SECRET_DELIMITER}^$(join_with_delimiter "${SECRET_DELIMITER}" "${SECRET_VARS[@]}")"

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "$ENV_ARG" \
    --set-secrets "$SECRET_ARG"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format='value(status.url)')"

gcloud run services update "$SERVICE_NAME" \
    --region "$REGION" \
    --update-env-vars "PUBLIC_BASE_URL=${SERVICE_URL}"

echo "Cloud Run deployed:"
echo "$SERVICE_URL"
echo "Health:"
echo "$SERVICE_URL/v1/health"
