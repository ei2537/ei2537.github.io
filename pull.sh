#!/bin/bash
echo "[Git] Getting changes for Repository..."

# 他の fetch 情報をクリア
rm -f .git/FETCH_HEAD

# origin/main だけを取得
git fetch origin main

# rebase 実行
git rebase origin/main

echo "[Git] Done."
