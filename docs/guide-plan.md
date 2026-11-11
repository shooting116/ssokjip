# 가이드 글 발행 계획 — 80편, 하루 1편

- 1~23편은 2026-10-12~10-18에 하루 3편씩 공개 완료. 24편(실거래 vs 부동산원 지수)은 2026-10-20 19:00 공개.
- 25편부터는 **매일 1편**. 매일 아침 예약 작업이 아래 표에서 그날 날짜의 글을 써서 `publishAt: "YYYY-MM-DDT08:00:00+09:00"`, `published: true`로 커밋한다.
- 51~80편(11/16~12/15)은 2026-11-03에 추가. 78 지역주택조합은 판단 표현 없이 국토부·지자체 통계만, 80편은 `data/rules/README.md` 버전 기록과 출처로 쓴다.
- 쓰는 규칙은 `docs/guide-writing.md`. 표의 slug·category·cta는 제안값이며 글을 쓰면서 바꿔도 된다(바꾸면 표도 고친다).
- 쓴 날은 `상태` 칸을 `완료(slug)`로 바꾼다. 표가 바닥나면 운영자에게 알린다.

| 날짜 | # | 제목(안) | slug | category | cta | 상태 |
|---|---|---|---|---|---|---|
| 2026-10-21 | 25 | 전세가율 읽는 법 — 매매가 대비 전세가, 갭이 뜻하는 것 | jeonse-ratio | price | find | 완료(jeonse-ratio) |
| 2026-10-22 | 26 | 실거래 내역의 신고가·저층·탑층 표시 — 쏙집 단지 페이지 기준 | trade-tags | price | find | 완료(trade-tags) |
| 2026-10-23 | 27 | 등기부등본 읽는 법 — 갑구·을구, 근저당·가압류·신탁 | registry-reading | situation | none | 완료(registry-reading) |
| 2026-10-24 | 28 | 계약금·중도금·잔금 타임라인 — 대출 실행은 언제 맞추나 | payment-timeline | situation | calc | 완료(payment-timeline) |
| 2026-10-25 | 29 | 가계약금 — 법적 효력, 돌려받을 수 있는 경우 | provisional-deposit | situation | none | 완료(provisional-deposit) |
| 2026-10-26 | 30 | 매매계약서 특약 체크리스트 — 대출 불가 시 해제, 하자, 잔금일 변경 | contract-clauses | situation | none | 완료(contract-clauses) |
| 2026-10-27 | 31 | 잔금일 당일 순서 — 대출 실행 → 등기 → 전입·관리비 정산 | closing-day | situation | none | 완료(closing-day) |
| 2026-10-28 | 32 | 세입자 있는 집 사기 — 전세 끼고 매수할 때 계약 승계와 만기 | buying-with-tenant | situation | find | 완료(buying-with-tenant) |
| 2026-10-29 | 33 | 아파트 관리비 읽는 법 — K-apt로 단지별 비교 | maintenance-fee | price | find | 완료(maintenance-fee) |
| 2026-10-30 | 34 | 보유세 기초 — 재산세·종합부동산세, 공시가격과 실거래가 차이 | holding-tax | tax | none | 완료(holding-tax) |
| 2026-10-31 | 35 | 1주택 양도세 비과세 — 12억·보유·거주 요건 | capital-gains-exempt | tax | none | 완료(capital-gains-exempt) |
| 2026-11-01 | 36 | 일시적 2주택 — 비과세·취득세 중과 배제 요건 한 장 정리 | temporary-two-homes | tax | calc | 완료(temporary-two-homes) |
| 2026-11-02 | 37 | 부모 도움받아 집 살 때 — 증여세 공제, 차용증, 자금출처 | family-gift-loan | tax | none | 완료(family-gift-loan) |
| 2026-11-03 | 38 | 청년 대출 — 만 34세 이하 장래소득 인정 DSR과 정책대출 | youth-loans | loan | calc | 완료(youth-loans) |
| 2026-11-04 | 39 | 신혼부부 정책대출 — 디딤돌·버팀목 신혼 특례, 혼인 7년 기준 | newlywed-loans | loan | calc |완료(newlywed-loans) |
| 2026-11-05 | 40 | 주담대 갈아타기(대환) — 온라인 대환 인프라, 중도상환수수료 | refinancing | loan | calc | 완료(refinancing) |
| 2026-11-06 | 41 | 상환 방식 — 원리금균등·원금균등·체증식, 총이자 차이 | repayment-methods | loan | calc | 완료(repayment-methods) |
| 2026-11-07 | 42 | DSR에 잡히는 것들 — 신용대출·카드론·전세대출·학자금 | dsr-components | loan | calc | 완료(dsr-components) |
| 2026-11-08 | 43 | 보금자리론 2026 — 자격·한도·금리 구조 | bogeumjari-2026 | loan | calc | 완료(bogeumjari-2026) |
| 2026-11-09 | 44 | 입주 물량 보는 법 — 공급이 가격에 닿는 시차 | supply-pipeline | price | find | 완료(supply-pipeline) |
| 2026-11-10 | 45 | 미분양 통계 읽는 법 — 국토부 월간 통계, 준공 후 미분양 | unsold-stats | price | none | 완료(unsold-stats) |
| 2026-11-11 | 46 | 용적률·대지지분 — 재건축 사업성을 가르는 두 숫자 | far-and-land-share | future | find | 완료(far-and-land-share) |
| 2026-11-12 | 47 | 분양권 vs 입주권 — 차이, 세금, 대출 | presale-vs-occupancy-right | future | none | 완료(presale-vs-occupancy-right) |
| 2026-11-13 | 48 | 아파트 vs 주상복합 vs 오피스텔(아파텔) — 대출·세금·관리비 차이 | apt-vs-officetel | situation | calc | |
| 2026-11-14 | 49 | 세대수·동수·주차대수 — 건축물대장으로 단지 읽기 | building-register | price | find | |
| 2026-11-15 | 50 | 신축·준신축·구축 — 준공연도별 가격 차이와 확인할 것 | age-of-building | price | find | |
| 2026-11-16 | 51 | 청약 가점 계산 — 무주택 기간·부양가족·통장 가입기간 | subscription-points | situation | none | |
| 2026-11-17 | 52 | 특별공급 종류 — 신혼·생애최초·다자녀·노부모, 소득 기준 | special-supply | situation | calc | |
| 2026-11-18 | 53 | 전세사기 예방 체크리스트 — 깡통전세·선순위·확정일자 | jeonse-fraud-check | situation | find | |
| 2026-11-19 | 54 | 스트레스 DSR — 가산금리가 한도를 얼마나 줄이나 | stress-dsr | loan | calc | |
| 2026-11-20 | 55 | 전월세 전환율 — 전세를 월세로 바꾸면 얼마인가, 반전세 | rent-conversion | price | none | |
| 2026-11-21 | 56 | 상속받은 집 — 취득세·양도세 기준일, 비과세 특례 | inherited-home | tax | none | |
| 2026-11-22 | 57 | 분양가 상한제와 실거주 의무·전매제한 | price-cap-rules | future | none | |
| 2026-11-23 | 58 | 전세보증금 반환보증(HUG·HF·SGI) — 가입 조건과 90% 기준 | deposit-guarantee | situation | find | |
| 2026-11-24 | 59 | 전세대출 기초 — 버팀목·일반 전세대출, DSR에 들어가나 | jeonse-loans | loan | calc | |
| 2026-11-25 | 60 | 지역별 변동률 읽는 법 — 부동산원 주간지수와 쏙집 지역별 페이지 | weekly-index-reading | price | ref | |
| 2026-11-26 | 61 | 부부 공동명의 — 취득·보유·양도세가 어떻게 달라지나 | joint-ownership | tax | none | |
| 2026-11-27 | 62 | 무순위 청약 — 자격, 규제지역과 비규제지역 차이 | unranked-subscription | situation | none | |
| 2026-11-28 | 63 | 중도상환수수료 — 계산법과 면제되는 경우 | prepayment-fee | loan | calc | |
| 2026-11-29 | 64 | 실거래 취소·해제 건 — 공개 시스템에서 걸러 보는 법 | cancelled-trades | price | find | |
| 2026-11-30 | 65 | 임대차 3법 — 계약갱신요구권·전월세상한제·신고제 | lease-three-laws | situation | none | |
| 2026-12-01 | 66 | 3기 신도시 입주 일정 — 지구별 분양·입주 시점 | third-newtown-timeline | future | find | |
| 2026-12-02 | 67 | 신용점수와 주담대 금리 — 가산금리·우대금리 구조 | credit-score-rate | loan | calc | |
| 2026-12-03 | 68 | 직거래와 중개거래 — 실거래 표기 차이, 가족 간 거래 | direct-vs-brokered | price | none | |
| 2026-12-04 | 69 | 주택임대소득 과세 — 연 2천만 원 기준, 월세 받을 때 | rental-income-tax | tax | none | |
| 2026-12-05 | 70 | 청약 당첨 후 자금 흐름 — 계약금·중도금 대출·잔금 | subscription-funding | loan | calc | |
| 2026-12-06 | 71 | 세대당 주차·초등학교 거리·역 거리 — 쏙집 필터 데이터의 출처와 한계 | filter-data-sources | price | find | |
| 2026-12-07 | 72 | 장기수선충당금 — 세입자가 돌려받는 돈, 매도 때 정산 | long-term-repair-fund | situation | none | |
| 2026-12-08 | 73 | 공공분양 vs 민간분양 — 나눔형·선택형·일반형 | public-vs-private-presale | future | none | |
| 2026-12-09 | 74 | 생활안정자금 주담대 — 한도와 규제지역 제한 | living-stability-loan | loan | calc | |
| 2026-12-10 | 75 | 연말정산 주택 항목 — 주담대 이자·전세대출 원리금·청약통장 공제 | year-end-housing-deductions | tax | none | |
| 2026-12-11 | 76 | 평형별 ㎡당 가격이 다른 이유 — 소형·중형·대형 | price-per-area-by-size | price | find | |
| 2026-12-12 | 77 | 금리 지표 읽기 — 코픽스·금융채·기준금리, ECOS로 보기 | cofix-and-rates | loan | ref | |
| 2026-12-13 | 78 | 지역주택조합 — 구조와 통계로 보는 진행률 | regional-housing-association | future | none | |
| 2026-12-14 | 79 | 같은 단지 안 가격 차이 — 층·향·동 격차 읽기 | floor-direction-premium | price | find | |
| 2026-12-15 | 80 | 2026년 바뀐 부동산 제도 정리 — 대출·세금·규제 한 장(규칙표 버전 기록·출처 그대로) | changes-2026-review | tax | calc | |

## 이미 공개된 글(겹치지 않게 참고)

how-to-read-trades, ltv-dsr-dti, acquisition-tax, first-home-2026, why-six-month-median, brokerage-fee, bond-and-registration, area-and-pyeong, yoy-pitfalls, what-is-leading-complex, volume-and-price, regulation-map-2026, moving-up, funding-plan, fixed-vs-variable, dual-income, gtx-timeline-2026, redevelopment-stages, newtown1-pilot, station-radius, metro-rail-2026-2031, remodeling-vs-rebuild, monthly-payment-feel, trades-vs-reb-index
