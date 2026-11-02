#!/usr/bin/env node
// 정책대출·규제 변경 감시: 공식 페이지의 금리표 숫자와 보도자료 제목을 읽어 지난번과 비교하고, 달라진 게 있으면 카카오톡으로 알린다.
// 규칙표는 자동으로 바꾸지 않는다 — 감지·알림·초안(data/watch/)까지만. 확정은 사람이 규칙표에 새 버전으로 넣는다.
//   node scripts/watch-policy.mjs [--notify] [--probe]
//   --probe: 각 소스의 응답·추출 결과를 그대로 보여준다(파싱 점검용, 상태 저장 안 함)
//   --try=URL,URL: 후보 URL의 응답·제목 추출만 찍어 본다(소스 고를 때)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/regions.mjs';
import { kakaoMemo } from './lib/kakao.mjs';

const args = new Set(process.argv.slice(2));
const notify = args.has('--notify'), probe = args.has('--probe');
const tryUrls = [...args].find((a) => a.startsWith('--try='))?.slice(6).split(',').filter(Boolean) ?? [];   // 소스 후보 URL 점검용
const OUT = join(ROOT, 'data', 'watch');
const STATE = join(OUT, 'policy-state.json');
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);   // KST
const notices = [];
const note = (m) => { console.log(m); notices.push(m); };

// 감시 대상 — 공식 기관 페이지만
const PAGES = [
  { key: 'hf_bogeumjari_rate', name: '보금자리론 금리표(주금공)', url: 'https://www.hf.go.kr/ko/sub01/sub01_01_04.do', rules: (r) => [...r.policy.products.bogeumjari.rate_table.akkime, ...r.policy.products.bogeumjari.rate_table.u_t] },
  // 기금 소개 페이지는 표 전체가 아니라 '최저~최고'만 글자로 노출한다 → 규칙표도 최저·최고 두 값으로 비교
  { key: 'nhuf_didimdol', name: '디딤돌대출(주택도시기금)', url: 'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030101.jsp', rules: (r) => minmax(r.policy.products.didimdol.rate_table.rows.flat()) },
  { key: 'nhuf_newlywed', name: '신혼부부 전용 구입자금(주택도시기금)', url: 'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030601.jsp', rules: (r) => minmax(r.policy.products.newlywed_first.rate_table.rows.flat()) },
  { key: 'nhuf_newborn', name: '신생아 특례(주택도시기금)', url: 'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030801.jsp', rules: (r) => minmax(r.policy.products.newborn.rate_table.rows.flat()) },
];
// 보도자료 — 국토부 누리집은 해외(GitHub) IP에서 리다이렉트 루프, 기금 공지는 406이라 뺐다. 국토부·금융위는 정책브리핑(korea.kr) 부처별 목록으로 본다.
const NEWS = [
  { key: 'hf_news', name: '주금공 보도자료', url: 'https://www.hf.go.kr/ko/sub05/sub05_04_05.do', parse: (h) => titles(h).filter((t) => /자세히 보기$/.test(t)).map((t) => t.replace(/\s*자세히 보기$/, '')) },
  { key: 'molit_news', name: '국토부 보도자료(정책브리핑)', url: 'https://www.korea.kr/briefing/pressReleaseList.do?repCodeType=A&repCode=A00006', parse: koreaKr },
  { key: 'fsc_news', name: '금융위 보도자료(정책브리핑)', url: 'https://www.korea.kr/briefing/pressReleaseList.do?repCodeType=A&repCode=C00003', parse: koreaKr },
];
/** 정책브리핑 보도자료 목록: <a href="/briefing/pressReleaseView.do…"><span class="text"><strong>제목</strong>… */
function koreaKr(html) {
  const out = [];
  for (const m of html.matchAll(/<a href="\/briefing\/pressReleaseView\.do[^"]*">\s*<span class="text">\s*<strong>([\s\S]*?)<\/strong>/g)) out.push(stripTags(m[1]).trim());
  return [...new Set(out)];
}
const minmax = (a) => [Math.min(...a), Math.max(...a)];
// 규칙표(정책대출 금리·한도, LTV·DSR, 규제지역, 취득세)에 닿을 만한 제목만 — 공급·교통 등 일반 국토부 자료는 거른다
const KEYWORDS = /보금자리|디딤돌|버팀목|신생아|신혼부부|LTV|DSR|DTI|규제지역|조정대상지역|투기과열|토지거래허가|주택담보대출|주담대|전세대출|대출 한도|금리 인상|금리 인하|가계부채|가계대출|주택도시기금|정책대출|부동산 대책|주택시장 안정|취득세|양도소득세|종합부동산세|보유세/;

async function getText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'ko-KR,ko;q=0.9', referer: new URL(url).origin + '/' }, signal: AbortSignal.timeout(45_000), redirect: 'follow' });
  if (r.status === 406) {   // 일부 공공 사이트(주택도시기금)는 accept 헤더가 길면 406을 낸다 → 단순 헤더로 한 번 더
    const r2 = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: '*/*' }, signal: AbortSignal.timeout(45_000), redirect: 'follow' });
    const b2 = Buffer.from(await r2.arrayBuffer()); let t2 = b2.toString('utf8');
    if (/charset=["']?euc-kr/i.test(t2.slice(0, 2000)) || /�/.test(t2.slice(0, 5000))) { try { t2 = new TextDecoder('euc-kr').decode(b2); } catch { /* utf8 유지 */ } }
    return { status: r2.status, html: t2, ctype: r2.headers.get('content-type') ?? '' };
  }
  const buf = Buffer.from(await r.arrayBuffer());
  let text = buf.toString('utf8');
  if (/charset=["']?euc-kr/i.test(text.slice(0, 2000)) || /�/.test(text.slice(0, 5000))) { try { text = new TextDecoder('euc-kr').decode(buf); } catch { /* utf8 유지 */ } }
  return { status: r.status, html: text, ctype: r.headers.get('content-type') ?? '' };
}
const stripTags = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, '·').replace(/\s+/g, ' ');
/** 본문에서 금리처럼 생긴 숫자(0.5~12.0, 소수 둘째 자리)만 순서대로 뽑는다 — 표 구조를 몰라도 '숫자 지문'으로 변경을 잡는다 */
function rateNumbers(text) {
  const out = [];
  for (const m of text.matchAll(/(?<![\d.])(\d{1,2}\.\d{1,2})\s*%?(?![\d.])/g)) { const v = Number(m[1]); if (v >= 0.5 && v <= 12) out.push(v); }
  return out.slice(0, 120);
}
/** 보도자료 목록에서 제목 후보 — RSS면 <title>, HTML이면 링크 글자와 title 속성 */
function titles(html, rss = false) {
  const out = [];
  if (rss) { for (const m of html.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/gi)) out.push(stripTags(m[1]).replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()); return [...new Set(out)]; }
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const t = stripTags(m[2]).trim(); if (t.length >= 8 && t.length <= 120) out.push(t);
    const tt = /title=["']([^"']{8,120})["']/i.exec(m[1]); if (tt) out.push(tt[1].trim());
  }
  return [...new Set(out)];
}
function loadRulesAll() {
  const dir = join(ROOT, 'data', 'rules');
  return readdirSync(dir).filter((f) => /^v\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
const uniq = (a) => [...new Set(a)];
const fmt = (a) => (a.length ? `${Math.min(...a)}~${Math.max(...a)}` : '-');

async function tryOnly() {
  for (const u of tryUrls) {
    try {
      const { status, html, ctype } = await getText(u);
      const isRss = /xml|rss/i.test(ctype) || /<rss|<feed/i.test(html.slice(0, 500));
      const all = titles(html, isRss);
      const hits = all.filter((t) => KEYWORDS.test(t));
      const longest = [...all].sort((x, y) => y.length - x.length).slice(0, 6);
      const fields = [...new Set([...html.matchAll(/<(?:select|input)\b[^>]*\bname=["']([^"']+)["']/gi)].map((m) => m[1]))].slice(0, 30);
      const links = [...new Set([...html.matchAll(/href=["']([^"']*(?:rss|\.xml)[^"']*)["']/gi)].map((m) => m[1]))].slice(0, 5);
      note(`[try] ${u} → HTTP ${status} ${ctype.split(';')[0]} ${html.length}자 · ${isRss ? 'RSS' : 'HTML'} 제목 ${all.length}개 · 키워드 ${hits.length}개 · 긴 제목: ${longest.join(' | ').slice(0, 400)} · 폼 필드: ${fields.join(',')} · rss링크: ${links.join(' ')} · 본문: ${stripTags(html).slice(0, 160)}`);
    } catch (e) { note(`[try] ${u} → 실패: ${e?.cause?.code ?? e?.cause?.message ?? e?.message ?? e}`); }
  }
  if (process.env.GITHUB_ACTIONS) notices.forEach((m, i) => console.log(`::notice title=try ${i + 1}::${m.slice(0, 3900)}`));
}

async function main() {
  if (tryUrls.length) return tryOnly();
  mkdirSync(OUT, { recursive: true });
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { pages: {}, news: {} };
  const rulesAll = loadRulesAll();
  const current = rulesAll.filter((r) => r.meta.effective_from <= today).at(-1);
  const future = rulesAll.filter((r) => r.meta.effective_from > today);
  const alerts = [];
  const drafts = {};

  for (const p of PAGES) {
    try {
      const { status, html } = await getText(p.url);
      const text = stripTags(html);
      const nums = rateNumbers(text);
      const fp = nums.join(',');
      const prev = state.pages[p.key];
      const ruleNow = uniq(p.rules(current)), ruleFuture = future.map((r) => uniq(p.rules(r)));
      const has = (set) => set.every((v) => nums.includes(v));
      const matchNow = has(ruleNow), matchFuture = ruleFuture.some(has);
      if (probe) { note(`${p.name} HTTP ${status} 글자 ${text.length} · 숫자 ${nums.length}개: ${nums.slice(0, 40).join(' ')} · 규칙표(시행중) 포함 ${matchNow}${ruleFuture.length ? ` · 예정판 포함 ${matchFuture}` : ''}`); continue; }
      if (status !== 200 || !nums.length) { note(`${p.name}: 응답 이상(HTTP ${status}, 숫자 ${nums.length}개) — 건너뜀`); continue; }
      if (prev && prev.fp !== fp) {
        const gone = prev.nums.filter((v) => !nums.includes(v)), added = nums.filter((v) => !prev.nums.includes(v));
        alerts.push(`▶ ${p.name} 숫자 변경: 빠짐 ${uniq(gone).slice(0, 8).join(' ') || '-'} / 새로 ${uniq(added).slice(0, 8).join(' ') || '-'} · 규칙표 ${matchNow ? '일치' : matchFuture ? '예정판과 일치' : '불일치 → 확인 필요'}`);
        drafts[p.key] = { page: p.url, checked: today, numbers: nums, previous: prev.nums, rules_now: ruleNow, rules_future: ruleFuture };
      } else if (!prev && !matchNow && !matchFuture) {
        alerts.push(`▶ ${p.name}: 규칙표 금리(${fmt(ruleNow)})가 페이지에 안 보임 → 표가 바뀌었는지 확인`);
      }
      state.pages[p.key] = { fp, nums, checked: today, matchNow, matchFuture };
    } catch (e) { note(`${p.name} 실패: ${String(e.message).slice(0, 120)}`); }
  }

  for (const n of NEWS) {
    try {
      const { status, html } = await getText(n.url);
      const all = n.parse ? n.parse(html) : titles(html, !!n.rss);
      const hits = all.filter((t) => KEYWORDS.test(t));
      if (probe) { note(`${n.name} HTTP ${status} 제목 ${all.length}개 · 키워드 ${hits.length}개: ${hits.slice(0, 5).join(' | ').slice(0, 300)} ‖ 샘플: ${all.filter((t) => t.length > 14).slice(0, 5).join(' | ').slice(0, 300)}`); continue; }
      if (status !== 200 || !all.length) { note(`${n.name}: 응답 이상(HTTP ${status}, 링크 ${all.length}개) — 건너뜀`); continue; }
      const seen = new Set(state.news[n.key] ?? []);
      const fresh = state.news[n.key] ? hits.filter((t) => !seen.has(t)) : [];   // 첫 실행은 기준선만 저장
      if (fresh.length) alerts.push(`▶ ${n.name} 새 글 ${fresh.length}건: ${fresh.slice(0, 3).map((t) => t.slice(0, 40)).join(' / ')}`);
      state.news[n.key] = uniq([...hits, ...(state.news[n.key] ?? [])]).slice(0, 200);
    } catch (e) { note(`${n.name} 실패: ${String(e.message).slice(0, 120)}`); }
  }

  if (probe) { finish(); return; }
  state.lastRun = today;
  writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');
  if (Object.keys(drafts).length) writeFileSync(join(OUT, `draft-${today}.json`), JSON.stringify({ note: '감시기가 감지한 페이지 숫자. 규칙표에 넣기 전에 사람이 시행일·경과규정을 확인한다.', ...drafts }, null, 1) + '\n');

  const head = `[쏙집 정책대출 감시 ${today.slice(5).replace('-', '/')}]`;
  if (alerts.length) {
    const msg = [head, ...alerts, `규칙표: 시행중 ${current.meta.version}(${current.meta.effective_from})${future.length ? ` · 예정 ${future.map((r) => `${r.meta.version}(${r.meta.effective_from})`).join(', ')}` : ''}`, '반영은 자동으로 하지 않습니다 — 확인 후 "반영"이라고 말해 주세요.'].join('\n').slice(0, 900);
    note(msg);
    if (notify) { const sent = await kakaoMemo(msg); console.log(sent ? '카카오톡 알림 전송' : '카카오톡 알림 안 보냄'); }
  } else note(`${head} 변경 없음 (페이지 ${Object.keys(state.pages).length} · 보도자료 ${Object.keys(state.news).length})`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `alerts=${alerts.length}\n`, { flag: 'a' });
  finish();
}
function finish() { if (process.env.GITHUB_ACTIONS) for (let i = 0; i < notices.length; i += 4) console.log(`::notice title=policy-watch ${i / 4 + 1}::${notices.slice(i, i + 4).join(' | ').slice(0, 3900)}`); }

main().catch((e) => { console.error('[policy-watch] 오류:', e.message); if (process.env.GITHUB_ACTIONS) console.log(`::error title=policy-watch::${String(e.message).slice(0, 800)}`); process.exit(1); });
