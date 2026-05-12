/**
 * Streaming Availability API에서 한국 넷플릭스 콘텐츠 목록을 가져와
 * Supabase에 저장된 기존 데이터와 비교 → 신규/변경분만 반환.
 *
 * 호출 방식:
 *   import { fetchNetflixNewContents } from './fetch-netflix';
 *   const newOrChanged = await fetchNetflixNewContents();
 *
 * 환경변수:
 *   - RAPIDAPI_KEY                   (필수)
 *   - NEXT_PUBLIC_SUPABASE_URL       (필수)
 *   - SUPABASE_SERVICE_ROLE_KEY      (필수, 서버 전용)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── 타입 ───────────────────────────────────────────────────────────────────────

export type ShowType = 'movie' | 'series';
export type ContentType = 'movie' | 'drama' | 'animation' | 'documentary' | 'variety';

export interface NetflixContent {
  id: string;
  title: string;
  original_title: string | null;
  show_type: ShowType;
  content_type: ContentType;
  overview: string | null;
  release_year: number | null;
  runtime: number | null;
  episode_count: number | null;
  is_ended: boolean | null;
  country: string[];
  genres: string[];
  rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  netflix_link: string | null;
}

interface RawApiItem {
  itemType?: string;
  showType?: string;
  id?: string;
  title?: string;
  originalTitle?: string;
  overview?: string;
  releaseYear?: number;
  firstAirYear?: number;
  runtime?: number;
  episodeCount?: number;
  seasonCount?: number;
  seasons?: Array<{ episodes?: Array<{ runtime?: number }> }>;
  isEnded?: boolean;
  creators?: string[];
  cast?: string[];
  rating?: number;
  imageSet?: {
    verticalPoster?: { w480?: string; w600?: string; w720?: string };
    horizontalBackdrop?: { w1080?: string; w1280?: string };
  };
  genres?: Array<{ id?: string; name?: string } | string>;
  countries?: string[];
  streamingOptions?: {
    kr?: Array<{ service?: { id?: string }; link?: string }>;
  };
}

interface ApiResponse {
  shows?: RawApiItem[];
  hasMore?: boolean;
  nextCursor?: string;
}

// ── 헬퍼 ───────────────────────────────────────────────────────────────────────

const API_HOST = 'streaming-availability.p.rapidapi.com';
const API_BASE = `https://${API_HOST}/shows/search/filters`;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다`);
  return value;
}

function getSupabase(): SupabaseClient {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}

/** show_type + 장르를 기준으로 더 세분화된 content_type 결정 */
function inferContentType(showType: ShowType, genres: string[]): ContentType {
  const g = genres.map((s) => s.toLowerCase());
  const has = (kw: string) => g.some((x) => x.includes(kw));

  if (has('documentary') || has('다큐')) return 'documentary';
  if (has('animation') || has('애니')) return 'animation';
  if (has('reality') || has('variety') || has('talk') || has('예능')) return 'variety';

  if (showType === 'series') return 'drama';
  return 'movie';
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function pickGenreNames(raw: RawApiItem['genres']): string[] {
  return safeArray<{ id?: string; name?: string } | string>(raw)
    .map((g) => (typeof g === 'string' ? g : g?.name ?? ''))
    .filter((s): s is string => !!s);
}

function pickPoster(raw: RawApiItem['imageSet']): string | null {
  return (
    raw?.verticalPoster?.w720 ??
    raw?.verticalPoster?.w600 ??
    raw?.verticalPoster?.w480 ??
    null
  );
}

function pickBackdrop(raw: RawApiItem['imageSet']): string | null {
  return raw?.horizontalBackdrop?.w1280 ?? raw?.horizontalBackdrop?.w1080 ?? null;
}

function pickNetflixLink(raw: RawApiItem['streamingOptions']): string | null {
  const kr = safeArray(raw?.kr) as Array<{ service?: { id?: string }; link?: string }>;
  const netflix = kr.find((opt) => opt.service?.id === 'netflix');
  return netflix?.link ?? null;
}

/** 시리즈의 평균 에피소드 러닝타임 계산 */
function calcAvgEpisodeRuntime(raw: RawApiItem): number | null {
  if (raw.runtime && raw.runtime > 0) return raw.runtime;
  const seasons = safeArray<{ episodes?: Array<{ runtime?: number }> }>(raw.seasons);
  const runtimes: number[] = [];
  for (const season of seasons) {
    for (const ep of safeArray<{ runtime?: number }>(season?.episodes)) {
      if (typeof ep?.runtime === 'number' && ep.runtime > 0) runtimes.push(ep.runtime);
    }
  }
  if (runtimes.length === 0) return null;
  return Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length);
}

/** API 응답을 DB 행 형태로 정규화 */
function normalize(raw: RawApiItem): NetflixContent | null {
  if (!raw.id || !raw.title) return null;

  const showType: ShowType = raw.showType === 'series' ? 'series' : 'movie';
  const genres = pickGenreNames(raw.genres);
  const content_type = inferContentType(showType, genres);

  return {
    id: raw.id,
    title: raw.title,
    original_title: raw.originalTitle ?? null,
    show_type: showType,
    content_type,
    overview: raw.overview ?? null,
    release_year: raw.releaseYear ?? raw.firstAirYear ?? null,
    runtime: calcAvgEpisodeRuntime(raw),
    episode_count: showType === 'series' ? raw.episodeCount ?? null : null,
    is_ended: showType === 'series' ? raw.isEnded ?? null : null,
    country: safeArray<string>(raw.countries),
    genres,
    rating: typeof raw.rating === 'number' ? Math.round(raw.rating) : null,
    poster_url: pickPoster(raw.imageSet),
    backdrop_url: pickBackdrop(raw.imageSet),
    netflix_link: pickNetflixLink(raw.streamingOptions),
  };
}

// ── 메인 페치 ──────────────────────────────────────────────────────────────────

async function fetchPage(cursor?: string): Promise<ApiResponse> {
  const apiKey = getEnv('RAPIDAPI_KEY');
  const params = new URLSearchParams({
    country: 'kr',
    catalogs: 'netflix',
    order_by: 'original_title',
    order_direction: 'asc',
  });
  if (cursor) params.set('cursor', cursor);

  const url = `${API_BASE}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': API_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ApiResponse;
}

/** 전체 페이지를 순회하며 한국 넷플릭스 콘텐츠 목록 수집 */
async function fetchAllContents(): Promise<NetflixContent[]> {
  const result: NetflixContent[] = [];
  let cursor: string | undefined;
  let pageNum = 0;
  const MAX_PAGES = 200; // 안전 가드

  do {
    pageNum++;
    if (pageNum > MAX_PAGES) {
      console.warn(`[fetch-netflix] 최대 페이지(${MAX_PAGES}) 도달. 조기 종료.`);
      break;
    }
    try {
      const page = await fetchPage(cursor);
      const items = safeArray<RawApiItem>(page.shows);
      for (const raw of items) {
        const normalized = normalize(raw);
        if (normalized) result.push(normalized);
      }
      cursor = page.hasMore ? page.nextCursor : undefined;
      console.log(`[fetch-netflix] page ${pageNum}: +${items.length} (total ${result.length})`);
    } catch (e) {
      console.error(`[fetch-netflix] page ${pageNum} 실패:`, e);
      break; // 한 페이지 실패하면 중단 (다음 실행에서 재시도)
    }
  } while (cursor);

  return result;
}

// ── 기존 데이터와 비교 (신규/변경분 추출) ───────────────────────────────────────

/** 비교용 시그니처 — 핵심 필드만 직렬화 (null/undefined 모두 허용) */
interface SignatureFields {
  title?: string | null;
  overview?: string | null;
  runtime?: number | null;
  episode_count?: number | null;
  is_ended?: boolean | null;
  rating?: number | null;
  genres?: string[] | null;
}

function signature(c: SignatureFields): string {
  return JSON.stringify({
    title: c.title ?? null,
    overview: c.overview ?? null,
    runtime: c.runtime ?? null,
    episode_count: c.episode_count ?? null,
    is_ended: c.is_ended ?? null,
    rating: c.rating ?? null,
    genres: c.genres ?? [],
  });
}

interface ExistingRow {
  id: string;
  title: string | null;
  overview: string | null;
  runtime: number | null;
  episode_count: number | null;
  is_ended: boolean | null;
  rating: number | null;
  genres: string[] | null;
  tags: Record<string, unknown> | null;
}

async function loadExisting(supabase: SupabaseClient): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('netflix_contents')
      .select('id, title, overview, runtime, episode_count, is_ended, rating, genres, tags')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) map.set(row.id, row as ExistingRow);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

/** 신규 + 의미있는 변경분 추출 (Claude 태깅 대상) */
export async function fetchNetflixNewContents(): Promise<NetflixContent[]> {
  const supabase = getSupabase();
  const [allFromApi, existing] = await Promise.all([fetchAllContents(), loadExisting(supabase)]);

  const newOrChanged: NetflixContent[] = [];
  for (const item of allFromApi) {
    const prev = existing.get(item.id);
    if (!prev) {
      newOrChanged.push(item);
      continue;
    }
    // 기존 행에 태그가 없으면 재태깅, 또는 시그니처가 달라지면 재태깅
    const hasTags = prev.tags && Object.keys(prev.tags).length > 0;
    if (!hasTags || signature(prev) !== signature(item)) {
      newOrChanged.push(item);
    }
  }

  console.log(
    `[fetch-netflix] API ${allFromApi.length}건 / DB ${existing.size}건 / 신규·변경 ${newOrChanged.length}건`
  );
  return newOrChanged;
}

// ── CLI 단독 실행 지원 ──────────────────────────────────────────────────────────

if (require.main === module) {
  fetchNetflixNewContents()
    .then((contents) => {
      console.log(`완료: ${contents.length}건의 신규/변경 콘텐츠 발견`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('실패:', e);
      process.exit(1);
    });
}
