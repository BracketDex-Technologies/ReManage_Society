FROM node:24-alpine AS base
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY apps/worker ./apps/worker
COPY packages ./packages
USER app
EXPOSE 4010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4010/health/live || exit 1
CMD ["npx", "tsx", "apps/worker/src/main.ts"]
