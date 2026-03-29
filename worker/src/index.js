export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // --- Routing ---
    // POST / or /trial → トライアルメール送信
    if (request.method === 'POST' && (path === '/' || path === '/trial')) {
      return handleTrial(request, env);
    }

    // POST /webhook → LemonSqueezy webhook
    if (request.method === 'POST' && path === '/webhook') {
      return handleLemonSqueezyWebhook(request, env);
    }

    // POST /verify → ライセンス検証（マシンID紐づけ）
    if (request.method === 'POST' && path === '/verify') {
      return handleVerify(request, env);
    }

    // POST /contact → 問い合わせメール送信
    if (request.method === 'POST' && path === '/contact') {
      return handleContact(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404, env);
  },
};

// ============================================================
// Trial handler (既存ロジック)
// ============================================================
async function handleTrial(request, env) {
  try {
    const { email } = await request.json();

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400, env);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
        to: [email],
        subject: '【ワンクリIPO】無料トライアルのダウンロードリンク',
        html: buildTrialEmailHtml(env.DOWNLOAD_URL, env.SITE_URL || ''),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return jsonResponse({ error: 'Failed to send email' }, 500, env);
    }

    return jsonResponse({ success: true }, 200, env);
  } catch (e) {
    console.error('Worker error:', e);
    return jsonResponse({ error: 'Internal server error' }, 500, env);
  }
}

// ============================================================
// Contact handler (問い合わせ)
// ============================================================
async function handleContact(request, env) {
  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return jsonResponse({ error: 'All fields are required' }, 400, env);
    }
    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400, env);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
        to: [env.CONTACT_EMAIL || 'darkground96@gmail.com'],
        reply_to: email,
        subject: `【ワンクリIPO】お問い合わせ: ${name}`,
        html: buildContactEmailHtml(name, email, message),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return jsonResponse({ error: 'Failed to send email', detail: err }, 500, env);
    }

    // ユーザーへ受領確認メール
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
        to: [email],
        subject: '【ワンクリIPO】お問い合わせを受け付けました',
        html: buildContactAckEmailHtml(name, message),
      }),
    }).catch(e => console.error('Ack email error:', e));

    return jsonResponse({ success: true }, 200, env);
  } catch (e) {
    console.error('Contact error:', e);
    return jsonResponse({ error: 'Internal server error' }, 500, env);
  }
}

// ============================================================
// 問い合わせメール HTML
// ============================================================
function buildContactEmailHtml(name, email, message) {
  const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 24px;">お問い合わせがありました</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#64748b;font-size:13px;padding:8px 0;vertical-align:top;width:80px;">お名前</td>
          <td style="color:#1e293b;font-size:14px;padding:8px 0;">${name}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:8px 0;vertical-align:top;">メール</td>
          <td style="color:#1e293b;font-size:14px;padding:8px 0;"><a href="mailto:${email}" style="color:#4F46E5;">${email}</a></td>
        </tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <p style="color:#64748b;font-size:12px;margin:0 0 8px;">お問い合わせ内容</p>
        <p style="color:#1e293b;font-size:14px;line-height:1.8;margin:0;">${escapedMessage}</p>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;">このメールに返信すると ${email} に届きます。</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// 問い合わせ受領確認メール HTML（ユーザー向け）
// ============================================================
function buildContactAckEmailHtml(name, message) {
  const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">お問い合わせありがとうございます</h2>
      <p style="color:#64748b;font-size:14px;line-height:1.8;margin:0 0 24px;">${name} 様<br>以下の内容でお問い合わせを受け付けました。内容を確認の上、折り返しご連絡いたします。</p>
      <div style="padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <p style="color:#64748b;font-size:12px;margin:0 0 8px;">お問い合わせ内容</p>
        <p style="color:#1e293b;font-size:14px;line-height:1.8;margin:0;">${escapedMessage}</p>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;">※このメールは自動送信です。本メールへの返信はお控えください。</p>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px;">&copy; 2026 ワンクリIPO</p>
  </div>
</body>
</html>`;
}

// ============================================================
// LemonSqueezy Webhook handler
// ============================================================
async function handleLemonSqueezyWebhook(request, env) {
  const signature = request.headers.get('x-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await request.text();

  // HMAC-SHA256署名検証
  const isValid = await verifyLemonSqueezySignature(body, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 400 });
  }

  const payload = JSON.parse(body);
  const eventName = payload.meta?.event_name;

  if (eventName !== 'order_created') {
    // 対象外イベントは200で返す（リトライを防ぐ）
    return new Response('OK', { status: 200 });
  }

  const order = payload.data?.attributes;
  const orderId = payload.data?.id;

  if (!order || order.status !== 'paid') {
    return new Response('OK', { status: 200 });
  }

  // 冪等性チェック: 同じ注文の重複webhookを防ぐ
  const existingKey = await env.LICENSES.get(`order:${orderId}`);
  if (existingKey) {
    return new Response('Already processed', { status: 200 });
  }

  const email = order.user_email;
  if (!email) {
    console.error('No email found in order:', orderId);
    return new Response('No email', { status: 400 });
  }

  // ライセンスキー生成
  const licenseKey = generateLicenseKey();
  const plan = 'standard';

  // KVに保存
  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify({
    plan,
    email,
    orderId,
    createdAt: new Date().toISOString(),
    activated: false,
  }));

  // 注文ID→キーのマッピング（冪等性用）
  await env.LICENSES.put(`order:${orderId}`, licenseKey);

  // ライセンスキーをメールで送信
  try {
    await sendLicenseEmail(email, licenseKey, plan, env);
  } catch (e) {
    console.error('Failed to send license email:', e);
    // メール送信失敗でも決済は成功しているので200を返す
  }

  return new Response('OK', { status: 200 });
}

// ============================================================
// ライセンス検証エンドポイント（マシンID紐づけ対応）
// ============================================================
async function handleVerify(request, env) {
  const { key, machine_id } = await request.json();

  if (!key || !machine_id) {
    return jsonResponse({ valid: false, error: 'Missing key or machine_id' }, 400, env);
  }

  const data = await env.LICENSES.get(`license:${key}`);
  if (!data) {
    return jsonResponse({ valid: false, error: 'invalid_key' }, 200, env);
  }

  const license = JSON.parse(data);

  // machine_ids配列を初期化（既存データとの互換性）
  if (!license.machine_ids) {
    license.machine_ids = [];
  }

  // マシンID確認
  const alreadyRegistered = license.machine_ids.includes(machine_id);

  if (!alreadyRegistered) {
    // 上限チェック（最大2台）
    if (license.machine_ids.length >= 2) {
      return jsonResponse({
        valid: false,
        error: 'device_limit_reached',
        message: 'このライセンスキーは既に2台のPCで使用されています。別のPCで使用するにはサポートにご連絡ください。',
        activated_devices: license.machine_ids.length,
      }, 200, env);
    }

    // 新しいマシンIDを追加
    license.machine_ids.push(machine_id);
  }

  // 初回アクティベーション
  if (!license.activated) {
    license.activated = true;
    license.activatedAt = new Date().toISOString();
  }

  // KV更新
  await env.LICENSES.put(`license:${key}`, JSON.stringify(license));

  return jsonResponse({
    valid: true,
    plan: license.plan,
    email: license.email,
    activated_devices: license.machine_ids.length,
  }, 200, env);
}

// ============================================================
// LemonSqueezy署名検証 (HMAC-SHA256)
// ============================================================
async function verifyLemonSqueezySignature(payload, signature, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (expectedSig.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    result |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================
// ライセンスキー生成: IPOAUTO-XXXX-XXXX-XXXX-XXXX
// ============================================================
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外 (I,O,0,1)
  const segments = 4;
  const segLen = 4;
  const parts = ['IPOAUTO'];

  for (let s = 0; s < segments; s++) {
    let segment = '';
    const randomValues = new Uint8Array(segLen);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < segLen; i++) {
      segment += chars[randomValues[i] % chars.length];
    }
    parts.push(segment);
  }

  return parts.join('-');
}

// ============================================================
// ライセンスメール送信
// ============================================================
async function sendLicenseEmail(email, licenseKey, plan, env) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
      to: [email],
      subject: '【ワンクリIPO】ライセンスキーのお届け',
      html: buildLicenseEmailHtml(licenseKey, env.DOWNLOAD_URL),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ============================================================
// ライセンスメール HTML
// ============================================================
function buildLicenseEmailHtml(licenseKey, downloadUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">ワンクリIPO</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:0 0 32px;">ご購入ありがとうございます！</p>

      <p style="color:#F9FAFB;font-size:14px;margin:0 0 12px;">あなたのライセンスキー</p>
      <div style="background:#0B0F1A;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:16px;margin-bottom:24px;">
        <code style="color:#A78BFA;font-size:18px;font-weight:700;letter-spacing:1px;">${licenseKey}</code>
      </div>

      <p style="color:#9CA3AF;font-size:13px;margin:0 0 12px;">このキーをワンクリIPOアプリに入力すると、全機能がご利用いただけます。</p>
      <p style="color:#F59E0B;font-size:13px;margin:0 0 24px;">※ Windows PC専用です。PCからダウンロードしてください。</p>

      <a href="${downloadUrl}"
         style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;">
        アプリをダウンロード
      </a>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">セットアップ手順</p>
        <ol style="color:#9CA3AF;font-size:13px;text-align:left;margin:0;padding-left:20px;line-height:2;">
          <li>上のボタンからアプリをダウンロード＆インストール</li>
          <li>アプリを起動し、上記のライセンスキーを入力</li>
          <li>Bitwarden・Telegramの初期設定（アプリ内ガイドあり）</li>
          <li>証券会社のログイン情報を登録して利用開始</li>
        </ol>
      </div>

      <div style="margin-top:24px;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:8px;">
        <p style="color:#F59E0B;font-size:12px;margin:0;">ライセンスキーは大切に保管してください。再発行はサポートまでお問い合わせください。</p>
      </div>
    </div>
    <p style="color:#4B5563;font-size:12px;text-align:center;margin-top:24px;">&copy; 2026 ワンクリIPO</p>
  </div>
</body>
</html>`;
}

// ============================================================
// トライアルメール HTML（既存）
// ============================================================
function buildTrialEmailHtml(downloadUrl, siteUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">ワンクリIPO</h1>
      <p style="color:#9CA3AF;font-size:14px;margin:0 0 32px;">無料トライアルをお申し込みいただきありがとうございます。</p>

      <p style="color:#F9FAFB;font-size:16px;margin:0 0 12px;">下のボタンからツールをダウンロードしてください。</p>
      <p style="color:#F59E0B;font-size:13px;margin:0 0 24px;">※ Windows PC専用です。PCからダウンロードしてください。</p>

      <a href="${downloadUrl}"
         style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;">
        ダウンロードする
      </a>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">セットアップ手順</p>
        <ol style="color:#9CA3AF;font-size:13px;text-align:left;margin:0;padding-left:20px;line-height:2;">
          <li>ダウンロードしたファイルを実行してインストール</li>
          <li>Bitwarden・Telegramの初期設定（アプリ内ガイドあり）</li>
          <li>証券会社のログイン情報を登録</li>
        </ol>
      </div>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:#F59E0B;font-size:14px;font-weight:700;margin:0 0 12px;">⚠ ダウンロード・起動時にWindowsの警告が表示されます</p>
        <p style="color:#9CA3AF;font-size:13px;line-height:1.8;margin:0 0 16px;">個人開発のソフトウェアのため、Windowsが警告を表示しますが、問題ありません。以下の手順で進めてください。</p>

        <p style="color:#D1D5DB;font-size:13px;font-weight:600;margin:0 0 8px;">① ダウンロード時：「保存」をクリック</p>
        <img src="${siteUrl}/images/download-step1.png" alt="ダウンロード警告1" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-bottom:16px;">

        <p style="color:#D1D5DB;font-size:13px;font-weight:600;margin:0 0 8px;">② 確認画面：「▼」→「保持する」をクリック</p>
        <img src="${siteUrl}/images/download-step2.png" alt="ダウンロード警告2" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-bottom:16px;">

        <p style="color:#D1D5DB;font-size:13px;font-weight:600;margin:0 0 8px;">③ 起動時：「詳細情報」→「実行」をクリック</p>
        <img src="${siteUrl}/images/download-step3.png" alt="SmartScreen警告" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-bottom:8px;">
      </div>

      <div style="margin-top:24px;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:8px;">
        <p style="color:#F59E0B;font-size:12px;margin:0;">無料トライアルですべての証券会社をご利用いただけます。トライアル期間は1ヶ月です。</p>
      </div>
    </div>
    <p style="color:#4B5563;font-size:12px;text-align:center;margin-top:24px;">&copy; 2026 ワンクリIPO</p>
  </div>
</body>
</html>`;
}

// ============================================================
// Utilities
// ============================================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}
