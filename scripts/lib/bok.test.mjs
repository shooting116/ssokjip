import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeetings, parseBaseRates, decide, message, conversionCap } from './bok.mjs';

const row = (d, decided) => `<tr> <th scope="row">${d}</th> <td>${decided ? '<div class="fileGroupSet"><a href="/portal/cmmn/file/fileDown.do?x=1" title="국문보도자료.pdf">국문보도자료.pdf</a></div>' : ' '}</td> <td class="tal"><div class="listText"> </div></td> <td> </td> <td> </td> </tr>`;
const sched = (rows) => `<table><thead><tr><th scope="col">회의일자</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
const rateTable = (rows) => `<table><thead><tr><th scope="col" colspan="2">변경일자</th><th scope="col" class="fb">기준금리</th></tr></thead><tbody>${rows.map(([y, d, r]) => `<tr> <td class="fb">${y}</td> <td>${d}</td> <td>${r}</td> </tr>`).join('')}</tbody></table>`;

const RATES = parseBaseRates(rateTable([['2026', '08월 27일', '3.00'], ['2026', '07월 16일', '2.75'], ['2025', '05월 29일', '2.50']]));

test('일정 표: 날짜와 결정문 게시 여부', () => {
  const m = parseMeetings(sched([row('10월 22일(목)', true), row('11월 26일(목)', false)]), 2026);
  assert.deepEqual(m, [{ date: '2026-10-22', decided: true }, { date: '2026-11-26', decided: false }]);
});

test('금리 표: 최근이 먼저', () => {
  assert.deepEqual(RATES[0], { date: '2026-08-27', rate: 3 });
  assert.equal(RATES.length, 3);
});

test('결정문이 아직 없으면 알리지 않는다', () => {
  const meetings = parseMeetings(sched([row('10월 22일(목)', true), row('11월 26일(목)', false)]), 2026);
  assert.equal(decide({ meetings, rates: RATES, state: { lastDecision: '2026-10-22', rate: 3, rateDate: '2026-08-27' }, today: '2026-11-26' }), null);
});

test('결정문이 올라왔고 금리 표가 그대로면 유지', () => {
  const meetings = parseMeetings(sched([row('10월 22일(목)', true), row('11월 26일(목)', true)]), 2026);
  const ev = decide({ meetings, rates: RATES, state: { lastDecision: '2026-10-22', rate: 3, rateDate: '2026-08-27' }, today: '2026-11-26' });
  assert.deepEqual(ev, { date: '2026-11-26', rate: 3, prev: 3, kind: '유지', next: null });
  assert.equal(message(ev, 2), '[쏙집 기준금리 11/26] 3.00% 유지\n전월세 전환 법정 상한 그대로 연 5.0%\n기준금리 적힌 가이드 2편: 회의 날짜 문장 확인');
});

test('금리 표의 최근 변경일이 회의일이면 변경(인하)', () => {
  const meetings = parseMeetings(sched([row('10월 22일(목)', true), row('11월 26일(목)', true)]), 2026);
  const rates = parseBaseRates(rateTable([['2026', '11월 26일', '2.75'], ['2026', '08월 27일', '3.00']]));
  const ev = decide({ meetings, rates, state: { lastDecision: '2026-10-22', rate: 3, rateDate: '2026-08-27' }, today: '2026-11-26' });
  assert.equal(ev.kind, '인하'); assert.equal(ev.prev, 3); assert.equal(ev.rate, 2.75);
  const msg = message(ev, 2);
  assert.match(msg, /3\.00% → 2\.75% 인하/); assert.match(msg, /연 5\.0% → 4\.75%/); assert.ok(msg.length <= 200);
});

test('유지로 알린 뒤 금리 표가 늦게 바뀌면 변경으로 다시 알린다', () => {
  const meetings = parseMeetings(sched([row('11월 26일(목)', true)]), 2026);
  const rates = parseBaseRates(rateTable([['2026', '11월 26일', '3.25'], ['2026', '08월 27일', '3.00']]));
  const ev = decide({ meetings, rates, state: { lastDecision: '2026-11-26', rate: 3, rateDate: '2026-08-27' }, today: '2026-11-26' });
  assert.equal(ev.kind, '인상'); assert.equal(ev.date, '2026-11-26');
});

test('이미 알린 회의는 다시 알리지 않는다 · 다음 회의 날짜', () => {
  const meetings = parseMeetings(sched([row('01월 14일(목)', true), row('02월 25일(목)', false)]), 2027);
  const state = { lastDecision: '2027-01-14', rate: 3, rateDate: '2026-08-27' };
  assert.equal(decide({ meetings, rates: RATES, state, today: '2027-01-15' }), null);
  const ev = decide({ meetings, rates: RATES, state: { ...state, lastDecision: '2026-11-26' }, today: '2027-01-14' });
  assert.equal(ev.next, '2027-02-25'); assert.match(message(ev), /다음 회의 2\/25/);
});

test('전월세전환율 법정 상한: 기준금리 + 2%p, 최대 10%', () => {
  assert.equal(conversionCap(3), 5); assert.equal(conversionCap(2.75), 4.75); assert.equal(conversionCap(8.5), 10);
});
