# PLAN.md

Quy tắc: làm tuần tự, mỗi lần một task. Task chỉ được tick khi lint, typecheck và test đều pass.
Làm theo lát cắt dọc: mỗi tính năng chạy được từ giao diện đến database.

## Giai đoạn 0: Nền móng
- [x] T1. Khởi tạo Next.js + TypeScript strict, Tailwind, ESLint, Prettier. Thêm script `lint`, `typecheck`, `test`.
  - Xong khi: `npm run dev` chạy, trang chủ hiển thị, các script chạy không lỗi.
- [x] T2. Cấu hình Prisma + Postgres, tạo migration đầu tiên từ `prisma/schema.prisma`, thêm `.env.example`.
  - Xong khi: `npx prisma migrate dev` thành công, có script seed rỗng.
- [x] T3. Cài Vitest + Playwright, viết một test mẫu cho mỗi loại, thêm GitHub Actions chạy lint, typecheck, test trên mỗi push.
  - Xong khi: CI xanh trên GitHub.
- [x] T4. Viết `src/lib/money.ts` (định dạng VND, parse "50k") và `src/lib/dates.ts` (gom tháng theo múi giờ) kèm unit test.
  - Xong khi: test phủ các trường hợp biên (đầu/cuối tháng, múi giờ).

## Giai đoạn 1: Xác thực
- [x] T5. Đăng ký và đăng nhập bằng email + mật khẩu (Auth.js, JWT), băm mật khẩu, middleware chặn route cần đăng nhập, tạo danh mục mặc định khi đăng ký.
  - Xong khi: e2e đăng ký, đăng nhập, đăng xuất pass; chưa đăng nhập bị chuyển về `/login`.
- [ ] T6. Thêm đăng nhập Google OAuth.
  - Xong khi: đăng nhập Google tạo hoặc liên kết user đúng.

## Giai đoạn 2: Giao dịch và danh mục (lát cắt dọc đầu tiên)
- [x] T7. Thêm giao dịch: schema Zod, service, route/action, form giao diện, test.
  - Xong khi: tạo được giao dịch; test từ chối `amount <= 0`, danh mục của user khác, danh mục đã lưu trữ.
- [x] T8. Danh sách giao dịch: phân trang, lọc theo tháng/danh mục/loại.
  - Xong khi: e2e thêm rồi thấy trong danh sách đúng tháng.
- [ ] T9. Sửa và xóa mềm giao dịch.
  - Xong khi: test xác nhận bản ghi xóa mềm không xuất hiện ở danh sách và thống kê.
  - Trạng thái: sửa, xóa mềm và phần danh sách đã xong, có test. Còn phần thống kê: chưa có service thống kê, sẽ kiểm tra ở T12 rồi mới tick T9.
- [x] T10. Quản lý danh mục: thêm, đổi tên, lưu trữ, khôi phục.
  - Xong khi: danh mục lưu trữ không chọn được cho giao dịch mới nhưng vẫn hiện ở giao dịch cũ.
- [ ] T11. Test phân quyền tổng hợp: user A không đọc, sửa, xóa được dữ liệu của user B ở mọi endpoint.
  - Xong khi: bộ test phân quyền pass cho giao dịch, danh mục.

## Giai đoạn 3: Dashboard
- [ ] T12. API và service thống kê (summary, by-category, daily) kèm unit test với dữ liệu mẫu.
  - Xong khi: số liệu khớp tổng thủ công, đúng ở ranh giới tháng theo múi giờ; có test giao dịch xóa mềm không được tính (để đóng T9).
- [ ] T13. Giao diện dashboard: thẻ tổng quan, biểu đồ tròn theo danh mục, biểu đồ cột theo ngày, chọn tháng.
  - Xong khi: e2e kiểm tra số trên dashboard khớp dữ liệu seed.

## Giai đoạn 4: Ngân sách
- [ ] T14. Ngân sách theo danh mục: đặt hạn mức, thanh tiến độ, cảnh báo 80% và 100%.
  - Xong khi: test `percentUsed` đúng; hiển thị cảnh báo đúng ngưỡng.

## Giai đoạn 5: Hoàn thiện và triển khai
- [ ] T15. Responsive (360px), kiểm tra truy cập bàn phím, trạng thái loading/lỗi/rỗng.
- [ ] T16. Giới hạn tần suất cho đăng nhập/đăng ký, rà soát bảo mật (header, cookie, input).
- [ ] T17. Triển khai Vercel + Postgres hosted, tạo tài khoản demo với dữ liệu mẫu.
- [ ] T18. Viết `README.md` tiếng Anh: giới thiệu, ảnh chụp màn hình, sơ đồ kiến trúc, stack, cách chạy, link demo.

## Giai đoạn 6 (v2, sau khi MVP xong)
- [ ] T19. Nhập nhanh bằng AI: gõ câu tự nhiên, LLM trả về JSON (amount, category, date), người dùng xác nhận trước khi lưu.
- [ ] T20. Nhập/xuất CSV.
- [ ] T21. Giao dịch định kỳ.
