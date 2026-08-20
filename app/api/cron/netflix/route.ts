/**
 * Vercel Cron 엔드포인트 — 넷플릭스 콘텐츠 동기화 + 자동 태깅.
 * 스케줄: vercel.json 의 crons 항목 (매일 새벽 3시 KST = UTC 18:00).
 *
 * 인증:
 *   - Authorization: Bearer <CRON_SECRET> 헤더 필요.
 *   - Vercel Cron이 자동으로 이 헤더를 붙여 호출함.
 *
 * 환경변수:
 *   - CRON_SECRET                    (필수)
 *   - RAPIDAPI_KEY                   (필수, fetch-netflix용)
 *   - ANTHROPIC_API_KEY              (필수, tag-contents용)
 *   - NEXT_PUBLIC_SUPABASE_URL       (필수)
 *   - SUPABASE_SERVICE_ROLE_KEY      (필수)
 *
 * 주의: 신규 콘텐츠가 많으면 Vercel maxDuration을 초과할 수 있음.
 *       Hobby 플랜은 60초, Pro 플랜은 300초까지 가능.
 */

import { NextResponse } from 'next/server';
import { fetchNetflixNewContents } from '@/scripts/fetch-netflix';
import { tagAndStoreContents } from '@/scripts/tag-contents';

// Vercel 서버리스 함수 최대 실행 시간 (초)
export const maxDuration = 300;


interface CronResult {
  ok: boolean;
  fetched?: number;
  tagged?: number;
  failed?: number;
  durationMs?: number;
  error?: string;
}

export async function GET(request: Request): Promise<NextResponse<CronResult>> {
  const start = Date.now();

  // 1. 인증
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/netflix] CRON_SECRET 환경변수 미설정');
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/netflix] 인증 실패');
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[cron/netflix] 시작:', new Date().toISOString());

  try {
    // 2. 신규/변경 콘텐츠 수집
    const newContents = await fetchNetflixNewContents();
    console.log(`[cron/netflix] 신규/변경: ${newContents.length}건`);

    // 3. Claude 태깅 + Supabase upsert
    const { total, tagged, failed } = await tagAndStoreContents(newContents);

    const durationMs = Date.now() - start;
    console.log(
      `[cron/netflix] 완료: total=${total} tagged=${tagged} failed=${failed} duration=${durationMs}ms`
    );

    return NextResponse.json({
      ok: true,
      fetched: total,
      tagged,
      failed,
      durationMs,
    });
  } catch (e) {
    const durationMs = Date.now() - start;
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/netflix] 실패:', e);
    return NextResponse.json(
      { ok: false, error: message, durationMs },
      { status: 500 }
    );
  }
}
