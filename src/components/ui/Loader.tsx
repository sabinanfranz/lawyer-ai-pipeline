export function Loader({ label = "로딩 중..." }: { label?: string }) {
  return <div className="text-sm text-gray-600">{label}</div>;
}
