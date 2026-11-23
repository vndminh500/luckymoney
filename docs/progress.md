# Progress

Nhật ký quyết định và vướng mắc theo từng task.

## T1. Khởi tạo dự án (2026-11-23)
- Next.js 16.4.6 (App Router, Turbopack), TypeScript strict, Tailwind v4, ESLint 9 (flat config).
- Prettier + `eslint-config-prettier/flat` (theo khuyến nghị trong tài liệu Next.js).
- `typecheck` = `next typegen && tsc --noEmit`: sinh type route trước để chạy được trên máy/CI chưa build.
- Tài liệu (`docs/`, `AGENTS.md`, `PLAN.md`) nằm trong `.prettierignore` để không tự định dạng lại văn bản của người viết.

## T2. Prisma + Postgres (2026-11-23)
- Ghim Prisma `7.10.1` (`-E`). Lưu ý: dist-tag `latest` của gói `prisma` đang trỏ vào `8.0.0-rc`, đừng chạy `npm i prisma@latest` theo gợi ý của CLI.
- Prisma 7 không cho `url` trong `datasource` của schema: chuyển sang `prisma.config.ts`. Giữ generator `prisma-client-js`, model không đổi.
- `prisma.config.ts` không tự đọc `.env`: dùng `process.loadEnvFile()` có sẵn của Node (không thêm `dotenv`). `url` để optional để `prisma generate` chạy được khi không có DB (CI).
- Prisma 7 bắt buộc driver adapter: dùng `@prisma/adapter-pg`. Client dùng chung ở `src/server/db.ts` (singleton qua `globalThis` khi dev).
- Prisma 7 `migrate dev` không còn tự chạy `generate`/`seed`: thêm `postinstall: prisma generate`, seed chạy bằng `npm run db:seed`.
- Seed chạy bằng `node prisma/seed.ts` (Node 24 tự bỏ type TypeScript), không cần `tsx`.
- npm 11 chặn install script mặc định: đã duyệt `prisma` và `@prisma/engines` (`allowScripts` trong `package.json`), vì engines cần tải schema engine cho `migrate`.
- Postgres local chạy bằng `docker-compose.yml` (postgres:17-alpine). `.gitignore` thêm `!.env.example`.

## T3. Vitest + Playwright + CI (2026-11-23)
- Vitest 5 (môi trường `node`, test ở `tests/unit/`). Alias `@/*` dùng `resolve.tsconfigPaths` có sẵn trong Vite 8, không cần `vite-tsconfig-paths`.
- Vitest chưa hỗ trợ async Server Component (theo tài liệu Next): UI kiểm tra bằng e2e, unit test dành cho `src/lib` và `src/server`.
- Nâng `@types/node` từ `^20` lên `^24` cho khớp runtime Node 24 (Vitest 5 yêu cầu >= 22).
- Playwright luôn chạy trên bản production (`next build` + `next start`, cổng 3100). Lý do: Next 16 chỉ cho một `next dev` mỗi thư mục, nên e2e không đụng dev server đang chạy.
- CI (`.github/workflows/ci.yml`): job `check` (lint, typecheck, format:check, unit test) và job `e2e` (Chromium). Chưa có Postgres trong CI; sẽ thêm khi e2e cần DB (T5).
- `npm audit`: 3 cảnh báo high từ `effect` (phụ thuộc nội bộ của Prisma CLI `@prisma/config`). Chỉ là công cụ dev, không vào bundle. `npm audit fix --force` sẽ hạ Prisma về v6 nên không áp dụng; theo dõi bản vá của Prisma.
