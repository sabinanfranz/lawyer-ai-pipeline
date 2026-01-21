export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{ border: "1px solid #f5c2c7", background: "#f8d7da", padding: 12, borderRadius: 8 }}>
      <strong>오류</strong>: {message}
    </div>
  );
}
