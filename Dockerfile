# syntax=docker/dockerfile:1.7
# ==========================================
# Stage 1: Dependencies (full, for build)
# ==========================================
FROM node:24-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && npm run build

# ==========================================
# Stage 3: Production dependencies (+ prisma CLI & tsx for seed)
# ==========================================
FROM node:24-alpine AS prod-deps
WORKDIR /app

COPY package*.json ./

# Install only production dependencies, then layer the dev tools we still need at
# runtime on top of them (versions pinned to whatever is in devDependencies so they
# never drift):
#   - prisma CLI .. for `prisma migrate deploy` (initContainer)
#   - tsx ......... for `prisma db seed` -- prisma.config.ts invokes `tsx`,
#                   and the seeds import the generated client from
#                   src/generated. tsx bundles its own transpiler (esbuild),
#                   so ts-node / typescript aren't needed at runtime.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund && \
    PRISMA_VERSION="$(npm pkg get devDependencies.prisma | tr -d '"^~ ')" && \
    TSX_VERSION="$(npm pkg get devDependencies.tsx | tr -d '"^~ ')" && \
    npm install --no-save --no-audit --no-fund \
      "prisma@${PRISMA_VERSION}" \
      "tsx@${TSX_VERSION}"
# NOTE: the second `npm install` deliberately omits `--omit=dev`. With it set, npm
# reapplies the "production-only" invariant across the whole tree on every install,
# which silently prunes transitive deps it considers devDeps. Without it, npm just
# adds the explicit packages on top of the prod-only state already established by
# `npm ci --omit=dev` above.

# ==========================================
# Stage 4: Production runtime
# ==========================================
FROM node:24-alpine AS production
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    KAFKAJS_NO_PARTITIONER_WARNING=1 \
    TZ=Asia/Jakarta \
    APP_PORT=4000

WORKDIR /app

# tini = tiny init -> proper signal forwarding & zombie reaping (PID 1 fix)
RUN apk add --no-cache tini tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo "$TZ" > /etc/timezone && \
    addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nestjs -G nodejs

# Production node_modules (incl. prisma CLI)
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/package*.json ./

# Build output + Prisma artefacts (schema for migrations, generated client for runtime,
# config file - the datasource URL lives there in this project).
#
# src/ is copied because `prisma db seed` (run via tsx) imports the generated
# client from src/generated, and src/public/uploads is the local upload dir.
# Source TS is never executed by the running app itself - it boots from dist/.
COPY --from=build --chown=nestjs:nodejs /app/dist             ./dist
COPY --from=build --chown=nestjs:nodejs /app/src              ./src
COPY --from=build --chown=nestjs:nodejs /app/prisma           ./prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nestjs:nodejs /app/tsconfig.json    ./tsconfig.json
COPY --from=build --chown=nestjs:nodejs /app/mails            ./mails

# Writable upload dir for the non-root user
RUN mkdir -p src/public/uploads && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

# Follows APP_PORT so the check stays valid wherever the port is overridden.
# /healthz/ready verifies DB + Redis connectivity — `docker compose up --wait`
# gates deploys on this going healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "const p=process.env.APP_PORT||4000; require('http').get('http://localhost:'+p+'/healthz/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main.js"]
