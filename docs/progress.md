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

## T6. Đăng nhập Google OAuth (2026-11-24) — chờ kiểm tra với Client ID thật
- Không dùng `@auth/prisma-adapter`: adapter ghi thêm cột `emailVerified`, `image` mà schema không có, và phiên đã là JWT. Việc tạo và liên kết user nằm trong `src/server/auth/google.ts` (callback `signIn`), callback `jwt` đổi id Google sang id user của mình.
- Quy tắc liên kết: Google đã liên kết thì dùng user đó (kể cả khi email Google đổi); email thuộc user không có mật khẩu thì liên kết; email thuộc tài khoản có mật khẩu thì **từ chối** (`?error=OAuthAccountNotLinked`); email mới thì tạo user, danh mục mặc định và liên kết. Chỉ nhận email Google đã xác minh (`email_verified`).
- Lý do từ chối liên kết với tài khoản mật khẩu: v1 không xác minh email khi đăng ký, nên tài khoản đó có thể do người khác tạo trước ("pre-account takeover"). Nếu bổ sung xác minh email thì có thể bật lại việc liên kết.
- Không lưu access/refresh token của Google vì app không gọi API Google.
- Nút Google chỉ hiện khi có `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET`. Trang `/register` là trang tĩnh, nên biến này được đọc lúc build.
- E2E dùng client ID giả và chặn `accounts.google.com` để kiểm tra URL ủy quyền (client_id, redirect_uri, scope, PKCE S256). Vòng OAuth thật chưa kiểm tra được vì chưa có Client ID thật.

## T7. Thêm giao dịch (2026-11-24)
- Schema ở `src/lib/schemas/transaction.ts`: `createTransactionSchema` cho API (`amount` số nguyên 1..1_000_000_000, `occurredAt` ISO 8601 có múi giờ, `note` cắt khoảng trắng, rỗng thành `null`, tối đa 200 ký tự) và `transactionFormSchema` cho form (`amount` là chuỗi đọc bằng `parseVnd`, `date` dạng `YYYY-MM-DD`). Khóa lạ như `userId` bị bỏ.
- Danh mục không tồn tại, của user khác, đã lưu trữ hoặc khác loại đều trả cùng một lỗi `400 VALIDATION_ERROR` ở trường `categoryId`, nên không lộ danh mục của người khác có tồn tại hay không.
- Form chỉ chọn ngày; `occurredAt` là thời điểm đầu ngày đó theo múi giờ của user (`startOfZonedDay`). Ngày mặc định là "hôm nay" theo múi giờ user, tính ở server.
- Giao diện: trang `/transactions/new`, sau khi lưu thì giữ loại và ngày, xóa số tiền, danh mục, ghi chú để nhập tiếp nhanh. Danh sách (T8) chưa có nên chưa chuyển trang.
- Route `POST /api/transactions` dùng chung service với server action. Test route đi qua e2e (cookie phiên thật) thay vì mock session.
- Phát hiện: proxy của Auth.js gắn lại cookie phiên vào mọi phản hồi, nên một request prefetch đang chạy lúc đăng xuất làm user bị đăng nhập lại. Đã sửa ngay sau T7 (xem mục bên dưới).
- Chưa xử lý: danh mục bị lưu trữ đúng lúc giữa bước kiểm tra và bước ghi (khoảng cách rất nhỏ, chấp nhận ở v1).

## Sửa lỗi: đăng xuất bị hoàn tác (2026-11-24)
- Nguyên nhân: `auth()` dùng làm proxy gọi endpoint session của Auth.js trên mọi request và gắn `set-cookie` (JWT gia hạn, cookie csrf, callback-url) vào phản hồi. Request bắt đầu trước khi đăng xuất mà trả về sau sẽ ghi lại cookie đã xóa.
- Cách sửa: `src/proxy.ts` chỉ giải mã cookie bằng `getToken` (`next-auth/jwt`, kiểm tra chữ ký và `exp`) và không bao giờ ghi cookie. Bỏ `prefetch={false}` tạm thời ở trang chủ.
- Hệ quả: phiên có thời hạn cố định 7 ngày từ lúc đăng nhập, không còn tự gia hạn khi dùng. Phù hợp PRD ("phiên đăng nhập có hạn").
- Test: `tests/integration/proxy.test.ts` (không ghi cookie, khách bị chuyển về `/login`, cookie hết hạn hoặc bị sửa coi như chưa đăng nhập, API trả 401). E2E chạy lặp 10 lần: 180/180 xanh.
- Vitest: thêm `server.deps.inline: ["next-auth"]` cho project integration vì `next-auth` import `next/server` không có đuôi file. Request trong test cần header `x-forwarded-proto` như Next.js thật, nếu thiếu Auth.js coi là https.
- Còn lại (đã có từ trước, không thuộc lỗi này): Vitest cảnh báo "ESM syntax in a file loaded as CommonJS (vitest.config.ts)" vì `package.json` không có `"type": "module"`. Test vẫn chạy đúng.
- Lưu ý bảo mật còn mở: JWT không thu hồi được ở server, nên cookie bị lộ vẫn dùng được đến khi hết hạn. Xem xét ở T16.

## Sửa lỗi: cảnh báo prerender `crypto.getRandomValues()` (2026-11-24)
- Log server báo lỗi trên `/`, `/transactions/new`, `/transactions`: Auth.js tạo CSRF token ngẫu nhiên mỗi lần `auth()` đọc phiên, mà Next.js (Cache Components) cấm giá trị ngẫu nhiên khi prerender. Lỗi có cả ở `/` (trang từ T5) nên nhiều khả năng đã có từ trước, chỉ bị phát hiện khi đọc log e2e.
- Sửa: `getSessionUserId` gọi `await connection()` trước `auth()` để đánh dấu là việc của request. Log e2e còn 0 lỗi.

## T8. Danh sách giao dịch (2026-11-24)
- `listTransactions(userId, query, now)` trong `src/server/transactions/service.ts`; query đọc từ URL bằng `listTransactionsQuerySchema` (chuỗi rỗng coi như không lọc, số được ép từ chuỗi). Thiếu `month` thì lấy tháng hiện tại theo múi giờ user.
- Lọc: `userId`, `deletedAt = null`, `occurredAt` trong `[start, end)` của tháng theo múi giờ user, `categoryId?`, `type?`. Đếm `total` và lấy trang trong cùng một `$transaction`.
- Sắp xếp `occurredAt desc, createdAt desc, id desc`: thêm `id` để các giao dịch cùng thời điểm (form lưu đầu ngày) không bị trùng hoặc sót giữa các trang.
- Mỗi item kèm `category.archived` để giao dịch cũ vẫn hiện danh mục đã lưu trữ (phục vụ T10).
- Lọc theo danh mục của user khác chỉ trả danh sách rỗng, không lỗi, vì truy vấn luôn lọc `userId`.
- Trang `/transactions`: chuyển tháng trước/sau (giữ bộ lọc), form lọc GET không cần JS, phân trang, trạng thái rỗng, bộ lọc sai hiện thông báo. Ô lọc danh mục chỉ liệt kê danh mục chưa lưu trữ; lọc danh mục đã lưu trữ vẫn được qua URL. Xem lại ở T10.
- Sau khi lưu ở `/transactions/new` có liên kết "Xem danh sách" tới đúng tháng của giao dịch.
- Test: `tests/integration/transaction-list.test.ts` (ranh giới tháng UTC+7, mặc định tháng, phân quyền, xóa mềm, lọc, phân trang ổn định, danh mục lưu trữ, query sai), e2e thêm rồi thấy đúng tháng, không thấy ở tháng sau. Thêm `tests/integration/fixtures.ts` dùng chung.
