FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g bun

# ------------ deps ------------
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ------------ builder ------------
FROM deps AS builder
COPY . .
RUN bun run build

# ------------ runner ------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
