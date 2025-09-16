#!/bin/bash
DIR=$(pwd)

echo "[Git] Working in $DIR..."
cd "$DIR" || exit 1

echo "[Git] Staging changes for personal repo..."
git add .

if git diff --cached --quiet; then
    echo "[Git] No changes to commit in personal repo."
else
    read -p "Commit Message (personal): " msg
    [[ -z "$msg" ]] && msg="Auto Update $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$msg"
fi

echo "[Git] Pushing to personal origin..."
git push origin main

echo "[Git] Done."
