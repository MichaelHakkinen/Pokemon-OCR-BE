# Deployment guide

How this API is built, shipped and run in production: GitHub Actions builds a
Docker image, pushes it to Huawei Cloud **SWR** (container registry), then
SSHes into the server and runs [`deploy.sh`](deploy.sh), which does a
**blue/green** switch behind nginx with no downtime.

```
push to main ──► CI (lint, unit, build, e2e) ──► build image ──► push to SWR
                                                                     │
server:  nginx ──► api-blue  (127.0.0.1:4001)  ◄── deploy.sh pulls,  │
               └─► api-green (127.0.0.1:4002)      migrates, health- ◄┘
                                                   checks, switches
```

Docker deploys are **off by default** (`DOCKER_ENABLED=false`). Until you
turn them on, pushes to `main` only run the checks.

Contents:
1. [Overview](#1-overview)
2. [One-time server setup](#2-one-time-server-setup)
3. [Repository configuration](#3-repository-configuration)
4. [First deploy](#4-first-deploy)
5. [Everyday deploys](#5-everyday-deploys)
6. [Rollback](#6-rollback)
7. [Migrations](#7-migrations)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

| Piece | Where | Notes |
|---|---|---|
| Workflows | `.github/workflows/ci.yaml`, `deploy.yaml`, `ci-config.yaml` | `deploy.yaml` runs on push to `main` and on manual *Run workflow* |
| Settings | `.github/ci.env` | `DOCKER_ENABLED`, `SWR_ORG`, `IMAGE_NAME`, `DEPLOY_DIR` (a repository variable of the same name overrides) |
| Secrets | GitHub → Settings → Secrets and variables → Actions | registry login + SSH, see [§3](#3-repository-configuration) |
| Server files | `$DEPLOY_DIR` (default `/opt/app/api`) | `docker-compose.yml`, `deploy.sh` (shipped by CI), `.env` (managed by `deploy.sh`), `api.env` (yours) |
| Image | `<SWR_REGISTRY>/<SWR_ORG>/<IMAGE_NAME>:<short-sha>` | one immutable tag per commit |

What `deploy.sh <tag>` does, in order:

1. Writes the new tag for the **idle** color (`BLUE_TAG` / `GREEN_TAG`) to `.env` and pulls it.
2. Runs `prisma migrate deploy` in a one-off container of the new image.
3. Starts the idle color and waits for `GET /healthz/ready` (database + Redis).
4. Rewrites the nginx upstream to the new color and reloads nginx (graceful).
5. Stops the old color (kept, so a manual rollback is instant). The app
   shuts down gracefully on SIGTERM: queued OTP emails finish sending before
   the database and Redis connections close.

If anything fails **before** step 4, live traffic is untouched: the idle color
is stopped and the script exits 1. If it fails **after** the switch, nginx is
pointed back at the old color.

---

## 2. One-time server setup

Tested assumptions: a Linux host with Docker Engine + the Compose plugin,
nginx on the host, PostgreSQL (e.g. Huawei RDS) and Redis reachable from the
host. Commands use `/opt/app/api` — use your `DEPLOY_DIR`.

### 2.1 Deploy user and Docker

```bash
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy           # run docker without sudo
sudo mkdir -p /opt/app/api && sudo chown deploy:deploy /opt/app/api
```

Give the GitHub runner SSH access as `deploy` (key-only auth). Put the public
key in `/home/deploy/.ssh/authorized_keys`; the private key becomes the
`SERVER_SSH_KEY` secret. Never use `root`.

### 2.2 Application environment (`api.env`) and `.env`

Two env files live in `$DEPLOY_DIR`, **not in git**:

- **`api.env`** — the application's environment, read by both containers
  (`env_file` in the compose file). Start from the repo's `.env.example`.
  ```bash
  sudo -u deploy nano /opt/app/api/api.env
  chmod 600 /opt/app/api/api.env
  ```
  Production essentials:
  ```env
  APP_ENV=production
  DATABASE_URL=postgresql://user:pass@db-host:5432/app
  # 32+ characters: openssl rand -hex 32 — the app won't start otherwise
  JWT_SECRET_KEY=...
  # one nginx in front of the app
  TRUST_PROXY=1
  # Redis running on the host (see §2.6)
  REDIS_HOST=host.docker.internal
  APP_URL=https://api.example.com
  ALLOWED_ORIGINS=https://admin.example.com
  ```
  Rules for this file (Docker reads it literally):
  - **Comments on their own line.** Docker keeps an inline `# ...` as part of
    the value, so `SYSTEM_LOG=true # note` reads as off.
  - On/off settings (`SYSTEM_LOG`, `ERROR_LOG`, `EXECUTE_CRON`, …) are on only
    for `true` (any case).
  - **Set `REDIS_HOST` explicitly.** Empty means "no Redis" (in-memory store),
    which is per container — during the blue/green overlap the two colors
    would then not share rate limits or caches.
  - **`EXECUTE_CRON=true` on one host only.** Both colors share `api.env`, so
    scheduled jobs briefly run in both during a switch; keep jobs idempotent.
  - The app validates everything at startup and lists what is wrong; a bad
    value fails the health check, so the deploy stops before the switch.
- **`.env`** — compose variables (`SWR_REGISTRY`, `SWR_ORG`, `IMAGE_NAME`,
  `BLUE_TAG`, `GREEN_TAG`, `ACTIVE_COLOR`). Created and maintained by
  `deploy.sh`; don't edit it by hand except for rollback ([§6](#6-rollback)).

### 2.3 Database backups (required)

Prisma has **no down migrations**: `deploy.sh` never reverts a migration. The
recovery path for a bad migration is restoring the database, so before the
first deploy:

- Enable **automated backups + point-in-time recovery (PITR)** on the database
  (on Huawei RDS: the instance's automated backup policy).
- Check that you can actually restore to a new instance.

### 2.4 nginx

`deploy.sh` switches traffic by rewriting one file and reloading nginx.

1. Create the upstream file, owned by `deploy` (the script writes it without sudo):
   ```bash
   echo 'upstream nest_api { server 127.0.0.1:4001; }' | sudo tee /etc/nginx/conf.d/nest_api_upstream.conf
   sudo chown deploy:deploy /etc/nginx/conf.d/nest_api_upstream.conf
   ```
2. A site config that proxies to it, e.g. `/etc/nginx/sites-available/api`:
   ```nginx
   server {
       listen 443 ssl;
       server_name api.example.com;
       # ssl_certificate / ssl_certificate_key: e.g. from certbot

       client_max_body_size 60m;            # banner videos up to 50 MB

       location / {
           proxy_pass         http://nest_api;
           proxy_set_header   Host $host;
           # Must be set: with TRUST_PROXY=1 the app takes the client IP from here
           proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header   X-Forwarded-Proto $scheme;
           proxy_set_header   X-Request-Id $request_id;
       }
   }
   ```
   Enable it and check: `sudo nginx -t && sudo systemctl reload nginx`.

Both app ports are bound to `127.0.0.1` in the compose file — nginx is the
only public entry point.

### 2.5 sudo for nginx reload

`deploy.sh` needs exactly two privileged commands. Allow only those
(`sudo visudo -f /etc/sudoers.d/deploy-nginx`):

```
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
```

Check the paths with `command -v nginx systemctl` and adjust if they differ.

### 2.6 Redis

Run Redis on the host, bound to localhost, e.g.:

```bash
docker run -d --name redis --restart unless-stopped \
  -p 127.0.0.1:6379:6379 redis:7 redis-server --appendonly yes
```

Containers reach it via `host.docker.internal` (mapped in the compose file),
so set `REDIS_HOST=host.docker.internal` in `api.env`. A managed Redis works
too — point `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` at it.

### 2.7 Registry login on the server

`deploy.sh` pulls images but does not log in. Log the `deploy` user in to SWR
once (the credentials are stored in `~/.docker/config.json`):

```bash
# as the deploy user; reads the key from stdin so it doesn't land in shell history
echo '<login-key>' | docker login swr.<region>.myhuaweicloud.com -u '<region>@<AK>' --password-stdin
```

Use a **long-term login key** (see [§3.1](#31-huawei-swr)); temporary ones
expire after 24 h and break the next deploy.

---

## 3. Repository configuration

### 3.1 Huawei SWR

1. In the SWR console, create an **organization** (namespace) — its name is
   `SWR_ORG`.
2. Note the registry address for your region: `swr.<region>.myhuaweicloud.com`
   — this is `SWR_REGISTRY`.
3. Obtain a **long-term valid login command** (Huawei docs: *SWR → Obtaining a
   Long-Term Valid Login Command*; it is derived from an access key pair). From
   `docker login -u <region>@<AK> -p <login-key> <registry>` take the username
   (`SWR_USERNAME`) and the password (`SWR_PASSWORD`). Temporary login commands
   expire after 24 hours — don't use those.

The image repository is created automatically on the first push.

### 3.2 `.github/ci.env`

```env
DOCKER_ENABLED=true
SWR_ORG=your-swr-organization
IMAGE_NAME=nest-api
DEPLOY_DIR=/opt/app/api
```

Deploys refuse to run while `SWR_ORG` is still `your-org`. Invalid values
(uppercase org, relative path, …) fail CI with a clear error. Each value can
be overridden by a repository variable of the same name.

### 3.3 Secrets

Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Value |
|---|---|
| `SWR_REGISTRY` | `swr.<region>.myhuaweicloud.com` |
| `SWR_USERNAME` | `<region>@<AK>` from the long-term login command |
| `SWR_PASSWORD` | the long-term login key |
| `SERVER_HOST` | server address |
| `SERVER_USERNAME` | `deploy` |
| `SERVER_SSH_KEY` | private key for the deploy user |
| `SERVER_PORT` | SSH port (usually `22`) |

The deploy job runs in the GitHub **environment** `production` — add required
reviewers there (Settings → Environments) if deploys should be approved.

---

## 4. First deploy

1. Finish [§2](#2-one-time-server-setup) and [§3](#3-repository-configuration).
2. Merge to `main` (or *Actions → Deploy → Run workflow* with an empty tag).
   The workflow builds, pushes, ships `docker-compose.prod.yml` + `deploy.sh`
   to `DEPLOY_DIR` and runs the deploy. The first deploy goes to **blue**.
3. Seed the database once if you want the default modules, groups and admins:
   ```bash
   cd /opt/app/api && docker compose run --rm --no-deps api-blue npx prisma db seed
   ```
   Then log in as `superadmin` / `Admin123!` and **change that password
   immediately** (and the `admin` one).
4. Check: `curl -s http://127.0.0.1:4001/healthz/ready` and the public URL.

---

## 5. Everyday deploys

Merge to `main`. The Deploy run shows each stage; the run summary lists the
resolved settings. Each deploy alternates blue ↔ green.

Things to keep in mind:
- Migrations run **before** the switch, while the old version still serves —
  see [§7](#7-migrations).
- After a deploy that includes the auth-hardening migration
  (`20261007000001_harden_auth_tokens`), every user signs in again once.
- Old images are pruned after a successful deploy; the previous one stays
  because the stopped color still references it.

---

## 6. Rollback

**Redeploy a previous tag (preferred):** *Actions → Deploy → Run workflow*,
enter an existing image tag (a short commit SHA from an earlier run). Verify
and build are skipped; that tag is deployed with the normal blue/green switch.

**Instant manual rollback** (the old color is stopped, not removed):

```bash
cd /opt/app/api
OLD=blue   # the color that was live before
docker compose start api-$OLD
echo "upstream nest_api { server 127.0.0.1:$([ $OLD = blue ] && echo 4001 || echo 4002); }" \
  > /etc/nginx/conf.d/nest_api_upstream.conf
sudo /usr/sbin/nginx -t && sudo /usr/bin/systemctl reload nginx
sed -i "s/^ACTIVE_COLOR=.*/ACTIVE_COLOR=$OLD/" .env
```

A rollback does **not** undo migrations — that is why migrations must stay
compatible with the previous release.

---

## 7. Migrations

- Applied with `prisma migrate deploy` by `deploy.sh`, before the switch.
- **Backward-compatible only** (expand/contract): the old release keeps
  serving against the new schema for a short while, and a rollback runs old
  code on it for longer. Add columns/tables first, release code that uses
  them, and drop old ones in a later release.
- A failed migration stops the deploy before the switch. Fix forward with a
  new migration, or restore the database ([§2.3](#23-database-backups-required)).
- Never edit a migration after it has been deployed anywhere.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build stops: *SWR_ORG not set* | Set `SWR_ORG` in `.github/ci.env` ([§3.2](#32-githubcienv)). |
| *Login to SWR*: `Username and password required` | `SWR_USERNAME` / `SWR_PASSWORD` secrets missing. |
| `docker compose pull` denied on the server | The `deploy` user isn't logged in to SWR, or used a temporary key ([§2.7](#27-registry-login-on-the-server)). |
| `ERROR: missing …/api.env` | Create `api.env` ([§2.2](#22-application-environment-apienv-and-env)). |
| `ERROR: SWR_REGISTRY is not set` | Running `deploy.sh` by hand on a fresh server: pass `SWR_REGISTRY=… SWR_ORG=… IMAGE_NAME=…`, or deploy once via the workflow. |
| Health check fails, deploy stops | `docker compose logs api-<color>` — usually an invalid `api.env` value (the app lists them), or the DB/Redis unreachable. Live traffic was not touched. |
| `nginx -t` fails / permission denied on the upstream file | Upstream file must exist and be owned by `deploy`; sudoers entry missing ([§2.4](#24-nginx), [§2.5](#25-sudo-for-nginx-reload)). |
| Every client is rate-limited together | `TRUST_PROXY=1` missing in `api.env`, or nginx doesn't send `X-Forwarded-For`. |
| `SYSTEM_LOG` etc. ignored | An inline comment after the value in `api.env` — move it to its own line. |
