'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { countryFormSchema, type CountryFormData } from './_schemas';

type ActionResult = { success: true } | { success: false; error: string };

async function ensureWritePermission(): Promise<ActionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) return { success: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'exec_master'))) {
    return { success: false, error: '国マスタの編集権限がありません' };
  }
  return null;
}

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'この国IDまたは国コードは既に登録されています';
  if (error.code === '23514') return '入力値が制約に違反しています（課税ベース等）';
  return `処理に失敗しました: ${error.message}`;
}

/** 国を追加（countries に INSERT） */
export async function createCountry(input: CountryFormData): Promise<ActionResult> {
  const parsed = countryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('countries')
    .select('id')
    .or(`id.eq.${parsed.data.id},code.eq.${parsed.data.code}`)
    .maybeSingle();
  if (existing) {
    return { success: false, error: 'この国IDまたは国コードは既に登録されています' };
  }

  const { error } = await supabase.from('countries').insert({
    id: parsed.data.id,
    name: parsed.data.name,
    code: parsed.data.code,
    flag: parsed.data.flag ?? null,
    tax_rate: parsed.data.tax_rate,
    tax_base: parsed.data.tax_base,
    tax_label: parsed.data.tax_label,
    display_order: parsed.data.display_order,
  });

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/countries');
  return { success: true };
}

/** 国を更新（id は変更不可・税率/課税ベース/ラベル/国名/コード/旗/表示順を更新） */
export async function updateCountry(id: string, input: CountryFormData): Promise<ActionResult> {
  const parsed = countryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  if (parsed.data.id !== id) {
    return { success: false, error: '国IDは作成後に変更できません' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { error } = await supabase
    .from('countries')
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      flag: parsed.data.flag ?? null,
      tax_rate: parsed.data.tax_rate,
      tax_base: parsed.data.tax_base,
      tax_label: parsed.data.tax_label,
      display_order: parsed.data.display_order,
    })
    .eq('id', id);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/countries');
  // 店舗マスタの「国の税制（自動設定）」表示にも反映させる
  revalidatePath('/masters/stores');
  return { success: true };
}
