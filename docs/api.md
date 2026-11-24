# API (hợp đồng giữa frontend và backend)

Quy ước chung
- Base path: `/api`. Dữ liệu JSON. Tiền là số nguyên VND. Ngày giờ là ISO 8601 UTC.
- Mọi endpoint (trừ đăng ký/đăng nhập) yêu cầu đã đăng nhập, nếu không trả `401`.
- Mọi truy vấn lọc theo `userId` của phiên. Truy cập tài nguyên của người khác trả `404` (không tiết lộ là có tồn tại).
- Lỗi validate trả `400` kèm `{ "error": "VALIDATION_ERROR", "details": [{ "field": "amount", "message": "..." }] }`.
- Lỗi khác dùng dạng `{ "error": "CODE", "message": "..." }`.

Mã lỗi: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `409 CONFLICT`, `429 RATE_LIMITED`, `500 INTERNAL`.

## Xác thực
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Body: `{ email, password, name? }`. Trả `201` với user (không có hash). `409` nếu email đã tồn tại. |
| POST/GET | `/api/auth/[...nextauth]` | Auth.js: đăng nhập credentials, Google, đăng xuất, session. |

Ràng buộc: email hợp lệ, mật khẩu tối thiểu 8 ký tự. Giới hạn tần suất cho đăng nhập và đăng ký.

## Giao dịch
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/transactions` | Query: `month=YYYY-MM` (mặc định tháng hiện tại theo múi giờ user), `categoryId?`, `type?`, `page=1`, `pageSize=20` (tối đa 100). Trả `{ month, items, page, pageSize, total }`, sắp xếp `occurredAt` giảm dần, bỏ qua bản ghi đã xóa mềm. Mỗi item có `category: { id, name, icon }`. |
| POST | `/api/transactions` | Body: `{ type, amount, categoryId, occurredAt, note? }`. Trả `201`. `categoryId` phải thuộc user và khớp `type`. |
| GET | `/api/transactions/:id` | Chi tiết một giao dịch. |
| PATCH | `/api/transactions/:id` | Sửa một phần các trường trên. |
| DELETE | `/api/transactions/:id` | Xóa mềm (`deletedAt = now`). Trả `204`. |

Ràng buộc: `amount` là số nguyên, `1 <= amount <= 1_000_000_000`; `note` tối đa 200 ký tự.

## Danh mục
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/categories` | Danh mục của user, mỗi mục kèm `transactionCount` (số giao dịch chưa xóa). |
| POST | `/api/categories` | Body: `{ name, type, icon? }`. `409` nếu trùng `(name, type)`. |
| PATCH | `/api/categories/:id` | Đổi `name`, `icon`. |
| DELETE | `/api/categories/:id` | Xóa danh mục trống, trả `204`. Còn giao dịch thì `409` (thông báo nói số giao dịch cần chuyển hoặc xóa trước). Ngân sách của danh mục bị xóa theo. |

Danh mục mặc định được tạo khi đăng ký (ví dụ: Ăn uống, Đi lại, Nhà ở, Giải trí, Mua sắm, Sức khỏe, Học tập, Khác; thu: Lương, Thưởng, Khác).

## Thống kê
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/stats/summary?month=YYYY-MM` | `{ income, expense, balance }` của tháng theo múi giờ user. |
| GET | `/api/stats/by-category?month=YYYY-MM&type=EXPENSE` | `[{ categoryId, name, icon, total, percent }]`, lớn nhất trước. `percent` làm tròn 1 chữ số thập phân. |
| GET | `/api/stats/daily?month=YYYY-MM` | `[{ date: "YYYY-MM-DD", income, expense }]`, đủ mọi ngày trong tháng (ngày trống là 0). |

| GET | `/api/stats/period?period=week|month|year&date=YYYY-MM-DD` | `{ period, start, previous, next, totals: { income, expense, balance }, buckets: [{ key, income, expense }] }`. Tuần chạy Thứ Hai–Chủ Nhật, mỗi ngày một bucket; tháng mỗi ngày một bucket; năm mỗi tháng một bucket (`key` = `YYYY-MM`). `previous`/`next` là một ngày nằm trong kỳ trước/sau. |

Thiếu `month` thì dùng tháng hiện tại theo múi giờ user (với `/period`: thiếu `period` là `month`, thiếu `date` là hôm nay). Không tính giao dịch đã xóa mềm.

## Ngân sách
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/budgets?month=YYYY-MM` | Mỗi mục kèm `spent`, `percentUsed` (làm tròn xuống 1 chữ số) và `status` (`ok` < 80% ≤ `warning` < 100% ≤ `over`). |
| PUT | `/api/budgets` | Body: `{ categoryId, month, amount }`. Tạo hoặc cập nhật (upsert). Chỉ danh mục chi của user. |
| DELETE | `/api/budgets/:id` | Xóa ngân sách. |

## Ghi chú cài đặt
- Có thể dùng Server Actions cho thao tác từ giao diện, nhưng logic nằm trong `src/server/` và dùng chung với route handler để dễ test.
- Mọi schema Zod đặt ở `src/lib/schemas/` và dùng lại cho cả client và server.
