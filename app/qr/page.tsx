import Image from 'next/image';
import QRCode from 'qrcode';
import { Smartphone, ScanLine, Printer } from 'lucide-react';
import { loginUrl } from '@/lib/site';

export const metadata = {
  title: 'スマホでログイン | Sales Console',
};

/**
 * スマホログイン用QRコードページ（公開・認証不要）。
 * - サーバ側で QR を SVG 生成（外部サービスへ送信しない）。
 * - スマホのカメラで読み取り→ログイン画面を開く運用。
 * - 印刷して店舗に掲示できるよう print 向けに整える。
 * 既存の認証・計算ロジックには一切触れない（表示専用の新規ページ）。
 */
export default async function QrLoginPage() {
  const url = loginUrl();
  // 余白少なめ・高めの誤り訂正（印刷掲示で多少汚れても読めるよう M）。
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' }, // slate-800 / white
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50/40 flex flex-col items-center justify-center px-5 py-10 print:bg-white">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex items-center justify-center gap-3 mb-8 print:mb-4">
          <Image
            src="/koga-group-logo.png"
            alt="KOGA Group"
            width={840}
            height={600}
            className="h-11 w-auto"
            priority
          />
          <div className="text-left">
            <div className="font-display text-sm font-bold text-slate-900 leading-tight">
              KOGA Holdings
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-slate-500">
              Sales Console
            </div>
          </div>
        </div>

        {/* カード */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 p-8 sm:p-10 text-center print:shadow-none">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold mb-6 print:hidden">
            <Smartphone className="w-3.5 h-3.5" />
            スマホでログイン
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-2">
            QRコードを
            <br className="sm:hidden" />
            読み取ってください
          </h1>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">
            スマホのカメラを向けると、ログイン画面が開きます。
          </p>

          {/* QR本体 */}
          <div className="flex justify-center mb-7">
            <div
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border border-slate-100 bg-white p-3 [&>svg]:w-full [&>svg]:h-full"
              // qrcode が生成した安全なSVG文字列（ユーザー入力を含まない固定URL由来）
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>

          {/* 手順 */}
          <div className="space-y-2.5 text-left mb-7">
            <Step n={1}>スマホの標準カメラアプリを開く</Step>
            <Step n={2}>上のQRコードにカメラを向ける</Step>
            <Step n={3}>表示されたリンクをタップしてログイン</Step>
          </div>

          {/* URL（手入力用） */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              直接ひらく場合
            </div>
            <div className="font-num text-xs text-slate-700 break-all select-all">{url}</div>
          </div>
        </div>

        {/* 補足 */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 print:hidden">
          <ScanLine className="w-3.5 h-3.5" />
          <span>カメラでうまく読めない場合は、上のURLを直接入力してください。</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 print:hidden">
          <Printer className="w-3.5 h-3.5" />
          <span>このページは印刷して店舗に掲示できます。</span>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}
