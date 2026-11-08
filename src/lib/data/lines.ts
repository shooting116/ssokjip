// 노선별 지역 분석: 도시철도 노선이 지나가는 시·구를 노선 순서대로 묶고, 지역끼리 시세·변동률을 비교한다.
// 역 자료 = data/poi/stations.json(국가철도공단 전국도시철도역사정보), 시세 = data/index(실거래 6개월 중앙값),
// 지수 = data/rone/weekly.json(한국부동산원 주간 아파트 매매가격지수). 해석·전망 없이 계산값만 낸다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSigungu, loadSummary, type Complex } from './index.ts';
import { roneSigungu, roneSeries } from './rone.ts';

export const MIN_COMPLEX = 3;            // 84㎡ 시세 중앙값을 내는 최소 단지 수
const CAPITAL = new Set(['서울', '경기', '인천']);

export const LINES: { slug: string; name: string; color: string; order: 'id' | 'geo' }[] = [
  { slug: '2', name: '2호선', color: '#00a84d', order: 'id' },
  { slug: '3', name: '3호선', color: '#ef7c1c', order: 'geo' },
  { slug: '4', name: '4호선', color: '#00a5de', order: 'geo' },
  { slug: '5', name: '5호선', color: '#996cac', order: 'geo' },
  { slug: '6', name: '6호선', color: '#cd7c2f', order: 'id' },
  { slug: '7', name: '7호선', color: '#747f00', order: 'geo' },
  { slug: '8', name: '8호선', color: '#e6186c', order: 'geo' },
  { slug: '9', name: '9호선', color: '#bdb092', order: 'id' },
  { slug: 'sinbundang', name: '신분당선', color: '#d4003b', order: 'id' },
  { slug: 'suin-bundang', name: '수인분당선', color: '#f5a200', order: 'geo' },
  { slug: 'incheon-1', name: '인천 1호선', color: '#7ca8d5', order: 'id' },
  { slug: 'incheon-2', name: '인천 2호선', color: '#ed8b00', order: 'id' },
];

interface Station { id: string; n: string; l: string; lat: number; lng: number }
export interface RegionRow {
  lawd: string; sido: string; sigungu: string; label: string;   // label: "안양 동안구"처럼 짧게
  stations: string[];                                            // 이 노선의 역(노선 순서)
  med: number | null; n84: number;                               // 지역 전체 84㎡ 시세 중앙값, 단지 수
  ratio: number | null;                                          // med ÷ 기준 지역 med (%)
  yoy: number | null;                                            // 실거래 1년 변동률(지역별 페이지와 같은 값)
  rone: number | null;                                           // 부동산원 지수 52주 변동률
  rel: number | null;                                            // 그래프 시작 주 대비 기준 지역보다 더 오른 폭(%p) = 상대지수 − 100
  series: (number | null)[] | null;                              // 기준 지역 대비 상대지수(시작 주 = 100)
  isRef: boolean;
}
export interface LineData {
  slug: string; name: string; color: string; asOf: string;
  regions: RegionRow[]; ref: RegionRow | null;
  chart: { periods: string[]; labels: Record<string, string>; keys: string[] } | null;   // keys = 그래프에 그릴 지역 lawd
}

const R = 6371000;
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** 지리 순서: 가장 먼 두 역 중 북쪽 끝에서 출발해 가장 가까운 역을 차례로 잇는다 */
function geoOrder(st: Station[]): Station[] {
  if (st.length < 3) return st;
  let a = st[0], best = -1;
  for (const p of st) for (const q of st) { const d = distM(p, q); if (d > best) { best = d; a = p.lat >= q.lat ? p : q; } }
  const out = [a]; const left = new Set(st.filter((s) => s !== a));
  while (left.size) { const cur = out[out.length - 1]; let nx: Station | null = null, nd = Infinity; for (const s of left) { const d = distM(cur, s); if (d < nd) { nd = d; nx = s; } } out.push(nx!); left.delete(nx!); }
  return out;
}

let cache: { all: Complex[]; asOf: string; stations: Station[]; med: Map<string, { med: number | null; n: number }> } | null = null;
function base() {
  if (cache) return cache;
  const all: Complex[] = []; let asOf = ''; const med = new Map<string, { med: number | null; n: number }>();
  for (const s of allSigungu()) {
    all.push(...s.complexes); asOf = s.asOf;
    const p = s.complexes.map((c) => c.types.find((t) => Math.abs(t.key - 84) <= 5 && t.basis === 'median6')?.price).filter((v): v is number => !!v);
    med.set(s.lawd, { med: p.length >= MIN_COMPLEX ? median(p) : null, n: p.length });   // 지역별 페이지의 "84㎡ 타입 시세 중앙값"과 같은 계산
  }
  const stations = JSON.parse(readFileSync(join(process.cwd(), 'data', 'poi', 'stations.json'), 'utf8')).stations as Station[];
  cache = { all, asOf, stations, med };
  return cache;
}

/** 역이 속한 시·구 = 2km 안 가장 가까운 단지의 시군구(수도권만) */
function regionOf(s: Station, all: Complex[]) {
  let best: Complex | null = null, bd = 2000;
  for (const c of all) {
    if (c.lat == null || c.lng == null || !CAPITAL.has(c.sido)) continue;
    if (Math.abs(c.lat - s.lat) > 0.02 || Math.abs(c.lng - s.lng) > 0.025) continue;
    const d = distM(s, { lat: c.lat, lng: c.lng }); if (d < bd) { bd = d; best = c; }
  }
  return best;
}
const shortName = (sido: string, sigungu: string) => {
  const p = sigungu.split(/\s+/);
  return p.length > 1 ? `${p[0].replace(/시$/, '')} ${p[1]}` : sido === '서울' || sido === '인천' ? sigungu : sigungu.replace(/시$|군$/, (m) => (m === '군' ? '군' : ''));
};

const lineCache = new Map<string, LineData>();
export function loadLine(slug: string): LineData | null {
  if (lineCache.has(slug)) return lineCache.get(slug)!;
  const def = LINES.find((l) => l.slug === slug); if (!def) return null;
  const { all, asOf, stations, med } = base();
  const sm = loadSummary();
  const mine = stations.filter((s) => s.l === def.name);
  const ordered = def.order === 'id' ? [...mine].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : geoOrder(mine);

  // 역 → 지역, 지역은 노선에서 처음 나오는 순서대로
  const byLawd = new Map<string, { lawd: string; sido: string; sigungu: string; stations: string[] }>();
  for (const s of ordered) {
    const c = regionOf(s, all); if (!c) continue;
    const r = byLawd.get(c.lawd) ?? { lawd: c.lawd, sido: c.sido, sigungu: c.sigungu, stations: [] };
    if (!r.stations.includes(s.n)) r.stations.push(s.n);
    byLawd.set(c.lawd, r);
  }
  const base0 = [...byLawd.values()].map((r) => ({ ...r, ...med.get(r.lawd)! }));

  // 기준 지역: 노선이 지나는 서울 구 중 84㎡ 시세가 가장 높은 곳(서울 구간이 없으면 노선 전체에서)
  const pool = base0.filter((r) => r.med != null && r.sido === '서울');
  const refRow = (pool.length ? pool : base0.filter((r) => r.med != null)).sort((a, b) => b.med! - a.med!)[0] ?? null;
  const refSeries = refRow ? roneSeries(refRow.sido, refRow.sigungu) : null;

  let periods: string[] = [], labels: Record<string, string> = {};
  const regions: RegionRow[] = base0.map((r) => {
    const meta = sm.sigungu.find((g) => g.lawd === r.lawd);
    const rs = roneSeries(r.sido, r.sigungu);
    let series: (number | null)[] | null = null, rel: number | null = null;
    if (rs && refSeries) {
      periods = rs.periods; labels = rs.labels;
      const i0 = rs.values.findIndex((v, i) => v != null && refSeries.values[i] != null);
      if (i0 >= 0) {
        const a0 = rs.values[i0]!, b0 = refSeries.values[i0]!;
        series = rs.values.map((v, i) => (v != null && refSeries.values[i] != null ? +((v / a0) / (refSeries.values[i]! / b0) * 100).toFixed(2) : null));
        const last = [...series].reverse().find((v) => v != null) ?? null;
        rel = last != null ? +(last - 100).toFixed(1) : null;
      }
    }
    return {
      lawd: r.lawd, sido: r.sido, sigungu: r.sigungu, label: shortName(r.sido, r.sigungu), stations: r.stations,
      med: r.med, n84: r.n, ratio: refRow?.med && r.med ? Math.round((r.med / refRow.med) * 100) : null,
      yoy: meta?.chg?.yoy ?? null, rone: roneSigungu(r.sido, r.sigungu)?.yoy ?? null,
      rel, series, isRef: r.lawd === refRow?.lawd,
    };
  });
  const ref = regions.find((r) => r.isRef) ?? null;
  // 그래프: 경기·인천 지역이 있으면 그 지역들, 없으면 서울 지역(기준 제외), 최대 8곳
  const outer = regions.filter((r) => !r.isRef && r.series && r.sido !== '서울');
  const keys = (outer.length ? outer : regions.filter((r) => !r.isRef && r.series)).slice(0, 8).map((r) => r.lawd);
  const out: LineData = { slug, name: def.name, color: def.color, asOf, regions, ref, chart: ref && keys.length ? { periods, labels, keys } : null };
  lineCache.set(slug, out);
  return out;
}
