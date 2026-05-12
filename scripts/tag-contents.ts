/**
 * Claude API를 사용해 넷플릭스 콘텐츠에 태그를 부여하고 Supabase에 upsert.
 *
 * 호출 방식:
 *   import { tagAndStoreContents } from './tag-contents';
 *   await tagAndStoreContents(newContents);
 *
 * 환경변수:
 *   - ANTHROPIC_API_KEY              (필수)
 *   - NEXT_PUBLIC_SUPABASE_URL       (필수)
 *   - SUPABASE_SERVICE_ROLE_KEY      (필수)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NetflixContent } from './fetch-netflix';

// ── 태그 정의 ──────────────────────────────────────────────────────────────────

const TAG_KEYS = [
  // 감정/분위기
  'lightness', 'tension', 'emotion', 'horror', 'laughter', 'romance', 'healing',
  // 시청상황
  'concentration', 'violence', 'adult', 'background_watch', 'episode_length',
  // 함께보기
  'with_partner', 'with_family', 'with_friend', 'solo',
] as const;

export type TagKey = (typeof TAG_KEYS)[number];
export type Tags = Record<TagKey, number>;

// ── 프롬프트 (고정 부분, 캐싱 대상) ──────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 넷플릭스 콘텐츠를 분류하는 전문가입니다.
각 콘텐츠에 대해 정확히 16개의 태그를 0~10 정수로 평가해야 합니다.
설명이나 부연 없이 JSON 객체만 반환하세요.`;

const TAG_CRITERIA = `각 태그는 0~10 정수값으로 평가합니다.

[감정/분위기]
- lightness: 가벼움 (0=매우 무거움/심각, 10=매우 가볍고 유쾌)
- tension: 긴장감/스릴 (0=없음, 10=극도로 긴장)
- emotion: 감동/눈물 유발 (0=없음, 10=강렬)
- horror: 공포/불안감 (0=없음, 10=극도로 무서움)
- laughter: 웃음/유머 (0=없음, 10=매우 웃김)
- romance: 로맨스 감성 (0=없음, 10=매우 로맨틱)
- healing: 힐링/따뜻함 (0=없음, 10=매우 따뜻하고 위로됨)

[시청상황]
- concentration: 집중도 필요 (0=틀어만 놔도 됨, 10=자막 집중 필수)
- violence: 폭력/잔인함 수위 (0=없음, 10=매우 잔인)
- adult: 성인 콘텐츠 수위 (0=전체관람가, 10=성인 전용)
- background_watch: 배경으로 틀어두기 적합도 (0=부적합, 10=매우 적합)
- episode_length: 편수 부담감 (0=짧고 부담없음, 10=긴 정주행 필요)

[함께보기]
- with_partner: 연인과 보기 적합도 (0=부적합, 10=매우 적합)
- with_family: 가족과 보기 적합도 (0=부적합, 10=매우 적합)
- with_friend: 친구와 보기 적합도 (0=부적합, 10=매우 적합)
- solo: 혼자 보기 적합도 (0=부적합, 10=매우 적합)

반환 형식 (정확히 이 16개 키만 포함하는 JSON):
{"lightness":7,"tension":3,"emotion":8,"horror":0,"laughter":6,"romance":4,"healing":5,"concentration":5,"violence":2,"adult":3,"background_watch":4,"episode_length":3,"with_partner":7,"with_family":3,"with_friend":8,"solo":7}`;

// ── 환경 ───────────────────────────────────────────────────────────────────────

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다`);
  return value;
}

function getAnthropic(): Anthropic {
  return new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') });
}

function getSupabase(): SupabaseClient {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}

// ── 단일 콘텐츠 태깅 ───────────────────────────────────────────────────────────

function buildUserPrompt(content: NetflixContent): string {
  return [
    `제목: ${content.title}`,
    content.original_title ? `원제: ${content.original_title}` : '',
    `유형: ${content.show_type === 'series' ? '시리즈' : '영화'} (${content.content_type})`,
    `장르: ${content.genres.join(', ') || '미상'}`,
    content.runtime ? `러닝타임: ${content.runtime}분` : '',
    content.episode_count ? `에피소드 수: ${content.episode_count}` : '',
    content.release_year ? `개봉/방영 연도: ${content.release_year}` : '',
    `줄거리: ${content.overview ?? '정보 없음'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function isValidTags(obj: unknown): obj is Tags {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  for (const key of TAG_KEYS) {
    const v = rec[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10) return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 한 콘텐츠에 대해 Claude로 태그 산출. 429 발생 시 자동 재시도. */
async function tagOne(anthropic: Anthropic, content: NetflixContent): Promise<Tags | null> {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        // 시스템 블록 둘 다 캐싱 → 모든 콘텐츠에서 동일 → cache hit 누적
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: TAG_CRITERIA, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
          { role: 'user', content: buildUserPrompt(content) },
        ],
      });
      return parseResponse(content, response);
    } catch (e) {
      // Rate limit이면 retry-after만큼 대기 후 재시도
      if (e instanceof Anthropic.RateLimitError) {
        const retryAfterHeader = e.headers?.get?.('retry-after');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
        const waitMs = Math.max(retryAfter, 2) * 1000;
        console.warn(
          `[tag] ${content.id} (${content.title}): rate limit, ${waitMs}ms 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(waitMs);
        attempt++;
        continue;
      }
      // 다른 에러는 즉시 실패 처리
      console.error(`[tag] ${content.id} (${content.title}): API 호출 실패`, e);
      return null;
    }
  }
  console.error(`[tag] ${content.id} (${content.title}): 재시도 한도 초과`);
  return null;
}

/** Claude 응답에서 태그 객체 추출 */
function parseResponse(content: NetflixContent, response: Anthropic.Message): Tags | null {
  try {

    // 응답에서 text 블록 추출
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.warn(`[tag] ${content.id} (${content.title}): 텍스트 블록 없음`);
      return null;
    }

    // JSON 파싱 — 앞뒤로 설명이 붙어도 첫 { ~ 마지막 } 사이만 추출
    const raw = textBlock.text.trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      console.warn(`[tag] ${content.id} (${content.title}): JSON 형식 아님`);
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (e) {
      console.warn(`[tag] ${content.id} (${content.title}): JSON 파싱 실패`, e);
      return null;
    }

    if (!isValidTags(parsed)) {
      console.warn(`[tag] ${content.id} (${content.title}): 태그 검증 실패`, parsed);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error(`[tag] ${content.id} (${content.title}): 응답 파싱 실패`, e);
    return null;
  }
}

// ── 순차 처리 (Tier 1 rate limit 50 RPM 대응) ─────────────────────────────────

/** 한 번의 cron 실행에서 처리할 최대 콘텐츠 수.
 *  Tier 1 무료 한도(50 RPM)와 Vercel maxDuration(300s)을 고려한 보수적 값.
 *  처리 못한 콘텐츠는 다음 cron에서 자동으로 이어받음. */
const MAX_PER_RUN = 40;

/** 호출 사이 최소 대기 시간 (ms). 50 RPM = 분당 50회 = 평균 1200ms 간격. */
const MIN_INTERVAL_MS = 1500;

async function processSequentially<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    const start = Date.now();
    const result = await worker(items[i]);
    results.push(result);
    if ((i + 1) % 5 === 0 || i === items.length - 1) {
      console.log(`[tag] 진행: ${i + 1} / ${items.length}`);
    }
    // 다음 호출 전 최소 간격 확보 (rate limit 보호)
    if (i < items.length - 1) {
      const elapsed = Date.now() - start;
      const wait = MIN_INTERVAL_MS - elapsed;
      if (wait > 0) await sleep(wait);
    }
  }
  return results;
}

// ── 메인: 태깅 + Supabase upsert ───────────────────────────────────────────────

export async function tagAndStoreContents(contents: NetflixContent[]): Promise<{
  total: number;
  tagged: number;
  failed: number;
}> {
  if (contents.length === 0) {
    console.log('[tag] 처리할 콘텐츠 없음');
    return { total: 0, tagged: 0, failed: 0 };
  }

  const anthropic = getAnthropic();
  const supabase = getSupabase();

  // 한 번에 처리할 콘텐츠 수 제한 (Tier 1 rate limit + Vercel timeout 보호)
  const toProcess = contents.slice(0, MAX_PER_RUN);
  if (contents.length > MAX_PER_RUN) {
    console.log(
      `[tag] ${contents.length}건 중 ${MAX_PER_RUN}건만 이번 실행에서 처리. 나머지는 다음 cron에서.`
    );
  }

  const taggedRows = await processSequentially(toProcess, async (content) => {
    const tags = await tagOne(anthropic, content);
    if (!tags) return { content, tags: null };
    return { content, tags };
  });

  // upsert 데이터 준비 — 태깅 성공한 것만
  const upsertRows = taggedRows
    .filter((r): r is { content: NetflixContent; tags: Tags } => r.tags !== null)
    .map(({ content, tags }) => ({
      ...content,
      tags,
      is_active: true,
      last_updated: new Date().toISOString(),
    }));

  if (upsertRows.length > 0) {
    // 큰 배치는 1000개씩 잘라서 upsert
    const CHUNK = 500;
    for (let i = 0; i < upsertRows.length; i += CHUNK) {
      const chunk = upsertRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('netflix_contents')
        .upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`[tag] upsert 실패 (chunk ${i / CHUNK}):`, error);
        // 그래도 다음 청크 시도
      } else {
        console.log(`[tag] upsert 완료: ${chunk.length}건`);
      }
    }
  }

  const tagged = upsertRows.length;
  const failed = toProcess.length - tagged;
  const skipped = contents.length - toProcess.length;
  console.log(
    `[tag] 완료: 발견 ${contents.length} / 처리 ${toProcess.length} / 성공 ${tagged} / 실패 ${failed} / 미처리 ${skipped}`
  );
  return { total: contents.length, tagged, failed };
}

// ── CLI 단독 실행 지원 (테스트용) ───────────────────────────────────────────────

if (require.main === module) {
  import('./fetch-netflix').then(async ({ fetchNetflixNewContents }) => {
    try {
      const contents = await fetchNetflixNewContents();
      const result = await tagAndStoreContents(contents);
      console.log('결과:', result);
      process.exit(0);
    } catch (e) {
      console.error('실패:', e);
      process.exit(1);
    }
  });
}
