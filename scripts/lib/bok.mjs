// 한국은행 기준금리 감시용 파서·판단 (순수 함수 — 네트워크 없음, 테스트 가능)
//
// 읽는 페이지 두 곳(한국은행 공식):
//  - 통화정책방향 결정회의 일정 및 자료: 회의일마다 한 줄. 결정이 나오면 '결정문' 칸에 보도자료 파일 링크가 붙는다.
//  - 한국은행 기준금리 추이: 금리가 바뀐 날만 한 줄씩(유지된 회의는 줄이 생기지 않는다).

const pad = (n) => String(n).padStart(2, '0');

/** 결정회의 일정 표 → [{ date: 'YYYY-MM-DD', decided }] (날짜순). decided = 결정문 칸에 파일 링크가 있음 */
export function parseMeetings(html, year) {
  const out = [];
  const re = /<tr[^>]*>\s*<th[^>]*scope="row"[^>]*>\s*(\d{1,2})월\s*(\d{1,2})일[^<]*<\/th>([\s\S]*?)<\/tr>/g;
  for (let m; (m = re.exec(html)); ) {
    const firstTd = /<td[^>]*>([\s\S]*?)<\/td>/.exec(m[3])?.[1] ?? '';
    out.push({ date: `${year}-${pad(m[1])}-${pad(m[2])}`, decided: /<a\s/i.test(firstTd) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** 기준금리 추이 표 → [{ date: 'YYYY-MM-DD', rate }] (최근이 먼저) */
export function parseBaseRates(html) {
  const out = [];
  const re = /<td[^>]*>\s*(\d{4})\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})월\s*(\d{1,2})일\s*<\/td>\s*<td[^>]*>\s*(\d+(?:\.\d+)?)\s*<\/td>/g;
  for (let m; (m = re.exec(html)); ) out.push({ date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, rate: Number(m[4]) });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** 법정 전월세전환율 상한(%) = 연 10%와 기준금리 + 2%p 중 낮은 쪽 (주택임대차보호법 시행령 제9조) */
export const conversionCap = (rate) => Math.min(10, +(rate + 2).toFixed(2));

/**
 * 새로 알릴 결정이 있는지 판단.
 * - 지난번 이후 결정문이 올라온 회의가 있으면 그 회의를 알린다(금리 표의 최근 변경일이 회의일과 같으면 변경, 아니면 유지).
 * - 회의는 새로 없는데 금리 표의 최근 값이 저장해 둔 값과 다르면(표가 늦게 고쳐졌거나 임시 회의) 변경으로 알린다.
 * 반환: null 또는 { date, rate, prev, kind: '유지'|'인상'|'인하', next }
 */
export function decide({ meetings, rates, state, today }) {
  const cur = rates[0];
  if (!cur) return null;
  const next = meetings.find((m) => m.date > today)?.date ?? null;
  const kindOf = (rate, prev) => (rate > prev ? '인상' : rate < prev ? '인하' : '유지');
  const latest = meetings.filter((m) => m.decided && m.date <= today).at(-1);
  if (latest && latest.date > (state.lastDecision ?? '')) {
    if (cur.date === latest.date) {
      const prev = rates[1]?.rate ?? state.rate ?? cur.rate;
      return { date: latest.date, rate: cur.rate, prev, kind: kindOf(cur.rate, prev), next };
    }
    return { date: latest.date, rate: cur.rate, prev: cur.rate, kind: '유지', next };
  }
  if (state.rate != null && cur.rate !== state.rate && cur.date > (state.rateDate ?? '')) {
    return { date: cur.date, rate: cur.rate, prev: state.rate, kind: kindOf(cur.rate, state.rate), next };
  }
  return null;
}

const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const pct = (v) => `${v.toFixed(2)}%`;
const capText = (v) => `${Number.isInteger(v * 10) ? v.toFixed(1) : v.toFixed(2)}%`;

/** 카카오톡 문구(200자 이내). guides = 기준금리 수치가 적힌 가이드 글 수 */
export function message(ev, guides = 0) {
  const lines = [];
  if (ev.kind === '유지') {
    lines.push(`[쏙집 기준금리 ${md(ev.date)}] ${pct(ev.rate)} 유지`);
    lines.push(`전월세 전환 법정 상한 그대로 연 ${capText(conversionCap(ev.rate))}`);
  } else {
    lines.push(`[쏙집 기준금리 ${md(ev.date)}] ${pct(ev.prev)} → ${pct(ev.rate)} ${ev.kind}`);
    lines.push(`전월세 전환 법정 상한 연 ${capText(conversionCap(ev.prev))} → ${capText(conversionCap(ev.rate))}`);
  }
  if (ev.next) lines.push(`다음 회의 ${md(ev.next)}`);
  if (guides) lines.push(ev.kind === '유지' ? `기준금리 적힌 가이드 ${guides}편: 회의 날짜 문장 확인` : `기준금리 적힌 가이드 ${guides}편 수정 필요`);
  return lines.join('\n');
}
