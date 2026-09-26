# ---- deps: full install (dev deps are needed to build, migrate and seed) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund

# ---- build: prisma client + Next standalone output ----
FROM deps AS build
COPY . .
# The build never talks to the database; Prisma only needs a syntactically valid URL.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build" NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---- tools: one-shot migrations + seed (used by the `migrate` compose service) ----
FROM build AS tools
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ---- runner: minimal production image ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
  && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
