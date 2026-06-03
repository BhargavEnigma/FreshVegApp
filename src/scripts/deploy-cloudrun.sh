#!/usr/bin/env bash
set -e

if [ -f ".env.cloudrun" ]; then
    set -a
    source .env.cloudrun
    set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-}}"
REGION="${GCP_REGION:-${REGION:-}}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-${SERVICE_NAME:-}}"

if [ -z "$PROJECT_ID" ] || [ -z "$REGION" ] || [ -z "$SERVICE_NAME" ]; then
    echo "Missing Cloud Run deployment configuration."
    echo "Set GCP_PROJECT_ID, GCP_REGION, and CLOUD_RUN_SERVICE"
    echo "or provide PROJECT_ID, REGION, and SERVICE_NAME via .env.cloudrun."
    exit 1
fi

gcloud config set project "$PROJECT_ID"

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars NODE_ENV="${NODE_ENV:-production}",DB_HOST="$DB_HOST",DB_PORT="$DB_PORT",DB_NAME="$DB_NAME",DB_USER="$DB_USER",DB_SSL="$DB_SSL",STORAGE_PROVIDER="$STORAGE_PROVIDER",SUPABASE_URL="$SUPABASE_URL",SUPABASE_STORAGE_BUCKET="$SUPABASE_STORAGE_BUCKET",SUPABASE_BUCKET_PUBLIC="$SUPABASE_BUCKET_PUBLIC",RAZORPAY_KEY_ID="$RAZORPAY_KEY_ID",MSG91_TEMPLATE_ID="$MSG91_TEMPLATE_ID",OTP_BYPASS_ENABLED="$OTP_BYPASS_ENABLED",ENABLE_SCHEDULER="$ENABLE_SCHEDULER",ENABLE_NOTIFICATIONS_WORKER="$ENABLE_NOTIFICATIONS_WORKER",CORS_ORIGINS="$CORS_ORIGINS" \
    --set-secrets DB_PASSWORD=DB_PASSWORD:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,MSG91_AUTH_KEY=MSG91_AUTH_KEY:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,INTERNAL_JOB_SECRET=INTERNAL_JOB_SECRET:latest

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format='value(status.url)')

gcloud run services update "$SERVICE_NAME" \
    --region "$REGION" \
    --update-env-vars PUBLIC_BASE_URL="$SERVICE_URL"

echo "Cloud Run deployed:"
echo "$SERVICE_URL"
echo "Health:"
echo "$SERVICE_URL/v1/health"
