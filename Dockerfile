FROM oven/bun:1.3.9-alpine

WORKDIR /app

COPY package.json ./
RUN bun install --production --frozen-lockfile || bun install --production

COPY . .

RUN mkdir -p /app/uploads /app/data

ENV NODE_ENV=production
EXPOSE 9995

CMD ["bun", "src/index.ts"]
