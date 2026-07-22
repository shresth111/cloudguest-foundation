FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g bun

# ------------ deps ------------
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ------------ builder ------------
FROM deps AS builder

# Vite inlines import.meta.env.VITE_* at build time -- this must be a build
# ARG, not a runtime `docker run -e`, or the client bundle keeps whatever
# value it was built with (defaults to api.ts's own relative "/api/v1"
# fallback, which only works if something in front of this container also
# proxies that path to a real backend).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV NODE_ENV=production

# @lovable.dev/vite-tanstack-config defaults nitro's build preset to
# "cloudflare-module" when none is set (see its own defaultPreset fallback)
# -- a Worker-format bundle, not something `node .output/server/index.mjs`
# below can run. NITRO_PRESET is nitro's own documented override and takes
# priority over that default, producing a real portable Node server instead.
ENV NITRO_PRESET=node-server

COPY . .
RUN bun run build

# ------------ runner ------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# nitro's node-server preset bundles its own server dependencies into
# .output/server -- no node_modules install needed here.
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" > /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
