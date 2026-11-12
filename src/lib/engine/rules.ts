// 규칙표 로더. 시행일별 버전 중 기준일에 맞는 최신 버전을 고른다.
import v20260930 from '../../../data/rules/v2026-09-30.json' with { type: 'json' };
import v20261015 from '../../../data/rules/v2026-10-15.json' with { type: 'json' };
import v20261109 from '../../../data/rules/v2026-11-09.json' with { type: 'json' };
import v20261113 from '../../../data/rules/v2026-11-13.json' with { type: 'json' };

// 타입은 최신 버전 기준. 옛 버전에는 나중에 추가된 필드가 없을 수 있으므로 그런 필드는 쓰는 쪽에서 `?? null`로 받는다.
export type Rules = typeof v20261113;

const versions: Rules[] = [v20260930 as unknown as Rules, v20261015 as unknown as Rules, v20261109 as unknown as Rules, v20261113];

/** 기준일(기본 오늘)에 적용되는 규칙표 */
export function getRules(asOf: Date = new Date()): Rules {
  const key = new Date(asOf.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);   // 시행일은 KST 기준. 빌드 서버(UTC)에서 새벽 빌드가 하루 늦게 고르지 않게
  const applicable = versions
    .filter((r) => r.meta.effective_from <= key)
    .sort((a, b) => (a.meta.effective_from < b.meta.effective_from ? 1 : -1));
  return applicable[0] ?? versions[versions.length - 1];
}

export function listRuleVersions(): { version: string; effective_from: string }[] {
  return versions.map((r) => ({ version: r.meta.version, effective_from: r.meta.effective_from }));
}
