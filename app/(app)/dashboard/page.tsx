import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Store as StoreIcon,
  ClipboardEdit,
  CalendarRange,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  AlertCircle,
  BookOpen,
  QrCode,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loginUrl } from '@/lib/site';
import {
  aggregateStorePeriod,
  computeStorePeriodMetrics,
} from '@/lib/period-summary/aggregate';
import { sumBetween } from '@/lib/pl/queries';
import { formatNumber, formatPercent, getAchievementBadgeClass } from '@/lib/business';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 「売上が入力されている日」の予算（target_sales）合計を返す。
 * 予算比の分母を、未入力の日（今日や未来）を含む期間予算ではなく、実際に売上が
 * 入力済みの日付だけに限定するためのもの（ダッシュボードの予算比用）。
 */
async function budgetForEnteredSalesDays(
  supabase: SupabaseServerClient,
  storeId: string,
  start: string,
  end: string,
): Promise<number> {
  // 売上（day_period='all'）が入力されている日付の集合を取得
  const { data: salesDays } = await supabase
    .from('daily_sales')
    .select('business_date')
    .eq('store_id', storeId)
    .eq('day_period', 'all')
    .gte('business_date', start)
    .lte('business_date', end);
  const dates = [...new Set((salesDays ?? []).map((r) => r.business_date as string))];
  if (dates.length === 0) return 0;

  // その日付の予算のみ合算（未入力日の予算は含めない）
  const { data: targets } = await supabase
    .from('daily_targets')
    .select('target_sales')
    .eq('store_id', storeId)
    .in('target_date', dates);
  return (targets ?? []).reduce((sum, t) => sum + Number(t.target_sales ?? 0), 0);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** 日本時間（JST=UTC+9） */
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const [storesResult, currenciesResult] = await Promise.all([
    supabase
      .from('stores')
      .select('id, store_no, name, currency_id')
      .eq('is_active', true)
      .order('store_no'),
    supabase.from('currencies').select('id, symbol'),
  ]);
  const stores = storesResult.data ?? [];
  const symbolById: Record<string, string> = {};
  for (const c of (currenciesResult.data ?? []) as { id: string; symbol: string }[]) {
    symbolById[c.id] = c.symbol;
  }

  // JST 基準の当月・当日、前年同月（MTD）
  const now = jstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const monthStart = `${y}-${pad(m)}-01`;
  const today = `${y}-${pad(m)}-${pad(d)}`;
  const lyStart = `${y - 1}-${pad(m)}-01`;
  const lyEnd = `${y - 1}-${pad(m)}-${pad(d)}`;
  const monthLabel = `${y}年${m}月`;

  // 前日（JST）入力済みの店舗（day_period='all' の行があるか）。当日分の報告は不要＝前日基準。
  const yDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  yDate.setUTCDate(yDate.getUTCDate() - 1);
  const yesterday = `${yDate.getUTCFullYear()}-${pad(yDate.getUTCMonth() + 1)}-${pad(yDate.getUTCDate())}`;
  const yMonth = yDate.getUTCMonth() + 1;
  const yDay = yDate.getUTCDate();
  const { data: yesterdayRows } = await supabase
    .from('daily_sales')
    .select('store_id, net_sales')
    .eq('business_date', yesterday)
    .eq('day_period', 'all');
  const yesterdayNetByStore = new Map<string, number>();
  for (const r of (yesterdayRows ?? []) as { store_id: string; net_sales: number | string }[]) {
    yesterdayNetByStore.set(r.store_id, Number(r.net_sales ?? 0));
  }

  // 店舗ごとに当月の売上・予算比・粗利率・前年同月比を集計（期間集計と同じロジックを再利用）
  const cards = await Promise.all(
    stores.map(async (s) => {
      const actuals = await aggregateStorePeriod(supabase, s.id, monthStart, today);
      const metrics = computeStorePeriodMetrics(actuals);
      // 予算比は「売上が入力されている日」までの予算で算出（未入力日・今日の予算は分母に含めない）
      const [enteredBudget, lastYearNet] = await Promise.all([
        budgetForEnteredSalesDays(supabase, s.id, monthStart, today),
        sumBetween(
          supabase,
          'daily_sales',
          'net_sales',
          s.id,
          'business_date',
          lyStart,
          lyEnd,
          { day_period: 'all' },
        ),
      ]);
      const budgetPct =
        enteredBudget > 0 ? Math.round((metrics.netSales / enteredBudget) * 1000) / 10 : null;
      const yoyPct = lastYearNet > 0 ? Math.round((metrics.netSales / lastYearNet) * 1000) / 10 : null;
      return {
        id: s.id,
        storeNo: Number(s.store_no),
        name: s.name,
        symbol: symbolById[s.currency_id] ?? s.currency_id.toUpperCase(),
        monthNet: metrics.netSales,
        budgetPct,
        grossMarginPct: metrics.grossMarginPct,
        yoyPct,
        yesterdayEntered: yesterdayNetByStore.has(s.id),
        yesterdayNet: yesterdayNetByStore.get(s.id) ?? 0,
      };
    }),
  );

  const notEnteredCount = cards.filter((c) => !c.yesterdayEntered).length;
  const hour = now.getUTCHours();
  const greeting = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';

  // スマホログイン用QRコード（サーバ側でSVG生成・外部送信なし）。ログインURLを符号化。
  const qrTarget = loginUrl();
  const qrSvg = await QRCode.toString(qrTarget, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' },
  });

  return (
    <div className="px-5 sm:px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-8 anim-in">
        <div className="text-xs tracking-[0.2em] uppercase text-brand-500 font-semibold mb-2">Dashboard</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
          {greeting}、{profile?.display_name ?? 'ユーザー'}さん
        </h1>
        <p className="text-sm text-slate-600 mt-2">{formatDate(now)} · {monthLabel}の状況</p>
      </div>

      <div className="mb-6 space-y-3">
        {notEnteredCount > 0 && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 flex items-center gap-2.5 text-sm text-rose-900">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span className="font-semibold">前日（{yMonth}/{yDay}）の売上が未入力の店舗が</span>
            <span className="font-bold font-num">{notEnteredCount}</span> 店舗あります。
            <Link href="/daily-input/sales" className="font-semibold underline underline-offset-2 hover:text-rose-700">
              日次売上入力へ
            </Link>
          </div>
        )}
      </div>

      {/* 当月サマリ（店舗別） */}
      <section className="mb-8 anim-in anim-delay-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-600" />
            当月サマリ（{monthLabel}・税抜）
          </h2>
          <div className="text-xs text-slate-500">{stores.length} 店舗</div>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <div className="text-sm text-slate-500">表示できる店舗がありません</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-num text-[11px] font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                    {pad3(c.storeNo)}
                  </span>
                  <span className="font-display text-base font-bold text-slate-900 truncate flex-1">{c.name}</span>
                  {!c.yesterdayEntered && (
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                      前日未入力
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-[11px] text-slate-500 mb-0.5">当月売上</div>
                  <div className="font-num text-2xl font-bold text-slate-900">
                    {c.symbol}{formatNumber(c.monthNet)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <Mini label="予算比">
                    {c.budgetPct === null ? (
                      <span className="font-num text-lg font-bold text-slate-400">—</span>
                    ) : (
                      <span className={'inline-block font-num text-lg font-bold px-2 py-0.5 rounded-lg ' + getAchievementBadgeClass(c.budgetPct)}>
                        {formatPercent(c.budgetPct, 1)}
                      </span>
                    )}
                  </Mini>
                  <Mini label="粗利率">
                    <span className="font-num text-lg font-bold text-slate-800">
                      {c.grossMarginPct === null ? '—' : formatPercent(c.grossMarginPct, 1)}
                    </span>
                  </Mini>
                  <Mini label="前年比">
                    {c.yoyPct === null ? (
                      <span className="font-num text-lg font-bold text-slate-400">—</span>
                    ) : (
                      <span className={'inline-flex items-center gap-0.5 font-num text-lg font-bold ' + (c.yoyPct >= 100 ? 'text-emerald-700' : 'text-rose-700')}>
                        {c.yoyPct >= 100 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {formatPercent(c.yoyPct, 0)}
                      </span>
                    )}
                  </Mini>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">前日売上（{yMonth}/{yDay}）</span>
                  <span className="font-num text-lg font-bold text-slate-900">
                    {c.yesterdayEntered ? `${c.symbol}${formatNumber(c.yesterdayNet)}` : <span className="text-base font-bold text-rose-600">未入力</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          · 金額は税抜・現地通貨。予算比は色分け（緑=100%以上／黒=95%以上／朱=95%未満）。前年比＝当月実績(MTD)÷前年同月同日まで。店舗横断の合計・円換算は「期間集計」をご覧ください。
        </p>
      </section>

      {/* クイックリンク */}
      <section className="anim-in anim-delay-200">
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <StoreIcon className="w-4 h-4 text-slate-600" />
          よく使う操作
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickLink href="/daily-input/sales" icon={ClipboardEdit} label="日次売上入力" />
          <QuickLink href="/period-summary" icon={CalendarRange} label="期間集計" />
          <QuickLink href="/pl" icon={BarChart3} label="月次PL（損益）" />
          <QuickLink href="/targets" icon={TrendingUp} label="売上予算" />
        </div>
      </section>

      {/* マニュアル */}
      <section className="mt-8 anim-in anim-delay-300">
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-slate-600" />
          マニュアル
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ManualLink
            href="/manuals/setup"
            title="設定マニュアル"
            desc="初期設定・マスタ・権限・為替・税計算の前提"
          />
          <ManualLink
            href="/manuals/operations"
            title="運用マニュアル"
            desc="ログイン・日次入力・集計・PL の使い方"
          />
        </div>
        <p className="mt-3 text-[11px] text-slate-400">· 各マニュアルの画面右上「PDFで保存 / 印刷」からPDF出力できます。</p>
      </section>

      {/* スマホログイン用QRコード */}
      <section className="mt-8 anim-in anim-delay-300">
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <QrCode className="w-4 h-4 text-slate-600" />
          スマホでログイン
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div
              className="w-40 h-40 flex-shrink-0 rounded-xl border border-slate-100 bg-white p-2.5 [&>svg]:w-full [&>svg]:h-full"
              // サーバ側で生成した安全なSVG（固定のログインURL由来・ユーザー入力なし）
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="min-w-0 flex-1 w-full">
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                スマホのカメラでこのQRコードを読み取ると、ログイン画面が開きます。アカウント作成やパスワード設定は不要で、
                発行済みのメールアドレス・パスワードでそのままログインできます。印刷して店舗に掲示すると、出社時にすぐ
                アクセスできて便利です。
              </p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  ログインURL
                </div>
                <div className="font-num text-xs text-slate-700 break-all select-all">{qrTarget}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/qr"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  大きく表示
                </Link>
                <Link
                  href="/qr"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  印刷用ページ
                </Link>
              </div>
              <p className="mt-2.5 text-[11px] text-slate-500">
                ※ カメラでうまく読めない場合は、上のURLを直接入力してもログインできます。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ManualLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white px-4 py-4 flex items-center justify-between hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-brand-600" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">{title}</span>
          <span className="block text-[11px] text-slate-500 mt-0.5 truncate">{desc}</span>
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
    </Link>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof StoreIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white px-4 py-4 flex items-center justify-between hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
    >
      <span className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-600" />
        </span>
        <span className="text-sm font-medium text-slate-900">{label}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
    </Link>
  );
}

function formatDate(d: Date) {
  // d は JST 補正済み（UTCゲッターで読む）
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${'日月火水木金土'[d.getUTCDay()]}）`;
}
