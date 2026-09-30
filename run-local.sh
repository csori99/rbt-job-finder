#!/bin/zsh
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" >/dev/null 2>&1
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
echo "=== $(date) ==="
git pull --rebase --autostash -q origin main || echo "pull failed, continuing"
yarn -s install --frozen-lockfile >/dev/null
node src/scrape.mjs || { echo "scrape failed"; exit 1; }
for f in docs/jobs.json data/discards.json data/jsearch-cache.json; do [ -f "$f" ] && git add "$f"; done
git diff --cached --quiet && { echo "no changes"; exit 0; }
git commit -qm "fix: update jobs" && git push -q origin main && echo "pushed"
