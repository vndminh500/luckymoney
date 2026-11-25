# Quên mật khẩu (OTP qua email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng quên mật khẩu nhận mã OTP qua email, nhập đúng mã thì sang trang đặt mật khẩu mới, đổi xong thấy popup thành công.

**Architecture:** Bảng `PasswordReset` giữ bản băm mã OTP và bản băm "vé đặt lại". Service thuần server (`src/server/auth/password-reset.ts`) nhận `now` và `send` để test được. Server actions bọc service; vé nằm trong cookie httpOnly để trang `/reset-password` chỉ mở được sau OTP.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod 4, `node:crypto`, nodemailer có sẵn (`src/server/email/mailer.ts`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-forgot-password-design.md`

## Global Constraints
- Không thêm dependency. Đổi schema phải có migration.
- OTP: 6 chữ số, hết hạn 10 phút, sai 5 lần thì hủy, mỗi email chờ 60 giây mới gửi lại; gửi mã mới làm mã cũ mất hiệu lực.
- Vé đặt lại: ngẫu nhiên 32 byte base64url, chỉ lưu SHA-256, dùng một lần, hết hạn 15 phút.
- Không lộ email đã đăng ký: mọi email nhận cùng câu "Nếu email đã đăng ký, mã đã được gửi." Tài khoản không có `passwordHash` (chỉ Google) không nhận mã.
- Mật khẩu mới dùng cùng luật `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH` của Đăng ký.
- Chữ giao diện tiếng Việt. Validate bằng Zod ở server. Không dùng `any`.

## Review Focus
- Mã của email A nhập kèm email B → bị từ chối (test ở Task 2).
- Vé đã dùng hoặc hết hạn mở `/reset-password` → báo hết hạn, link về `/forgot-password`, không đổi mật khẩu (Task 2 + Task 3 e2e).
- Lỗi gửi email (SMTP hỏng) → người dùng vẫn thấy câu chung, lỗi được log, không 500 (Task 2: `send` ném lỗi).
- Gõ mã có khoảng trắng ("123 456") → chấp nhận sau khi bỏ khoảng trắng (Task 1 schema test).
- Trang mới ở 360px không cuộn ngang (Task 3: thêm 2 path vào `responsive-a11y.spec.ts`).

---

### Task 1: Mô hình dữ liệu, schema Zod, hàm băm mã

**Files:**
- Modify: `prisma/schema.prisma` (thêm model + quan hệ `passwordResets PasswordReset[]` trên `User`)
- Create: migration qua `npx prisma migrate dev --name password_reset`
- Modify: `src/lib/schemas/auth.ts`
- Create: `src/server/auth/reset-codes.ts` (thuần, không import prisma, để e2e import được)
- Test: `tests/unit/auth-schemas.test.ts`, `tests/unit/reset-codes.test.ts`

**Interfaces:**
- Produces:
  - Model `PasswordReset { id String @id @default(cuid()); userId String; codeHash String; attempts Int @default(0); expiresAt DateTime; ticketHash String? @unique; ticketExpiresAt DateTime?; createdAt DateTime @default(now()); user User @relation(fields:[userId], references:[id], onDelete: Cascade); @@index([userId]) }`
  - `forgotPasswordSchema` → `{ email: string }` (dùng lại `email` có sẵn)
  - `verifyResetCodeSchema` → `{ email: string; code: string }`; `code` bỏ mọi khoảng trắng rồi phải khớp `/^\d{6}$/`, lỗi "Mã gồm 6 chữ số."
  - `resetPasswordSchema` → `{ password: string; confirmPassword: string }`; luật password như `registerSchema`; không khớp thì lỗi ở path `confirmPassword`: "Mật khẩu xác nhận không khớp."
  - `generateResetCode(): string` (6 chữ số, `randomInt(0, 1_000_000)` đệm số 0)
  - `hashResetCode(resetId: string, code: string): string` (SHA-256 hex của `${resetId}:${code}`)
  - `generateResetTicket(): string`, `hashResetTicket(ticket: string): string`
  - `codesMatch(a: string, b: string): boolean` (so sánh hex bằng `timingSafeEqual`)

- [ ] **Step 1: Viết test hỏng**

```ts
// tests/unit/auth-schemas.test.ts (thêm)
it("accepts a 6-digit code with spaces", () => {
  expect(verifyResetCodeSchema.parse({ email: "An@Example.com ", code: "123 456" }))
    .toEqual({ email: "an@example.com", code: "123456" });
});
it("rejects codes that are not 6 digits", () => {
  for (const code of ["12345", "1234567", "12a456", ""]) {
    expect(verifyResetCodeSchema.safeParse({ email: "a@b.co", code }).success).toBe(false);
  }
});
it("reports mismatched confirmation on confirmPassword", () => {
  const result = resetPasswordSchema.safeParse({ password: "mat-khau-moi-1", confirmPassword: "khac-hoan-toan" });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "Mật khẩu xác nhận không khớp." });
});
it("applies the register password length rules", () => {
  expect(resetPasswordSchema.safeParse({ password: "ngan", confirmPassword: "ngan" }).success).toBe(false);
});

// tests/unit/reset-codes.test.ts
it("generates 6-digit codes", () => { for (let i = 0; i < 50; i++) expect(generateResetCode()).toMatch(/^\d{6}$/); });
it("binds the code hash to the reset id", () => {
  expect(hashResetCode("r1", "123456")).not.toBe(hashResetCode("r2", "123456"));
  expect(codesMatch(hashResetCode("r1", "123456"), hashResetCode("r1", "123456"))).toBe(true);
});
it("generates distinct tickets and never stores them raw", () => {
  const t = generateResetTicket();
  expect(t).not.toBe(generateResetTicket());
  expect(hashResetTicket(t)).not.toContain(t);
});
```

- [ ] **Step 2:** `npm test -- tests/unit/auth-schemas.test.ts tests/unit/reset-codes.test.ts` → FAIL (chưa export).
- [ ] **Step 3:** Cài đặt schema, `reset-codes.ts`, model Prisma; chạy `npx prisma migrate dev --name password_reset`.
- [ ] **Step 4:** Chạy lại test → PASS; `npm run typecheck` → không lỗi.
- [ ] **Step 5: Commit** `feat(db): password reset codes and tickets`

---

### Task 2: Service đặt lại mật khẩu

**Files:**
- Create: `src/server/auth/password-reset.ts`
- Test: `tests/integration/password-reset.test.ts`

**Interfaces:**
- Consumes: Task 1; `SendEmail` từ `src/server/email/mailer.ts`; `hashPassword`/`verifyPassword`; `ValidationError`.
- Produces:
  - `RESET_CODE_TTL_MS = 10 * 60_000`, `RESET_TICKET_TTL_MS = 15 * 60_000`, `RESET_MAX_ATTEMPTS = 5`, `RESET_RESEND_COOLDOWN_MS = 60_000`
  - `requestPasswordReset(input: unknown, now: Date, send: SendEmail): Promise<void>` — ném `ValidationError` nếu email sai dạng; không user / không `passwordHash` / còn trong 60 giây kể từ row mới nhất → return im lặng. Ngược lại xóa mọi row của user, tạo row mới, gửi email (subject "Mã đặt lại mật khẩu Lucky Money", nội dung có mã và "hết hạn sau 10 phút"). `send` ném lỗi → `console.error` và return (không ném).
  - `verifyResetCode(input: unknown, now: Date): Promise<string | null>` — ném `ValidationError` khi input sai dạng; trả vé (raw) khi đúng; `null` khi sai/hết hạn/hết lượt/đã dùng. Sai mã thì tăng `attempts`; đạt 5 thì row vô hiệu. Đúng thì ghi `ticketHash`, `ticketExpiresAt`, và mã không dùng lại được nữa.
  - `isResetTicketValid(ticket: string, now: Date): Promise<boolean>`
  - `resetPassword(ticket: string, input: unknown, now: Date): Promise<boolean>` — ném `ValidationError` khi mật khẩu sai luật/không khớp (kiểm tra trước vé); `false` khi vé sai/hết hạn; `true` khi đã đổi `passwordHash` và xóa mọi row `PasswordReset` của user, trong một transaction.

- [ ] **Step 1: Viết test hỏng** (dùng `registerUser` tạo user; `send = vi.fn()` bắt mã từ `email.text` bằng `/\b(\d{6})\b/`; `now` cố định `new Date("2026-11-25T03:00:00Z")`)

Các test, mỗi test một `it`:
  - `sends a code to a password account` → `send` được gọi 1 lần với `to: "an@example.com"`; DB không chứa mã raw (`codeHash` ≠ mã).
  - `stays silent for unknown emails and Google-only accounts` → không ném, `send` không được gọi (tạo user Google-only bằng `prisma.user.create({ data: { email } })`).
  - `does not resend within 60 seconds` → gọi 2 lần cách 30s: `send` 1 lần; cách 61s: 2 lần và mã cũ trả `null`.
  - `swallows send failures` → `send` ném lỗi, `requestPasswordReset` resolve.
  - `accepts the right code once` → trả chuỗi vé; gọi lại cùng mã → `null`.
  - `rejects a code after 10 minutes` → `now + 10*60_000 + 1` → `null`.
  - `locks the code after 5 wrong attempts` → 5 lần "000000" (khác mã thật) rồi mã đúng → `null`.
  - `does not accept user A's code for user B` → yêu cầu mã cho A và B; mã của A kèm email B → `null`, và mã đúng của B vẫn dùng được.
  - `resets the password with a valid ticket` → `true`; `verifyCredentials({ email, password: mới })` khác null, mật khẩu cũ → null; bảng `PasswordReset` của user rỗng.
  - `rejects a used or expired ticket` → dùng lần 2 → `false`; vé mới với `now + 15*60_000 + 1` → `false`, mật khẩu không đổi.
  - `validates the new password before the ticket` → không khớp → ném `ValidationError` với field `confirmPassword`.
  - `isResetTicketValid` → true với vé mới, false với `"khong-ton-tai"`.

- [ ] **Step 2:** `npm test -- tests/integration/password-reset.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Cài đặt `password-reset.ts` theo Interfaces.
- [ ] **Step 4:** Chạy lại → PASS. Kiểm tra độ mạnh: tạm bỏ điều kiện `userId` khi tìm row theo email → test A/B đỏ; trả lại.
- [ ] **Step 5: Commit** `feat: password reset service with email OTP`

---

### Task 3: Actions, trang, popup, e2e

**Files:**
- Create: `src/app/(auth)/password-reset-actions.ts`
- Create: `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`
- Create: `src/components/auth/forgot-password-form.tsx`, `src/components/auth/reset-password-form.tsx`
- Modify: `src/components/auth/login-form.tsx` (link "Quên mật khẩu?" cạnh ô mật khẩu → `/forgot-password`)
- Modify: `src/proxy.ts` (`GUEST_PAGES` thêm `/forgot-password`, `/reset-password`)
- Modify: `src/components/auth/auth-tabs.tsx` nếu cần, để không đánh dấu tab nào trên hai trang mới
- Test: `tests/integration/proxy.test.ts`, `tests/e2e/password-reset.spec.ts`, `tests/e2e/responsive-a11y.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`requestPasswordReset`, `verifyResetCode`, `isResetTicketValid`, `resetPassword`), `sendEmail`, `hashResetCode` (Task 1).
- Produces:
  - Cookie `RESET_TICKET_COOKIE = "lm-reset-ticket"`: httpOnly, `sameSite: "lax"`, `secure` khi production, `path: "/reset-password"`, `maxAge` 15 phút.
  - `ForgotPasswordState = { step: "email" | "code"; email?: string; error?: string; fieldErrors?: Record<string,string>; notice?: string }`
  - `requestResetCodeAction(prev, formData)` → `{ step: "code", email, notice: "Nếu email đã đăng ký, mã đã được gửi." }`
  - `verifyResetCodeAction(prev, formData)` → sai: `{ step: "code", email, error: "Mã không đúng hoặc đã hết hạn." }`; đúng: đặt cookie rồi `redirect("/reset-password")`.
  - `ResetPasswordState = { done?: boolean; error?: string; fieldErrors?: Record<string,string> }`
  - `resetPasswordAction(prev, formData)` → đọc vé từ cookie; `false` → `error: "Phiên đặt lại đã hết hạn. Vui lòng yêu cầu mã mới."`; `true` → xóa cookie, `{ done: true }`.

- [ ] **Step 1: Test proxy hỏng** — trong `proxy.test.ts`: khách mở `/forgot-password` và `/reset-password` → không redirect (status 200 / `NextResponse.next`); người đã đăng nhập → redirect `/`.
- [ ] **Step 2:** `npm test -- tests/integration/proxy.test.ts` → FAIL; sửa `GUEST_PAGES` → PASS.
- [ ] **Step 3: Cài đặt actions, form và trang**
  - `/forgot-password`: tiêu đề "Quên mật khẩu". Bước email: ô "Email", nút "Gửi mã". Bước mã: thông báo chung, ô "Mã xác nhận" (`inputMode="numeric"`, `autoComplete="one-time-code"`), nút "Xác nhận", nút phụ "Gửi lại mã" (gửi lại cùng email), link "Quay lại đăng nhập".
  - `/reset-password`: server đọc cookie và `isResetTicketValid`; không hợp lệ → `AuthAlert` "Phiên đặt lại đã hết hạn…" + link "Yêu cầu mã mới". Hợp lệ → `PasswordField` "Mật khẩu mới" và "Nhập lại mật khẩu mới" (`autoComplete="new-password"`), nút "Đổi mật khẩu".
  - Popup thành công: `<dialog>` modal (cùng cách `settle-debt-dialog.tsx`), `aria-labelledby` tiêu đề "Đổi mật khẩu thành công", nội dung "Hãy đăng nhập bằng mật khẩu mới.", nút "Đăng nhập" → `/login`. Esc cũng đưa về `/login`.
  - Dùng `AuthField`, `PasswordField`, `AuthAlert`, `AuthSubmit` có sẵn.
- [ ] **Step 4: Viết e2e `tests/e2e/password-reset.spec.ts`**
  - E2E chạy `next start` không có SMTP nên `send` lỗi và bị nuốt (Task 2). Test lấy row `PasswordReset` mới nhất của user từ DB e2e (PrismaClient + `PrismaPg(process.env.E2E_DATABASE_URL)`), ghi đè `codeHash = hashResetCode(row.id, "246810")`, rồi nhập "246810".
  - `test("resets the password with an email code")`: đăng ký → đăng xuất → bấm "Quên mật khẩu?" → nhập email → "Gửi mã" → thấy "Nếu email đã đăng ký, mã đã được gửi." → nhập mã → URL `/reset-password` → nhập hai ô → "Đổi mật khẩu" → `getByRole("dialog", { name: "Đổi mật khẩu thành công" })` hiện → "Đăng nhập" → đăng nhập bằng mật khẩu mới vào được `/`.
  - `test("shows an error for a wrong code")` → "Mã không đúng hoặc đã hết hạn."
  - `test("rejects mismatched passwords")` → "Mật khẩu xác nhận không khớp.", không có dialog.
  - `test("blocks /reset-password without a verified code")` → mở trực tiếp thấy "Phiên đặt lại đã hết hạn" và không có ô mật khẩu.
  - `responsive-a11y.spec.ts`: mảng `["/login", "/register"]` thêm `"/forgot-password"`, `"/reset-password"`.
- [ ] **Step 5:** `npm run test:e2e -- password-reset responsive-a11y auth` → PASS.
- [ ] **Step 6: Commit** `feat: forgot password pages with OTP step and success dialog`

---

### Task 4: Kiểm tra toàn bộ và ghi chép

**Files:**
- Modify: `PLAN.md` (thêm mục "T24. Quên mật khẩu (theo yêu cầu)" và đánh dấu xong), `docs/progress.md` (quyết định: OTP 6 số/10 phút/5 lần/60 giây, vé 15 phút trong cookie, không gửi cho tài khoản chỉ Google, phiên JWT cũ không bị thu hồi, e2e ghi đè `codeHash`).

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → tất cả xanh.
- [ ] **Step 2:** Cập nhật `PLAN.md` và `docs/progress.md`.
- [ ] **Step 3: Commit** `docs: forgot password progress notes`
