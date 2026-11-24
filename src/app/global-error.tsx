"use client";

/**
 * Last resort when the root layout itself fails: no app styles can be relied
 * on, so it is plain, inline-styled HTML.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Roboto, Arial, sans-serif",
          fontSize: 16,
          background: "#f4fbff",
          color: "#062b45",
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Lucky Money đang gặp lỗi</h1>
          <p style={{ color: "#3d6680", margin: "0 0 20px" }}>
            Ứng dụng không tải được. Dữ liệu của bạn không bị mất. Thử lại sau ít phút.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 48,
              padding: "0 20px",
              border: 0,
              borderRadius: 12,
              background: "#30afff",
              color: "#062b45",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
