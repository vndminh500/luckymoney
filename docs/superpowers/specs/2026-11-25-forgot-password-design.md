# Quên mật khẩu bằng mã OTP qua email

## Mục đích
Người dùng quên mật khẩu tự lấy lại quyền truy cập từ trang Đăng nhập, không cần hỗ trợ thủ công.

## Luồng
1. `/login` có link "Quên mật khẩu?" → `/forgot-password`.
2. Nhập email → server gửi mã OTP 6 chữ số (nếu email có tài khoản có mật khẩu). Màn hình luôn báo "Nếu email đã đăng ký, mã đã được gửi" rồi hiện ô nhập mã (trên cùng trang).
3. Nhập đúng mã → server cấp vé đặt lại (token ngẫu nhiên, 1 lần, 15 phút) trong cookie httpOnly → chuyển `/reset-password`.
4. `/reset-password`: mật khẩu mới + xác nhận (cùng luật mật khẩu của Đăng ký, khớp nhau, Zod ở server). Thành công → popup "Đổi mật khẩu thành công" với nút "Đăng nhập" về `/login`. Không có vé hợp lệ → báo hết hạn, dẫn về `/forgot-password`.

## Quyết định
- Mã OTP: 6 chữ số, chỉ lưu bản băm (SHA-256 kèm id bản ghi), hết hạn 10 phút, sai 5 lần thì hủy, mỗi email chờ 60 giây mới gửi lại. Gửi mã mới làm mã cũ mất hiệu lực.
- Không lộ email đã đăng ký: câu trả lời giống nhau cho mọi email.
- Tài khoản chỉ có Google (không có `passwordHash`): **không gửi mã** (người dùng chọn phương án a).
- Vé đặt lại lưu bản băm trong DB, dùng một lần; đặt lại xong thì xóa mọi mã/vé của user đó.
- Một bảng mới `PasswordReset` + migration. Không thêm dependency (dùng `node:crypto`, mailer có sẵn).

## Cách tiếp cận đã cân nhắc
- **OTP + vé đặt lại phía server (chọn):** trang đặt lại không thể mở nếu chưa qua OTP; mã ngắn dễ gõ.
- Link đặt lại trong email: người dùng yêu cầu mã OTP, nên loại.
- Gửi OTP cùng mật khẩu mới trong một form: không khớp yêu cầu "nhập đúng mã mới sang trang đặt lại".

## Ngoài phạm vi
- Thu hồi các phiên JWT đang mở sau khi đặt lại mật khẩu.
- Giới hạn tần suất theo IP (thuộc T16).

## Test
- Unit/integration: mã đúng/sai/hết hạn/quá số lần, chờ gửi lại, vé dùng một lần và hết hạn, mã của email A không dùng cho email B, tài khoản Google-only không nhận mã, mật khẩu không khớp bị từ chối.
- E2E: quên mật khẩu → mã (đọc từ DB test hoặc mailer giả) → đặt lại → popup → đăng nhập bằng mật khẩu mới.
