// 애드센스 수동 광고 단위.
// 게시자 ID와 광고 단위 번호는 페이지 소스에 그대로 드러나는 공개값이다(비밀 아님).
// 광고 스크립트는 Base.astro <head>에서 한 번만 불러온다.
//
// 자리는 세 종류로 나눈다(애드센스 보고서에서 자리별 수익을 따로 보기 위해):
//  - result: 계산기 결과 아래
//  - mid:    목록·본문 중간(리스트 4번째, 섹션 사이)
//  - bottom: 페이지 하단
export const AD_CLIENT = 'ca-pub-5901585061378578';
export const AD_SLOTS = {
  result: '9406769963', // 쏙집(반응형 결과아래)
  mid: '5596351616', // 쏙집(반응형 리스트 중간)
  bottom: '1328969394', // 쏙집(반응형 리스트 하단)
} as const;
export type AdPos = keyof typeof AD_SLOTS;

/**
 * 상단 띠 광고(제목 바로 아래, 높이 고정)에 쓰는 광고 단위.
 * 전용 단위를 만들기 전까지 '리스트 중간' 단위를 같이 쓴다 — 애드센스 보고서에서는 상단 수익이 '리스트 중간'에 합쳐져 보인다.
 * '상단' 단위를 따로 만들면 이 줄의 번호만 바꾼다.
 */
export const AD_TOP_SLOT: string = AD_SLOTS.mid;

/**
 * 광고 단위 마크업. 자바스크립트로 그리는 화면(계산기)에서 쓴다. Astro 페이지는 components/Ad.astro를 쓴다.
 * 애드센스가 준 코드의 속성을 그대로 둔다(반응형, 폰에서는 화면 폭).
 */
export const adHtml = (pos: AdPos) =>
  `<div class="ad-slot" data-ad="${pos}"><ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="${AD_SLOTS[pos]}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;

/** 아직 요청하지 않은 광고 단위를 한 번씩 요청한다(자바스크립트로 그린 화면용). 광고 차단 등으로 실패해도 무시한다. */
export function requestAds(el: ParentNode) {
  el.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* 무시 */
    }
  });
}
