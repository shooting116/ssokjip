// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import tableWrap from './src/lib/md/satteri-table-wrap.mjs';

// 쏙집 — korea-rich.com
// 정적 빌드. 단지 페이지가 2만 개를 넘기면 3단계에서 Cloudflare 어댑터로 요청 시 생성(하이브리드)을 켠다.
export default defineConfig({
  site: 'https://korea-rich.com',
  // PREVIEW_GUIDES=1 이면 예약 중인 가이드도 빌드(로컬 확인용). 서버 빌드에는 넣지 않는다.
  vite: { define: { 'import.meta.env.PREVIEW_GUIDES': JSON.stringify(process.env.PREVIEW_GUIDES ?? '') } },
  markdown: { processor: satteri({ hastPlugins: [tableWrap()] }) },
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // 2026-11-03 애드센스 '가치가 별로 없는 콘텐츠' 거절 대응: 템플릿 페이지(단지 상세 1.7만·예산별 333)는 noindex + 사이트맵 제외.
      // 검색엔진에는 가이드·계산기·집 찾기·지역별·레퍼런스만 보이게 한다. 비교 페이지는 noindex(입력 전엔 빈 화면).
      filter: (page) => !/\/(apt|budget|compare)\//.test(page),
    }),
  ],
  // 2026-10-19 시도 표기 변경(광주 → 전남광주): 옛 주소는 새 주소로 (예산별 페이지 금액 2만~20만, 5천 단위)
  redirects: Object.fromEntries([
    ['/ref/광주/', '/ref/전남광주/'],
    ...Array.from({ length: 37 }, (_, i) => 20000 + i * 5000).map((a) => [`/budget/${a}/광주/`, `/budget/${a}/전남광주/`]),
  ]),
  build: { format: 'directory' },
});
