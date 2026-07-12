/**
 * メールテンプレート（4言語対応）
 *
 * 用途：
 * - 招待メール
 * - パスワードリセットメール
 * - アラート通知メール（オプション）
 * - 入力遅延リマインダーメール（オプション）
 *
 * 使い方：
 *   import { renderEmail } from '@/lib/email/templates';
 *   const { subject, html, text } = renderEmail('invitation', user.language, {
 *     displayName: '田中 太郎',
 *     inviteUrl: 'https://...',
 *     inviterName: '比嘉 俊一',
 *   });
 */

import type { Locale } from '@/lib/i18n/locales';

// ====================================================================
// 型定義
// ====================================================================

export type EmailType = 'invitation' | 'passwordReset' | 'alertNotice' | 'inputReminder';

export type EmailVariables = {
  displayName?: string;
  inviteUrl?: string;
  resetUrl?: string;
  inviterName?: string;
  storeName?: string;
  pendingDate?: string;
  alertMessage?: string;
  expirationHours?: number;
};

export type EmailRenderResult = {
  subject: string;
  html: string;
  text: string;
};

// ====================================================================
// 共通スタイル（HTML email）
// ====================================================================

const baseStyles = `
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Noto Sans JP', 'Noto Sans Thai'; background: #f8fafc; }
    .container { max-width: 560px; margin: 0 auto; background: #fff; padding: 0; }
    .header { background: #0f172a; padding: 32px 40px; }
    .logo { color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
    .content { padding: 40px; color: #0f172a; }
    .h1 { font-size: 24px; font-weight: 800; line-height: 1.3; margin: 0 0 16px 0; }
    .p { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0; }
    .cta { display: inline-block; background: #0f172a; color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 24px 0; }
    .small { font-size: 12px; color: #64748b; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
    .footer { padding: 24px 40px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
`;

const wrapHtml = (innerContent: string): string => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">${baseStyles}</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">みせPL</div>
    </div>
    <div class="content">
      ${innerContent}
    </div>
    <div class="footer">
      © 2026 みせPL
    </div>
  </div>
</body>
</html>`;

// ====================================================================
// 招待メール
// ====================================================================

const INVITATION: Record<Locale, (v: EmailVariables) => EmailRenderResult> = {
  ja: (v) => ({
    subject: 'みせPL へのご招待',
    html: wrapHtml(`
      <h1 class="h1">みせPL へようこそ</h1>
      <p class="p">${v.displayName} 様</p>
      <p class="p">
        ${v.inviterName} 様より、みせPL へのアカウント招待が届いています。
        以下のリンクから初期パスワードを設定してください。
      </p>
      <a href="${v.inviteUrl}" class="cta">アカウントを設定する</a>
      <p class="p">
        このリンクは <strong>${v.expirationHours || 24} 時間</strong>有効です。
        期限切れの場合は管理者へ再送を依頼してください。
      </p>
      <div class="small">
        身に覚えのない招待の場合、このメールは破棄してください。<br>
        質問は管理者（${v.inviterName}）へ直接ご連絡ください。
      </div>
    `),
    text: `みせPL へようこそ

${v.displayName} 様

${v.inviterName} 様より、みせPL へのアカウント招待が届いています。
以下のリンクから初期パスワードを設定してください。

${v.inviteUrl}

このリンクは ${v.expirationHours || 24} 時間有効です。

身に覚えのない招待の場合、このメールは破棄してください。
質問は管理者（${v.inviterName}）へ直接ご連絡ください。

— みせPL`,
  }),

  en: (v) => ({
    subject: "You're invited to みせPL",
    html: wrapHtml(`
      <h1 class="h1">Welcome to みせPL</h1>
      <p class="p">Hi ${v.displayName},</p>
      <p class="p">
        ${v.inviterName} has invited you to join みせPL.
        Click the link below to set up your initial password.
      </p>
      <a href="${v.inviteUrl}" class="cta">Set up your account</a>
      <p class="p">
        This link is valid for <strong>${v.expirationHours || 24} hours</strong>.
        If it expires, please ask your administrator to resend the invitation.
      </p>
      <div class="small">
        If you didn't expect this invitation, you can safely ignore this email.<br>
        For questions, contact your administrator (${v.inviterName}) directly.
      </div>
    `),
    text: `Welcome to みせPL

Hi ${v.displayName},

${v.inviterName} has invited you to join みせPL.
Click the link below to set up your initial password.

${v.inviteUrl}

This link is valid for ${v.expirationHours || 24} hours.

If you didn't expect this invitation, you can safely ignore this email.

— みせPL`,
  }),

  th: (v) => ({
    subject: 'คุณได้รับเชิญเข้าใช้ みせPL',
    html: wrapHtml(`
      <h1 class="h1">ยินดีต้อนรับสู่ みせPL</h1>
      <p class="p">เรียน คุณ ${v.displayName}</p>
      <p class="p">
        ${v.inviterName} ได้เชิญคุณเข้าร่วมระบบ みせPL
        กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านเริ่มต้น
      </p>
      <a href="${v.inviteUrl}" class="cta">ตั้งค่าบัญชีของคุณ</a>
      <p class="p">
        ลิงก์นี้มีอายุ <strong>${v.expirationHours || 24} ชั่วโมง</strong>
        หากลิงก์หมดอายุ กรุณาติดต่อผู้ดูแลระบบเพื่อส่งคำเชิญใหม่
      </p>
      <div class="small">
        หากคุณไม่ได้คาดหวังคำเชิญนี้ คุณสามารถละเว้นอีเมลนี้ได้<br>
        สำหรับคำถาม กรุณาติดต่อผู้ดูแลระบบ (${v.inviterName}) โดยตรง
      </div>
    `),
    text: `ยินดีต้อนรับสู่ みせPL

เรียน คุณ ${v.displayName}

${v.inviterName} ได้เชิญคุณเข้าร่วมระบบ みせPL
กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านเริ่มต้น

${v.inviteUrl}

ลิงก์นี้มีอายุ ${v.expirationHours || 24} ชั่วโมง

— みせPL`,
  }),

  id: (v) => ({
    subject: 'Anda diundang ke みせPL',
    html: wrapHtml(`
      <h1 class="h1">Selamat datang di みせPL</h1>
      <p class="p">Yth. ${v.displayName},</p>
      <p class="p">
        ${v.inviterName} telah mengundang Anda untuk bergabung dengan みせPL.
        Klik tautan di bawah ini untuk menyiapkan kata sandi awal Anda.
      </p>
      <a href="${v.inviteUrl}" class="cta">Siapkan akun Anda</a>
      <p class="p">
        Tautan ini berlaku selama <strong>${v.expirationHours || 24} jam</strong>.
        Jika kedaluwarsa, mohon minta administrator untuk mengirim ulang undangan.
      </p>
      <div class="small">
        Jika Anda tidak mengharapkan undangan ini, Anda dapat mengabaikan email ini.<br>
        Untuk pertanyaan, hubungi administrator (${v.inviterName}) langsung.
      </div>
    `),
    text: `Selamat datang di みせPL

Yth. ${v.displayName},

${v.inviterName} telah mengundang Anda untuk bergabung dengan みせPL.
Klik tautan di bawah ini untuk menyiapkan kata sandi awal Anda.

${v.inviteUrl}

Tautan ini berlaku selama ${v.expirationHours || 24} jam.

— みせPL`,
  }),
};

// ====================================================================
// パスワードリセット
// ====================================================================

const PASSWORD_RESET: Record<Locale, (v: EmailVariables) => EmailRenderResult> = {
  ja: (v) => ({
    subject: 'パスワードリセットのご案内 - みせPL',
    html: wrapHtml(`
      <h1 class="h1">パスワードリセット</h1>
      <p class="p">${v.displayName || 'お客様'}</p>
      <p class="p">
        パスワードリセットのリクエストを受け付けました。
        以下のリンクから新しいパスワードを設定してください。
      </p>
      <a href="${v.resetUrl}" class="cta">パスワードを再設定する</a>
      <p class="p">
        このリンクは <strong>1時間</strong>有効です。
      </p>
      <div class="small">
        このリクエストに心当たりがない場合は、このメールを無視してください。
        パスワードは変更されません。
      </div>
    `),
    text: `パスワードリセット

パスワードリセットのリクエストを受け付けました。
以下のリンクから新しいパスワードを設定してください。

${v.resetUrl}

このリンクは1時間有効です。

このリクエストに心当たりがない場合は、このメールを無視してください。

— みせPL`,
  }),

  en: (v) => ({
    subject: 'Reset your password - みせPL',
    html: wrapHtml(`
      <h1 class="h1">Reset your password</h1>
      <p class="p">Hi ${v.displayName || 'there'},</p>
      <p class="p">
        We received a request to reset your password.
        Click the link below to set a new password.
      </p>
      <a href="${v.resetUrl}" class="cta">Reset password</a>
      <p class="p">
        This link is valid for <strong>1 hour</strong>.
      </p>
      <div class="small">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </div>
    `),
    text: `Reset your password

We received a request to reset your password.
Click the link below to set a new password.

${v.resetUrl}

This link is valid for 1 hour.

If you didn't request a password reset, you can safely ignore this email.

— みせPL`,
  }),

  th: (v) => ({
    subject: 'รีเซ็ตรหัสผ่านของคุณ - みせPL',
    html: wrapHtml(`
      <h1 class="h1">รีเซ็ตรหัสผ่านของคุณ</h1>
      <p class="p">เรียน คุณ ${v.displayName || 'ผู้ใช้งาน'}</p>
      <p class="p">
        เราได้รับคำขอรีเซ็ตรหัสผ่านของคุณ
        กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่
      </p>
      <a href="${v.resetUrl}" class="cta">รีเซ็ตรหัสผ่าน</a>
      <p class="p">
        ลิงก์นี้มีอายุ <strong>1 ชั่วโมง</strong>
      </p>
      <div class="small">
        หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน คุณสามารถละเว้นอีเมลนี้ได้
        รหัสผ่านของคุณจะไม่ถูกเปลี่ยน
      </div>
    `),
    text: `รีเซ็ตรหัสผ่านของคุณ

เราได้รับคำขอรีเซ็ตรหัสผ่านของคุณ
กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่

${v.resetUrl}

ลิงก์นี้มีอายุ 1 ชั่วโมง

— みせPL`,
  }),

  id: (v) => ({
    subject: 'Atur ulang kata sandi Anda - みせPL',
    html: wrapHtml(`
      <h1 class="h1">Atur ulang kata sandi Anda</h1>
      <p class="p">Yth. ${v.displayName || 'Pengguna'},</p>
      <p class="p">
        Kami menerima permintaan untuk mengatur ulang kata sandi Anda.
        Klik tautan di bawah ini untuk menetapkan kata sandi baru.
      </p>
      <a href="${v.resetUrl}" class="cta">Atur ulang kata sandi</a>
      <p class="p">
        Tautan ini berlaku selama <strong>1 jam</strong>.
      </p>
      <div class="small">
        Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.
        Kata sandi Anda tidak akan diubah.
      </div>
    `),
    text: `Atur ulang kata sandi Anda

Kami menerima permintaan untuk mengatur ulang kata sandi Anda.
Klik tautan di bawah ini untuk menetapkan kata sandi baru.

${v.resetUrl}

Tautan ini berlaku selama 1 jam.

— みせPL`,
  }),
};

// ====================================================================
// 入力遅延リマインダー
// ====================================================================

const INPUT_REMINDER: Record<Locale, (v: EmailVariables) => EmailRenderResult> = {
  ja: (v) => ({
    subject: `【リマインド】${v.storeName} の${v.pendingDate}の入力が未完了です`,
    html: wrapHtml(`
      <h1 class="h1">日次入力のリマインド</h1>
      <p class="p">${v.displayName} 様</p>
      <p class="p">
        ${v.storeName} の <strong>${v.pendingDate}</strong> の日次入力がまだ完了していません。
        本日中にご入力をお願いします。
      </p>
      <a href="${v.inviteUrl}" class="cta">入力画面を開く</a>
      <div class="small">
        既に入力済みの場合は本メールを無視してください。
      </div>
    `),
    text: `日次入力のリマインド

${v.displayName} 様

${v.storeName} の ${v.pendingDate} の日次入力がまだ完了していません。

入力画面：${v.inviteUrl}

— みせPL`,
  }),

  en: (v) => ({
    subject: `[Reminder] ${v.storeName} input pending for ${v.pendingDate}`,
    html: wrapHtml(`
      <h1 class="h1">Daily input reminder</h1>
      <p class="p">Hi ${v.displayName},</p>
      <p class="p">
        Daily input for <strong>${v.storeName}</strong> on <strong>${v.pendingDate}</strong> is still pending.
        Please submit it today.
      </p>
      <a href="${v.inviteUrl}" class="cta">Open input form</a>
      <div class="small">
        If you've already submitted, please ignore this email.
      </div>
    `),
    text: `Daily input reminder

Daily input for ${v.storeName} on ${v.pendingDate} is still pending.
Please submit it today.

${v.inviteUrl}

— みせPL`,
  }),

  th: (v) => ({
    subject: `[แจ้งเตือน] ${v.storeName} ยังไม่ได้บันทึกข้อมูลของวันที่ ${v.pendingDate}`,
    html: wrapHtml(`
      <h1 class="h1">แจ้งเตือนการบันทึกประจำวัน</h1>
      <p class="p">เรียน คุณ ${v.displayName}</p>
      <p class="p">
        ข้อมูลประจำวันของ <strong>${v.storeName}</strong> สำหรับวันที่ <strong>${v.pendingDate}</strong> ยังไม่ได้บันทึก
        กรุณาบันทึกภายในวันนี้
      </p>
      <a href="${v.inviteUrl}" class="cta">เปิดหน้าบันทึก</a>
      <div class="small">
        หากคุณบันทึกแล้ว กรุณาละเว้นอีเมลนี้
      </div>
    `),
    text: `แจ้งเตือนการบันทึกประจำวัน

ข้อมูลประจำวันของ ${v.storeName} สำหรับวันที่ ${v.pendingDate} ยังไม่ได้บันทึก
กรุณาบันทึกภายในวันนี้

${v.inviteUrl}

— みせPL`,
  }),

  id: (v) => ({
    subject: `[Pengingat] ${v.storeName} belum input data tanggal ${v.pendingDate}`,
    html: wrapHtml(`
      <h1 class="h1">Pengingat input harian</h1>
      <p class="p">Yth. ${v.displayName},</p>
      <p class="p">
        Input harian untuk <strong>${v.storeName}</strong> tanggal <strong>${v.pendingDate}</strong> belum dilakukan.
        Mohon submit hari ini.
      </p>
      <a href="${v.inviteUrl}" class="cta">Buka formulir input</a>
      <div class="small">
        Jika sudah submit, mohon abaikan email ini.
      </div>
    `),
    text: `Pengingat input harian

Input harian untuk ${v.storeName} tanggal ${v.pendingDate} belum dilakukan.
Mohon submit hari ini.

${v.inviteUrl}

— みせPL`,
  }),
};

// ====================================================================
// アラート通知
// ====================================================================

const ALERT_NOTICE: Record<Locale, (v: EmailVariables) => EmailRenderResult> = {
  ja: (v) => ({
    subject: `【アラート】${v.storeName} - ${v.alertMessage}`,
    html: wrapHtml(`
      <h1 class="h1">⚠️ アラート通知</h1>
      <p class="p">${v.displayName} 様</p>
      <p class="p">
        <strong>${v.storeName}</strong> でアラートが発生しています：
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; color: #7f1d1d; font-size: 14px;">
        ${v.alertMessage}
      </div>
      <a href="${v.inviteUrl}" class="cta">詳細を確認</a>
    `),
    text: `アラート通知

${v.storeName} でアラートが発生しています：
${v.alertMessage}

詳細：${v.inviteUrl}

— みせPL`,
  }),

  en: (v) => ({
    subject: `[Alert] ${v.storeName} - ${v.alertMessage}`,
    html: wrapHtml(`
      <h1 class="h1">⚠️ Alert notification</h1>
      <p class="p">Hi ${v.displayName},</p>
      <p class="p">
        An alert has been triggered at <strong>${v.storeName}</strong>:
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; color: #7f1d1d; font-size: 14px;">
        ${v.alertMessage}
      </div>
      <a href="${v.inviteUrl}" class="cta">View details</a>
    `),
    text: `Alert notification

An alert has been triggered at ${v.storeName}:
${v.alertMessage}

Details: ${v.inviteUrl}

— みせPL`,
  }),

  th: (v) => ({
    subject: `[แจ้งเตือน] ${v.storeName} - ${v.alertMessage}`,
    html: wrapHtml(`
      <h1 class="h1">⚠️ การแจ้งเตือน</h1>
      <p class="p">เรียน คุณ ${v.displayName}</p>
      <p class="p">
        มีการแจ้งเตือนที่ <strong>${v.storeName}</strong>:
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; color: #7f1d1d; font-size: 14px;">
        ${v.alertMessage}
      </div>
      <a href="${v.inviteUrl}" class="cta">ดูรายละเอียด</a>
    `),
    text: `การแจ้งเตือน

มีการแจ้งเตือนที่ ${v.storeName}:
${v.alertMessage}

รายละเอียด: ${v.inviteUrl}

— みせPL`,
  }),

  id: (v) => ({
    subject: `[Peringatan] ${v.storeName} - ${v.alertMessage}`,
    html: wrapHtml(`
      <h1 class="h1">⚠️ Pemberitahuan peringatan</h1>
      <p class="p">Yth. ${v.displayName},</p>
      <p class="p">
        Peringatan telah dipicu di <strong>${v.storeName}</strong>:
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; color: #7f1d1d; font-size: 14px;">
        ${v.alertMessage}
      </div>
      <a href="${v.inviteUrl}" class="cta">Lihat detail</a>
    `),
    text: `Pemberitahuan peringatan

Peringatan telah dipicu di ${v.storeName}:
${v.alertMessage}

Detail: ${v.inviteUrl}

— みせPL`,
  }),
};

// ====================================================================
// 統合エクスポート
// ====================================================================

const TEMPLATES: Record<EmailType, Record<Locale, (v: EmailVariables) => EmailRenderResult>> = {
  invitation: INVITATION,
  passwordReset: PASSWORD_RESET,
  inputReminder: INPUT_REMINDER,
  alertNotice: ALERT_NOTICE,
};

/**
 * メールを指定言語でレンダリング
 */
export function renderEmail(
  type: EmailType,
  locale: Locale,
  variables: EmailVariables = {}
): EmailRenderResult {
  const template = TEMPLATES[type]?.[locale];
  if (!template) {
    throw new Error(`Email template not found: type=${type}, locale=${locale}`);
  }
  return template(variables);
}
