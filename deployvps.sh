#!/usr/bin/env bash
# Canonical local launcher for SocialToSite production deployment.
# Usage: ./deployvps.sh [optional commit message]
# This script NEVER touches Docker. GitHub Actions performs build + FTP upload.
set -euo pipefail

fail() { echo "deployvps ERROR: $*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is required"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run inside the socialtosite git repository"
cd "$ROOT"

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in
  *mrrmrc/socialtosite*) ;;
  *) fail "origin is not mrrmrc/socialtosite ($REMOTE_URL)" ;;
esac

BRANCH="$(git branch --show-current)"
[ "$BRANCH" = "main" ] || fail "deployvps publishes main only; current branch is '$BRANCH'"

echo "== deployvps: saving local work =="
git status --short

echo "== deployvps: synchronize main before committing =="
# Do not overwrite local work. If main moved remotely, rebase only after saving
# current changes in a local commit below; the later pull --rebase handles it.

git add -A
if git diff --cached --quiet; then
  echo "No uncommitted changes to save."
else
  MSG="${*:-Update production}"
  case "$MSG" in
    *'[deployvps]'*) ;;
    *) MSG="$MSG [deployvps]" ;;
  esac
  git commit -m "$MSG"
fi

# If there were no local changes, create an explicit marker commit so that
# deployvps always has an auditable deployment request and triggers the workflow.
HEAD_MSG="$(git log -1 --pretty=%B)"
if [[ "$HEAD_MSG" != *"[deployvps]"* ]]; then
  git commit --allow-empty -m "Deploy current main to VPS [deployvps]"
fi

echo "== deployvps: update from origin/main without discarding local commits =="
git pull --rebase origin main

# Rebase can rewrite the marker commit but preserves its message.
HEAD_MSG="$(git log -1 --pretty=%B)"
[[ "$HEAD_MSG" == *"[deployvps]"* ]] || fail "HEAD lost [deployvps] marker after rebase"

echo "== deployvps: push main; GitHub Actions will build and FTP-upload =="
git push origin main

echo "deployvps requested successfully."
echo "Production target: https://213.32.22.252/"
echo "No Docker command was executed."
