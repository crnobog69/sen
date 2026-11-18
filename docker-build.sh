#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

timestamp=$(TZ=Europe/Belgrade date +'%d.%m.%Y_%H-%M-%S')
if [[ ${1:-} == --local ]]; then
  docker build -t "sen:$timestamp" -t "sen:latest" .
  exit
fi

for remote in gitcrn github; do
  git remote get-url "$remote" >/dev/null
done
branch=$(git symbolic-ref --short HEAD)
message="${timestamp%_*}. ${timestamp#*_}"
message=${message//-/:}

git add -A
if ! git diff --cached --quiet; then git commit -m "${1:-$message}"; fi
commit=$(git rev-parse HEAD)
git tag "$timestamp" "$commit"

failed=0
for remote in gitcrn github; do
  if ! git push --atomic "$remote" "$commit:refs/heads/$branch" "refs/tags/$timestamp"; then
    echo "Slanje na $remote nije uspelo. Lokalni tag je $timestamp." >&2
    failed=1
  fi
done
exit "$failed"
