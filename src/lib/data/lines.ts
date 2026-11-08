// 노선별 보기: 도시철도 노선의 역을 순서대로 늘어놓고, 역마다 반경 안 단지의 84㎡ 시세를 집계한다.
// 역 자료 = data/poi/stations.json(국가철도공단 전국도시철도역사정보), 단지 = data/index(실거래 6개월 중앙값).
// 해석·전망 없이 계산값만 낸다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSigungu, type Complex } from './index.ts';

export const RADIUS_M = 1000;          // 역 반경(직선거리)
export const MIN_COMPLEX = 3;          // 시세 중앙값을 내는 최소 단지 수
export const REF = { sido: '서울', sigungu: '강남구', label: '강남구' };   // 가격 비율의 기준(강남구 84㎡ 시세 중앙값)

/** 노선: slug(주소), 이름(stations.json의 l 값), 순서 방식 */
export const LINES: { slug: string; name: string; color: string; order: 'id' | 'geo'; branches?: Record<string, string> }[] = [
  { slug: '2', name: '2호선', color: '#00a84d', order: 'id', branches: { 용답: '성수지선', 도림천: '신정지선' } },
  { slug: '3', name: '3호선', color: '#ef7c1c', order: 'geo' },
  { slug: '4', name: '4호선', color: '#00a5de', order: 'geo' },
  { slug: '5', name: '5호선', color: '#996cac', order: 'geo', branches: { 둔촌동: '마천 방면' } },
  { slug: '6', name: '6호선', color: '#cd7c2f', order: 'id' },
  { slug: '7', name: '7호선', color: '#747f00', order: 'geo' },
  { slug: '8', name: '8호선', color: '#e6186c', order: 'geo' },
  { slug: '9', name: '9호선', color: '#bdb092', order: 'id' },
  { slug: 'sinbundang', name: '신분당선', color: '#d4003b', order: 'id' },
  { slug: 'suin-bundang', name: '수인분당선', color: '#f5a200', order: 'geo' },
  { slug: 'incheon-1', name: '인천 1호선', color: '#7ca8d5', order: 'id' },
  { slug: 'incheon-2', name: '인천 2호선', color: '#ed8b00', order: 'id' },
];

interface Station { id: string; n: string; l: string; x: boolean; lat: number; lng: number }
export interface StationRow {
  name: string; transfer: string[];        // 같은 이름 역의 다른 노선(환승)
  complexes: number;                        // 반경 안 84㎡ 6개월 시세가 있는 단지 수
  med: number | null;                       // 그 단지들 84㎡ 시세의 중앙값(만 원)
  yoy: number | null;                       // 1년 변동률 중앙값(%) — 두 기간 3건 이상인 단지만
  yoyN: number;
  n6: number;                               // 반경 안 단지 6개월 거래 건수 합(전 평형)
  ratio: number | null;                     // 이 역 시세 ÷ 기준 시세(%)
  gapKm: number;                            // 앞 역과의 직선거리(km)
  branch: string | null;                    // 이 역부터 지선(이름)
  top: { id: string; name: string; price: number; static: boolean }[];   // 반경 안 84㎡ 시세 상위 단지(최대 5)
}
export interface LineData { slug: string; name: string; color: string; stations: StationRow[]; asOf: string; ref: { name: string; med: number | null; n: number } }

const R = 6371000;
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** 지리 순서: 가장 먼 두 역 중 한쪽 끝에서 출발해 가장 가까운 역을 차례로 잇는다(지선은 끝에 붙는다). */
function geoOrder(st: Station[]): Station[] {
  if (st.length < 3) return st;
  let a = st[0], best = -1;
  for (const p of st) for (const q of st) { const d = distM(p, q); if (d > best) { best = d; a = p.lat >= q.lat ? p : q; } }   // 북쪽 끝에서 시작
  const out = [a]; const left = new Set(st.filter((s) => s !== a));
  while (left.size) { const cur = out[out.length - 1]; let nx: Station | null = null, nd = Infinity; for (const s of left) { const d = distM(cur, s); if (d < nd) { nd = d; nx = s; } } out.push(nx!); left.delete(nx!); }
  return out;
}

let cache: { all: Complex[]; asOf: string; stations: Station[] } | null = null;
function base() {
  if (cache) return cache;
  const all: Complex[] = []; let asOf = '';
  for (const s of allSigungu()) { all.push(...s.complexes); asOf = s.asOf; }
  const stations = (JSON.parse(readFileSync(join(process.cwd(), 'data', 'poi', 'stations.json'), 'utf8')).stations as Station[]);
  cache = { all, asOf, stations };
  return cache;
}

function rowFor(name: string, at: { lat: number; lng: number }, all: Complex[]) {
  const p84: number[] = [], yoys: number[] = [], top: StationRow['top'] = []; let n6 = 0, cnt = 0;
  for (const c of all) {
    if (c.lat == null || c.lng == null) continue;
    if (Math.abs(c.lat - at.lat) > 0.012 || Math.abs(c.lng - at.lng) > 0.015) continue;
    if (distM(at, { lat: c.lat, lng: c.lng }) > RADIUS_M) continue;
    n6 += c.n6;
    const t = c.types.find((t) => Math.abs(t.key - 84) <= 5 && t.basis === 'median6');   // 대장 순위와 같은 84㎡ 타입 기준
    if (t?.price) { p84.push(t.price); cnt++; if (t.yoy != null) yoys.push(t.yoy); top.push({ id: c.id, name: c.name, price: t.price, static: c.static }); }
  }
  return { complexes: cnt, med: cnt >= MIN_COMPLEX ? median(p84) : null, yoy: yoys.length >= MIN_COMPLEX ? Math.round(median(yoys.map((v) => v * 10))!) / 10 : null, yoyN: yoys.length, n6, top: top.sort((a, b) => b.price - a.price).slice(0, 5) };
}

const lineCache = new Map<string, LineData>();
export function loadLine(slug: string): LineData | null {
  if (lineCache.has(slug)) return lineCache.get(slug)!;
  const def = LINES.find((l) => l.slug === slug); if (!def) return null;
  const { all, asOf, stations } = base();
  const mine = stations.filter((s) => s.l === def.name);
  const ordered = def.order === 'id' ? [...mine].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : geoOrder(mine);
  const refP = all.filter((c) => c.sido === REF.sido && c.sigungu === REF.sigungu).map((c) => c.types.find((t) => Math.abs(t.key - 84) <= 5 && t.basis === 'median6')?.price).filter((v): v is number => !!v);
  const ref = median(refP);
  const rows: StationRow[] = ordered.map((s, i) => {
    const r = rowFor(s.n, s, all);
    const gapKm = i ? Math.round(distM(ordered[i - 1], s) / 100) / 10 : 0;
    const transfer = [...new Set(stations.filter((o) => o.n === s.n && o.l !== s.l).map((o) => o.l))];
    return { name: s.n, transfer, ...r, ratio: ref && r.med ? Math.round((r.med / ref) * 100) : null, gapKm, branch: def.branches?.[s.n] ?? null };
  });
  const out = { slug, name: def.name, color: def.color, stations: rows, asOf, ref: { name: REF.label, med: ref, n: refP.length } };
  lineCache.set(slug, out);
  return out;
}
