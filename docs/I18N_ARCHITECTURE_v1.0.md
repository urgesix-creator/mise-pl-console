# 多言語対応（i18n）アーキテクチャ設計書 v1.0

| 項目 | 内容 |
|---|---|
| 関連文書 | 要件定義 v2.3 6.5節、データモデル v1.6 |
| 採用ライブラリ | `next-intl` v3+ |
| 対応言語 | 日本語（ja）／英語（en）／タイ語（th）／インドネシア語（id） |

---

## 1. 全体アーキテクチャ

```
┌────────────────────────────────────────────────────┐
│ ユーザーアクセス                                    │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ middleware.ts                                       │
│ - profiles.language を取得                          │
│ - 未ログイン時はAccept-Languageヘッダから推定       │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ Server Component                                    │
│ - getMessages(locale) で翻訳JSONを取得              │
│ - <NextIntlClientProvider> でラップ                 │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ Client Component                                    │
│ - useTranslations('namespace') でアクセス           │
│ - t('key') で翻訳取得                               │
└────────────────────────────────────────────────────┘

翻訳ファイル: messages/{ja|en|th|id}.json
```

## 2. ファイル構造

```
sales-console/
├── messages/                    # 翻訳JSONファイル群
│   ├── ja.json                 # 日本語（ベース）
│   ├── en.json                 # 英語
│   ├── th.json                 # タイ語
│   └── id.json                 # インドネシア語
├── lib/
│   ├── i18n/
│   │   ├── config.ts           # next-intl 設定
│   │   ├── request.ts          # サーバー側 locale 解決
│   │   ├── locales.ts          # ロケール定数
│   │   └── format.ts           # 数値・日付フォーマット
│   └── ...
├── i18n.ts                      # next-intl エントリポイント
├── next.config.js               # next-intl プラグイン設定
└── ...
```

## 3. 翻訳キーの命名規則

階層的な構造で、画面・機能ごとに名前空間を分ける：

```typescript
// ❌ 悪い例（フラット）
t('saveButton')
t('userManagementTitle')

// ✅ 良い例（階層的）
t('common.save')
t('admin.users.title')
```

### 名前空間（namespace）の標準

| 名前空間 | 用途 |
|---|---|
| `common` | 全画面共通のラベル（save, cancel, delete等） |
| `auth` | 認証関連（login, logout, password等） |
| `nav` | ナビゲーションメニュー |
| `dashboard` | ダッシュボード画面 |
| `input` | 日次入力画面 |
| `targets` | 売上目標画面 |
| `data` | データ閲覧画面 |
| `masters.stores` | 店舗マスタ |
| `masters.categories` | 仕入カテゴリマスタ |
| `masters.suppliers` | 仕入先マスタ |
| `masters.expenseAccounts` | 販管費科目マスタ |
| `masters.exchangeRates` | 為替レート |
| `admin.users` | ユーザー管理 |
| `admin.settings` | システム設定 |
| `profile` | プロフィール |
| `roles` | ロール名（executive等） |
| `expenseLevel1` | 販管費上位分類（人件費等） |
| `errors` | エラーメッセージ |
| `validations` | バリデーションメッセージ |

## 4. 翻訳キーの粒度

```json
{
  "input": {
    "title": "日次入力",
    "subtitle": "今日の売上を記録",
    "sections": {
      "basicInfo": "基本情報",
      "sales": "売上",
      "purchases": "仕入",
      "expenses": "販管費",
      "inventory": "概算棚卸"
    },
    "fields": {
      "businessDate": "営業日",
      "grossSales": "総売上",
      "customerCount": "客数",
      "weather": "天気",
      "eventNote": "特記事項"
    },
    "actions": {
      "save": "保存",
      "saveDraft": "下書き保存",
      "delete": "削除"
    }
  }
}
```

## 5. ロケール対応のフォーマッタ

`Intl` API を使用してロケール別に自動フォーマット：

```typescript
// lib/i18n/format.ts
import type { Locale } from './locales';

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : locale).format(n);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(getLocaleString(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function getLocaleString(locale: Locale): string {
  const map = { ja: 'ja-JP', en: 'en-US', th: 'th-TH', id: 'id-ID' };
  return map[locale];
}
```

### 表示例

| 言語 | 数値（1234567） | 日付（2026-05-10） |
|---|---|---|
| ja | 1,234,567 | 2026年5月10日 |
| en | 1,234,567 | May 10, 2026 |
| th | 1,234,567 | 10 พฤษภาคม 2026 |
| id | 1.234.567 | 10 Mei 2026 |

## 6. 通貨表示のルール

通貨記号と金額は**言語によらず統一**：

```typescript
// 良い例：どの言語でも同じ表示
formatCurrency(85600, '฿')  // → "฿85,600"

// ❌ 悪い例：通貨を翻訳しようとする
t('currency.thb') + formatNumber(85600)  // 不要な複雑化
```

ただし**金額の数値部分は言語ロケールでフォーマット**：

```
ja: ฿1,234,567
en: ฿1,234,567
th: ฿1,234,567
id: ฿1.234.567
```

## 7. 翻訳の追加・修正フロー

### 開発中の運用

1. UIに新しい文字列を追加するときは、まず`ja.json`にキーを追加
2. 残り3言語のJSONにも対応キーを追加（とりあえず `[TODO: 翻訳]` でも可）
3. PRレビュー時に翻訳の妥当性を確認
4. 本番リリース前に**ネイティブスピーカーによるレビュー**を実施

### 翻訳キーの欠落検出

CI/CD で以下を実行：

```bash
# 4ファイル間で全キーが揃っているかチェック
node scripts/check-i18n-keys.js
```

## 8. 言語切替の実装

### プロフィール画面

```tsx
// app/(app)/profile/components/LanguageSelector.tsx
'use client';

import { useRouter } from 'next/navigation';
import { updateUserLanguage } from '../actions';

export function LanguageSelector({ current }: { current: Locale }) {
  const router = useRouter();
  
  const handleChange = async (lang: Locale) => {
    await updateUserLanguage(lang);
    router.refresh();  // Server Component を再レンダリング
  };
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['ja', 'en', 'th', 'id'] as Locale[]).map(l => (
        <button
          key={l}
          onClick={() => handleChange(l)}
          className={current === l ? 'border-slate-900' : 'border-slate-200'}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
```

### Server Action

```typescript
// app/(app)/profile/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function updateUserLanguage(language: Locale) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  await supabase
    .from('profiles')
    .update({ language })
    .eq('id', user.id);
}
```

## 9. ログイン画面の言語

未ログインユーザーは`profiles.language`が取得できないため：

```typescript
// middleware.ts または app/layout.tsx
function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return 'ja';
  const langs = acceptLanguage.toLowerCase();
  if (langs.includes('ja')) return 'ja';
  if (langs.includes('th')) return 'th';
  if (langs.includes('id')) return 'id';
  return 'en';  // フォールバック
}
```

ログイン後は `profiles.language` で上書き。

## 10. メールテンプレート

招待メール・パスワードリセットメール等は、ユーザーの言語で送信：

```typescript
// app/api/invite/route.ts
const t = await getTranslations({ locale: targetUser.language });
const subject = t('email.invite.subject');
const body = t('email.invite.body', { name: targetUser.display_name });
```

## 11. 翻訳品質保証

### Phase 1（MVP）
- 比嘉専務（日本語）が原文を作成
- Claude Code が英語・タイ語・インドネシア語の初期翻訳を生成
- 各国の現地スタッフに**レビュー依頼**（あお季タイ・博多天神ジャカルタ）
- 修正をフィードバック→翻訳ファイル更新

### Phase 2 以降
- 翻訳管理サービス（Lokalise・Crowdin等）の導入を検討
- マスタデータ（仕入先名等）の多言語対応

## 12. アクセシビリティ

```tsx
<html lang={locale}>
```

各ページの `<html>` タグに `lang` 属性を必ず設定。スクリーンリーダーが正しい言語で読み上げる。
