// 한국부동산원 R-ONE 주간 아파트 매매가격지수 (data/rone/weekly.json, fetch-rone.mjs가 매주 갱신)
// 지역 키는 "서울>강남지역>동남권>강남구", "경기>경부1권>성남시>분당구", "경기>경부1권>성남시", "인천>부평구", "서울" 꼴.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Weekly { source: string; updated: string; periods: string[]; labels: Record<string, string>; series: Record<string, Record<string, number>> }
export interface RoneStat {
  yoy: number | null;        // 최근 주 지수 ÷ 52주 전 지수 − 1 (%)
  m3: number | null;         // 최근 주 지수 ÷ 13주 전 지수 − 1 (%) — '최근 3개월'
  wk: number | null;         // 전주 대비 변동률(%) — 부동산원 공표와 같이 0.01% 단위로 반올림. 0이면 보합
  streak: number;            // 주간 변동률(0.01% 단위)이 연속으로 +인 주 수(양수) 또는 −인 주 수(음수). 보합(0.00%)이 나오면 끊김
  latest: number; asOf: string; asOfLabel: string; key: string;
}

let cache: Weekly | null | undefined;
function load(): Weekly | null {
  if (cache !== undefined) return cache;
  const p = join(process.cwd(), 'data', 'rone', 'weekly.json');
  cache = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Weekly) : null;
  return cache;
}
export function roneAsOf(): { period: string; label: string; updated: string } | null {
  const w = load(); if (!w || !w.periods.length) return null;
  const period = w.periods[w.periods.length - 1];
  return { period, label: w.labels[period] ?? period, updated: w.updated };
}
function statOf(key: string): RoneStat | null {
  const w = load(); if (!w) return null;
  const s = w.series[key]; if (!s) return null;
  const P = w.periods;
  const last = s[P[P.length - 1]]; if (last == null) return null;
  const prev = P.length >= 53 ? s[P[P.length - 53]] : undefined;
  const yoy = prev ? +(((last - prev) / prev) * 100).toFixed(1) : null;
  const q = P.length >= 14 ? s[P[P.length - 14]] : undefined;
  const m3 = q ? +(((last - q) / q) * 100).toFixed(1) : null;
  // 주간 변동률 = 지수 두 값을 나눠 0.01% 단위로 반올림(부동산원 주간 아파트가격동향의 공표 방식).
  // 반올림하지 않은 지수(소수 6자리 이상)로 계산해야 공표값과 같다. 0.00%는 보합으로 보고 연속 기록을 끊는다
  const wkAt = (i: number): number | null => {
    const a = s[P[i]], b = s[P[i - 1]];
    if (a == null || b == null || !b) return null;
    const r = +((a / b - 1) * 100).toFixed(2);
    return r === 0 ? 0 : r;   // −0 방지
  };
  const wk = P.length >= 2 ? wkAt(P.length - 1) : null;
  let streak = 0;
  for (let i = P.length - 1; i > 0; i--) {
    const r = wkAt(i);
    if (r == null) break;
    const d = Math.sign(r);
    if (d === 0) break;
    if (streak === 0) streak = d; else if (Math.sign(streak) !== d) break; else streak += d;
  }
  return { yoy, m3, wk, streak, latest: last, asOf: P[P.length - 1], asOfLabel: w.labels[P[P.length - 1]] ?? P[P.length - 1], key };
}
const keys = () => Object.keys(load()?.series ?? {});

/** 시도 전체 ("서울", "경기" …) · 권역("수도권", "전국"). 최상위 이름이 조금 달라도(광주광역시 등) 찾는다 */
// 2026 통합 뒤 R-ONE 표기: 통합시 전체 '전남광주'(2026-07부터)와 옛 광주광역시 '전남광주>광주'(2012년부터)가 따로 있다.
// 쏙집 수집 범위가 옛 광주 5개 구이므로 시도 '전남광주'는 '전남광주>광주' 시계열을 먼저 쓴다
const SIDO_ALIAS: Record<string, string[]> = { 전남광주: ['전남광주>광주'], 광주: ['전남광주>광주'] };
export function roneSido(sido: string): RoneStat | null {
  for (const a of SIDO_ALIAS[sido] ?? []) { const r = statOf(a); if (r) return r; }
  const direct = statOf(sido); if (direct) return direct;
  const k = keys().find((x) => !x.includes('>') && x.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '') === sido);
  return k ? statOf(k) : null;
}
/** 시군구: "종로구"(서울·광역시) 또는 "안양시 만안구"(경기). 이름이 안 맞으면 null */
export function roneSigungu(sido: string, sigungu: string): RoneStat | null {
  const parts = sigungu.trim().split(/\s+/);
  const tail = '>' + parts.join('>');
  const roots = [sido, ...(SIDO_ALIAS[sido] ?? []).map((a) => a.split('>')[0])];
  const k = keys().find((x) => roots.some((r) => x.startsWith(r + '>')) && x.endsWith(tail));
  return k ? statOf(k) : null;
}
/** 시 단위 ("성남시") — 구가 있는 시는 R-ONE에 시 합계 행이 따로 있다 */
export function roneCity(sido: string, city: string): RoneStat | null {
  const k = keys().find((x) => x.startsWith(sido + '>') && x.endsWith('>' + city) && x.split('>').length <= 4);
  return k ? statOf(k) : null;
}
const wkRate = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
/** 연속 주 수 문구: "93주 연속 상승" / "15주 연속 하락" / (이번 주 0.00%) "보합". 2주 미만이면 빈 문자열 */
export function roneStreakText(r: RoneStat | null): string {
  if (!r) return '';
  return r.streak >= 2 ? `${r.streak}주 연속 상승` : r.streak <= -2 ? `${-r.streak}주 연속 하락` : r.wk === 0 ? '보합' : '';
}
/** 표시용: "1년 +10.2% · 3개월 +1.8% · 전주 대비 +0.03% · 93주 연속 상승" — 1년(52주 전 대비)·3개월(13주 전 대비)·전주 대비를 글자로 구분 */
export function roneText(r: RoneStat | null): string {
  if (!r || r.yoy == null) return '';
  const sg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  const st = roneStreakText(r);
  return `1년 ${sg(r.yoy)}${r.m3 != null ? ` · 3개월 ${sg(r.m3)}` : ''}${r.wk != null ? ` · 전주 대비 ${wkRate(r.wk)}` : ''}${st ? ` · ${st}` : ''}`;
}
/** 카드용 한 줄(HTML): 전주 대비 −0.30% · 15주 연속 하락. 스타일은 global.css의 .wk */
export function roneWeekHtml(r: RoneStat | null): string {
  if (!r || r.wk == null) return '';
  const c = r.wk > 0 ? 'up' : r.wk < 0 ? 'down' : 'flat';
  const st = roneStreakText(r);
  return `<span class="wk ${c}"><span class="in"><span><i>전주 대비</i> <b>${wkRate(r.wk)}</b></span>${st ? `<span class="st">${st}</span>` : ''}</span></span>`;
}

/** 시군구 주간 지수 시계열(노선별 지역 비교 그래프용). 이름 규칙은 roneSigungu와 같다 */
export function roneSeries(sido: string, sigungu: string): { periods: string[]; labels: Record<string, string>; values: (number | null)[] } | null {
  const w = load(); if (!w) return null;
  const parts = sigungu.trim().split(/\s+/);
  const tail = '>' + parts.join('>');
  const roots = [sido, ...(SIDO_ALIAS[sido] ?? []).map((a) => a.split('>')[0])];
  const k = keys().find((x) => roots.some((r) => x.startsWith(r + '>')) && x.endsWith(tail));
  if (!k) return null;
  return { periods: w.periods, labels: w.labels, values: w.periods.map((p) => w.series[k][p] ?? null) };
}
