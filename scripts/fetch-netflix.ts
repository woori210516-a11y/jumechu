/**
 * TMDB API에서 한국 넷플릭스 콘텐츠 목록을 가져와
 * Supabase에 저장된 기존 데이터와 비교 → 신규/변경분만 반환.
 *
 * 호출 방식:
 *   import { fetchNetflixNewContents } from './fetch-netflix';
 *   const newOrChanged = await fetchNetflixNewContents();
 *
 * 환경변수:
 *   - TMDB_BEARER_TOKEN              (필수, "API Read Access Token v4")
 *   - NEXT_PUBLIC_SUPABASE_URL       (필수)
 *   - SUPABASE_SERVICE_ROLE_KEY      (필수, 서버 전용)
 *
 * TMDB API 메모:
 *   - Netflix provider_id = 8
 *   - 한국 region = 'KR', 한국어 language = 'ko-KR'
 *   - discover/movie, discover/tv 결과를 페이지네이션
 *   - 일일 한도 사실상 없음 (Be reasonable 정책)
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

// TMDB 응답 타입 (필요 필드만)
interface TmdbMovieDiscover {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
  origin_country?: string[];
}

interface TmdbTvDiscover {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
  origin_country?: string[];
}

interface TmdbDiscoverResponse<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenreList {
  genres: TmdbGenre[];
}

interface TmdbMovieDetail {
  id: number;
  runtime: number | null;
  genres: TmdbGenre[];
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
}

interface TmdbTvDetail {
  id: number;
  number_of_episodes: number | null;
  number_of_seasons: number | null;
  episode_run_time: number[];
  in_production: boolean;
  status: string;
  genres: TmdbGenre[];
  origin_country?: string[];
}

// ── 환경 ───────────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3';
const NETFLIX_PROVIDER_ID = 8;
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

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

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getEnv('TMDB_BEARER_TOKEN')}`,
    accept: 'application/json',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 헬퍼 ───────────────────────────────────────────────────────────────────────

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function yearFromDate(date?: string): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** 0.0~10.0 평점 → 0~100 정수 */
function ratingToInt(vote: number): number | null {
  if (!Number.isFinite(vote) || vote <= 0) return null;
  return Math.round(vote * 10);
}

function posterUrl(path: string | null): string | null {
  return path ? `${POSTER_BASE}${path}` : null;
}

function backdropUrl(path: string | null): string | null {
  return path ? `${BACKDROP_BASE}${path}` : null;
}

/** show_type + 장르 ID/이름으로 content_type 추론 */
function inferContentType(showType: ShowType, genreIds: number[], genreNames: string[]): ContentType {
  // TMDB 장르 ID
  const DOCUMENTARY = 99;
  const ANIMATION = 16;
  const REALITY = 10764;
  const TALK = 10767;

  if (genreIds.includes(DOCUMENTARY)) return 'documentary';
  if (genreIds.includes(ANIMATION)) return 'animation';
  if (showType === 'series' && (genreIds.includes(REALITY) || genreIds.includes(TALK))) {
    return 'variety';
  }
  // 이름 기반 백업
  const nameStr = genreNames.join(' ').toLowerCase();
  if (nameStr.includes('다큐')) return 'documentary';
  if (nameStr.includes('애니')) return 'animation';
  if (showType === 'series' && (nameStr.includes('예능') || nameStr.includes('리얼리티'))) {
    return 'variety';
  }
  return showType === 'series' ? 'drama' : 'movie';
}

// ── 장르 매핑 (캐시) ───────────────────────────────────────────────────────────

let movieGenreMap: Map<number, string> | null = null;
let tvGenreMap: Map<number, string> | null = null;

async function loadGenreMaps(): Promise<void> {
  const [movieRes, tvRes] = await Promise.all([
    fetch(`${TMDB_BASE}/genre/movie/list?language=ko-KR`, { headers: authHeaders() }),
    fetch(`${TMDB_BASE}/genre/tv/list?language=ko-KR`, { headers: authHeaders() }),
  ]);
  if (!movieRes.ok) throw new Error(`TMDB genre/movie/list 실패: ${movieRes.status}`);
  if (!tvRes.ok) throw new Error(`TMDB genre/tv/list 실패: ${tvRes.status}`);

  const movieData = (await movieRes.json()) as TmdbGenreList;
  const tvData = (await tvRes.json()) as TmdbGenreList;

  movieGenreMap = new Map(movieData.genres.map((g) => [g.id, g.name]));
  tvGenreMap = new Map(tvData.genres.map((g) => [g.id, g.name]));
}

function genreNamesFor(showType: ShowType, ids: number[]): string[] {
  const map = showType === 'movie' ? movieGenreMap : tvGenreMap;
  if (!map) return [];
  return ids.map((id) => map.get(id)).filter((n): n is string => !!n);
}

// ── Discover 페이지네이션 ──────────────────────────────────────────────────────

async function discoverPage<T>(
  endpoint: 'movie' | 'tv',
  page: number
): Promise<TmdbDiscoverResponse<T>> {
  const params = new URLSearchParams({
    language: 'ko-KR',
    watch_region: 'KR',
    with_watch_providers: String(NETFLIX_PROVIDER_ID),
    sort_by: 'popularity.desc',
    page: String(page),
    include_adult: 'false',
  });
  const url = `${TMDB_BASE}/discover/${endpoint}?${params.toString()}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TMDB discover/${endpoint} ${page}p ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TmdbDiscoverResponse<T>;
}

/** 영화 전체 페이지 순회 */
async function fetchAllMovies(): Promise<NetflixContent[]> {
  const result: NetflixContent[] = [];
  const first = await discoverPage<TmdbMovieDiscover>('movie', 1);
  const totalPages = Math.min(first.total_pages, 500); // TMDB 한도

  const consume = (page: TmdbDiscoverResponse<TmdbMovieDiscover>) => {
    for (const m of page.results) {
      const genreIds = safeArray<number>(m.genre_ids);
      const genres = genreNamesFor('movie', genreIds);
      result.push({
        id: `m_${m.id}`, // 영화/시리즈 ID 충돌 방지를 위해 prefix
        title: m.title,
        original_title: m.original_title ?? null,
        show_type: 'movie',
        content_type: inferContentType('movie', genreIds, genres),
        overview: m.overview || null,
        release_year: yearFromDate(m.release_date),
        runtime: null, // detail에서 채움 (선택적)
        episode_count: null,
        is_ended: null,
        country: safeArray<string>(m.origin_country),
        genres,
        rating: ratingToInt(m.vote_average),
        poster_url: posterUrl(m.poster_path),
        backdrop_url: backdropUrl(m.backdrop_path),
        netflix_link: null, // TMDB에는 직접 링크 없음
      });
    }
  };

  consume(first);
  console.log(`[fetch-netflix] movie page 1/${totalPages}: +${first.results.length}`);

  for (let p = 2; p <= totalPages; p++) {
    try {
      const page = await discoverPage<TmdbMovieDiscover>('movie', p);
      consume(page);
      if (p % 10 === 0 || p === totalPages) {
        console.log(`[fetch-netflix] movie page ${p}/${totalPages}: +${page.results.length} (누적 ${result.length})`);
      }
      await sleep(50); // 너무 빠르게 호출하지 않도록 가벼운 대기
    } catch (e) {
      console.error(`[fetch-netflix] movie page ${p} 실패:`, e);
      break;
    }
  }
  return result;
}

/** TV 시리즈 전체 페이지 순회 */
async function fetchAllSeries(): Promise<NetflixContent[]> {
  const result: NetflixContent[] = [];
  const first = await discoverPage<TmdbTvDiscover>('tv', 1);
  const totalPages = Math.min(first.total_pages, 500);

  const consume = (page: TmdbDiscoverResponse<TmdbTvDiscover>) => {
    for (const t of page.results) {
      const genreIds = safeArray<number>(t.genre_ids);
      const genres = genreNamesFor('series', genreIds);
      result.push({
        id: `t_${t.id}`,
        title: t.name,
        original_title: t.original_name ?? null,
        show_type: 'series',
        content_type: inferContentType('series', genreIds, genres),
        overview: t.overview || null,
        release_year: yearFromDate(t.first_air_date),
        runtime: null,
        episode_count: null,
        is_ended: null,
        country: safeArray<string>(t.origin_country),
        genres,
        rating: ratingToInt(t.vote_average),
        poster_url: posterUrl(t.poster_path),
        backdrop_url: backdropUrl(t.backdrop_path),
        netflix_link: null,
      });
    }
  };

  consume(first);
  console.log(`[fetch-netflix] tv page 1/${totalPages}: +${first.results.length}`);

  for (let p = 2; p <= totalPages; p++) {
    try {
      const page = await discoverPage<TmdbTvDiscover>('tv', p);
      consume(page);
      if (p % 10 === 0 || p === totalPages) {
        console.log(`[fetch-netflix] tv page ${p}/${totalPages}: +${page.results.length} (누적 ${result.length})`);
      }
      await sleep(50);
    } catch (e) {
      console.error(`[fetch-netflix] tv page ${p} 실패:`, e);
      break;
    }
  }
  return result;
}

// ── Detail (runtime/episode_count) 보강 ──────────────────────────────────────────

/** 신규/변경 콘텐츠에 대해서만 detail을 호출하여 runtime/episode_count 보강 */
async function enrichWithDetails(items: NetflixContent[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const tmdbId = item.id.slice(2); // 'm_' 또는 't_' 제거
    const endpoint = item.show_type === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?language=ko-KR`;

    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        console.warn(`[fetch-netflix] detail ${item.id} 실패 ${res.status}`);
        continue;
      }
      if (item.show_type === 'movie') {
        const d = (await res.json()) as TmdbMovieDetail;
        item.runtime = d.runtime ?? null;
        if (d.genres?.length) {
          item.genres = d.genres.map((g) => g.name).filter(Boolean);
        }
        if (d.production_countries?.length) {
          item.country = d.production_countries.map((c) => c.iso_3166_1);
        }
      } else {
        const d = (await res.json()) as TmdbTvDetail;
        item.episode_count = d.number_of_episodes ?? null;
        item.runtime = d.episode_run_time?.[0] ?? null;
        item.is_ended = !d.in_production;
        if (d.genres?.length) {
          item.genres = d.genres.map((g) => g.name).filter(Boolean);
        }
        if (d.origin_country?.length) item.country = d.origin_country;
      }
      await sleep(20);
    } catch (e) {
      console.warn(`[fetch-netflix] detail ${item.id} 예외:`, e);
    }

    if ((i + 1) % 20 === 0 || i === items.length - 1) {
      console.log(`[fetch-netflix] detail 진행: ${i + 1}/${items.length}`);
    }
  }
}

// ── 기존 데이터와 비교 (신규/변경분 추출) ───────────────────────────────────────

interface SignatureFields {
  title?: string | null;
  overview?: string | null;
  rating?: number | null;
  genres?: string[] | null;
}

function signature(c: SignatureFields): string {
  return JSON.stringify({
    title: c.title ?? null,
    overview: c.overview ?? null,
    rating: c.rating ?? null,
    genres: c.genres ?? [],
  });
}

interface ExistingRow {
  id: string;
  title: string | null;
  overview: string | null;
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
      .select('id, title, overview, rating, genres, tags')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) map.set(row.id, row as ExistingRow);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

// ── 메인 export ────────────────────────────────────────────────────────────────

/** 신규 + 의미있는 변경분 추출 (Claude 태깅 대상) */
export async function fetchNetflixNewContents(): Promise<NetflixContent[]> {
  await loadGenreMaps();

  const supabase = getSupabase();
  const [movies, series, existing] = await Promise.all([
    fetchAllMovies(),
    fetchAllSeries(),
    loadExisting(supabase),
  ]);
  // 영화·시리즈를 번갈아 섞어서 cron 40개 처리 시 양쪽이 골고루 포함되도록 함
  const allFromApi: typeof movies = [];
  const maxLen = Math.max(movies.length, series.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < movies.length)  allFromApi.push(movies[i]);
    if (i < series.length)  allFromApi.push(series[i]);
  }

  const newOrChanged: NetflixContent[] = [];
  for (const item of allFromApi) {
    const prev = existing.get(item.id);
    if (!prev) {
      newOrChanged.push(item);
      continue;
    }
    const hasTags = prev.tags && Object.keys(prev.tags).length > 0;
    if (!hasTags || signature(prev) !== signature(item)) {
      newOrChanged.push(item);
    }
  }

  console.log(
    `[fetch-netflix] TMDB ${allFromApi.length}건 (movies ${movies.length} / series ${series.length}) / DB ${existing.size}건 / 신규·변경 ${newOrChanged.length}건`
  );

  // 신규/변경분에만 detail API 호출 (runtime/episode_count 보강)
  // 너무 많으면 첫 N개만 보강 — 나머지는 다음 cron에서 보강
  const MAX_DETAIL = 60;
  if (newOrChanged.length > 0) {
    const toEnrich = newOrChanged.slice(0, MAX_DETAIL);
    console.log(`[fetch-netflix] detail 보강 ${toEnrich.length}건 시작`);
    await enrichWithDetails(toEnrich);
  }

  return newOrChanged;
}

// ── CLI 단독 실행 ──────────────────────────────────────────────────────────────

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
