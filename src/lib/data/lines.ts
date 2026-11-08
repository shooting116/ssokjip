// 노선별 지역 분석: 도시철도 노선이 지나가는 시·구를 노선 순서대로 묶고, 지역끼리 시세·변동률을 비교한다.
// 역 자료 = data/poi/stations.json(국가철도공단 전국도시철도역사정보), 시세 = data/index(실거래 6개월 중앙값),
// 지수 = data/rone/weekly.json(한국부동산원 주간 아파트 매매가격지수). 해석·전망 없이 계산값만 낸다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSigungu, loadSummary, type Complex } from './index.ts';
import { roneSigungu, roneSeries } from './rone.ts';

export const MIN_COMPLEX = 3;            // 84㎡ 시세 중앙값을 내는 최소 단지 수
const CAPITAL = new Set(['서울', '경기', '인천']);
/** 모든 노선의 공통 기준 지역(2026-11-08 결정: 노선끼리 비교되도록 하나로 통일) */
export const REF = { lawd: '11650', sido: '서울', sigungu: '서초구', label: '서초구' };

export const LINES: { slug: string; name: string; color: string; order: 'id' | 'geo' | 'rule' | 'seg'; note?: string; segments?: { title: string; names: string[] }[] }[] = [
  {
    slug: '1', name: '1호선', color: '#0052a4', order: 'seg',
    note: '서울·경기·인천 구간만 담았습니다(천안·아산 방면 제외). 구로에서 인천행과 수원·평택행으로 갈라집니다.',
    segments: [
      { title: '연천 ~ 서울역 ~ 구로', names: ['연천','전곡','청산','소요산','동두천','보산','동두천중앙','지행','덕정','덕계','양주','녹양','가능','의정부','회룡','망월사','도봉산','도봉','방학','창동','녹천','월계','광운대','석계','신이문','외대앞','회기','청량리','제기동','신설동','동묘앞','동대문','종로5가','종로3가','종각','시청','서울','남영','용산','노량진','대방','신길','영등포','신도림','구로'] },
      { title: '경인선 · 구로 ~ 인천', names: ['구일','개봉','오류동','온수','역곡','소사','부천','중동','송내','부개','부평','백운','동암','간석','주안','도화','제물포','도원','동인천','인천'] },
      { title: '경부선 · 구로 ~ 평택', names: ['가산디지털단지','독산','금천구청','광명','석수','관악','안양','명학','금정','군포','당정','의왕','성균관대','화서','수원','세류','병점','서동탄','세마','오산대','오산','진위','송탄','서정리','평택지제','평택'] },
    ],
  },
  { slug: 'gtx-a', name: 'GTX-A', color: '#9a6292', order: 'rule', note: '운정중앙~서울역, 수서~동탄 운행 중. 삼성역은 공사 중이며 창릉역은 2030년 개통 예정입니다.' },
  { slug: 'gtx-b', name: 'GTX-B', color: '#0d4d9b', order: 'rule', note: '공사 중인 노선입니다. 역 주변 지역을 미리 비교하는 용도이며, 개통 시기는 GTX 일정 가이드를 확인하세요.' },
  { slug: 'gtx-c', name: 'GTX-C', color: '#2e7d5b', order: 'rule', note: '2026년 9월 본공사를 시작한 노선입니다. 역 구성은 2022년 발표 기준이며 바뀔 수 있습니다.' },
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

interface Station { id: string; n: string; l: string; lat: number; lng: number; st?: string; addr?: string }
export interface RegionRow {
  lawd: string; sido: string; sigungu: string; label: string;   // label: "안양 동안구"처럼 짧게
  stations: string[];                                            // 이 노선의 역(노선 순서). 운행 전 역은 '(공사중)' 등이 붙는다
  med: number | null; n84: number;                               // 지역 전체 84㎡ 시세 중앙값, 단지 수
  ratio: number | null;                                          // med ÷ 기준 지역 med (%)
  yoy: number | null;                                            // 실거래 1년 변동률(지역별 페이지와 같은 값)
  rone: number | null;                                           // 부동산원 지수 52주 변동률
  rel: number | null;                                            // 그래프 시작 주 대비 기준 지역보다 더 오른 폭(%p) = 상대지수 − 100
  series: (number | null)[] | null;                              // 기준 지역 대비 상대지수(시작 주 = 100)
  isRef: boolean;
  seg: string | null;                                            // 이 지역부터 시작하는 구간 제목(1호선처럼 갈라지는 노선)
}
export interface LineData {
  slug: string; name: string; color: string; asOf: string; lineNote: string | null;
  regions: RegionRow[]; ref: { label: string; med: number | null; n: number; onLine: boolean };
  note: { label: string; med: number; n: number } | null;   // 참고 시세(인천 노선 = 송도동)
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

/** 역이 속한 시·구: 주소가 있으면 주소로, 없으면 반경 800m 안 단지가 가장 많은 시군구(가까울수록 가중), 그것도 없으면 2km 안 가장 가까운 단지 */
function regionOf(s: Station, all: Complex[], byName: Map<string, Complex>) {
  if (s.addr) {
    const t = s.addr.split(/\s+/);
    for (const k of [`${t[0]} ${t[1]} ${t[2]}`, `${t[0]} ${t[1]}`]) { const c = byName.get(k); if (c) return c; }
  }
  const votes = new Map<string, { w: number; c: Complex }>(); let best: Complex | null = null, bd = 2000;
  for (const c of all) {
    if (c.lat == null || c.lng == null || !CAPITAL.has(c.sido)) continue;
    if (Math.abs(c.lat - s.lat) > 0.02 || Math.abs(c.lng - s.lng) > 0.025) continue;
    const d = distM(s, { lat: c.lat, lng: c.lng });
    if (d < bd) { bd = d; best = c; }
    if (d <= 800) { const v = votes.get(c.lawd) ?? { w: 0, c }; v.w += 1 / Math.max(150, d); votes.set(c.lawd, v); }
  }
  const top = [...votes.values()].sort((a, b) => b.w - a.w)[0];
  return top?.c ?? best;
}
const shortName = (sido: string, sigungu: string) => {
  const p = sigungu.split(/\s+/);
  return p.length > 1 ? `${p[0].replace(/시$/, '')} ${p[1]}` : sido === '서울' || sido === '인천' ? sigungu : sigungu.replace(/시$|군$/, (m) => (m === '군' ? '군' : ''));
};

/** GTX처럼 도시철도 역사정보에 없는 노선: 쏙집 철도 규칙표(data/transit)의 역 순서·좌표를 쓴다 */
function ruleStations(line: string): Station[] {
  const st = JSON.parse(readFileSync(join(process.cwd(), 'data', 'transit', 'stations.json'), 'utf8')).stations as { line: string; name: string; status: string; lat?: number; lng?: number; addr?: string }[];
  return st.filter((x) => x.line === line && x.lat != null && x.lng != null).map((x, i) => ({ id: String(i), n: x.name.replace(/\(가칭\)/, ''), l: line, lat: x.lat!, lng: x.lng!, st: x.status, addr: x.addr }));
}

const lineCache = new Map<string, LineData>();
export function loadLine(slug: string): LineData | null {
  if (lineCache.has(slug)) return lineCache.get(slug)!;
  const def = LINES.find((l) => l.slug === slug); if (!def) return null;
  const { all, asOf, stations, med } = base();
  const sm = loadSummary();
  const mine = def.order === 'rule' ? ruleStations(def.name) : stations.filter((s) => s.l === def.name);
  // 구간이 정해진 노선(1호선)은 구간 순서대로, 각 역에 구간 제목을 단다
  const segOf = new Map<Station, string>();
  const ordered = def.order === 'seg'
    ? def.segments!.flatMap((g) => g.names.map((n) => mine.find((s) => s.n === n)).filter((s): s is Station => !!s).map((s) => (segOf.set(s, g.title), s)))
    : def.order === 'id' ? [...mine].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : def.order === 'rule' ? mine : geoOrder(mine);

  // 역 → 지역, 지역은 노선에서 처음 나오는 순서대로
  const byName = new Map<string, Complex>();
  for (const c of all) { const k = `${c.sido} ${c.sigungu}`; if (!byName.has(k)) byName.set(k, c); }
  const byLawd = new Map<string, { lawd: string; sido: string; sigungu: string; stations: string[]; seg: string | null }>();
  let curSeg: string | null = null, segShown = new Set<string>();
  for (const s of ordered) {
    const c = regionOf(s, all, byName); if (!c) continue;
    curSeg = segOf.get(s) ?? null;
    const key = curSeg ? `${curSeg}|${c.lawd}` : c.lawd;   // 구간이 다르면 같은 구도 따로 놓는다
    const first = curSeg && !segShown.has(curSeg) ? (segShown.add(curSeg), curSeg) : null;
    const r = byLawd.get(key) ?? { lawd: c.lawd, sido: c.sido, sigungu: c.sigungu, stations: [], seg: first };
    const nm = s.st && s.st !== '운행중' ? `${s.n}(${s.st})` : s.n;
    if (!r.stations.includes(nm)) r.stations.push(nm);
    byLawd.set(key, r);
  }
  const base0 = [...byLawd.values()].map((r) => ({ ...r, ...med.get(r.lawd)! }));

  // 기준: 모든 노선 공통 서초구
  const refRow = { lawd: REF.lawd, ...med.get(REF.lawd)! };
  const refSeries = roneSeries(REF.sido, REF.sigungu);

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
      rel, series, isRef: r.lawd === refRow?.lawd, seg: r.seg,
    };
  });
  const ref = { label: REF.label, med: refRow.med, n: refRow.n, onLine: regions.some((r) => r.isRef) };
  // 인천 노선: 송도동 시세를 참고로 함께 보여준다
  let note: LineData['note'] = null;
  if (regions.length && regions.every((r) => r.sido === '인천')) {
    const p = all.filter((c) => c.lawd === '28185' && /송도/.test(c.umd)).map((c) => c.types.find((t) => Math.abs(t.key - 84) <= 5 && t.basis === 'median6')?.price).filter((v): v is number => !!v);
    if (p.length >= MIN_COMPLEX) note = { label: '송도동', med: median(p)!, n: p.length };
  }
  // 그래프: 경기·인천 지역이 있으면 그 지역들, 없으면 서울 지역(기준 제외), 최대 8곳
  const outer = regions.filter((r) => !r.isRef && r.series && r.sido !== '서울');
  const cand = [...new Map((outer.length ? outer : regions.filter((r) => !r.isRef && r.series)).map((r) => [r.lawd, r])).values()];
  const pick = cand.length <= 8 ? cand : Array.from({ length: 8 }, (_, i) => cand[Math.round((i * (cand.length - 1)) / 7)]);   // 많으면 노선 위에서 고르게 8곳
  const keys = pick.map((r) => r.lawd);
  const out: LineData = { slug, name: def.name, color: def.color, asOf, lineNote: def.note ?? null, regions, ref, note, chart: keys.length ? { periods, labels, keys } : null };
  lineCache.set(slug, out);
  return out;
}
