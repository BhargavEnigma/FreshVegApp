#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_PROJECT_ID="${GCP_PROJECT_ID:-${FIREBASE_PROJECT_ALIAS:-${PROJECT_ID:-}}}"
FIREBASE_CONFIG_PATH="${FIREBASE_CONFIG_FILE:-firebase.json}"

if [[ "$FIREBASE_CONFIG_PATH" != /* ]]; then
    FIREBASE_CONFIG_PATH="${REPO_ROOT}/${FIREBASE_CONFIG_PATH}"
fi

if [ -z "$DEPLOY_PROJECT_ID" ]; then
    echo "Missing Firebase deploy project. Set GCP_PROJECT_ID or FIREBASE_PROJECT_ALIAS." >&2
    exit 1
fi

if [ ! -f "$FIREBASE_CONFIG_PATH" ]; then
    echo "Firebase config file not found: $FIREBASE_CONFIG_PATH" >&2
    exit 1
fi

npx firebase-tools deploy \
    --only hosting \
    --project "$DEPLOY_PROJECT_ID" \
    --config "$FIREBASE_CONFIG_PATH"
