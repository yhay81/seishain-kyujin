# 正社員求人くらべ

正社員求人が一般求人（パートタイムを含む）に占める割合と元件数を、全国・47労働局、2011〜2025年度、有効求人・新規求人・就職から選び、最大4地域で比較する日本語Webサービスです。

- Production: <https://seishain-kyujin.yhay81.com>
- Source: 厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第1表・第2表
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

割合は同じ労働局・年度・指標の「正社員件数 ÷ 一般件数」です。有効求人の年度値は月間有効求人数の合計で、同じ求人が複数月に含まれます。求人の質、賃金、求人倍率、採用しやすさ、地域の雇用環境を評価する指標ではありません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
