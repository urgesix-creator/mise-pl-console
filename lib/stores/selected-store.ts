import { cookies } from 'next/headers';

// ====================================================================
// 選択店舗の保持（#2）。
//   - 店舗選択は URL の ?store= で行うが、別画面へ移動すると失われ先頭店に戻る。
//   - middleware が ?store= 付き遷移で selected_store Cookie を保存する。
//   - 各ページは「URLの?store= → Cookie → 先頭店」の優先順で既定店舗を決める。
//   - いずれもアクセス可能な stores の中だけから選ぶため、RLS/権限は壊さない。
// ====================================================================

export const SELECTED_STORE_COOKIE = 'selected_store';

/**
 * 既定の店舗IDを解決する：searchParams の store → Cookie → 先頭店。
 * 渡された stores（アクセス可能な店舗）に含まれるIDのみ採用する。
 */
export async function resolveSelectedStoreId<T extends { id: string }>(
  searchParamStore: string | null | undefined,
  stores: T[],
): Promise<string | null> {
  const pick = (id: string | undefined | null): string | null =>
    id && stores.some((s) => s.id === id) ? id : null;

  const fromParam = pick(searchParamStore);
  if (fromParam) return fromParam;

  const cookieStore = await cookies();
  const fromCookie = pick(cookieStore.get(SELECTED_STORE_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  return stores[0]?.id ?? null;
}
