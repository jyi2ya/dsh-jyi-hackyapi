#!/usr/bin/env bash
# 把构建产物推成一条单提交的发布分支。
#
# 用法：scripts/publish-dist.sh [--dry-run] [--branch=dist] [--remote=origin]
set -euo pipefail

BRANCH="${DIST_BRANCH:-dist}"
REMOTE="${DIST_REMOTE:-origin}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --branch=*) BRANCH="${arg#*=}" ;;
    --remote=*) REMOTE="${arg#*=}" ;;
    -h|--help)
      sed -n '2,5p' "$0"
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v npm >/dev/null 2>&1 || { echo "npm not found" >&2; exit 1; }
[ -f package.json ] || { echo "package.json not found in $ROOT" >&2; exit 1; }

echo "==> build"
rm -rf dist
npm run build

[ -d dist ] && [ -n "$(ls -A dist)" ] || { echo "dist/ is empty after build" >&2; exit 1; }

VERSION="$(node -p "require('./package.json').version")"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> stage $BRANCH"
git init -q "$TMP"
git -C "$TMP" config user.name "$(git config user.name || echo dist)"
git -C "$TMP" config user.email "$(git config user.email || echo dist@localhost)"
cp -r dist "$TMP/dist"
[ -d client ] && cp -r client "$TMP/client"
cp package.json LICENSE cordis.patch.yml "$TMP/"
[ -f README.md ] && cp README.md "$TMP/"
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "dist: ${VERSION} (${SHA})"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> dry run: would push to ${REMOTE}/${BRANCH}"
  git -C "$TMP" log --oneline
  git -C "$TMP" ls-files
  exit 0
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "remote '${REMOTE}' is not configured; run git remote add or pass --remote=" >&2
  exit 1
fi

URL="$(git remote get-url "$REMOTE")"
git -C "$TMP" push -f "$URL" "HEAD:${BRANCH}"
echo "==> pushed ${BRANCH} (${VERSION}, single commit)"
