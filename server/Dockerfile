# Equarios API / care worker image (Postgres provider at build time).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# HA image always targets Postgres (local demo keeps SQLite on the host).
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma \
  && npx prisma generate

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["api"]
