export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-[min(560px,92vw)] rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <div className="flex-1">
            <p className="text-base font-semibold">초안을 불러오는 중입니다</p>
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              생성이 완료되면 자동으로 화면이 표시됩니다. 잠시만 기다려 주세요.
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="indeterminate-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
