#!/usr/bin/env bash
set -e

if [ ! -f ".firebaserc" ]; then
    echo "Missing .firebaserc"
    echo "Create it using: cp .firebaserc.example .firebaserc"
    exit 1
fi

firebase deploy --only hosting
