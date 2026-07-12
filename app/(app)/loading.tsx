// ページ遷移時に即時表示されるローディング骨組み（App Router の loading.tsx）。
// サーバ側のデータ取得が終わるまでの「白い待ち時間」を解消し、切替を速く体感させる。
export default function Loading() {
  return (
    <div className="px-5 sm:px-8 py-8 max-w-7xl mx-auto animate-pulse" aria-busy="true" aria-label="読み込み中">
      {/* 見出し */}
      <div className="mb-8">
        <div className="h-3 w-24 rounded bg-slate-200 mb-3" />
        <div className="h-9 w-72 max-w-full rounded-lg bg-slate-200" />
        <div className="h-3 w-40 rounded bg-slate-100 mt-3" />
      </div>

      {/* カード群 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-4 w-32 rounded bg-slate-200 mb-4" />
            <div className="h-8 w-40 rounded bg-slate-200 mb-4" />
            <div className="h-2.5 w-full rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      {/* 行 */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
