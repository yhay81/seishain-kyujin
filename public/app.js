const MAX_COMPARE = 4;
const STORAGE_KEY = "seishain-kyujin:compare:v1";
const DEFAULT_SELECTED = ["00", "13", "27"];

const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const metric = document.querySelector("#metric");
const year = document.querySelector("#year");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const metricNote = document.querySelector("#metric-note");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let index = null;
let records = [];
let recordMap = new Map();
let selected = loadSelected();
let searchTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "seishain-kyujin:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-seishain-kyujin-session": getSession(),
      "x-seishain-kyujin-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [...DEFAULT_SELECTED];
    const value = JSON.parse(stored);
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [...DEFAULT_SELECTED];
  } catch {
    return [...DEFAULT_SELECTED];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Comparison remains available for the current page view.
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const currentMetric = () => index.metrics.find((item) => item.id === metric.value);
const currentYear = () => Number(year.value);
const currentYearIndex = () => index.years.indexOf(currentYear());
const selectedRecord = (placeId) => recordMap.get(`${placeId}|${metric.value}`);
const valuesFor = (placeId, yearIndex = currentYearIndex()) => {
  const record = selectedRecord(placeId);
  if (!record || yearIndex < 0) return { general: null, regular: null, share: null };
  const general = record.g[yearIndex];
  const regular = record.r[yearIndex];
  return {
    general,
    regular,
    share: general > 0 ? (regular / general) * 100 : null,
  };
};
const previousShareFor = (placeId) => {
  const previousIndex = currentYearIndex() - 1;
  return previousIndex < 0 ? null : valuesFor(placeId, previousIndex).share;
};
const shareChange = (placeId) => {
  const current = valuesFor(placeId).share;
  const previous = previousShareFor(placeId);
  return current === null || previous === null ? null : current - previous;
};
const formatShare = (value) => (value === null ? "—" : `${value.toFixed(1)}%`);
const formatCount = (value) => (value === null ? "—" : number.format(value));
const formatPoint = (value) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;

const notes = {
  active: "有効求人は月間有効求人数の年度計です。同じ求人が複数月に含まれることがあります。",
  new: "新規求人は年度中に新たに受け付けた採用予定人員の合計です。求人票の枚数ではありません。",
  placed: "就職は公共職業安定所の紹介で就職したことを確認した件数です。採用全体ではありません。",
};

function shareRange() {
  const values = records
    .filter((record) => record.m === metric.value)
    .flatMap((record) =>
      record.g.map((general, i) => (general > 0 ? (record.r[i] / general) * 100 : null)),
    )
    .filter((value) => typeof value === "number");
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  return { min, max: Math.max(min + 1, max) };
}

function ratioBar(share, label) {
  const width = share === null ? 0 : Math.max(0, Math.min(100, share));
  return `<svg aria-label="${escapeHtml(label)}" class="ratio-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 12">
    <rect class="ratio-track" height="10" rx="5" width="100" x="0" y="1"></rect>
    <rect class="ratio-value" height="10" rx="5" width="${width.toFixed(2)}" x="0" y="1"></rect>
  </svg>`;
}

function ratioRing(share, label) {
  const value = share === null ? 0 : Math.max(0, Math.min(100, share));
  return `<svg aria-label="${escapeHtml(label)}" class="ratio-ring" role="img" viewBox="0 0 100 100">
    <circle class="ring-track" cx="50" cy="50" r="40" pathLength="100"></circle>
    <circle class="ring-value" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="${value.toFixed(2)} 100"></circle>
    <text class="card-ring-value" x="50" y="54">${formatShare(share)}</text>
  </svg>`;
}

function sparkline(placeId) {
  const record = selectedRecord(placeId);
  const range = shareRange();
  const shares = record.g.map((general, i) => (general > 0 ? (record.r[i] / general) * 100 : null));
  const points = shares
    .map((value, i) => {
      const x = shares.length === 1 ? 50 : (i / (shares.length - 1)) * 100;
      const y = value === null ? 50 : 55 - ((value - range.min) / (range.max - range.min)) * 50;
      return `${x.toFixed(2)},${Math.max(5, Math.min(55, y)).toFixed(2)}`;
    })
    .join(" ");
  const selectedIndex = currentYearIndex();
  const selectedValue = shares[selectedIndex];
  const markerX = (selectedIndex / (shares.length - 1)) * 100;
  const markerY = 55 - ((selectedValue - range.min) / (range.max - range.min)) * 50;
  return `<svg aria-label="2011年度から2025年度の正社員割合推移" class="sparkline" role="img" viewBox="0 0 100 62">
    <line class="spark-grid" x1="0" x2="100" y1="55" y2="55"></line>
    <polyline class="spark-path" points="${points}"></polyline>
    <circle class="spark-marker" cx="${markerX.toFixed(2)}" cy="${Math.max(5, Math.min(55, markerY)).toFixed(2)}" r="2.8"></circle>
  </svg>`;
}

function renderCompare() {
  const places = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean);
  compareCount.textContent = `${places.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = places.length === 0;
  if (places.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4地域を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = places
    .map((place) => {
      const values = valuesFor(place.id);
      const change = shareChange(place.id);
      return `<article class="compare-card">
        <div class="compare-title"><div><span>${escapeHtml(place.region)}</span><strong>${escapeHtml(place.name)}</strong></div><button aria-label="${escapeHtml(place.name)}を比較から外す" data-remove="${place.id}" type="button">×</button></div>
        <div class="compare-chart">${ratioRing(values.share, `${place.name}の正社員割合 ${formatShare(values.share)}`)}${sparkline(place.id)}</div>
        <div class="year-scale"><span>2011</span><span>${currentYear()}</span><span>2025</span></div>
        <dl class="count-pair">
          <div><dt>正社員</dt><dd>${formatCount(values.regular)}</dd></div>
          <div><dt>一般・パート含む</dt><dd>${formatCount(values.general)}</dd></div>
          <div><dt>前年差</dt><dd>${formatPoint(change)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function visiblePlaces() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = index.places.filter((place) => {
    const haystack = normalize(`${place.name}${place.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || place.region === selectedRegion)
    );
  });
  const sorted = [...filtered];
  const numericSort = (getter) => (a, b) => getter(b.id) - getter(a.id) || a.id.localeCompare(b.id);
  if (sort.value === "share-desc") sorted.sort(numericSort((id) => valuesFor(id).share ?? -1));
  if (sort.value === "regular-desc") sorted.sort(numericSort((id) => valuesFor(id).regular ?? -1));
  if (sort.value === "change-desc") sorted.sort(numericSort((id) => shareChange(id) ?? -Infinity));
  if (sort.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return sorted;
}

function renderResults() {
  const visible = visiblePlaces();
  resultCount.textContent = number.format(visible.length);
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する地域がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((place) => {
      const values = valuesFor(place.id);
      const change = shareChange(place.id);
      const active = selected.includes(place.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="place-card">
        <div class="place-heading"><div><p>${escapeHtml(place.region)} · ${escapeHtml(place.id)}</p><h3>${escapeHtml(place.name)}</h3></div><strong>${formatShare(values.share)}</strong></div>
        ${ratioBar(values.share, `${place.name} ${currentYear()}年度の正社員割合 ${formatShare(values.share)}`)}
        <dl class="place-counts">
          <div><dt>正社員</dt><dd>${formatCount(values.regular)}</dd></div>
          <div><dt>一般・パート含む</dt><dd>${formatCount(values.general)}</dd></div>
          <div><dt>前年差</dt><dd>${formatPoint(change)}</dd></div>
        </dl>
        <button class="compare-button${active ? " is-selected" : ""}" data-select="${place.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button>
      </article>`;
    })
    .join("");
}

function renderAll() {
  metricNote.textContent = notes[metric.value];
  renderCompare();
  renderResults();
}
function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderAll();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
metric.addEventListener("change", () => {
  renderAll();
  track("metric_changed");
});
year.addEventListener("change", () => {
  renderAll();
  track("year_changed");
});
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean)
    .map((place) => {
      const values = valuesFor(place.id);
      return `${place.name}｜正社員 ${formatCount(values.regular)}｜一般（パート含む） ${formatCount(values.general)}｜${formatShare(values.share)}｜前年差 ${formatPoint(shareChange(place.id))}`;
    });
  await navigator.clipboard.writeText(
    [
      `正社員求人の割合（${currentYear()}年度・${currentMetric().name}）`,
      ...lines,
      "正社員件数÷一般求人件数。求人の質・求人倍率・雇用環境の順位ではありません。",
      "出典：厚生労働省「職業安定業務統計 雇用関係指標 第1表・第2表」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

Promise.all([
  fetch("/data/index.json").then((response) => {
    if (!response.ok) throw new Error("index_unavailable");
    return response.json();
  }),
  fetch("/data/jobs.json").then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  }),
])
  .then(([indexData, jobData]) => {
    index = indexData;
    records = jobData;
    recordMap = new Map(records.map((record) => [`${record.p}|${record.m}`, record]));
    const validIds = new Set(index.places.map((place) => place.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    year.innerHTML = [...index.years]
      .reverse()
      .map((value) => `<option value="${value}">${value}年度</option>`)
      .join("");
    const regions = [...new Set(index.places.map((place) => place.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "全国・47労働局 · 2011—2025年度";
    renderAll();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
