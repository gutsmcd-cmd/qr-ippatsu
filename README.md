# QR一発（QR Ippatsu）

QRコードを作る・読み取るだけのシンプルな PWA。**無料・広告なし・ログイン不要・通信なし・オフライン対応。**

## できること

- **作る**：テキスト／URL／Wi-Fi（SSID・パスワード・暗号化方式・ステルス）から QR コードを作成。誤り訂正レベル L/M/Q/H
- **保存・共有**：PNG で保存、または画像として共有（Web Share 対応ブラウザ）
- **読み取る**：カメラで読み取り。対応ブラウザでは端末内蔵の BarcodeDetector、非対応なら同梱の jsQR デコーダーを使用（CDN は使いません）。写真・スクリーンショットからの読み取りも可
- Wi-Fi の QR を読むと SSID とパスワードを表示してコピーできます
- **履歴**：作成・読み取りの履歴を端末内に保存（削除は元に戻せます）
- 表示言語：日本語 / English

履歴はこの端末の localStorage にだけ保存されます。読み取った URL は「開く」を押したときだけ開きます。

## English

**QR Ippatsu** makes and scans QR codes, entirely offline. Create codes from text, a URL, or Wi-Fi details (SSID / password / security / hidden), save as PNG or share the image. Scan with the camera using the native BarcodeDetector API where available, falling back to the bundled jsQR decoder (bundled locally, no CDN); you can also decode a photo or screenshot. A local history keeps what you made and scanned. Japanese UI by default with an English toggle. Free, no ads, no login, no analytics.

Libraries: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0), both bundled into the build.

## 開発 / Development

```bash
npm install
npm run dev      # 開発サーバー / dev server
npm run build    # 型チェック + ビルド → dist/ / type-check + build
npm run preview  # ビルドの確認 / preview the build
```

Vite + vanilla TypeScript + vite-plugin-pwa（`registerType: 'autoUpdate'`, `base: './'`）。`main` ブランチに push すると `.github/workflows/pages.yml` で GitHub Pages に公開されます。 / Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.
