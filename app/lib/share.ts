import type { Menu, ScoredMenu } from '@/app/types';

/** 결과 상위 3개 메뉴 id를 "-"로 연결한 파라미터 반환 */
export function resultsToShareParam(results: ScoredMenu[]): string {
  return results.map((r) => r.menu.id).join('-');
}

/** q 파라미터 파싱 → menus에서 해당 메뉴 찾아 ScoredMenu[] 반환 */
export function parseShareParam(q: string, menus: Menu[]): ScoredMenu[] {
  return q
    .split('-')
    .map((idStr) => menus.find((m) => m.id === Number(idStr)))
    .filter((m): m is Menu => m !== undefined)
    .map((menu) => ({ menu, score: 0 }));
}
