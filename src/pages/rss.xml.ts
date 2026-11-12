// 공부 가이드 RSS (최신 50편). 네이버 서치어드바이저·구글 등이 새 글을 빨리 가져가도록 한다.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORY, isLive } from '../lib/ui/guide.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? 'https://korea-rich.com/').replace(/\/$/, '');
  const posts = (await getCollection('guide')).filter(isLive).sort((a, b) => b.data.publishAt.localeCompare(a.data.publishAt)).slice(0, 50);
  const items = posts.map((e) => `    <item>
      <title>${esc(e.data.title)}</title>
      <link>${base}/guide/${e.id}/</link>
      <guid isPermaLink="true">${base}/guide/${e.id}/</guid>
      <pubDate>${new Date(e.data.publishAt).toUTCString()}</pubDate>
      <category>${esc(CATEGORY[e.data.category]?.name ?? e.data.category)}</category>
      <description>${esc(e.data.description)}</description>
    </item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>쏙집 공부 가이드</title>
    <link>${base}/guide/</link>
    <description>집 사기 전에 알아야 할 대출·세금·시세 읽는 법을 숫자와 출처로 정리한 글</description>
    <language>ko</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
${posts.length ? `    <lastBuildDate>${new Date(posts[0].data.publishAt).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
