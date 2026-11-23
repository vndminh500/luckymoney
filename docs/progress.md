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
- `npm audit`: 3 cảnh báo high từ `effect` (qua `@prisma/config`). Sửa lại ở T5: cảnh báo vẫn còn khi `--omit=dev`, nên chuỗi phụ thuộc có ở cả production, không chỉ CLI. Lỗi là ReDoS trong regex của `Schema.TemplateLiteral`, chỉ dùng khi đọc cấu hình Prisma, không nhận dữ liệu người dùng. `npm audit fix --force` sẽ hạ Prisma về v6 nên không áp dụng; theo dõi bản vá của Prisma.

## T4. money.ts + dates.ts (2026-11-23)
- `formatVnd`: `Intl.NumberFormat("vi-VN", VND)`, ví dụ `50.000 ₫` (khoảng trắng là NBSP `U+00A0`). Ném `RangeError` nếu không phải số nguyên.
- `parseVnd`: nhận số thường (`50000`, `50.000`, `50,000`, `50 000`), đơn vị `k/nghìn/ngàn`, `tr/triệu/m`, thập phân (`1.5tr`, `1,5k`), kiểu viết tắt `1tr5`, `2k5`, hậu tố `đ/₫/vnd/vnđ`. Trả `null` nếu không phải số nguyên VND không âm. Không dùng số thực: dịch chữ số dạng chuỗi rồi `BigInt`. Ràng buộc `> 0` và `<= 1_000_000_000` thuộc schema Zod (T7).
- Không viết BigInt literal (`10n`) vì `tsconfig` target ES2017 không cho phép.
- `dates.ts` dùng `Intl` có sẵn, không thêm thư viện múi giờ. Tháng là khoảng nửa mở `[start, end)` theo UTC: truy vấn `occurredAt >= start AND occurredAt < end`.
- `startOfZonedDay` xử lý DST bỏ qua nửa đêm (America/Santiago 2026-09-06) bằng cách thử offset ở hai phía của thời điểm đổi giờ và lấy thời điểm sớm nhất thuộc ngày đó.
- Kiểm tra độ mạnh của test: cố ý đổi sang gom theo UTC thì 11 test thất bại.

## T5. Đăng ký và đăng nhập email + mật khẩu (2026-11-24)
- Auth.js v5 (`next-auth@5.0.0-beta.32`, ghim): v5 vẫn là beta nhưng là bản hỗ trợ Next 16. Phiên JWT trong cookie httpOnly, hết hạn sau 7 ngày.
- Băm mật khẩu bằng `scrypt` có sẵn trong Node (N=2^15, r=8, p=1, salt ngẫu nhiên, so sánh `timingSafeEqual`), không cần thư viện native. Tham số lưu trong chuỗi hash để nâng sau. Chuẩn hóa NFC để mật khẩu tiếng Việt gõ từ bàn phím khác vẫn khớp.
- Email không tồn tại vẫn chạy một lần kiểm tra hash giả, để thời gian phản hồi không lộ email nào đã đăng ký.
- Next 16 đổi `middleware` thành `proxy` (`src/proxy.ts`, chạy Node runtime). Proxy chỉ là lớp chặn sơ bộ; route handler và server action phải tự kiểm tra qua `src/server/auth/session.ts` (`requireUserId`, `getCurrentUser`).
- API chưa đăng nhập trả `401 { error: "UNAUTHENTICATED" }`, trang chưa đăng nhập chuyển về `/login?callbackUrl=...`. `callbackUrl` được lọc bằng `safeRedirectPath` để chặn open redirect.
- Đăng ký tạo user và 11 danh mục mặc định trong một transaction. Email trùng (không phân biệt hoa thường) trả `409`.
- Lỗi đã gặp: trang đăng nhập dùng `<Suspense>` để đọc `searchParams`. Fallback là một form thứ hai trùng `id` (input bị gắn hai label, "Email Email"). Sau khi sửa, input ẩn `callbackUrl` được stream riêng nhưng React gỡ rồi gắn lại nó sau khi tải trang, nên submit nhanh làm mất `callbackUrl`. Cách sửa cuối: trang `/login` đọc `searchParams` ở server (`export const instant = false`) và truyền `callbackUrl` làm prop của form.
- Test: database riêng `spendly_test` (integration, xóa sạch trước mỗi test) và `spendly_e2e`. Test từ chối chạy nếu tên database không kết thúc bằng `_test`/`_e2e`.
- CI thêm Postgres service cho cả hai job.
- Đổi font sang Inter (có subset `vietnamese`), `lang="vi"`.
