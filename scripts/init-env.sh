#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

EXAMPLE_FILE="$ROOT_DIR/.env.example"
TARGET_FILE="${1:-$ROOT_DIR/.env}"
FORCE_FLAG="${2:-}"

if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "Грешка: недостаје .env.example" >&2
  exit 1
fi

if [ -f "$TARGET_FILE" ] && [ "$FORCE_FLAG" != "--force" ]; then
  echo "Грешка: $TARGET_FILE већ постоји. Користи --force ако желиш препис." >&2
  exit 1
fi

rand_alnum() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 24
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24
  fi
}

rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-$(rand_alnum)}"
ADMIN_COOKIE_SECRET_VALUE="${ADMIN_COOKIE_SECRET:-$(rand_hex)}"
CADDY_DOMAIN_VALUE="${CADDY_DOMAIN:-localhost}"
ACME_EMAIL_VALUE="${ACME_EMAIL:-admin@localhost}"

TMP_FILE="$TARGET_FILE.tmp"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ADMIN_PASSWORD=*)
      printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD_VALUE" ;;
    ADMIN_COOKIE_SECRET=*)
      printf 'ADMIN_COOKIE_SECRET=%s\n' "$ADMIN_COOKIE_SECRET_VALUE" ;;
    CADDY_DOMAIN=*)
      printf 'CADDY_DOMAIN=%s\n' "$CADDY_DOMAIN_VALUE" ;;
    ACME_EMAIL=*)
      printf 'ACME_EMAIL=%s\n' "$ACME_EMAIL_VALUE" ;;
    *)
      printf '%s\n' "$line" ;;
  esac
done < "$EXAMPLE_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$TARGET_FILE"
chmod 600 "$TARGET_FILE" 2>/dev/null || true

echo "Креиран је $TARGET_FILE"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD_VALUE"
echo "CADDY_DOMAIN=$CADDY_DOMAIN_VALUE"
