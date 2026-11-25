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

## CI lần đầu trên GitHub (2026-11-24)
- Lần push đầu: job check xanh, job e2e đỏ ở `google.spec.ts › register page offers Google too`. Nguyên nhân: CI build ở bước `npm run build` riêng, không có biến Google giả (chỉ khai báo trong `webServer.env` của Playwright), mà `/register` là trang tĩnh đọc biến lúc build. Sửa: Playwright tự build trong CI như ở local, bỏ bước build riêng. Lần chạy sau xanh cả hai job, tick T3.

## T9. Sửa và xóa mềm giao dịch (2026-11-24) — chưa tick, chờ T12
- Service: `getTransaction`, `updateTransaction` (PATCH, ít nhất một trường), `updateTransactionFromForm`, `deleteTransaction`. Mọi truy vấn lọc `{ id, userId, deletedAt: null }`; của user khác, không tồn tại hoặc đã xóa đều là `404`. Xóa lần hai cũng `404`.
- Đổi loại hoặc danh mục thì danh mục mới phải hợp lệ (cùng quy tắc khi tạo). Giữ nguyên danh mục cũ thì được lưu kể cả khi danh mục đó đã bị lưu trữ; trang sửa thêm danh mục đó vào ô chọn với nhãn "(đã lưu trữ)".
- Form sửa: nếu ngày không đổi thì giữ nguyên thời điểm gốc (giao dịch tạo qua API có giờ cụ thể không bị dời về đầu ngày).
- Xóa mềm bằng `updateMany` có điều kiện, nên không có khoảng hở giữa kiểm tra và ghi. Cập nhật dùng `update` với `where` có `userId`, lỗi `P2025` (bị xóa giữa chừng) đổi thành `404`.
- Trang `/transactions/[id]/edit` nằm sau `<Suspense>`, nên `notFound()` trả giao diện 404 kèm `noindex` nhưng mã HTTP vẫn 200 (đúng tài liệu Next.js về streaming). API trả `404` thật. Thêm `src/app/not-found.tsx` tiếng Việt.
- Xóa không hỏi xác nhận (không dùng hộp thoại trình duyệt); chấp nhận vì là xóa mềm. Có thể thêm bước xác nhận hoặc hoàn tác ở T15.
- Gom việc đọc múi giờ user thành `getUserTimeZone` trong service giao dịch.
- Phần "không xuất hiện ở thống kê" chưa kiểm tra được vì chưa có service thống kê; đã ghi vào điều kiện xong của T12.

## T10. Quản lý danh mục (2026-11-24)
- Service `src/server/categories/service.ts`: `listCategories` (`includeArchived`), `createCategory`, `updateCategory` (chỉ `name`, `icon`; không đổi `type` vì giao dịch cũ phải khớp loại), `archiveCategory`, `restoreCategory`. Schema ở `src/lib/schemas/category.ts`.
- Tên chuẩn hóa NFC và cắt khoảng trắng; tối đa 50 ký tự. Biểu tượng tối đa 16 đơn vị UTF-16 (đủ cho emoji có bổ ngữ).
- Trùng `(name, type)` trả `409`, kể cả khi danh mục trùng đang lưu trữ (ràng buộc unique của DB bao gồm cả bản lưu trữ), nên khôi phục không bao giờ gây trùng. So sánh tên phân biệt hoa thường theo ràng buộc DB; chưa chặn "ăn uống" và "Ăn uống" cùng tồn tại.
- Lưu trữ và khôi phục là idempotent: lưu trữ lần hai giữ nguyên `archivedAt` cũ. Danh mục của user khác hoặc không tồn tại trả `404`.
- Trang `/categories`: form thêm, nhóm Chi, Thu, Đã lưu trữ, đổi tên tại chỗ, nút lưu trữ/khôi phục. Server action gọi `refresh()` (Next 16) để tải lại dữ liệu trang.
- Ô lọc ở `/transactions` giờ liệt kê cả danh mục đã lưu trữ (ghi chú mở từ T8).
- Điều kiện xong được kiểm tra ở cả integration và e2e: danh mục lưu trữ không có trong ô chọn khi thêm giao dịch, bị từ chối nếu gửi thẳng qua API, và vẫn hiện "(đã lưu trữ)" trên giao dịch cũ.

## T11. Test phân quyền tổng hợp (2026-11-24)
- `tests/integration/authorization.test.ts`: gọi thật mọi route handler trong `src/app/api` (trừ Auth.js và đăng ký) và mọi server action, chỉ giả lập `@/server/auth/session` để đổi user. Mỗi endpoint có một "tấn công" vào dữ liệu của Bob khi đăng nhập là Alice.
- Mỗi trường hợp kiểm tra: mã trạng thái (404 cho tài nguyên của người khác, 400 khi dùng danh mục của người khác), phản hồi không chứa id, ghi chú hay số tiền của Bob, và toàn bộ bản ghi của Bob không đổi (so sánh snapshot DB). Thêm trường hợp chưa đăng nhập trả 401 cho mọi endpoint và mọi action.
- Test tự quét `src/app/api/**/route.ts`: thêm endpoint mới mà chưa có trường hợp phân quyền thì test đỏ.
- Kiểm tra độ mạnh: bỏ điều kiện `userId` trong `getTransaction`/`findOwned` làm 8 test đỏ; bỏ `userId` trong truy vấn danh sách giao dịch và danh mục làm 2 test đỏ. Đã hoàn nguyên.

## Thiết kế lại đăng nhập/đăng ký, thương hiệu Lucky Money (2026-11-24, ngoài PLAN, theo yêu cầu)
- Bảng màu do người dùng chọn: `#30AFFF`, `#92EEFF`, `#D8FFC5`, `#C4F7CA`, thêm `#062B45` (chữ) và `#0A6FB0` (viền focus). Token Tailwind `lm-*` trong `globals.css`. `#30AFFF` với chữ trắng chỉ 2,4:1 nên nút chính dùng chữ `#062B45` trên nền `#30AFFF`.
- Font Roboto (400/500/700, subset `vietnamese`) thay Inter cho toàn app; cỡ chữ gốc 16px.
- Logo: đồng xu xanh có cỏ bốn lá (`src/components/brand/logo.tsx`), favicon `src/app/icon.svg`, bỏ `favicon.ico` mặc định. Tiêu đề trang đổi sang "Lucky Money".
- Bố cục: desktop chia hai cột (mảng màu thương hiệu với ba giao dịch mẫu bên trái, form bên phải); mobile chỉ còn logo và form. Có chế độ tối qua biến `--auth-*` trong `.auth-shell`.
- Chuyển động: ba giao dịch mẫu lần lượt trượt lên khi tải trang, nền trôi chậm, tab trượt khi chuyển Đăng nhập/Đăng ký (layout giữ nguyên nên thanh trượt có hiệu ứng), form hiện dần khi đổi trang, ô nhập đổi viền khi focus, nút lún khi bấm, vòng quay khi đang gửi. Tắt toàn bộ khi `prefers-reduced-motion`.
- Thêm nút ẩn/hiện mật khẩu (`aria-pressed`). Vì nhãn nút có chữ "mật khẩu", e2e đổi sang `getByLabel("Mật khẩu", { exact: true })`.
- Các trang trong app (trang chủ, giao dịch, danh mục) vẫn dùng màu emerald cũ; nên chuyển sang bảng màu mới ở T15.

## T12. Service và API thống kê (2026-11-24) — đóng luôn T9
- `src/server/stats/service.ts`: `getSummary`, `getStatsByCategory`, `getDailyStats`. Chung một phạm vi: `userId`, `deletedAt = null`, `occurredAt` trong `[start, end)` của tháng theo múi giờ user (`getMonthRange`). Thiếu `month` thì lấy tháng hiện tại theo múi giờ user.
- Summary và by-category tổng hợp bằng `groupBy` + `_sum` trong Postgres. Daily lấy các dòng của tháng rồi gom theo ngày địa phương bằng `toDateKey`, để dùng đúng quy tắc múi giờ đã test ở T4 thay vì viết lại bằng `AT TIME ZONE` trong SQL. Trả đủ mọi ngày của tháng (ngày trống là 0) cho biểu đồ.
- `percent` tính trên số nguyên: `round(total * 1000 / tổng) / 10`, một chữ số thập phân; tổng các phần trăm có thể lệch 0,1 do làm tròn.
- By-category gồm cả danh mục đã lưu trữ, sắp xếp tổng giảm dần rồi theo tên.
- Test dữ liệu mẫu (UTC+7): ranh giới 16:59:59Z/17:00Z ở cả đầu và cuối tháng, đổi sang Europe/London, giao dịch xóa mềm, dữ liệu user khác, tháng nhuận (2028-02), tổng daily khớp summary. Lúc đầu test London kỳ vọng sai (đã nhầm ranh giới), service đúng.
- Test phân quyền T11 tự phát hiện 3 endpoint mới chưa có trường hợp; đã thêm. Bỏ `userId` khỏi phạm vi thống kê làm 7 test đỏ.
- T9 được tick: điều kiện "xóa mềm không xuất hiện ở thống kê" đã có test.

## T13. Dashboard theo tháng (2026-11-24)
- Trang chủ `/` thành dashboard: chào, chọn tháng (‹ ›, `?month=`), nút thêm giao dịch, ba ô Thu/Chi/Số dư, "Chi theo danh mục", "Chi theo ngày". Dùng bảng màu thương hiệu (`.dash-shell`), có chế độ tối.
- Theo yêu cầu người dùng: phần danh mục dùng **thanh xếp hạng** (một màu, lớn nhất trước, kèm số tiền và %) thay cho biểu đồ tròn ghi trong PLAN, cộng một thanh tỉ lệ mảnh ở trên (5 danh mục đầu có màu riêng, còn lại gộp "Khác"). Lý do: so sánh góc của biểu đồ tròn khó và kém chính xác.
- Màu biểu đồ: bảng categorical đã được validator của skill dataviz kiểm tra trên nền thẻ trắng và `#0b2639` (đạt CVD và phân biệt màu; 3 màu dưới 3:1 trên nền sáng nên mỗi dòng luôn có tên và số tiền in rõ). Màu theo thứ hạng trong tháng, nên đổi tháng có thể đổi màu của một danh mục; danh tính luôn nằm ở tên, không chỉ ở màu.
- "Chi theo ngày": Recharts `3.10.1` (ghim; bản mới nhất 3.11.x mới phát hành dưới 2 tuần). Một chuỗi (chi), một trục; thu nhập khác thang đo (lương làm lùn mọi khoản chi) nên chỉ hiện ở ô tổng và tooltip. Có tooltip khi rê chuột, bảng "Xem dạng bảng" cho trình đọc màn hình. Trục Y dùng `formatVndCompact` (45k, 1,5tr, 1 tỷ; chỉ để hiển thị) trong `src/lib/money.ts`, có unit test.
- Sửa lỗi phát hiện khi build: route GET thống kê gọi `connection()` (qua `requireUserId`) trong `try/catch`, nên tín hiệu dừng prerender của Next bị `errorResponse` bắt và ghi log. `errorResponse` giờ gọi `unstable_rethrow` trước tiên (có test với `notFound()`).
- E2E "register, sign out, and sign in again" chập chờn khi mọi worker cùng đăng ký trên server vừa khởi động: đo tuần tự chỉ 0,7–1,7 s, nhưng song song có lúc quá 5 s. Nâng `expect.timeout` của Playwright lên 10 s (ghi lý do trong `playwright.config.ts`). Sau đó e2e lặp 3 lần: 96/96.
- E2E dashboard: dữ liệu tháng 6/2026 tạo qua API (có một giao dịch đã xóa và một giao dịch 23:30 ngày 31/05 giờ Việt Nam), kiểm tra từng số trên dashboard, bảng theo ngày và chuyển tháng.
- `npm audit` vẫn chỉ 3 cảnh báo cũ của Prisma/`effect`; Recharts không thêm cảnh báo.

## T14. Ngân sách theo danh mục (2026-11-24)
- `src/lib/budget.ts`: `percentUsed(spent, limit)` = `floor(spent * 1000 / limit) / 10`, làm tròn **xuống** để số hiển thị và cảnh báo luôn khớp (79.999/100.000 hiện 79,9% và chưa cảnh báo). `budgetStatus`: `ok` < 80 ≤ `warning` < 100 ≤ `over`. Unit test ở đúng các ngưỡng.
- `src/server/budgets/service.ts`: `upsertBudget` (khóa duy nhất `(userId, categoryId, month)`), `upsertBudgetFromForm` (hạn mức gõ "2tr"), `listBudgets` (chi tiêu theo tháng của múi giờ user, bỏ giao dịch xóa mềm), `deleteBudget` (xóa cứng vì ngân sách không phải giao dịch; của user khác là 404). Chỉ đặt được cho danh mục **chi** của chính user, chưa lưu trữ; ngân sách có sẵn vẫn hiện nếu danh mục bị lưu trữ sau đó.
- API `GET/PUT /api/budgets`, `DELETE /api/budgets/:id`; đã thêm vào bộ test phân quyền (route và server action).
- Trang `/budgets`: chọn tháng, form đặt/đổi hạn mức, thẻ mỗi ngân sách với thanh tiến độ (`role="meter"`). Cảnh báo dùng màu trạng thái cố định (vàng `#fab219`, đỏ `#d03b3b`) **kèm biểu tượng và chữ** ("Sắp chạm hạn mức", "Vượt hạn mức", "Đã vượt …"), không chỉ dựa vào màu. Tách header dùng chung `src/components/layout/app-header.tsx` (thêm mục "Ngân sách").
- E2E: 79,9% không cảnh báo, 80% cảnh báo, 105% vượt; đổi hạn mức cùng danh mục cập nhật chứ không tạo thêm; xóa; hạn mức sai.
- Vướng mắc chưa giải quyết (e2e chập chờn lúc server vừa khởi động): "register, sign out, and sign in again" thỉnh thoảng hết 10 s ở bước đăng ký. Đo tạm (đã gỡ): phần đăng ký + đăng nhập luôn < 0,75 s, nhưng 4 lần render dashboard đầu tiên ngay sau khi khởi động mất 2–7,7 s ở bước truy vấn thống kê; các lần sau 30–170 ms. Prisma đo riêng thì nhanh (truy vấn đầu 105 ms, 28 truy vấn đồng thời 55 ms). Đổi `localhost` sang `127.0.0.1` giảm còn ~5,6 s; tăng `UV_THREADPOOL_SIZE=16` cho kết quả không nhất quán (1,7 s rồi 6,9 s). Giả thuyết còn mở: tranh chấp threadpool libuv giữa `scrypt` (đăng ký/đăng nhập song song) và việc mở kết nối Postgres mới (SCRAM). Ảnh hưởng thật: request đầu tiên sau khi khởi động lạnh có thể chậm vài giây. Nên điều tra tiếp ở T16/T17 (ví dụ đo trên Vercel + Postgres hosted). CI có `retries: 2`.

## Thiết kế lại trang giao dịch theo bảng màu Lucky Money (2026-11-24, ngoài PLAN, theo yêu cầu)
- `/transactions`, `/transactions/new`, `/transactions/[id]/edit` và trang "Không tìm thấy" chuyển sang `.dash-shell` + `AppHeader`, cùng phong cách với dashboard và ngân sách; có chế độ tối (`color-scheme: dark` để ô chọn ngày và menu select của trình duyệt cũng tối).
- Bộ control dùng chung `src/components/ui/brand-form.tsx` (`BrandField`, `BrandSelect`, `BrandAlert`, nút chính/phụ, `Spinner`). Kích thước tách riêng (`brandControl`, `brandControlCompact`, biến thể `large`) vì nối class Tailwind xung đột (`h-12` với `h-10`) không đảm bảo class nào thắng — đã gây lệch ô lọc khi chụp màn hình.
- Form: công tắc Chi/Thu có thanh trượt (xanh trời cho chi, bạc hà cho thu), ô số tiền lớn, ngày và ghi chú cùng hàng trên màn hình rộng, thông báo "Đã lưu" có biểu tượng và hiệu ứng mỗi lần lưu.
- Danh sách: mỗi dòng có vòng biểu tượng danh mục, tên, ghi chú, số tiền (thu màu xanh lá, chi giữ màu chữ) và ngày; trạng thái rỗng có nút thêm giao dịch; chuyển tháng bằng nút tròn ‹ › (nhãn "Tháng trước"/"Tháng sau"); phân trang có mũi tên SVG thay ký tự "→".
- `src/components/ui/form.tsx` (kiểu cũ) giờ chỉ còn trang danh mục dùng.
- E2E cập nhật theo giao diện: ghi chú và ngày nằm ở hai chỗ riêng thay vì chuỗi "15/10/2026 · Bún chả", nút "Tháng sau" thay "Tháng sau →".

## Menu chuyển sang sidebar bên trái (2026-11-24, ngoài PLAN, theo yêu cầu)
- Layout chung `src/app/(app)/layout.tsx` + `src/components/layout/app-shell.tsx`: sidebar trái (logo, Tổng quan, Giao dịch, Ngân sách, Danh mục, có biểu tượng), thanh trên cùng chỉ còn nút "Đăng xuất". Dashboard chuyển từ `src/app/page.tsx` vào `src/app/(app)/page.tsx` để dùng chung layout; layout giữ nguyên khi chuyển trang nên thanh đánh dấu mục hiện tại có hiệu ứng. Bỏ `app-header.tsx`.
- Trang danh mục (vẫn kiểu cũ bên trong) cũng nằm trong khung mới; bỏ hai liên kết "Trang chủ"/"Giao dịch" ở đầu trang.
- Dưới `lg`: sidebar thành ngăn kéo trượt từ trái (nút "Mở menu", `aria-expanded`, lớp phủ mờ), đóng khi chọn mục, bấm lớp phủ hoặc Esc; khi đóng dùng `invisible` + `inert` để không vào được bằng bàn phím hay trình đọc màn hình. Trên màn hình nhỏ nút đăng xuất chỉ hiện biểu tượng, chữ "Đăng xuất" vẫn là tên truy cập.
- Next (Cache Components) đòi `usePathname()` nằm trong `<Suspense>` ở route động (`/transactions/[id]/edit` làm build lỗi). Chỉ danh sách menu đọc `usePathname`, bọc trong `<Suspense>` với dự phòng là cùng danh sách chưa đánh dấu.
- E2E mới `tests/e2e/navigation.spec.ts`: mục hiện tại có `aria-current`, thanh trên chỉ có nút đăng xuất, ngăn kéo mở/đóng trên điện thoại.

## Tổng quan: "Chi theo danh mục" thành biểu đồ tròn (2026-11-24, theo yêu cầu)
- Người dùng đổi ý so với lựa chọn ở T13 (thanh xếp hạng): dùng biểu đồ tròn. `src/components/dashboard/category-donut.tsx` thay `category-breakdown.tsx`.
- Donut Recharts: tối đa 5 lát có màu riêng (bảng categorical đã validate), phần còn lại gộp thành "Khác (n danh mục)" màu xám; giữa vòng là tổng chi. Chú giải bên cạnh có chấm màu, tên, % và số tiền, nên không nhận diện bằng màu đơn thuần.
- Rê chuột vào lát hoặc dòng chú giải: làm mờ phần còn lại, nhãn giữa vòng đổi sang tên, số tiền và % của lát đó. Bỏ tooltip của Recharts vì đè lên nhãn giữa (phát hiện khi chụp màn hình); hiệu ứng lát phình ra (`activeShape`) chỉ chạy khi có tooltip nên cũng bỏ.
- Chú giải hai tầng (tên + % / số tiền) vì cột hẹp làm tên bị cắt thành "K…" ở phiên bản đầu.
- Cột "Chi theo danh mục" rộng hơn cột "Chi theo ngày" (6fr/5fr). E2E kiểm tra donut có 2 lát và "Tổng chi 75.000 ₫".

## Thống kê theo tuần / tháng / năm (2026-11-24, ngoài PLAN, theo yêu cầu)
- `src/lib/dates.ts` thêm `addDays`, `startOfWeekKey` (tuần bắt đầu Thứ Hai), `getDayRange(startKey, days, timeZone)`, `isValidDateKey`; unit test gồm năm nhuận, qua năm, DST New York (tuần có 7 ngày + 1 giờ).
- `getPeriodStats` trong `src/server/stats/service.ts` + `GET /api/stats/period`: kỳ tuần (7 bucket ngày), tháng (bucket ngày), năm (12 bucket tháng), theo múi giờ user, bỏ giao dịch xóa mềm; trả `previous`/`next` để điều hướng. Đã thêm vào bộ test phân quyền.
- Trang `/stats` (mục "Thống kê" trong sidebar): tab Tuần/Tháng/Năm có thanh trượt, nút kỳ trước/sau, ba ô Thu/Chi/Số dư, biểu đồ cột Recharts với nút chuyển **Chi / Thu** (một chuỗi mỗi lần, một trục — thu và chi khác thang đo), tooltip và bảng số liệu. Trạng thái kỳ nằm trên URL (`?period=&date=`), đổi tab giữ nguyên ngày neo.
- `SummaryTiles` nhận `{ income, expense, balance }` để dùng lại.
- E2E `tests/e2e/stats.spec.ts`. Không đếm `.recharts-bar-rectangle` vì Recharts không vẽ cột giá trị 0; kiểm tra bảng số liệu thay thế.

## Menu avatar và trang Tài khoản (2026-11-24, ngoài PLAN, theo yêu cầu)
- Quyết định đã hỏi người dùng: avatar tải lên và lưu trong DB (cắt vuông, 256×256 trong trình duyệt); username chỉ để hiển thị, vẫn đăng nhập bằng email; email chỉ xem (chưa có xác minh email, và email gắn với liên kết Google).
- Migration `20261124120000_profile_and_preferences` tạo bằng `prisma migrate diff --from-config-datasource --to-schema` (vì `migrate dev` từ chối shell không tương tác), áp dụng bằng `migrate deploy`; diff sau đó rỗng. Bảng `UserAvatar` tách riêng để truy vấn `User` không tải ảnh.
- `src/server/account/service.ts`: `getAccount`, `updateProfile` (username chuẩn hóa chữ thường, trùng → 409 trên trường username; ngày sinh không ở tương lai theo múi giờ user và không trước 1900), `changePassword` (bắt buộc mật khẩu hiện tại nếu đã có; tài khoản chỉ Google được tạo mật khẩu), `setAvatar` (kiểm tra PNG/JPEG/WebP bằng chữ ký byte đầu, không tin `type` khai báo; tối đa 200 KB), `removeAvatar`, `getAvatar`.
- `GET /api/account/avatar` chỉ trả ảnh của user trong phiên (không có tham số user), `Cache-Control: private, immutable` với `?v=` đổi theo mỗi lần tải; `x-content-type-options: nosniff`.
- Thanh trên cùng: nút avatar vuông (ảnh hoặc chữ cái đầu trên nền gradient). Rê chuột mở menu, rời ra đóng sau 180 ms; bấm thì ghim mở; Esc/bấm ra ngoài/chọn mục thì đóng, Esc trả focus về nút. Menu có tên, @username hoặc email, Tài khoản, Cài đặt, Đăng xuất. Menu đóng dùng `invisible` + `inert`.
- Trang `/account` (ảnh đại diện + thông tin cá nhân) và `/account/security` (đổi/tạo mật khẩu), tab con dùng chung `SectionTabs` (đọc `usePathname` trong `<Suspense>`).
- Còn mở: đổi mật khẩu không thu hồi các phiên JWT khác (ghi chú cho người dùng trên trang); chưa giới hạn số lần thử mật khẩu hiện tại (T16).
- Kiểm tra độ mạnh: bỏ bước kiểm tra mật khẩu hiện tại làm test đổi mật khẩu đỏ; cho route avatar trả ảnh bất kỳ làm test phân quyền (avatar của Bob chứa "BOBAVATAR") đỏ.
- E2E đăng xuất giờ mở menu avatar trước (`signOut` helper).

## Cài đặt: tùy chỉnh tài chính, giao diện, thông báo, về ứng dụng (2026-11-24, ngoài PLAN, theo yêu cầu)
- Quyết định đã hỏi người dùng: chỉ VND (cài đặt đổi cách hiển thị, không đa tiền tệ); thông báo chỉ trong ứng dụng (chưa có dịch vụ email/đẩy).
- `src/server/settings/service.ts`: `getPreferences`, `updateDisplayPreferences` (kiểu số tiền SYMBOL/DONG/SHORT, định dạng ngày DMY/ISO, ngày đầu tuần, múi giờ IANA hợp lệ), `updateTheme`, `updateNotificationPreferences`, `getBudgetAlerts(userId, month)` (ngân sách ở mức cảnh báo/vượt theo hai công tắc).
- Mọi tùy chọn có tác dụng: `formatMoney`/`formatDateKey` (unit test) được truyền qua prop `display` tới ô tổng, biểu đồ tròn, biểu đồ theo ngày/kỳ, danh sách giao dịch, thẻ ngân sách; ngày đầu tuần áp vào `getPeriodStats` (`startOfWeekKey(date, weekStart)`); múi giờ là `User.timeZone` sẵn có.
- Giao diện Sáng/Tối/Theo hệ thống: `<html data-theme>`; Tailwind `@custom-variant dark` (dark khi `data-theme="dark"`, hoặc `"system"` + hệ điều hành tối) và các khối màu dùng `@variant dark`. Script nhỏ trong `<head>` của layout gốc đọc cookie `lm-theme` trước lần vẽ đầu (không nháy, layout gốc vẫn tĩnh). Lưu giao diện ghi DB và cookie; menu avatar đồng bộ lại cookie trên thiết bị mới.
- Thông báo: dải "Cảnh báo ngân sách" trên Tổng quan (biểu tượng + chữ + %), ẩn theo công tắc.
- Trang `/settings`, `/settings/appearance`, `/settings/notifications`, `/settings/about` (phiên bản lấy từ `package.json`).
- Ghi chú quy trình: một lệnh `node - <<'EOF'` dài chứa nhiều dấu nháy/backtick làm bash lỗi cú pháp (không chạy gì); chuyển sang ghi script ra file bằng Write rồi chạy, đúng như mục "Lỗi hay gặp".

## Giao diện tối theo bảng màu teal / navy / tím (2026-11-24, theo yêu cầu)
- Bảng màu người dùng chọn cho chế độ tối: `#78B9B5`, `#0F828C`, `#065084`, `#320A6B`. Chế độ sáng giữ nguyên.
- Màu thương hiệu `lm-*` thành vai trò theo theme qua biến CSS (`@theme inline { --color-lm-sky: var(--lm-sky) … }`): sky = màu nhấn, ink = chữ trên màu nhấn, deep = viền focus/liên kết, aqua/lime/mint = nền phụ. Tối: nhấn `#78B9B5` với chữ `#0c0a24` (8,7:1), viền focus `#78B9B5` trên thẻ (7,9:1); `#0F828C` chỉ làm nền (chữ trên nó chỉ 4,1:1).
- Nền tối `#0b0a22` với hai vầng sáng tím `#320A6B` và navy `#065084`; thẻ `#131536`, chữ `#eaf4f3`, chữ phụ `#a3c4c1` (9,5:1), viền `#2a2f66`. Bảng đăng nhập: gradient tím → navy → teal, chữ sáng (biến `--panel-*` riêng).
- Bóng và hover viết cứng màu xanh trời (`rgb(48 175 255 / …)`, `#4dbaff`) chuyển sang `color-mix(… var(--lm-sky) …)` / `var(--lm-sky-hover)` để theo theme.
- Bảng màu biểu đồ (categorical đã validate) giữ nguyên; chạy lại validator trên nền thẻ mới `#131536`: đạt mọi kiểm tra.

## Thiết kế lại trang Danh mục, bộ chọn biểu tượng (2026-11-24, theo yêu cầu)
- Trang `/categories` theo phong cách chung (`.dash-shell`, brand-form): thẻ "Thêm danh mục" (tên, công tắc Chi/Thu có thanh trượt, biểu tượng), ba thẻ Chi / Thu / Đã lưu trữ có số lượng, mỗi dòng có vòng biểu tượng, nút "Sửa" (mở form sửa tên + biểu tượng ngay tại dòng) và "Lưu trữ"/"Khôi phục". Xóa `src/components/ui/form.tsx` (không còn dùng).
- Ô biểu tượng thành `IconPicker`: nút vuông sổ ra danh sách hoạt động thường ngày theo nhóm (Ăn uống, Đi lại, Nhà ở, Mua sắm, Sức khỏe, Học tập, Giải trí, Gia đình, Thu nhập, Tài chính), mỗi mục có emoji + tên; ô tìm kiếm không phân biệt dấu/hoa thường; "Không dùng biểu tượng"; Esc/bấm ngoài để đóng, trả focus về nút. Dữ liệu ở `src/lib/category-icons.ts` (unit test: không trùng, vừa cột icon, chứa mọi icon danh mục mặc định, tìm kiếm). API vẫn nhận biểu tượng tùy ý ≤ 16 ký tự.
- Lỗi phát hiện qua e2e: bảng chọn bị thẻ phía dưới đè lên (mỗi thẻ có `animate-lm-rise` → `transform` tạo stacking context riêng, `z-40` không thoát ra được) và bị `overflow-hidden` cắt. Sửa: thẻ "Thêm danh mục" `relative z-20`, thẻ danh sách `relative focus-within:z-10`, bỏ `overflow-hidden`. Trên điện thoại bảng chọn rộng bằng ô (trước đó tràn 5 px).

## Bỏ lưu trữ danh mục, thay bằng xóa có xác nhận (2026-11-24, theo yêu cầu)
- Quyết định đã hỏi người dùng: chỉ xóa được danh mục **không còn giao dịch** (chưa xóa mềm). Còn giao dịch thì `409`, thông báo nêu số giao dịch cần chuyển hoặc xóa trước.
- Migration `20261124180000_category_delete_instead_of_archive`: đặt lại `archivedAt = NULL` cho mọi danh mục (các danh mục đã lưu trữ có thể còn giao dịch nên hiện lại bình thường), rồi đổi tên cột thành `deletedAt`.
- `deleteCategory`: danh mục trống → xóa hẳn (ngân sách cascade). Nếu chỉ còn giao dịch **đã xóa mềm** trỏ tới (AGENTS cấm xóa cứng giao dịch, FK là `Restrict`) → đặt `deletedAt`, xóa ngân sách, đổi tên thành `"<tên> (đã xóa <id>)"` để giải phóng ràng buộc `(userId, name, type)`; mọi truy vấn danh mục lọc `deletedAt: null` nên nó không xuất hiện ở đâu nữa, không dùng/sửa/xóa lại được.
- Vì danh mục còn giao dịch không xóa được, mọi giao dịch đang hiển thị luôn có danh mục bình thường: bỏ cờ `archived` khỏi danh sách giao dịch, ngân sách, form sửa, bộ lọc. `listCategories` trả `transactionCount`. Bỏ `includeArchived`, route `archive`/`restore`; thêm `DELETE /api/categories/:id` (bộ test phân quyền).
- Giao diện: mỗi dòng có "Sửa" và "Xóa" + số giao dịch. "Xóa" mở `<dialog>` gốc (`showModal`: giữ focus, Esc đóng, bấm nền đóng) với hiệu ứng vào: danh mục trống → "Xóa danh mục?" + Hủy / Xóa danh mục; còn giao dịch → "Chưa xóa được danh mục", nêu số giao dịch, chỉ có nút Đóng. Bỏ thẻ "Đã lưu trữ".
- Cập nhật `docs/api.md` và PRD F3. Ghi chú: T10 trong PLAN mô tả "lưu trữ, khôi phục" theo yêu cầu cũ; hành vi hiện tại theo mục này.
- Test: bỏ các test chỉ còn ý nghĩa với lưu trữ (danh mục lưu trữ trên giao dịch/ngân sách cũ); các test "không chọn được" chuyển sang danh mục đã xóa. Kiểm tra độ mạnh: nới điều kiện "còn giao dịch" làm test từ chối xóa đỏ.

## T22. Sổ nợ (2026-11-24, theo yêu cầu)
- Đã hỏi người dùng: lịch trả **nhiều kỳ**; trả/thu nợ **không** tạo giao dịch thu/chi (sổ nợ riêng, không làm sai thống kê); nhắc hạn bằng **email**.
- Mô hình: `Debt` (chiều `I_OWE`/`THEY_OWE`, người, số tiền, ngày vay), `DebtInstallment` (lịch dự kiến, có `upcomingRemindedAt`/`overdueRemindedAt`), `DebtPayment` (lần trả thực tế). Ngày là chuỗi `YYYY-MM-DD` theo múi giờ user, không phải thời điểm, nên không lệch ngày khi đổi múi giờ.
- Không lưu trạng thái từng kỳ: `scheduleStatus` (src/lib/debt.ts, hàm thuần) tính từ lịch + tổng đã trả, phủ các kỳ theo thứ tự ngày hạn. Sửa lịch hay hoàn tác lần trả thì trạng thái tự đúng.
- Sửa khoản nợ thay toàn bộ lịch trả (xóa và tạo lại các kỳ), nên dấu "đã nhắc" của các kỳ cũ mất theo; kỳ mới có thể được nhắc lại. Chấp nhận được.
- Email: `nodemailer` qua `SMTP_URL` (dev không có thì in ra log server; production thiếu thì báo lỗi). Chọn bản 8.x vì `next-auth` khai báo peer `nodemailer ^7 || ^8.0.5`. Cron `/api/cron/debt-reminders` lúc 01:00 UTC (08:00 giờ VN) qua `vercel.json`, bảo vệ bằng `CRON_SECRET` (so sánh hằng thời gian; chưa đặt thì từ chối mọi lời gọi). Mỗi user một email; chỉ đánh dấu "đã nhắc" sau khi gửi thành công nên lỗi SMTP được thử lại lần sau.
- Kiểm tra độ mạnh: bỏ lọc `userId` ở `findOwned` làm 3 case phân quyền đỏ; bỏ điều kiện "đã nhắc sắp đến hạn" làm test "nhắc một lần" đỏ.

## T15. Responsive, bàn phím, trạng thái loading/lỗi/rỗng (2026-11-24)
- Test e2e mới `tests/e2e/responsive-a11y.spec.ts`: mở 17 trang trong app (có dữ liệu: ghi chú dài, tên người nợ dài, số tiền 9 chữ số) và 2 trang đăng nhập ở 360px, kiểm tra trang không cuộn ngang và không phần tử nào trong `<main>` vượt mép phải. Phần tử nằm trong dải cuộn ngang có chủ đích (thanh tab Cài đặt) được bỏ qua.
- Lỗi tìm được và đã sửa: (1) thẻ khoản nợ tràn 110px khi tên dài (thiếu `min-w-0` trên ô lưới); (2) lời chào trang Tổng quan tràn 292px với email dài không có dấu gạch (dùng `overflow-wrap:anywhere`). Lỗi (2) chỉ lộ ra khi chụp màn hình; email trong test được đổi thành chuỗi liền để test bắt được.
- Bàn phím: skip link "Bỏ qua tới nội dung chính" là điểm Tab đầu tiên, nhảy tới `#noi-dung`. Menu điện thoại: mở thì focus vào mục đầu, Esc đóng và trả focus về nút menu, phần nội dung phía sau `inert` khi menu mở. Trước đây focus không vào được menu vì `visibility` còn `hidden` ở khung đầu của transition; giờ hiện ngay khi mở, chỉ trễ khi đóng.
- Loading: `LoadingState` (khung xương có `role="status"`, "Đang tải…" cho trình đọc màn hình, dừng nhấp nháy khi người dùng giảm chuyển động) thay dòng chữ ở 16 trang.
- Lỗi: `src/app/(app)/error.tsx` (giữ sidebar, nút "Thử lại" và "Về trang tổng quan") và `src/app/global-error.tsx` (khi chính layout gốc lỗi, HTML tự định dạng). Hai file này chỉ được kiểm qua build, chưa có test tự động vì khó gây lỗi server có kiểm soát trong e2e.
- Rỗng: đã có từ trước ở mọi danh sách và biểu đồ; kiểm lại bằng ảnh chụp tài khoản mới ở 360px. Trang không tìm thấy giờ ghi chung chung và dẫn về Tổng quan (trước dẫn về Giao dịch).

## Bộ chọn ngày riêng (2026-11-24, theo yêu cầu)
- `DatePicker` (src/components/ui/date-picker.tsx) thay `<input type="date">` ở 6 chỗ: ngày giao dịch, ngày sinh, ngày vay, kỳ đầu tiên, từng kỳ trả, ngày trả nợ. Không thêm dependency.
- Ô gõ được `dd/mm/yyyy` (nhận cả `24112026`, `24-11-2026`, `2026-11-24`); gõ sai thì báo ngay. Giá trị gửi lên server vẫn là `YYYY-MM-DD` qua input ẩn, nên action và Zod không đổi; chuỗi gõ sai được gửi nguyên để server báo lỗi như cũ.
- Lịch: tuần bắt đầu Thứ Hai, Chủ Nhật màu đỏ, luôn 6 hàng để không nhảy chiều cao, ngày ngoài tháng hiện mờ, hôm nay có viền, ngày chọn tô xanh. Bấm tiêu đề để chọn tháng, rồi chọn năm (khối 12 năm). Nút tắt "Hôm nay", "Hôm qua" (giao dịch, ngày vay, ngày trả), "Xóa" cho ô không bắt buộc. `min`/`max` khóa ngày, tháng, năm ngoài khoảng.
- Bàn phím theo mẫu APG date picker: mũi tên theo ngày/tuần, Home/End đầu/cuối tuần, PageUp/PageDown theo tháng (Shift: theo năm), Enter chọn, Esc đóng và trả focus về nút lịch; Alt+↓ trong ô mở lịch. Lịch tự canh phải khi sát mép phải màn hình (360px không cuộn ngang).
- Hàm thuần trong `src/lib/calendar.ts` (đọc ngày gõ, lưới tháng, nhãn đọc màn hình) có unit test; e2e `date-picker.spec.ts` kiểm chọn bằng chuột, bàn phím, phím tắt, gõ tay, lưu đúng ngày, và đi tới ngày sinh 1995 qua bảng năm. Hai e2e cũ đổi giá trị mong đợi sang `dd/mm/yyyy`.
- Lịch luôn hiện `dd/mm/yyyy`, chưa theo tùy chọn định dạng ngày ISO trong Cài đặt.

## "Đã tất toán" cho khoản nợ nhiều kỳ (2026-11-24, theo yêu cầu)
- Tất toán = ghi một `DebtPayment` bằng toàn bộ số còn lại, ngày hôm nay theo múi giờ user, ghi chú "Tất toán". Không thêm cột hay trạng thái mới: mọi kỳ thành "Đã trả" nhờ `scheduleStatus`, khoản nợ vào "Đã xong", và hoàn tác bằng nút "Hoàn tác" của lần trả đó. Khoản đã trả xong thì `409`.
- Nút chỉ hiện với khoản có từ 2 kỳ và chưa trả xong; bấm thì mở `<dialog>` xác nhận (số còn lại, ngày, số kỳ còn lại). Chưa có route API riêng; chỉ có server action, được thêm vào bộ test phân quyền.
- Ảnh chụp 360px lộ lỗi có sẵn: ba số "Số tiền nợ / Đã trả / Còn lại" đè lên nhau. Test T15 thêm kiểm tra "chữ tràn khỏi ô của nó" (bắt được lỗi trước khi sửa); trên điện thoại ba số giờ xếp thành dòng.

## T23. Tích góp (2026-11-24, theo yêu cầu)
- Đã hỏi người dùng: dạng **hũ tiền / quỹ** (không mục tiêu, không lịch góp); **không** tính vào thu chi; **chưa** cần nhắc nhở.
- Mô hình: `SavingsJar` (tên duy nhất trong user, biểu tượng) và `SavingsEntry` (`DEPOSIT`/`WITHDRAW`, số tiền dương, ngày `YYYY-MM-DD`, ghi chú). Số dư không lưu mà tính từ các lần nạp/rút (cùng cách Sổ nợ), nên hoàn tác hay sửa không thể làm lệch số.
- Ràng buộc số dư không âm ở hai chỗ: rút không quá số dư, và không hoàn tác lần nạp nếu số dư còn lại không đủ (`409` với lời giải thích "hãy hoàn tác lần rút trước").
- Xóa hũ được kể cả khi còn tiền (có hộp xác nhận nêu số dư), vì đây là sổ ghi, không phải tiền thật bị mất.
- Giao diện: thẻ tổng (gradient màu thương hiệu), lưới hũ với phần trăm trong tổng, form tạo hũ dùng lại bộ chọn biểu tượng; trang hũ có Nạp/Rút (dùng DatePicker), lịch sử có số dư sau mỗi lần, Sửa/Xóa. Thông báo thành công/thất bại như form Danh mục.
- Kiểm tra 360px (thêm 2 trang, dữ liệu dài) bắt được lỗi trang hũ tràn 318px: cột lưới giãn theo ghi chú dài; sửa bằng `minmax(0, …)`. Kiểm tra độ mạnh: bỏ lọc `userId` làm 4 case phân quyền đỏ.

## T24. Quên mật khẩu (2026-11-25, theo yêu cầu)
- Luồng: `/login` → "Quên mật khẩu?" → `/forgot-password` (nhập email, rồi nhập mã trên cùng trang) → `/reset-password` (mật khẩu mới + nhập lại) → popup "Đổi mật khẩu thành công" với nút "Đăng nhập". Thiết kế ở `docs/superpowers/specs/2026-11-25-forgot-password-design.md`.
- Mã OTP 6 chữ số, hết hạn 10 phút, sai 5 lần thì khóa (lần nhập đúng cũng tính một lượt, đếm nguyên tử để đoán song song không vượt giới hạn), mỗi email chờ 60 giây mới gửi lại, mã mới thay mã cũ. Chỉ lưu SHA-256 của `id:mã`.
- Nhập đúng mã thì nhận vé 32 byte (lưu SHA-256, dùng một lần, 15 phút) trong cookie httpOnly `lm-reset-ticket`, `path=/reset-password`. Trang đặt lại chỉ hiện form khi vé hợp lệ.
- Không lộ email: mọi email đều thấy "Nếu email đã đăng ký, mã đã được gửi.". Tài khoản chỉ có Google không nhận mã (người dùng chọn). Gửi email lỗi thì chỉ ghi log, câu trả lời không đổi; hệ quả là người dùng thật không biết email không đi.
- Đặt lại xong không xóa cookie: xóa cookie trong server action làm Next.js render lại trang (vé đã hết) và mất popup; vé đã bị xóa ở DB nên cookie vô dụng và tự hết hạn.
- Phiên JWT đang mở ở thiết bị khác không bị thu hồi sau khi đổi mật khẩu (giới hạn của phiên không trạng thái). Giới hạn tần suất theo IP để cho T16.
- E2E chạy không có SMTP: test ghi đè `codeHash` của bản ghi vừa tạo bằng mã đã biết (`hashResetCode`), không có đường code riêng cho test trong ứng dụng.
- Kiểm tra độ mạnh: bỏ điều kiện email khi tìm mã làm test "mã của A không dùng cho B" đỏ.
- Sau review: tối đa 5 mã mỗi tài khoản trong 24 giờ (mã cũ bị cho hết hạn thay vì xóa, để đếm được), nên kẻ biết email chỉ đoán được tối đa 25 lần/ngày. Email chứa mã gửi sau khi đã trả lời (`after()` của Next.js, `src/server/email/background.ts`), nên SMTP chậm/treo không làm treo request và không lộ email nào có tài khoản qua thời gian phản hồi.
- Sửa các lỗi nhỏ sau review: (1) ô mã cho gõ tới 12 ký tự, nên "24 68 10" không bị cắt (server bỏ khoảng trắng); (2) nút "Đổi email" ở bước nhập mã quay về bước 1, giữ email đã gõ, không gọi server; (3) hai yêu cầu cùng lúc chỉ gửi một mã: kiểm tra thời gian chờ và giới hạn ngày nằm trong transaction có khóa dòng `User` (`SELECT … FOR UPDATE`); (4) e2e mới: mở lại `/reset-password` sau khi đổi thành công thì báo hết hạn, và mọi bước (nhập mã, mã sai, form lỗi, popup) không cuộn ngang ở 360px.

## Chuyển tab Đăng nhập/Đăng ký mượt hơn, bỏ placeholder (2026-11-25, theo yêu cầu)
- Lỗi: form Đăng ký cao hơn Đăng nhập và cột form được căn giữa, nên khi đổi tab thanh tab nhảy dọc ~48px trong một khung hình. Người dùng chọn giữ căn giữa và cho co giãn mượt: `AuthTransition` đo nội dung bằng `ResizeObserver` và chuyển chiều cao khung trong 420ms, nên thanh tab trượt thay vì nhảy. Tắt khi người dùng giảm chuyển động.
- E2E `auth-transition.spec.ts` lấy mẫu vị trí thanh tab mỗi khung hình: không khung nào đi quá nửa quãng đường (code cũ: nhảy trọn 49.6px). Ngưỡng tương đối để không đỏ oan khi máy bận rớt khung.
- Xóa toàn bộ 19 placeholder ở 13 file (theo yêu cầu, toàn app). Mọi ô đều đã có nhãn hoặc `aria-label`; gợi ý định dạng vẫn nằm ở dòng hint (ví dụ "Ví dụ: 50000, 50k, 1tr5"). Ô ngày không còn "dd/mm/yyyy" trong ô. Unit test `no-placeholders.test.ts` chặn placeholder quay lại.

## Bỏ đăng nhập/đăng ký bằng Google (2026-11-25, theo yêu cầu)
- Gỡ provider Google khỏi `src/auth.ts` (chỉ còn credentials), nút "Tiếp tục với Google" ở `/login` và `/register`, `googleSignInAction`, `src/server/auth/google.ts`, các biến `AUTH_GOOGLE_*` trong `.env.example` và Playwright, test `google.test.ts`, `google.spec.ts`. T6 trong PLAN đánh dấu đã bỏ.
- Migration `remove_google_sign_in`: xóa bảng `Account`, `User.passwordHash` thành bắt buộc. Trước khi làm đã kiểm DB local: 0 dòng `Account`, 0 user thiếu mật khẩu; app chưa triển khai. Nếu DB nào còn user thiếu mật khẩu, migration báo lỗi thay vì tự xóa user.
- Hệ quả: bỏ nhánh "tài khoản chỉ Google" ở đổi mật khẩu (giờ luôn bắt buộc mật khẩu hiện tại, kiểm ở Zod), quên mật khẩu và đăng nhập. Trang Bảo mật chỉ còn "Đổi mật khẩu"; dòng gợi ý email ở Tài khoản không còn nhắc Google. Trang `/login` vẫn hiện một thông báo chung cho mọi `?error=` của Auth.js.

## T17. Triển khai lên Vercel (2026-11-25, một phần)
- Đã chạy ở https://luckymoney-fawn.vercel.app (Vercel Hobby, nhánh `main` tự deploy). Database là Prisma Postgres (Free) qua Vercel Storage, nối cho cả Production và Preview: Preview dùng chung dữ liệu thật.
- Biến Production: `DATABASE_URL` (do Storage tạo), `AUTH_SECRET`, `CRON_SECRET`, `APP_URL`, `SMTP_URL` (Gmail App Password), `EMAIL_FROM`.
- Migration không chạy khi build: sau mỗi lần đổi schema phải tự chạy `npx prisma migrate deploy` với `DATABASE_URL` production.
- Đã kiểm tra: `/api/auth/session` trả `null`, đăng nhập sai trả `CredentialsSignin` (DB có bảng), người dùng đã thử đăng ký và các luồng chính.
- Còn thiếu để tick T17: tài khoản demo với dữ liệu mẫu.

## T16. Giới hạn tần suất và rà soát bảo mật (2026-11-25)
- Bộ đếm lưu ở Postgres (bảng `RateLimit`, cửa sổ cố định), không thêm dịch vụ hay dependency. Một câu `INSERT … ON CONFLICT DO UPDATE … RETURNING` nên gửi song song không vượt ngưỡng (có test 12 lần song song, đúng 3 lần qua). Khóa là tên luật + SHA-256 của IP/email, không lưu IP/email dạng rõ. Lần bị từ chối vẫn được đếm nhưng không kéo dài cửa sổ.
- Ngưỡng (`RATE_LIMITS` trong `src/server/rate-limit.ts`): đăng nhập 20 lần/15 phút mỗi IP và 10 lần/15 phút mỗi email (chặn cả khi nhiều IP cùng đoán một tài khoản; mật khẩu đúng cũng bị chặn khi đã quá ngưỡng); đăng ký 5 lần/giờ mỗi IP; xin mã đặt lại 10 lần/giờ và nhập mã 30 lần/giờ mỗi IP (cộng với giới hạn theo tài khoản có từ T24).
- Đăng nhập: giới hạn nằm trong `authorize` (`authenticate` ở `src/server/auth/users.ts`), nên áp dụng cho cả server action lẫn gọi thẳng `/api/auth/callback/credentials`. Quá ngưỡng thì ném `CredentialsSignin` có `code = "rate_limited"`, form hiện "Bạn đã thử đăng nhập quá nhiều lần…". API đăng ký trả `429` + `Retry-After`.
- IP lấy từ phần tử đầu của `x-forwarded-for` (Vercel tự đặt header này và bỏ giá trị client gửi). Nếu tự host sau proxy khác, proxy phải làm tương tự, nếu không kẻ tấn công đổi header để né giới hạn theo IP (giới hạn theo email vẫn còn).
- Dọn bộ đếm hết hạn trong cron hằng ngày `/api/cron/debt-reminders` (gói Hobby chỉ cho một cron mỗi ngày), trả thêm `rateLimitsDeleted`.
- E2E: mọi test chạy từ cùng một máy nên sẽ đụng giới hạn theo IP. `tests/e2e/fixtures.ts` cho mỗi test một IP ngẫu nhiên qua `x-forwarded-for` (đúng cách ứng dụng đọc IP trên Vercel), nên ứng dụng không có đường code riêng cho test. Mọi spec import `test` từ `./fixtures`.
- Lỗi gặp khi viết e2e: React xóa ô mật khẩu khi action trả về; điền ngay sau khi nhận response có thể bị xóa mất và gửi mật khẩu rỗng (không được tính vào giới hạn theo email). Test chờ ô mật khẩu trống rồi mới điền lần tiếp.
- Header (`next.config.ts`, mọi đường dẫn): CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`; script vẫn cần `'unsafe-inline'` vì Next.js chèn script khởi động và script giao diện, dùng nonce sẽ buộc mọi trang thành động), HSTS 2 năm, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; tắt `X-Powered-By`.
- Cookie: phiên Auth.js mặc định `httpOnly`, `sameSite=lax`, `secure` trên https (tên `__Secure-`); vé đặt lại mật khẩu `httpOnly`, `secure`, giới hạn `path`. Cookie giao diện thêm `secure` ở production (không `httpOnly` vì script đọc, không chứa bí mật).
- Input: mọi service nhận dữ liệu từ người dùng đều qua Zod; các hàm không parse chỉ nhận id và lọc theo `userId` (bộ test phân quyền T11).

## T17. Tài khoản demo (2026-11-25)
- `src/server/demo/demo-account.ts`: `buildDemoData(today)` (hàm thuần, PRNG cố định nên cùng ngày cho cùng dữ liệu) tạo 6 tháng thu chi tới hôm nay (lương, tiền nhà, ăn uống hằng ngày, đi lại, giải trí cuối tuần…), 4 ngân sách tháng này, 3 khoản nợ (một quá hạn, một đang trả, một đã tất toán), 2 hũ tích góp. `resetDemoAccount` xóa user demo (giao dịch trước vì khóa ngoại tới danh mục là `Restrict`) rồi tạo lại trong một transaction; giao dịch "sau giờ hiện tại" của hôm nay bị bỏ.
- Đăng nhập demo: `demo@example.com` / `demo-luckymoney`. Dùng `example.com` (tên miền dành riêng, không ai nhận thư) nên không ai chiếm được tài khoản qua Quên mật khẩu; đổi mật khẩu của tài khoản demo bị từ chối.
- Chạy: `npx prisma db seed` (seed chỉ tạo lại tài khoản demo, không đụng user khác). Cron hằng ngày reset demo khi `DEMO_ACCOUNT_RESET=true`, để khách sửa/xóa gì thì hôm sau cũng về dữ liệu sạch và ngày tháng luôn mới.
- Module demo chỉ dùng import tương đối có đuôi `.ts` (thêm `allowImportingTsExtensions` vào tsconfig) vì `prisma/seed.ts` chạy bằng `node` thuần, không hiểu alias `@/`.
- Transaction của reset chờ kết nối tối đa 15 giây: với Prisma Postgres ở xa, mặc định 2 giây báo "Unable to start a transaction in the given time".
- Sự cố: `.env` đang trỏ `DATABASE_URL` tới production, nên `prisma migrate dev --name rate_limits` (T16) đã áp migration đó lên production (chỉ tạo bảng `RateLimit`, không đụng dữ liệu), và một lần chạy seed cũng nhắm vào production nhưng thất bại trước khi ghi. Đã thêm một dòng vào "Lỗi hay gặp" trong AGENTS.md.

## Bộ chọn tháng ở Tổng quan (2026-11-25, theo yêu cầu)
- Trước chỉ có ‹ › nên xem tháng xa phải bấm lùi từng tháng. `MonthPicker` (src/components/dashboard/month-picker.tsx) giữ ‹ › và thêm: bấm nhãn "Tháng 6/2026 ▾" mở bảng 12 tháng của một năm (‹ › đổi năm), bấm năm để chọn trong khối 12 năm, nút "Tháng này" (cả trong bảng lẫn cạnh ‹ › khi đang xem tháng khác). Tới tháng bất kỳ trong vòng 12 năm chỉ mất tối đa 3 lần bấm.
- Mỗi ô tháng là `Link` tới `/?month=YYYY-MM`, nên điều hướng, prefetch và nút Back vẫn như cũ. Tháng đang xem tô xanh, tháng hiện tại (theo múi giờ user, tính ở server) có viền, tháng tương lai hiện mờ nhưng vẫn chọn được như trước.
- Bàn phím: mở thì focus vào tháng đang xem; ←→ theo tháng, ↑↓ theo quý, PageUp/PageDown theo năm, Enter mở tháng, Esc đóng và trả focus. Bấm ra ngoài thì đóng.
- E2E: nhảy về 2 năm trước bằng chuột, qua bảng năm tới 2019, "Tháng này"; luồng bàn phím; bảng nằm gọn trong màn 360px.
- Lần chạy toàn bộ e2e: `auth-transition.spec.ts` (đo vị trí thanh tab theo từng khung hình) đỏ một lần khi máy bận, chạy lại riêng xanh 3/3; không liên quan thay đổi này.
- Đã chạy seed lên production (người dùng đồng ý): đăng nhập demo trên https://luckymoney-fawn.vercel.app thành công, tháng 11/2026 có 92 giao dịch. `prisma migrate status` trên production: đủ 8 migration.
