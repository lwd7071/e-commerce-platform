# Contributing

## Runtime bắt buộc

Repository dùng Node.js `22.20.0` và npm `11.12.1`.

```bash
nvm install 22.20.0
nvm use 22.20.0
npm install --global npm@11.12.1
node --version
npm --version
```

Kết quả bắt buộc là `v22.20.0` và `11.12.1`. Không dùng Node 20 hoặc Node 24 để xác nhận CI T1.

## Cài dependency

Chạy từ root repository:

```bash
npm --prefix backend ci
npm --prefix ecommerce-web ci
```

`npm ci` tự đồng bộ `node_modules`; không chạy lệnh xóa rộng. Không dùng `npm install` chỉ để chạy dự án sau khi pull.

## Quality gates

```bash
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend run test:node
npm --prefix backend run test:vitest
npm --prefix ecommerce-web run lint
npm --prefix ecommerce-web run build
```

Prisma validation:

```bash
npm --prefix backend exec prisma validate
```

## Lockfile và secrets

- Chỉ sinh lockfile bằng Node `22.20.0` và npm `11.12.1`.
- Sau khi cài dependency, kiểm tra lockfile không dirty.
- Không commit `.env`, Supabase key, service-role key, database URL hoặc password.
- Không chạy `prisma db push`, `migrate reset` hoặc sửa migration đã phát hành.

Chi tiết version và boundary kiến trúc nằm trong [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md).
