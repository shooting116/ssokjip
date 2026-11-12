#!/usr/bin/env node
// 도시철도역(data/poi/stations.json)의 좌표 → 행정구역(시도·시군구·법정동). 카카오 로컬 API coord2regioncode.
//   node scripts/geocode-stations.mjs [--force]
// 결과는 data/poi/station-regions.json 에 "노선|역명" 키로 따로 둔다(역사정보를 다시 받아도 지워지지 않게).
// 쓰는 곳: 노선별 시세분석(src/lib/data/lines.ts) — 역이 어느 시·구에 속하는지를 주변 단지 추정 대신 실제 행정구역으로 판정.
// 키: KAKAO_REST_KEY (Actions Secrets). 로그에 키를 찍지 않는다. 이미 받은 역은 건너뛴다(--force 면 다시).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/regions.mjs';

const KEY = process.env.KAKAO_REST_KEY;
if (!KEY) { console.error('KAKAO_REST_KEY 환경변수가 없습니다'); process.exit(1); }
const force = process.argv.includes('--force');
const SRC = join(ROOT, 'data', 'poi', 'stations.json');
const OUT = join(ROOT, 'data', 'poi', 'station-regions.json');
const stations = JSON.parse(readFileSync(SRC, 'utf8')).stations;
const prev = existsSync(OUT) && !force ? JSON.parse(readFileSync(OUT, 'utf8')).regions : {};

// 카카오는 시도를 정식 이름으로 준다 → 쏙집 표기(짧은 이름)로
const SIDO = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };

async function region(lat, lng) {
  const res = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?${new URLSearchParams({ x: String(lng), y: String(lat) })}`, { headers: { Authorization: `KakaoAK ${KEY}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const docs = (await res.json()).documents ?? [];
  const d = docs.find((x) => x.region_type === 'B') ?? docs[0];   // B = 법정동
  if (!d) return null;
  return { sido: SIDO[d.region_1depth_name] ?? d.region_1depth_name, sgg: d.region_2depth_name, dong: d.region_3depth_name, code: d.code };
}

const out = {}; let calls = 0; const miss = [];
for (const s of stations) {
  const k = `${s.l}|${s.n}`;
  const p = prev[k];
  if (p && p.lat === s.lat && p.lng === s.lng) { out[k] = p; continue; }
  if (s.lat == null || s.lng == null) { miss.push(`${k} (좌표 없음)`); continue; }
  try {
    calls++;
    const r = await region(s.lat, s.lng);
    if (r && r.sgg) out[k] = { ...r, lat: s.lat, lng: s.lng }; else miss.push(k);
  } catch (e) { miss.push(`${k} (${e.message})`); }
  await new Promise((r) => setTimeout(r, 60));
}
writeFileSync(OUT, JSON.stringify({ source: '카카오 로컬 API coord2regioncode(법정동). 역 좌표는 data/poi/stations.json', updated: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10), n: Object.keys(out).length, regions: out }, null, 1) + '\n');
const bySido = {}; for (const v of Object.values(out)) bySido[v.sido] = (bySido[v.sido] ?? 0) + 1;
const line = `역 ${stations.length} · 행정구역 ${Object.keys(out).length} · 호출 ${calls}${miss.length ? ` · 실패 ${miss.length}: ${miss.slice(0, 10).join(', ')}` : ''} · 시도별 ${Object.entries(bySido).map(([k, v]) => `${k} ${v}`).join(' ')}`;
console.log('[geocode-stations] ' + line);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=stations::${line.slice(0, 3800)}`);
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `calls=${calls}\n`, { flag: 'a' });
