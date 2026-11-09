#!/usr/bin/env bash
# Blue/green zero-downtime deploy for the NestJS API.
# Invoked by the Deploy workflow over SSH:
#   SWR_REGISTRY=... SWR_ORG=... IMAGE_NAME=... ./deploy.sh <image-tag>
# The three variables are optional: when given they are saved to .env, so the
# image reference always matches what CI pushed. Full runbook: README.md here
# (deploy/README.md in the repo).
#
# Flow:
#   pull new image into the IDLE color -> run migrations
#   -> start idle color & wait healthy -> switch nginx upstream -> stop old color
#
# Zero-downtime properties:
#   - The live container keeps serving during the entire deploy.
#   - nginx only switches after the new container passes /healthz/ready.
#   - A failed deploy never touches live traffic: the idle color is simply
#     stopped again and the script exits 1.
#   - Rollback after a successful switch = redeploy the previous tag via the
#     workflow_dispatch input (or: start old color, rewrite upstream, reload).
#
# Migrations are NOT reverted on failure (Prisma has no down migrations). The
# recovery path for a bad migration is Huawei RDS point-in-time recovery —
# automated backups + PITR MUST be enabled on the RDS instance (hard
# prerequisite, see README.md §2.3). Keep migrations backward-
# compatible with the previous release (expand/contract), since the old code
# briefly runs against the new schema.
#
# One-time server prerequisites: see README.md §2 (nginx upstream file, sudoers
# entries for nginx reload, SWR login, .env + api.env in this directory).

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/etc/nginx/conf.d/nest_api_upstream.conf}"

touch .env # created on the first deploy; deploy.sh manages its contents
[ -f api.env ] || { echo "ERROR: missing $APP_DIR/api.env (application env)"; exit 1; }

set_env_var() { # set_env_var KEY VALUE  (idempotent upsert into .env)
  if grep -qE "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

# Image reference passed by the workflow (optional when running by hand).
for var in SWR_REGISTRY SWR_ORG IMAGE_NAME; do
  if [ -n "${!var:-}" ]; then set_env_var "$var" "${!var}"; fi
done
for var in SWR_REGISTRY SWR_ORG IMAGE_NAME; do
  grep -qE "^$var=." .env || { echo "ERROR: $var is not set (pass it or add it to $APP_DIR/.env)"; exit 1; }
done

port_of() { [ "$1" = "blue" ] && echo 4001 || echo 4002; }
tag_var_of() { [ "$1" = "blue" ] && echo BLUE_TAG || echo GREEN_TAG; }

ACTIVE="$(grep -E '^ACTIVE_COLOR=' .env | cut -d= -f2- || true)"
case "$ACTIVE" in blue|green) ;; *) ACTIVE="" ;; esac # first deploy: no active color
if [ "$ACTIVE" = "blue" ]; then TARGET="green"; else TARGET="blue"; fi
TARGET_PORT="$(port_of "$TARGET")"

echo "==> Deploying tag $NEW_TAG to '$TARGET' (live: ${ACTIVE:-<none>})"

# --- failure handling: live traffic is never touched before the switch -------
SWITCHED=0
on_error() {
  if [ "$SWITCHED" -eq 1 ]; then
    # switch already happened; point nginx back at the old color
    echo "!!! Failure AFTER traffic switch — reverting nginx to '${ACTIVE:-<none>}'"
    if [ -n "$ACTIVE" ]; then
      printf 'upstream nest_api { server 127.0.0.1:%s; }\n' "$(port_of "$ACTIVE")" > "$UPSTREAM_CONF"
      sudo /usr/sbin/nginx -t && sudo /usr/bin/systemctl reload nginx \
        || echo "!!! nginx revert failed — manual intervention required"
    fi
  else
    echo "!!! Deploy FAILED before the traffic switch — '$ACTIVE' still serving, stopping '$TARGET'"
    docker compose stop "api-$TARGET" > /dev/null 2>&1 || true
  fi
  exit 1
}
trap on_error ERR

# --- 1. Point the idle color at the new tag and pull -------------------------
set_env_var "$(tag_var_of "$TARGET")" "$NEW_TAG"
echo "==> Pulling image"
docker compose pull "api-$TARGET"

# --- 2. Migrations (image bundles the prisma CLI and schema) -----------------
echo "==> Running prisma migrate deploy"
docker compose run --rm --no-deps "api-$TARGET" npx prisma migrate deploy

# --- 3. Start idle color and wait for its healthcheck (/healthz/ready) -------
echo "==> Starting api-$TARGET"
docker compose up -d --wait "api-$TARGET"

echo "==> Verifying http://127.0.0.1:$TARGET_PORT/healthz/ready"
curl -fsS --max-time 10 "http://127.0.0.1:$TARGET_PORT/healthz/ready" > /dev/null

# --- 4. Switch traffic (the only moment nginx config changes) ----------------
echo "==> Switching nginx upstream to $TARGET ($TARGET_PORT)"
printf 'upstream nest_api { server 127.0.0.1:%s; }\n' "$TARGET_PORT" > "$UPSTREAM_CONF"
sudo /usr/sbin/nginx -t
SWITCHED=1
sudo /usr/bin/systemctl reload nginx # graceful: existing connections finish on old workers

set_env_var ACTIVE_COLOR "$TARGET"

# --- 5. Retire the old color (kept stopped for instant manual rollback) ------
if [ -n "$ACTIVE" ]; then
  echo "==> Stopping api-$ACTIVE"
  docker compose stop "api-$ACTIVE"
fi

trap - ERR
echo "==> Deploy OK: $NEW_TAG live on '$TARGET'"
docker image prune -f > /dev/null || true
