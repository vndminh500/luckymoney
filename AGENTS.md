# AGENTS.md

Ứng dụng web quản lý chi tiêu cá nhân (nhiều người dùng). Đọc `docs/PRD.md` để biết phạm vi và `PLAN.md` để biết task hiện tại. Mỗi lần chỉ làm MỘT task trong `PLAN.md`.

## Công nghệ
- Next.js (App Router) + TypeScript (strict)
- PostgreSQL + Prisma
- Auth.js (credentials + Google)
- Tailwind CSS, Recharts
- Zod để validate
- Vitest (unit), Playwright (e2e)
- Triển khai: Vercel + Postgres hosted

## Lệnh thường dùng
- Cài đặt: `npm install`
- Chạy dev: `npm run dev`
- Lint: `npm run lint`
- Kiểm tra kiểu: `npm run typecheck`
- Unit test: `npm test`
- E2E test: `npm run test:e2e`
- Migrate DB: `npx prisma migrate dev`
- Seed dữ liệu: `npx prisma db seed`

Một task CHƯA xong cho đến khi lint, typecheck và test đều pass. Phải chạy đủ trước khi báo hoàn thành.

## Cấu trúc dự án
- `src/app/`: route và trang
- `src/components/`: component giao diện
- `src/server/`: server actions, service, logic nghiệp vụ (không chứa code UI)
- `src/lib/`: hàm dùng chung (tiền, ngày, schema validate)
- `prisma/schema.prisma`: mô hình dữ liệu
- `tests/`: unit và e2e test
- `docs/`: PRD, kiến trúc, ADR

## Quy ước
- Tiền là số nguyên VND. Không dùng số thực. Chỉ định dạng ở lớp giao diện qua `src/lib/money.ts`.
- Ngày lưu theo UTC. Gom theo tháng dùng múi giờ của người dùng.
- MỌI truy vấn database phải lọc theo `userId` của người dùng đã đăng nhập. Không bao giờ tin `userId` từ client.
- Validate toàn bộ dữ liệu đầu vào bằng Zod ở server.
- Logic nghiệp vụ nằm trong `src/server/`, không đặt trong component.
- Hàm nhỏ, kiểu rõ ràng, không dùng `any`.
- Xóa mềm giao dịch (`deletedAt`), không xóa cứng.
- Mỗi thay đổi hành vi phải kèm test. Phải có test phân quyền (user A không truy cập được dữ liệu của user B).

## KHÔNG được làm
- Không commit secret hoặc `.env`. Khi thêm biến môi trường thì cập nhật `.env.example`.
- Không thêm dependency mới mà không nêu lý do trong commit message.
- Không đổi Prisma schema mà không tạo migration.
- Không refactor phần code không liên quan đến task đang làm.
- Không đánh dấu task xong trong `PLAN.md` nếu còn kiểm tra nào chưa đạt.

## Quy trình làm việc
1. Đọc task trong `PLAN.md` và spec liên quan trong `docs/`.
2. Khảo sát code liên quan trước khi sửa.
3. Viết test trước (hoặc song song), rồi viết phần cài đặt.
4. Chạy lint, typecheck, test. Sửa đến khi xanh.
5. Commit với thông điệp rõ ràng (Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`).
6. Đánh dấu task trong `PLAN.md`, ghi quyết định hoặc vướng mắc vào `docs/progress.md`.

## Lỗi hay gặp (thêm một dòng mỗi khi agent lặp lại cùng một lỗi)
- Không ghi văn bản có backtick (Markdown inline code, template literal) qua `node -e "..."` hay `sed` trong bash: bash coi backtick là lệnh con, làm mất chữ và chạy lệnh ngoài ý muốn. Dùng công cụ Edit/Write, hoặc heredoc có nháy (`<<'EOF'`).
