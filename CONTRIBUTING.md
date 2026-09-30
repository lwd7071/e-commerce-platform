# Contributing

## Runtime bắt buộc

Backend và frontend workspace dùng Node.js `24.15.0` và npm `11.12.1`.

```bash
nvm install 24.15.0
nvm use 24.15.0
npm install --global npm@11.12.1
node --version
npm --version
```

Kết quả bắt buộc là `v24.15.0` và `11.12.1` cho backend và frontend workspace. `ecommerce-web/` là prototype riêng, không thuộc quality gates triển khai.

## Cài dependency

Chạy từ root repository:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

`npm ci` tự đồng bộ `node_modules`; không chạy lệnh xóa rộng. Không dùng `npm install` chỉ để chạy dự án sau khi pull.

## Quality gates

```bash
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend run test:node
npm --prefix backend run test:vitest
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run lint
```

Prisma validation:

```bash
npm --prefix backend exec prisma validate
```

## Lockfile và secrets

- Chỉ sinh lockfile backend/frontend bằng Node `24.15.0` và npm `11.12.1`.
- Sau khi cài dependency, kiểm tra lockfile không dirty.
- Không commit `.env`, Supabase key, service-role key, database URL hoặc password.
- Không chạy `prisma db push`, `migrate reset` hoặc sửa migration đã phát hành.

Chi tiết version và boundary kiến trúc nằm trong [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md).
