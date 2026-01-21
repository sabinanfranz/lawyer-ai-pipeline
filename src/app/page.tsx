import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Lawyer AI Pipeline (Local MVP)</h1>
      <p className="mt-2 text-sm text-gray-600">
        /new에서 입력 → 후보 → 초안 → 공유 링크 → 승인 → 컴플라이언스 1회 수정
      </p>

      <div className="mt-6">
        <Link className="underline" href="/new">
          시작하기: /new
        </Link>
      </div>
    </main>
  );
}
