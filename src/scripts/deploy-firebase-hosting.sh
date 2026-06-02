#!/usr/bin/env bash
set -e

DEPLOY_PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-}}"

if [ -z "$DEPLOY_PROJECT_ID" ] && [ ! -f ".firebaserc" ]; then
    echo "Missing Firebase project configuration."
    echo "Set GCP_PROJECT_ID or PROJECT_ID, or create .firebaserc."
    exit 1
fi

if [ -n "$DEPLOY_PROJECT_ID" ]; then
    npx firebase-tools deploy --only hosting --project "$DEPLOY_PROJECT_ID"
else
    npx firebase-tools deploy --only hosting
fi
