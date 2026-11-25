#!/usr/bin/env node
// 한국은행 기준금리 결정 감시: 금융통화위원회 통화정책방향 결정회의(연 8회) 결과가 나오면 카카오톡으로 알린다.
//   node scripts/watch-bok.mjs [--notify] [--probe]
//   --probe: 읽은 결과만 보여주고 상태 저장·알림은 하지 않는다
//
// - 계산기·규칙표는 기준금리를 직접 쓰지 않는다. 기준금리 수치가 적힌 곳은 가이드 글뿐이라, 알림에 고칠 글 수를 같이 적는다.
// - 가이드·규칙표는 자동으로 바꾸지 않는다. 감지와 알림까지만 한다.
// - 평일 오전·오후 두 번 돈다. 결정문이 아직 안 올라온 시각이면 아무것도 하지 않고, 다음 실행에서 잡는다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/regions.mjs';
import { kakaoMemo } from './lib/kakao.mjs';
import { parseMeetings, parseBaseRates, decide, message } from './lib/bok.mjs';

const args = new Set(process.argv.slice(2));
const notify = args.has('--notify'), probe = args.has('--probe');
const OUT = join(ROOT, 'data', 'watch');
const STATE = join(OUT, 'bok-state.json');
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST
const year = today.slice(0, 4);
const URL_MEETINGS = `https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755&pYear=${year}`;
const URL_RATES = 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643';

const gh = !!process.env.GITHUB_ACTIONS;
const note = (m) => { console.log(m); if (gh) console.log(`::notice title=bok::${m.replace(/\n/g, ' / ')}`); };
const warn = (m) => { console.warn(m); if (gh) console.log(`::warning title=bok::${m.replace(/\n/g, ' / ')}`); };

async function getHtml(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((r) => setTimeout(r, i === 1 ? 4_000 : 12_000));
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', accept: 'text/html,*/*;q=0.8', 'accept-language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
      if (r.status === 200) return await r.text();
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
  }
  throw last;
}

// 기준금리 수치가 본문에 적힌 가이드 글 수 (예: "기준금리 3.00%")
function guidesWithBaseRate() {
  const dir = join(ROOT, 'src', 'content', 'guide');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md') && /기준금리[^\n]{0,40}?\d\.\d{2}%/.test(readFileSync(join(dir, f), 'utf8'))).length;
}

async function main() {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  let meetings, rates;
  try {
    meetings = parseMeetings(await getHtml(URL_MEETINGS), year);
    rates = parseBaseRates(await getHtml(URL_RATES));
    if (!rates.length) throw new Error('기준금리 표를 읽지 못함(행 0개)');
  } catch (e) {
    const fails = (state.fails ?? 0) + 1;
    warn(`한국은행 페이지 읽기 실패(${fails}회 연속): ${String(e?.message ?? e)}`);
    if (!probe) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(STATE, JSON.stringify({ ...state, fails, checked: today }, null, 1) + '\n');
      if (notify && (fails === 2 || (fails > 2 && (fails - 2) % 6 === 0))) await kakaoMemo(`[쏙집 기준금리 감시] 한국은행 페이지를 ${fails}번 연속 읽지 못했습니다. 감시가 멈춰 있을 수 있습니다.`);
    }
    return;
  }

  const ev = decide({ meetings, rates, state, today });
  const decided = meetings.filter((m) => m.decided).at(-1)?.date ?? '없음';
  note(`회의 ${meetings.length}건(${year}) · 최근 결정문 ${decided} · 기준금리 ${rates[0].rate.toFixed(2)}%(${rates[0].date} 변경) · 지난 알림 ${state.lastDecision ?? '없음'} · ${ev ? `새 결정: ${ev.date} ${ev.kind}` : '새 결정 없음'}`);
  if (probe) { if (ev) console.log(message(ev, guidesWithBaseRate())); return; }

  const next = { ...state, fails: 0, checked: today, rate: rates[0].rate, rateDate: rates[0].date };
  if (ev) {
    next.lastDecision = ev.date > (state.lastDecision ?? '') ? ev.date : state.lastDecision;
    next.lastEvent = { date: ev.date, kind: ev.kind, rate: ev.rate, prev: ev.prev };
    const msg = message(ev, guidesWithBaseRate());
    console.log(msg);
    if (notify) console.log((await kakaoMemo(msg, { url: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643', button: '한국은행 기준금리' })) ? '카카오톡 알림 전송' : '카카오톡 알림 안 보냄');
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `event=${ev.date} ${ev.kind} ${ev.rate.toFixed(2)}%\n`, { flag: 'a' });
  }
  // 날짜만 바뀐 경우에는 파일을 건드리지 않는다(매일 빈 커밋 방지)
  const strip = ({ checked, ...rest }) => JSON.stringify(rest);
  if (!existsSync(STATE) || strip(next) !== strip(state)) { mkdirSync(OUT, { recursive: true }); writeFileSync(STATE, JSON.stringify(next, null, 1) + '\n'); }
}

main().catch((e) => { console.error(String(e?.stack ?? e)); process.exit(1); });
