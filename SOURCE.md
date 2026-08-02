# Source and transformation

## Official sources

- Provider: 厚生労働省
- Statistics page: <https://www.mhlw.go.jp/toukei/list/114-1d.html>
- Item 1, general including part-time: <https://www.mhlw.go.jp/toukei/list/xls/114-1d-01.xlsx>
- Item 2, regular employees: <https://www.mhlw.go.jp/toukei/list/xls/114-1d-02.xlsx>
- Definitions: <https://www.mhlw.go.jp/toukei/itiran/roudou/koyou/ippan/detail/01.html>
- Edition: 2011〜2025年度（平成23年度〜令和7年度）
- Source verification: 2026-08-02
- General workbook: 41,740 bytes; SHA-256 `275f4b75a347f28f4cfc6133d038390ecaa2aa43728af89b4006eaff8f6e4018`
- Regular workbook: 40,932 bytes; SHA-256 `81150ef91c39330f7743d591598c6340f2fd1659bd4fe5e6708f778d27c53256`
- Terms: 公共データ利用規約（第1.0版）
- Terms page: <https://www.mhlw.go.jp/chosakuken/index.html>

出典：厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第1表・第2表を加工して作成。

## Verified dimensions

- 全国と47労働局、48地域
- 2011〜2025年度、15年度
- 有効求人数、新規求人数、就職件数、3指標
- 一般求人と正社員求人を対応づけた2,160組
- 地域名・年度・指標の不一致0
- 正社員件数が一般件数を超える組合せ0
- 一般・正社員とも、全国計と47労働局の合計の不一致0
- 2025年度全国の正社員割合は、有効求人49.52%、新規求人48.54%、就職37.74%

## Transformation / 加工

1. 2つのExcelの各3シートから2011〜2025年度を読み取る。
2. シート位置、年度見出し、全国・47労働局の行見出しを対応づける。
3. 全組合せで正の整数、`正社員 <= 一般`、全国計と労働局合計を検算する。
4. 労働局名を都道府県名へ短縮し、9地域と全国に分類する。
5. 加工前の整数値を静的JSONへ保存し、正社員割合は画面表示時に算出する。
6. 表示は小数第1位、コピー結果は小数第1位とし、元件数を常に併記する。

公式Excelのハッシュが変わった場合は、更新内容を人が確認してから再生成します。

## Interpretation boundary

正社員は「パートタイムを除く常用」のうち、勤め先で正社員・正職員などと呼ばれる正規労働者です。新規求人数は期間中に新たに受け付けた採用予定人員、月間有効求人数は前月から繰り越した未充足の求人数と当月の新規求人数の合計、就職件数は安定所の紹介による就職を確認した件数です。有効求人の年度値は月間値の合計なので、固有の求人票数ではありません。求人の質、求人倍率、賃金、応募、定着、民間求人を含む労働市場全体を示しません。
