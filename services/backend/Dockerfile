# syntax=docker/dockerfile:1.6
# Minimal dev image for the backend service
FROM node:20-alpine@sha256:1ab6fc5a31d515dc7b6b25f6acfda2001821f2c2400252b6cb61044bd9f9ad48

WORKDIR /app

# Enable Corepack (Yarn pinned via packageManager in root package.json)
RUN corepack enable

# Copy only manifests first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY services/backend/package.json services/backend/package.json
COPY packages/types/package.json packages/types/package.json

# Install all workspace deps (dev deps included for ts-node)
# Use a cache for Yarn to speed up installs
RUN --mount=type=cache,target=/root/.cache/yarn \
  corepack yarn install --immutable

# Copy only the workspaces needed for the backend
COPY --chown=node:node services/backend ./services/backend
COPY --chown=node:node packages/types ./packages/types
COPY --chown=node:node tsconfig.base.json ./tsconfig.base.json

# Drop root privileges
USER node

# Runtime env, ports, and command are defined in docker-compose.yml
