// Sätteri hast 플러그인: 가이드 본문의 <table>을 <div class="tbl">로 감싼다.
// 폰에서 넓은 표는 이 상자 안에서만 가로 스크롤되고 페이지는 밀리지 않는다.
export default function tableWrap() {
  return () => ({
    name: 'table-wrap',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        ctx.wrapNode(node, { type: 'element', tagName: 'div', properties: { className: ['tbl'] }, children: [] });
      },
    },
  });
}
