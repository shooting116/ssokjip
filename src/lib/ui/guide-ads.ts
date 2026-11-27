// 가이드 글 본문 중간 광고의 개수와 위치를 정한다(순수 함수 — 빌드 때 한 번 계산).
// 원칙: 글 길이에 따라 1~2개, 소제목(h2) 바로 위에만 둔다. 표나 계산 예시 한가운데에는 끼지 않는다.
// 제목 아래(상단 띠)와 글 끝(하단)에는 광고 자리가 따로 있어, 본문 앞뒤 구간에는 두지 않는다.

/** 본문 글자 수(공백 제외)가 이 값 이상이면 2개, 미만이면 1개 */
export const MID_AD_TWO_FROM = 4000;
/** 본문 앞 20% · 뒤 15% 구간에는 두지 않는다 */
const FROM = 0.2;
const TO = 0.85;
/** 광고 두 개 사이의 최소 거리(본문 길이 대비) */
const MIN_GAP = 0.2;

/**
 * 본문 HTML을 광고가 들어갈 자리에서 나눈다. 반환한 조각들 사이사이에 광고가 하나씩 들어간다.
 * - 2개: 본문의 1/3 · 2/3 지점에 가장 가까운 소제목 위 / 1개: 1/2 지점에 가장 가까운 소제목 위
 * - 첫 소제목 위에는 두지 않는다. 조건에 맞는 소제목이 없으면 나누지 않고 [html]을 돌려준다.
 * @param html  렌더링된 본문 HTML
 * @param chars 본문 글자 수(공백 제외)
 */
export function splitGuideForAds(html: string, chars: number): string[] {
  const len = html.length;
  if (!len) return [html];
  const h2: number[] = [];
  for (const m of html.matchAll(/<h2[\s>]/g)) h2.push(m.index as number);
  const cands = h2.slice(1).filter((p) => p / len >= FROM && p / len <= TO);
  const targets = chars >= MID_AD_TWO_FROM ? [1 / 3, 2 / 3] : [1 / 2];
  const picked: number[] = [];
  for (const t of targets) {
    const best = cands
      .filter((p) => picked.every((q) => Math.abs(p - q) / len >= MIN_GAP))
      .sort((a, b) => Math.abs(a / len - t) - Math.abs(b / len - t))[0];
    if (best != null) picked.push(best);
  }
  picked.sort((a, b) => a - b);
  const out: string[] = [];
  let last = 0;
  for (const p of picked) {
    out.push(html.slice(last, p));
    last = p;
  }
  out.push(html.slice(last));
  return out;
}
