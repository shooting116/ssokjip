// Sätteri hast 플러그인: 굵은 글씨(**…**)가 강조로 읽히지 않고 별표째 남은 곳을 <strong>으로 바꾼다.
//
// CommonMark 규칙상 닫는 ** 바로 앞이 문장부호(%, ), ” 등)이고 바로 뒤에 글자가 붙으면 강조로 인식되지 않는다.
// 한국어는 "**40%**입니다", "**±3㎡**는"처럼 조사가 바로 붙어서 이 경우가 흔하다.
// 글을 고치는 대신 여기서 한 번에 처리해, 앞으로 발행되는 글에도 같은 문제가 생기지 않게 한다.
//
// - 같은 부모 아래 나란히 있는 글자 노드를 한 줄로 이어서 본다(짝이 두 노드에 걸친 경우 대비).
// - code/pre 안은 건드리지 않는다. 짝 사이에 링크 같은 다른 요소가 끼어 있으면 그대로 둔다.
// - unwrapDel: true 이면 "10~50년 5.00~5.30%"처럼 물결표 두 개 사이가 취소선(<del>)으로 바뀐 것도 원래 글자로 되돌린다.
const RE = /\*\*([^*\s](?:[^*]*?[^*\s])?)\*\*/g;
const SKIP = new Set(['code', 'pre', 'script', 'style', 'kbd', 'samp']);

export default function strongFallback({ unwrapDel = false } = {}) {
  const isText = (n) => !!n && n.type === 'text';
  const isDel = (n) => unwrapDel && !!n && n.type === 'element' && n.tagName === 'del' && n.children.every(isText);
  const inRun = (n) => isText(n) || isDel(n);
  const valueOf = (n) => (isText(n) ? n.value : `~${n.children.map((c) => c.value).join('')}~`);

  // 취소선 하나를 물결표 + 내용 + 물결표로 되돌린다(안에 겹친 취소선도 같이)
  const unwrap = (del) => [
    { type: 'text', value: '~' },
    ...del.children.flatMap((c) => (c.type === 'element' && c.tagName === 'del' ? unwrap(c) : [c])),
    { type: 'text', value: '~' },
  ];

  // 같은 부모 아래 이어진 글자(와 취소선) 줄을 한 번에 처리한다. first는 그 줄의 첫 노드
  const handleRun = (first, ctx) => {
    const parent = ctx.parent(first);
    if (!parent || !Array.isArray(parent.children)) return;
    if (parent.type === 'element' && SKIP.has(parent.tagName)) return;
    if (unwrapDel && parent.type === 'element' && parent.tagName === 'del') return; // 취소선 안의 글자는 취소선을 풀 때 함께 다룬다

    const sibs = parent.children;
    const i = ctx.indexOf(first);
    if (i == null) return;
    if (i > 0 && inRun(sibs[i - 1])) return; // 이어진 줄의 첫 노드에서만 처리

    let j = i;
    while (j + 1 < sibs.length && inRun(sibs[j + 1])) j++;
    const run = sibs.slice(i, j + 1);
    const hasDel = run.some(isDel);
    const merged = run.map(valueOf).join('');
    RE.lastIndex = 0;
    if (!hasDel && !RE.test(merged)) return;

    const out = [];
    let last = 0;
    RE.lastIndex = 0;
    for (let m; (m = RE.exec(merged)); ) {
      if (m.index > last) out.push({ type: 'text', value: merged.slice(last, m.index) });
      out.push({ type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'text', value: m[1] }] });
      last = m.index + m[0].length;
    }
    if (last < merged.length) out.push({ type: 'text', value: merged.slice(last) });

    ctx.replaceNode(first, out);
    for (let k = i + 1; k <= j; k++) ctx.removeNode(sibs[k]);
  };

  return () => ({
    name: 'strong-fallback',
    text: handleRun,
    ...(unwrapDel
      ? {
          element: {
            filter: ['del'],
            visit(node, ctx) {
              // 글자만 든 취소선: 앞뒤 글자와 한 줄로 이어 처리(줄이 취소선으로 시작하는 경우 포함)
              if (isDel(node)) return handleRun(node, ctx);
              // 굵은 글씨 등이 섞인 취소선: 물결표를 되살리고 안의 내용은 그대로 둔다
              const parent = ctx.parent(node);
              if (parent && parent.type === 'element' && parent.tagName === 'del') return; // 겹친 취소선은 바깥 것을 풀 때 함께 푼다
              ctx.replaceNode(node, unwrap(node));
            },
          },
        }
      : {}),
  });
}
