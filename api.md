# Tài liệu API Dự án Chess

Tài liệu này ghi lại các điểm cuối (endpoints) API được định nghĩa trong mã nguồn frontend (`src/services`).

## 1. Các API Đã Sử Dụng (Used APIs)
Đây là các API đã được tích hợp hoàn chỉnh vào các trang (Pages) và hoạt động thực tế.

### Dịch vụ Xác thực (`AuthService.js`)
- `POST /api/auth/login`: Xác thực người dùng, nhận Token.
- `POST /api/auth/register`: Đăng ký tài khoản mới.
- `POST /api/auth/verify-otp`: Xác thực mã OTP gửi về email.
- `POST /api/auth/refresh`: Làm mới Access Token khi hết hạn.
- `POST /api/auth/google`: Đăng nhập bằng tài khoản Google.
- `GET /api/auth/me`: Lấy thông tin hồ sơ người dùng đang đăng nhập (được bọc trong `UserService.getMe`).

### Dịch vụ Người dùng (`UserService.js`)
- `GET /api/user/{userId}/stats`: Lấy các chỉ số thắng/thua/hòa và điểm Elo.
- `PATCH /api/user/me/profile`: Cập nhật thông tin hồ sơ (avatar URL, bio, quốc gia).

### Dịch vụ Lưu trữ MinIO (`MinioService.js`)
- `POST /api/minio/upload`: Tải tệp ảnh đại diện (avatar) lên MinIO Storage (multipart/form-data).

### Dịch vụ Bạn bè (`FriendService.js`)
- `GET /api/friends/list?userId={id}`: Lấy danh sách bạn bè hiện tại.
- `GET /api/friends/pending?userId={id}`: Lấy danh sách yêu cầu kết bạn chưa xử lý.
- `POST /api/friends/request?senderId={id}&receiverId={id}`: Gửi lời mời kết bạn mới.
- `POST /api/friends/accept?user1={id}&user2={id}`: Chấp nhận lời mời kết bạn.
- `POST /api/friends/remove?user1={id}&user2={id}`: Xóa bạn bè.

### Dịch vụ Ván đấu (`GameService.js`)
- `GET /api/game/history?userId={id}`: Truy xuất lịch sử các ván đấu cũ.
- `GET /api/game/active?userId={id}`: Kiểm tra và khôi phục ván đấu đang diễn ra nếu người dùng lỡ tải lại trang.

### Dịch vụ Tin nhắn Quản trị viên (`AdminService.js`)
- `GET /api/user/{userId}/messages`: Lấy danh sách tin nhắn gửi tới người dùng.
- `POST /api/user/{userId}/messages`: Gửi tin nhắn trực tiếp từ Admin tới người dùng.
- `POST /api/user/{userId}/messages/{messageId}/read`: Đánh dấu tin nhắn đã đọc.
- `GET /api/admin/users/{userId}/messages`: Lấy lịch sử tin nhắn trực tiếp giữa Admin và người dùng.
- `GET /api/admin/messages`: Lấy tất cả tin nhắn trực tiếp đã gửi bởi Admin.
- `POST /api/admin/messages`: Gửi tin nhắn từ Admin (hỗ trợ cả tin nhắn đơn và gửi tất cả người dùng qua `sendToAll: true`).
- `POST /api/admin/messages/broadcast`: Gửi thông báo toàn hệ thống tới tất cả người dùng.
- `POST /api/user/messages/broadcast`: Gửi thông báo toàn hệ thống tới tất cả người dùng (Admin).

## 2. Các API Chưa Sử Dụng (Unused APIs / In-Progress)
Đây là các API đã được định nghĩa trong lớp Service nhưng chưa thấy được gọi từ giao diện người dùng (hoặc đang trong quá trình phát triển).

### Bạn bè
- `POST /api/friends/accept?user1={id}&user2={id}`: Hàm `acceptRequest` trong `FriendService.js` chưa được gọi trong file `Friends.jsx`. Hiện tại giao diện mới chỉ hiển thị danh sách, chưa có nút bấm để chấp nhận yêu cầu.

## 3. Kết nối WebSocket
Ngoài các API REST, ứng dụng sử dụng WebSocket tại đường dẫn:
- `ws://{host}/ws?token={token}`
- Các kênh (topics) chính:
    - `/user/queue/notifications`: Nhận thông báo riêng tư.
    - `/topic/presence`: Cập nhật trạng thái online của mọi người.
    - `/topic/game/{gameId}`: Đồng bộ nước đi trong ván đấu.
