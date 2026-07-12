import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { canOpenPath, isPurchasesOnly, PURCHASES_ONLY_HOME } from '@/lib/permissions/access';

// ユーザーのロール＋能力を短時間キャッシュ（毎遷移ごとの profiles/role_permissions の
// 往復を削減）。権限変更は最大 TTL 秒で反映（実用上問題ない範囲）。Edge アイソレート内のみ。
type UserAccess = { role: string | null; caps: Set<string>; exp: number };
const accessCache = new Map<string, UserAccess>();
const ACCESS_TTL_MS = 30_000;

type MwClient = ReturnType<typeof createServerClient<Database>>;

async function getUserAccess(supabase: MwClient, userId: string): Promise<UserAccess> {
  const now = Date.now();
  const cached = accessCache.get(userId);
  if (cached && cached.exp > now) return cached;

  const { data: prof } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  const role = prof?.role ?? null;
  let caps = new Set<string>();
  if (role) {
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('capability')
      .eq('role', role)
      .eq('allowed', true);
    caps = new Set((perms ?? []).map((p) => p.capability as string));
  }
  const entry: UserAccess = { role, caps, exp: now + ACCESS_TTL_MS };
  accessCache.set(userId, entry);
  return entry;
}

/**
 * 認証ミドルウェア
 * - セッションの自動更新（getUser() で必須）
 * - 認証必須ルートの保護
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッション更新（必須・getUser を呼ばないとリフレッシュされない）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // パブリックルート（/auth/* はメールリンク→セッション確立ルート。/qr はスマホ用QR。未ログインで通す）
  const publicPaths = ['/login', '/reset-password', '/change-password', '/auth/', '/qr'];
  const isPublic = publicPaths.some((path) => pathname.startsWith(path));

  // 未ログインで保護ルートへアクセス → ログインへリダイレクト
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // ログイン済みでログイン画面へアクセス → ダッシュボードへリダイレクト
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // 厳格アクセス制御：権限のないページは開かせない（保有能力で判定し、不可なら誘導）。
  //   表示データの範囲・保存可否は従来どおり RLS が担保。ここは「画面を開けるか」のみ。
  //   能力取得に失敗した場合は fail-open（締め出し防止）。
  if (user && !isPublic) {
    const { role, caps } = await getUserAccess(supabase, user.id);
    if (role && !canOpenPath(pathname, caps)) {
      const url = request.nextUrl.clone();
      url.pathname = isPurchasesOnly(caps) ? PURCHASES_ONLY_HOME : '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // 選択店舗を Cookie に保持（?store= 付き遷移で更新）。各ページが未指定時の既定に使う（#2）。
  const storeParam = request.nextUrl.searchParams.get('store');
  if (user && storeParam) {
    supabaseResponse.cookies.set('selected_store', storeParam, {
      path: '/',
      maxAge: 60 * 60 * 24 * 180, // 180日
      sameSite: 'lax',
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにマッチ：
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - api/ (APIルートはハンドラ内で認証)
     * - public/ 静的アセット（拡張子 .png/.jpg/.svg/.webp/.ico/.gif/.jpeg）
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpe?g|gif|svg|webp|ico)$).*)',
  ],
};
