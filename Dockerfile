FROM oven/bun:1.3.9-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY src ./src
COPY drizzle ./drizzle

RUN mkdir -p /app/uploads /app/data

ENV NODE_ENV=production
EXPOSE 9995

CMD ["bun", "src/index.ts"]
