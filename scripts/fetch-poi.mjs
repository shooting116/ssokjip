#!/usr/bin/env node
// 공공데이터포털 표준데이터 → 초등학교·도시철도역 좌표 (data/poi/*.json)
//   node scripts/fetch-poi.mjs --mode probe                 표준데이터 페이지에서 odcloud API 주소(uddi)를 찾아 출력
//   node scripts/fetch-poi.mjs --mode schools [--api tn_pubr_public_elesch_mskul_lc_api]   전국초중등학교위치표준데이터 → data/poi/schools.json (초등학교만). --odcloud true 면 옛 odcloud 주소
//   node scripts/fetch-poi.mjs --mode stations [--uddi …]   전국도시철도역사정보표준데이터 → data/poi/stations.json
// 키는 DATA_GO_KR_KEY(공공데이터포털 공통 키). 로그에 키를 찍지 않는다. 컨테이너에서는 포털에 못 닿으므로 Actions(data-run)에서 돌린다.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/regions.mjs';
import { serviceKey } from './lib/datago.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'] : [])).filter((x) => x.length));
const mode = args.mode ?? 'probe';
const OUT = join(ROOT, 'data', 'poi');
const notices = [];
const note = (m) => { console.log(m); notices.push(m); };
const redact = (s) => String(s).replace(/serviceKey=[^&\s]+/g, 'serviceKey=***');

// 표준데이터셋 ID (공공데이터포털 data/{id}/standard.do)
const SETS = {
  schools: { id: '15021148', name: '전국초중등학교위치표준데이터' },
  stations: { id: '15013205', name: '전국도시철도역사정보표준데이터' },
};
const UDDI_FILE = join(OUT, '_uddi.json');

async function getText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (ssokjip data pipeline)' }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`${r.status} ${redact(url)}`);
  return r.text();
}
async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

/** 표준데이터 페이지(standard.do)와 오픈API 탭에서 odcloud 요청 주소의 uddi를 찾는다 */
async function findUddi(id) {
  const html = await getText(`https://www.data.go.kr/data/${id}/standard.do`);
  const found = new Set([...html.matchAll(new RegExp(`api/${id}/v1/(uddi:[0-9a-f-]+)`, 'gi'))].map((m) => m[1]));
  for (const m of html.matchAll(/(uddi:[0-9a-f]{8}-[0-9a-f-]{27,})/gi)) found.add(m[1]);
  return [...found];
}
/** 페이지에서 내려받기 링크 후보(xlsx/csv/fileDownload)를 뽑는다 — 표준데이터가 API 없이 파일로만 제공될 때 */
async function findDownloads(url) {
  const html = await getText(url);
  const out = new Set();
  for (const m of html.matchAll(/(?:href|src|data-url)=["']([^"']*(?:fileDownload|FileDown|\.xlsx|\.csv|downloadFile|fileDown)[^"']*)["']/gi)) out.add(m[1]);
  for (const m of html.matchAll(/(https?:\/\/[^"'\s<>]*(?:\.xlsx|\.csv))/gi)) out.add(m[1]);
  return [...out].slice(0, 12);
}

async function probe() {
  for (const [k, s] of Object.entries(SETS)) {
    try {
      const u = await findUddi(s.id);
      note(`${k} ${s.name}(${s.id}): uddi ${u.length ? u.join(', ') : '없음 — 페이지에 노출되지 않음'}`);
      const dl = await findDownloads(`https://www.data.go.kr/data/${s.id}/standard.do`);
      if (dl.length) note(`${k} 내려받기 후보: ${dl.join(' ; ').slice(0, 600)}`);
    } catch (e) { note(`${k} 페이지 실패: ${redact(e.message)}`); }
  }
  // 도시철도 역사정보는 국가철도공단(KRIC) 파일로 옮겨 간 경우가 있어 그 페이지도 본다
  for (const url of ['https://data.kric.go.kr/rips/M_01_01/detail.do?id=32', `https://www.data.go.kr/data/${SETS.stations.id}/fileData.do`]) {
    try { const dl = await findDownloads(url); note(`${url} → ${dl.length ? dl.join(' ; ').slice(0, 600) : '링크 없음'}`); }
    catch (e) { note(`${url} 실패: ${redact(e.message)}`); }
  }
}

/** 표준데이터 API를 page 단위로 전부 읽는다.
 *  (a) api.data.go.kr/openapi/{api} — 활용신청 화면의 End Point 형식 (pageNo/numOfRows/type=json, response.body.items)
 *  (b) api.odcloud.kr/api/{id}/v1/{uddi} — 옛 형식 (page/perPage, data[]) */
async function fetchAll(id, uddi, api) {
  const key = serviceKey();
  const rows = [];
  for (let page = 1; page <= 200; page++) {
    const url = api
      ? `https://api.data.go.kr/openapi/${api}?serviceKey=${key}&pageNo=${page}&numOfRows=1000&type=json`
      : `https://api.odcloud.kr/api/${id}/v1/${uddi}?page=${page}&perPage=1000&returnType=JSON&serviceKey=${key}`;
    const j = await getJson(url);
    let data, total;
    if (api) {
      const body = j.response?.body ?? {};
      if (j.response?.header && j.response.header.resultCode && j.response.header.resultCode !== '00') throw new Error(`${j.response.header.resultCode} ${j.response.header.resultMsg ?? ''}`);
      data = Array.isArray(body.items) ? body.items : (body.items?.item ?? []);
      total = Number(body.totalCount ?? NaN);
    } else { data = j.data ?? []; total = Number(j.totalCount ?? NaN); }
    rows.push(...data);
    if (page === 1) note(`총 ${Number.isFinite(total) ? total : '?'}건 · 열: ${Object.keys(data[0] ?? {}).join(', ').slice(0, 400)}`);
    if (!data.length || (Number.isFinite(total) && rows.length >= total)) break;
  }
  return rows;
}
const pick = (o, names) => { for (const n of names) if (o[n] != null && String(o[n]).trim() !== '') return String(o[n]).trim(); return null; };
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return Number.isFinite(n) && n !== 0 ? n : null; };

function resolveUddi(k) {
  if (args.uddi) return args.uddi;
  const saved = existsSync(UDDI_FILE) ? JSON.parse(readFileSync(UDDI_FILE, 'utf8')) : {};
  if (saved[k]) return saved[k];
  throw new Error(`${k} uddi를 모릅니다. --mode probe 로 찾거나 --uddi 로 주세요`);
}
function saveUddi(k, uddi) {
  const saved = existsSync(UDDI_FILE) ? JSON.parse(readFileSync(UDDI_FILE, 'utf8')) : {};
  saved[k] = uddi; mkdirSync(OUT, { recursive: true }); writeFileSync(UDDI_FILE, JSON.stringify(saved, null, 1) + '\n');
}

async function schools() {
  const api = args.api ?? 'tn_pubr_public_elesch_mskul_lc_api';   // 활용신청 화면의 End Point 끝부분
  let uddi = null;
  if (args.odcloud === 'true') { try { uddi = resolveUddi('schools'); } catch { const u = await findUddi(SETS.schools.id); if (!u.length) throw new Error('schools uddi 없음'); uddi = u[0]; } }
  const rows = await fetchAll(SETS.schools.id, uddi, uddi ? null : api);
  const out = [];
  for (const r of rows) {
    const level = pick(r, ['학교급구분', 'schoolSe', 'schoolKindName', 'schulKndScNm']) ?? '';
    if (!level.includes('초등')) continue;
    const status = pick(r, ['운영상태', 'operSttus', 'operationStatus']) ?? '';
    if (status && !status.includes('운영')) continue;             // 폐교·휴교 제외
    const lat = num(pick(r, ['위도', 'latitude'])), lng = num(pick(r, ['경도', 'longitude']));
    if (lat == null || lng == null || lat < 33 || lat > 39 || lng < 124 || lng > 132) continue;
    const branch = pick(r, ['본교분교구분', 'mainbrSe', 'mainBranchSe']) ?? '';
    out.push({ id: pick(r, ['학교ID', 'schoolId']), name: pick(r, ['학교명', 'schoolNm', 'schoolName']), lat, lng, addr: pick(r, ['소재지도로명주소', 'rdnmadr', '소재지지번주소', 'lnmadr']), edu: pick(r, ['시도교육청명', 'sidoEduOfficeNm']), branch: branch.includes('분교') ? '분교' : null });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  mkdirSync(OUT, { recursive: true });
  const asOf = pick(rows[0] ?? {}, ['데이터기준일자', 'referenceDate', 'dataStdDe']) ?? new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'schools.json'), JSON.stringify({ source: `공공데이터포털 ${SETS.schools.name}(한국교육시설안전원)`, id: SETS.schools.id, asOf, updated: new Date().toISOString().slice(0, 10), n: out.length, schools: out }) + '\n');
  if (uddi) saveUddi('schools', uddi);
  note(`초등학교 ${out.length}개 저장 (원본 ${rows.length}행, 기준일 ${asOf})`);
}

async function stations() {
  let uddi; try { uddi = resolveUddi('stations'); } catch { const u = await findUddi(SETS.stations.id); if (!u.length) throw new Error('stations uddi 없음'); uddi = u[0]; }
  const rows = await fetchAll(SETS.stations.id, uddi);
  const out = [];
  for (const r of rows) {
    const lat = num(pick(r, ['역위도', '위도'])), lng = num(pick(r, ['역경도', '경도']));
    if (lat == null || lng == null || lat < 33 || lat > 39 || lng < 124 || lng > 132) continue;
    out.push({ id: pick(r, ['역번호', '역사ID']), name: (pick(r, ['역사명', '역명']) ?? '').replace(/역$/, ''), line: pick(r, ['노선명']), op: pick(r, ['운영기관명']), transfer: (pick(r, ['환승역구분']) ?? '').includes('환승'), lat, lng, addr: pick(r, ['역사도로명주소', '소재지도로명주소']) });
  }
  out.sort((a, b) => (a.line ?? '').localeCompare(b.line ?? '', 'ko') || a.name.localeCompare(b.name, 'ko'));
  mkdirSync(OUT, { recursive: true });
  const asOf = pick(rows[0] ?? {}, ['데이터기준일자']) ?? new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'stations.json'), JSON.stringify({ source: `공공데이터포털 ${SETS.stations.name}(국토교통부)`, id: SETS.stations.id, asOf, updated: new Date().toISOString().slice(0, 10), n: out.length, stations: out }) + '\n');
  saveUddi('stations', uddi);
  const lines = new Set(out.map((s) => s.line));
  note(`도시철도역 ${out.length}개 · 노선 ${lines.size}개 저장 (원본 ${rows.length}행, 기준일 ${asOf})`);
}

async function main() {
  if (mode === 'probe') await probe();
  else if (mode === 'schools') await schools();
  else if (mode === 'stations') await stations();
  else throw new Error(`알 수 없는 모드 ${mode}`);
  if (process.env.GITHUB_ACTIONS) for (let i = 0; i < notices.length; i += 6) console.log(`::notice title=poi ${i / 6 + 1}::${notices.slice(i, i + 6).join(' | ').slice(0, 3900)}`);
}
main().catch((e) => { console.error(redact(e.message)); if (process.env.GITHUB_ACTIONS) console.log(`::error title=poi::${redact(e.message).slice(0, 1000)}`); process.exit(1); });
