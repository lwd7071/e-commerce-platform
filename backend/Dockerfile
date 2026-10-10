FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY .env /app/.env
COPY .env /app/../.env
COPY backend/ ./

# Sinh Prisma Client
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "start"]
