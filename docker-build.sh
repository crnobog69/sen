#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
timestamp=$(TZ=Europe/Belgrade date +'%d.%m.%Y_%H-%M-%S')
if [[ ${1:-} == --local ]]; then
  docker build -t "sen:$timestamp" -t "sen:latest" .
  exit
fi

# The Gitcrn remote in this checkout. Validate all push URLs before making a release.
remote=origin
if git remote | grep -qx gitcrn; then remote=gitcrn; fi
urls=$(git remote get-url --all --push "$remote")
while IFS= read -r url; do
  if [[ ! "$url" =~ ^(([[:alnum:]_.-]+@)?(gitcrn|100\.91\.132\.35):|((https?|ssh)://)([[:alnum:]_.-]+@)?(gitcrn|100\.91\.132\.35)(:[0-9]+)?/) ]]; then
    echo "Remote '$remote' ne pokazuje na Gitcrn." >&2
    exit 1
  fi
done <<< "$urls"
branch=$(git symbolic-ref --short HEAD)
message="${timestamp%_*}. ${timestamp#*_}"
message=${message//-/:}
git add -A
if ! git diff --cached --quiet; then git commit -m "${1:-$message}"; fi
git tag "$timestamp"
git push --atomic "$remote" "HEAD:refs/heads/$branch" "refs/tags/$timestamp"
