# Node Handbook

Sổ tra cứu kinh nghiệm dev Node.js (mốc 2 năm và 5 năm): 53 chủ đề, sơ đồ quy trình, hỏi đáp, editor chạy code.

Mở offline: `index.html` cần một web server tĩnh (Web Worker của editor không chạy từ `file://`):

```bash
cd node-handbook && python3 -m http.server 8080   # rồi mở http://localhost:8080
```

- `content-a.js`, `content-b.js`, `content-c.js`: nội dung (sửa/thêm chủ đề ở đây).
- `app.js`: giao diện, sơ đồ, mô phỏng event loop, editor.
- Chế độ TS của editor tải trình biên dịch TypeScript từ cdnjs (cần mạng); chỉ xóa kiểu, không kiểm tra kiểu.
