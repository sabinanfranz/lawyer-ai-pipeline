import Link from "next/link";

export default function CIndexPage() {
  return (
    <main className="p-6 space-y-2">
      <h1 className="text-xl font-semibold">/c/</h1>
      <div className="text-sm text-gray-700">유효하지 않은 링크입니다.</div>
      <div className="text-sm text-gray-700">
        콘텐츠가 없습니다. <Link className="text-blue-600 underline" href="/new">/new</Link>에서 생성해 주세요.
      </div>
    </main>
  );
}
