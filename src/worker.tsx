import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://seishain-kyujin.yhay81.com";
const dataPage = "https://www.mhlw.go.jp/toukei/list/114-1d.html";
const generalWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-01.xlsx";
const regularWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-02.xlsx";
const termsPage = "https://www.mhlw.go.jp/toukei/itiran/roudou/koyou/ippan/detail/01.html";
const useTerms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "sort_changed",
  "metric_changed",
  "year_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-seishain-kyujin-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-seishain-kyujin-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "都道府県比較" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#20364a" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="正社員求人くらべ ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
          </span>
          <span>正社員求人くらべ</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>正社員求人くらべ</strong>
          <p>厚生労働省「職業安定業務統計 雇用関係指標」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/seishain-kyujin">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const RatioFigure = () => (
  <div
    aria-label="一般求人の内側に正社員求人が含まれ、全国では49.5パーセントを示す図"
    class="ratio-figure"
    role="img"
  >
    <div class="file-tabs" aria-hidden="true">
      <span>全国</span>
      <span>47都道府県</span>
      <span>15年度</span>
    </div>
    <article class="job-file general-file">
      <div class="file-head">
        <span>一般求人・パート含む</span>
        <b>27,576,204</b>
      </div>
      <div class="file-rules">
        <i />
        <i />
        <i />
      </div>
      <article class="job-file regular-file">
        <div class="file-head">
          <span>うち正社員</span>
          <b>13,657,110</b>
        </div>
        <div class="file-rules">
          <i />
          <i />
        </div>
      </article>
    </article>
    <svg class="hero-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-track" cx="60" cy="60" r="47" pathLength="100" />
      <circle
        class="ring-value"
        cx="60"
        cy="60"
        r="47"
        pathLength="100"
        stroke-dasharray="49.52 100"
      />
      <text class="ring-number" x="60" y="57">
        49.5%
      </text>
      <text class="ring-caption" x="60" y="77">
        2025 有効求人
      </text>
    </svg>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="正社員求人が一般求人に占める割合と元件数を、全国・47都道府県、2011〜2025年度、有効求人・新規求人・就職で比較できます。"
    title="都道府県別の正社員求人割合を比較 | 正社員求人くらべ"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="period-label">2011—2025年度 · ハローワーク</p>
          <h1>一般求人のうち、正社員はどのくらい？</h1>
          <p class="lead">同じ地域・年度・指標の元件数をそろえ、割合と15年の変化を並べます。</p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>48</b> 全国・労働局
            </span>
            <span>
              <b>3</b> 求人・就職指標
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <RatioFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="section-kicker">選択した地域</p>
            <h2 id="compare-title">割合と15年推移</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="metric-controls">
          <label>
            <span>指標</span>
            <select id="metric">
              <option value="active">有効求人数</option>
              <option value="new">新規求人数</option>
              <option value="placed">就職件数</option>
            </select>
          </label>
          <label>
            <span>年度</span>
            <select id="year" />
          </label>
          <div class="ratio-legend" aria-label="割合の凡例">
            <span>
              <i class="legend-regular" />
              正社員
            </span>
            <span>
              <i class="legend-other" />
              それ以外
            </span>
          </div>
        </div>
        <p class="metric-note" id="metric-note">
          有効求人は月間有効求人数の年度計です。同じ求人が複数月に含まれることがあります。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4地域を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="section-kicker">地域一覧</p>
            <h2 id="finder-title">都道府県を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県・全国</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、全国"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="share-desc">正社員割合が高い順</option>
              <option value="regular-desc">正社員件数が多い順</option>
              <option value="change-desc">前年差が大きい順</option>
              <option value="name">名前順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">正社員求人の割合</h2>
          <p>
            <b id="result-count">—</b> 地域
          </p>
        </div>
        <div class="place-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">内</span>
        <div>
          <strong>割合は「正社員件数 ÷ 一般件数」</strong>
          <p>
            正社員は「パートタイムを除く常用」のうち、勤め先で正社員・正職員などと呼ばれる求人です。求人の質、賃金、採用しやすさ、地域の働きやすさを表す順位ではありません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="正社員、一般求人、有効求人数、新規求人数、就職件数、年度計と正社員割合の読み方を説明します。"
    title="数字の見方 | 正社員求人くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">数字の見方</p>
        <h1>分子と分母を、同じ条件に。</h1>
        <p>正社員件数と、パートタイムを含む一般件数を、同じ労働局・年度・指標で割ります。</p>
      </div>
      <section class="definition-board">
        <article class="definition-general">
          <span>分母</span>
          <h2>一般求人</h2>
          <p>公共職業安定所が扱う一般求人で、パートタイムを含みます。</p>
          <article class="definition-regular">
            <span>分子</span>
            <h3>正社員求人</h3>
            <p>パートタイムを除く常用のうち、勤め先で正社員・正職員などと呼ばれる求人です。</p>
          </article>
        </article>
        <div class="formula-card">
          <span>正社員割合</span>
          <strong>正社員件数 ÷ 一般件数 × 100</strong>
          <p>求人全体に占める構成比であり、正社員求人倍率ではありません。</p>
        </div>
      </section>
      <section class="guide-grid">
        <article>
          <span>年度計・延べ</span>
          <h2>有効求人数</h2>
          <p>
            前月から繰り越した未充足の求人数と、その月の新規求人数の合計。年度値は月ごとの合計なので、同じ求人が複数月に含まれます。
          </p>
        </article>
        <article>
          <span>年度計</span>
          <h2>新規求人数</h2>
          <p>年度中に新たに受け付けた採用予定人員の合計です。求人票の枚数ではありません。</p>
        </article>
        <article>
          <span>年度計</span>
          <h2>就職件数</h2>
          <p>有効求職者が公共職業安定所の紹介により就職したことを確認した件数です。</p>
        </article>
      </section>
      <section class="note-panel">
        <h2>読み取れないこと</h2>
        <p>
          民間求人媒体だけの求人、求人票数、応募者数、賃金、離職、定着、就職後の雇用継続は分かりません。割合だけで地域や雇用環境を評価しないでください。
        </p>
        <a href={termsPage}>厚生労働省 用語の解説</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="正社員求人くらべが利用する厚生労働省の2つの公式Excel、加工内容、確認日、利用条件を示します。"
    title="出典とデータ | 正社員求人くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">出典</p>
        <h1>2つの公式表を、同じセル位置で照合。</h1>
        <p>一般求人と正社員求人を、全国・47労働局、15年度、3指標で対応づけています。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={dataPage}>雇用関係指標（年度）</a>
        </div>
        <div>
          <span>一般求人</span>
          <strong>第1表 · パート含む</strong>
          <a href={generalWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>正社員</span>
          <strong>第2表 · 正社員</strong>
          <a href={regularWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>収録範囲</span>
          <strong>48地域 × 15年度 × 3指標</strong>
          <a href={termsPage}>用語の解説</a>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={useTerms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>第1表と第2表の各3シートから、2011〜2025年度の公表値を抽出しました。</li>
          <li>48地域・15年度・3指標の全2,160組で、地域名と年度が一致することを確認しました。</li>
          <li>
            全国計が47労働局の合計と一致し、正社員件数が一般件数以下であることを全組合せで検算しました。
          </li>
          <li>
            正社員件数を一般件数で割り、小数第1位まで表示します。元件数は加工前の整数を併記します。
          </li>
          <li>労働局名を都道府県名へ短縮し、9地域と全国に分類しました。</li>
          <li>
            出典：厚生労働省「職業安定業務統計 雇用関係指標（年度）第1表・第2表」を加工して作成。
          </li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>ファイル確認</h2>
        <p>2026年8月2日取得。第1表 SHA-256: 275f4b75…e4018、第2表 SHA-256: 81150ef9…53256。</p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="正社員求人くらべの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 正社員求人くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">保存</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、地域名、選択年度、指標をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>比較に選んだ公開地域IDを最大4件だけブラウザへ保存します。アカウントは不要です。</p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>
            訪問、検索、0件、地域・並び順・指標・年度の変更、比較追加、コピーの操作名だけを計測します。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    asOf: "2026-08-02",
    ok: row?.ok === 1,
    records: 2160,
    service: "seishain-kyujin",
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 正社員求人くらべ"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="section-kicker">404</p>
          <h1>この求人表は見つかりません。</h1>
          <p>
            <a href="/">都道府県の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
