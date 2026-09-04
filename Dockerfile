# GFPR — one image serving the API and the built web UI from a single port.
#
# better-sqlite3 ships prebuilt binaries for both glibc and musl and has no
# install script, so Alpine works without a compiler toolchain and
# `npm ci --ignore-scripts` is safe in the dependency layer.

# ---------------------------------------------------------------- build ----
FROM node:22-alpine AS build

WORKDIR /app

# Dependency manifests first, so this layer stays cached when only source changes.
COPY package.json package-lock.json .npmrc ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# --ignore-scripts: the root postinstall imports data, which cannot run before
# the sources are copied.
RUN npm ci --ignore-scripts

COPY . .

# Build the UI and the sample table. The derived artifact (figure payloads) is
# committed, so no heavy source file is needed here.
RUN npm run build && npm run import-data && npm run import-annotations

# Drop dev dependencies (vite, oxlint, concurrently).
RUN npm prune --omit=dev


# -------------------------------------------------------------- runtime ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

USER node

EXPOSE 4000

# busybox wget is already present on Alpine.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "backend/src/server.js"]
