#!/usr/bin/env bash
set -euo pipefail

: "${FIREBASE_PROJECT_ALIAS:?Missing FIREBASE_PROJECT_ALIAS}"
: "${FIREBASE_CONFIG_FILE:?Missing FIREBASE_CONFIG_FILE}"

firebase deploy \
    --only hosting \
    --project "$FIREBASE_PROJECT_ALIAS" \
    --config "$FIREBASE_CONFIG_FILE"