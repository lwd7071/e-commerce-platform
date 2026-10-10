FROM node:24-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

# Copy .env gốc để next.config.ts nạp biến lúc build
COPY .env /app/.env
COPY .env /app/../.env
COPY frontend/ ./

ARG NEXT_PUBLIC_API_URL=https://api.dinoshopping.io.vn/api/v1
ARG NEXT_PUBLIC_SITE_URL=https://dinoshopping.io.vn
ARG NEXT_PUBLIC_SUPABASE_URL=https://putywqmxtjttfdezlswf.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZXw4cszWPlXI7v_jWHQdjg_QkGXa7mt
ARG NEXT_PUBLIC_USE_MOCK=false

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK

RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/.env /app/.env
COPY --from=builder /app/../.env /app/../.env

EXPOSE 3000

CMD ["npm", "start"]
