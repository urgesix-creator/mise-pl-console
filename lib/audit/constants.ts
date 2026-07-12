// 監査ログの表示用定数（DB非依存・クライアント/サーバ共用）

/** 操作種別の日本語ラベル（画面表示用） */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'permission.update': '権限の変更',
  'user.create': 'ユーザー招待',
  'user.update': 'ユーザー更新',
  'user.activate': 'ユーザー有効化',
  'user.deactivate': 'ユーザー無効化',
  'user.delete': 'ユーザー削除',
  'user.reset_password': 'パスワード再発行',
  'api_key.create': 'APIキー発行',
  'api_key.revoke': 'APIキー失効',
  'api.write': 'API経由の書き込み',
  'settings.update': 'システム設定の変更',
  'initial_setup.import': '初期設定の一括取込',
  'report.test_send': '日報のテスト送信',
  'exchange_rate.auto_sync': '為替レート自動取得',
};
