# PRD: Website quản lý chi tiêu cá nhân (tên tạm: "Spendly")

## 1. Vấn đề
Mọi người ghi chi tiêu bằng ghi chú hoặc bảng tính rồi bỏ sau vài tuần vì nhập liệu mất công và không cho thấy thông tin hữu ích. Họ cần ghi một khoản chi trong vài giây và thấy ngay tiền của mình đi đâu mỗi tháng.

## 2. Người dùng mục tiêu
- Sinh viên và người đi làm trẻ tại Việt Nam tự quản lý tiền của mình (nhóm chính).
- Giai đoạn đầu chỉ dùng một loại tiền (VND); sản phẩm nhiều người dùng, mỗi người chỉ thấy dữ liệu của mình.

## 3. Mục tiêu
- Ghi một giao dịch trong dưới 10 giây.
- Hiển thị rõ bức tranh theo tháng: thu, chi, số dư, chi tiêu theo danh mục.
- An toàn và tách biệt dữ liệu giữa người dùng ngay từ đầu (user này không bao giờ đọc được dữ liệu của user khác).
- Là dự án portfolio có thể triển khai thật, có test và có tài liệu.

## 4. Ngoài phạm vi (v1)
- Đồng bộ tài khoản ngân hàng.
- Nhiều loại tiền tệ, đầu tư, quản lý nợ.
- Ứng dụng mobile native (chỉ làm web responsive).
- Ví chung / làm việc nhóm.

## 5. Tính năng MVP và tiêu chí nghiệm thu

### F1. Xác thực
- Đăng ký / đăng nhập bằng email + mật khẩu và Google OAuth. Đăng xuất.
- Nghiệm thu: người chưa đăng nhập bị chuyển về trang đăng nhập; mật khẩu được băm; phiên đăng nhập có hạn.

### F2. Giao dịch (CRUD)
- Trường: số tiền (số nguyên VND), loại (thu | chi), danh mục, ngày, ghi chú.
- Nghiệm thu: thêm, sửa, xóa hoạt động đúng; số tiền phải > 0; xóa mềm; danh sách có phân trang và lọc theo tháng, danh mục, loại; người dùng chỉ thấy giao dịch của mình.

### F3. Danh mục
- Mỗi người dùng có sẵn danh mục mặc định; có thể thêm, sửa (tên, biểu tượng), xóa danh mục.
- Nghiệm thu: chỉ xóa được danh mục không còn giao dịch; xóa phải qua hộp thoại xác nhận. (Đổi từ "lưu trữ" sang "xóa" theo yêu cầu ngày 2026-11-24.)

### F4. Dashboard theo tháng
- Tổng thu, tổng chi, số dư, biểu đồ chi theo danh mục, xu hướng chi theo ngày.
- Nghiệm thu: số liệu khớp với tổng các giao dịch của tháng được chọn theo múi giờ của người dùng.

### F5. Ngân sách (mở rộng trong v1)
- Đặt ngân sách tháng cho từng danh mục; thanh tiến độ; cảnh báo ở mức 80% và 100%.

### F6. Sổ nợ (thêm theo yêu cầu ngày 2026-11-24)
- Ghi khoản "Tôi nợ" và "Nợ tôi": người, số tiền, ngày vay, ghi chú, lịch trả dự kiến nhiều kỳ (có nút chia đều theo tháng).
- Ghi các lần trả (được trả một phần); tiền trả phủ các kỳ sớm nhất trước. Kỳ quá hạn từ ngày sau ngày hạn.
- Khoản nhiều kỳ chưa trả xong có nút "Đã tất toán" (có hộp xác nhận): ghi một lần trả bằng toàn bộ số còn lại, ngày hôm nay; hoàn tác được như mọi lần trả.
- Tổng "Tôi đang nợ", "Người khác nợ tôi", số kỳ quá hạn. Không tính vào thu chi và thống kê.
- Email nhắc mỗi ngày (bật/tắt trong Cài đặt > Thông báo) cho kỳ còn 3 ngày đến hạn và kỳ quá hạn.
- Nghiệm thu: tổng các kỳ phải bằng số tiền nợ; không trả quá số còn nợ; mỗi kỳ chỉ nhắc một lần mỗi loại; user A không xem/sửa được sổ nợ của user B.

### F7. Tích góp (thêm theo yêu cầu ngày 2026-11-24)
- Các hũ tiền / quỹ (vd: Quỹ khẩn cấp, Du lịch): tên, biểu tượng; nạp và rút nhiều lần, có ngày và ghi chú.
- Tổng tiền tích góp, số dư từng hũ và phần trăm trong tổng; lịch sử có số dư sau mỗi lần.
- Không tính vào thu chi và thống kê. Chưa có nhắc nhở.
- Nghiệm thu: không rút quá số dư; không hoàn tác lần nạp đã bị rút; xóa hũ phải xác nhận; user A không xem/sửa được hũ của user B.

## 6. Ý tưởng cho v2
- Giao dịch định kỳ, nhập/xuất CSV, đính kèm hóa đơn.
- Nhập nhanh bằng AI: gõ "phở 50k hôm qua", ứng dụng tự tách số tiền, danh mục, ngày (LLM trả về dữ liệu có cấu trúc, người dùng xác nhận trước khi lưu).
- Tóm tắt thói quen chi tiêu hàng tháng bằng AI.

## 7. Yêu cầu phi chức năng
- Tiền lưu bằng số nguyên (VND không có đơn vị nhỏ hơn), tuyệt đối không dùng số thực.
- Thời gian lưu theo UTC, gom theo tháng dựa trên múi giờ của người dùng.
- Mọi truy vấn đều lọc theo `userId`. Dữ liệu đầu vào được kiểm tra ở server (Zod).
- Responsive từ 360px; tương phản màu đạt WCAG AA; form dùng được bằng bàn phím.
- Dashboard tải dưới 2 giây trên kết nối trung bình.

## 8. Tiêu chí thành công (portfolio)
- Có link demo chạy thật và tài khoản demo.
- CI xanh: lint, type-check, unit test, e2e test.
- README có ảnh chụp màn hình, sơ đồ kiến trúc, hướng dẫn cài đặt.
- Phần logic nghiệp vụ (tính toán, phân quyền) có độ phủ test tối thiểu 70%.

## 9. Câu hỏi còn mở
- Gói miễn phí của hosting (Vercel + Neon/Supabase) có đủ cho demo không?
- Xác thực email làm ở v1 hay v2?
