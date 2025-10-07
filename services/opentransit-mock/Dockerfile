# syntax=docker/dockerfile:1.6
FROM node:20-alpine

WORKDIR /app

# Use workspace install flow for TS toolchain
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY services/opentransit-mock/package.json services/opentransit-mock/package.json
COPY packages/infra/package.json packages/infra/package.json

RUN --mount=type=cache,target=/root/.cache/yarn \
  corepack yarn install --immutable

COPY --chown=node:node services/opentransit-mock ./services/opentransit-mock
COPY --chown=node:node packages/infra ./packages/infra
COPY --chown=node:node tsconfig.base.json ./tsconfig.base.json

RUN corepack yarn workspace @open-transit-map/infra build && corepack yarn workspace @open-transit-map/opentransit-mock build

USER node

CMD ["node", "services/opentransit-mock/dist/main.js"]
