# マシンID紐づけ仕様（ライセンスコピー防止）

## 背景
ライセンスキーをフォルダごとコピーすると別PCでも使えてしまう問題の対策。
初回アクティベーション時にマシンIDをWorkerに送信し、KVに紐づけて台数制限する。

## 制限
- 1ライセンスにつき **最大2台** まで（利用規約上は1台、内部的に2台許容）
- 3台目のアクティベーションは拒否
- PC買い替え時は管理者がKVの紐づけをリセット

## Worker変更箇所: `/verify` エンドポイント

### 現状
```
GET /verify?key=xxx
→ KVからライセンス情報取得 → activated=true にマーク → valid/plan/email返却
```

### 変更後
```
POST /verify
Body: { "key": "IPOAUTO-XXXX-...", "machine_id": "a1b2c3d4..." }
→ KVからライセンス情報取得
→ machine_ids配列を確認:
   - 既にこのmachine_idが登録済み → OK
   - machine_ids.length < 2 → 追加してOK
   - machine_ids.length >= 2 かつ未登録 → 拒否（上限到達）
→ KV更新 → レスポンス返却
```

### KVデータ構造の変更

**Before:**
```json
{
  "plan": "standard",
  "email": "user@example.com",
  "sessionId": "cs_xxx",
  "createdAt": "2026-03-01T...",
  "activated": false
}
```

**After:**
```json
{
  "plan": "standard",
  "email": "user@example.com",
  "sessionId": "cs_xxx",
  "createdAt": "2026-03-01T...",
  "activated": true,
  "activatedAt": "2026-03-01T...",
  "machine_ids": ["a1b2c3d4...", "e5f6g7h8..."]
}
```

### レスポンス

**成功時 (200):**
```json
{
  "valid": true,
  "plan": "standard",
  "email": "user@example.com",
  "activated_devices": 1
}
```

**上限到達時 (200):**
```json
{
  "valid": false,
  "error": "device_limit_reached",
  "message": "このライセンスキーは既に2台のPCで使用されています。別のPCで使用するにはサポートにご連絡ください。",
  "activated_devices": 2
}
```

**キー無効時 (200):**
```json
{
  "valid": false,
  "error": "invalid_key"
}
```

### 注意事項
- GETからPOSTに変更（machine_idをbodyで送るため）
- CORSヘッダーはPOSTを許可済み（既存設定で対応可能）
- 既存のGET /verifyも後方互換で残すかは任意（machine_id無しは拒否でOK）

## マシンIDの生成方法（アプリ側で実装済み）

アプリ側（Python）でWindowsのWMIからマザーボードシリアル + CPU IDを取得し、
SHA-256ハッシュの先頭16文字をマシンIDとして使用する。

```python
# backend/license.py に get_machine_id() を追加済み
# 例: "a1b2c3d4e5f6g7h8"
```

## Worker側のアクティベーションURL

アプリ側で呼び出すエンドポイント:
```
POST https://ipo-auto-trial.darkground96.workers.dev/verify
Content-Type: application/json
Body: {"key": "IPOAUTO-XXXX-...", "machine_id": "a1b2c3d4..."}
```

## 管理用: 紐づけリセット

PC買い替え等でリセットが必要な場合、KVのmachine_ids配列をクリアする。
管理用APIを追加するか、Cloudflareダッシュボードから直接KV編集。
