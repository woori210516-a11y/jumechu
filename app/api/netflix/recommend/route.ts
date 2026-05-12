/**
 * Netflix 콘텐츠 추천 API
 * POST /api/netflix/recommend
 *
 * Body:
 *   contentTypes?:  string[] | null        — content_type 필터 (null = 상관없음)
 *   isEnded?:       boolean | null          — 완결 여부 필터
 *   episodeMin?:    number | null
 *   episodeMax?:    number | null
 *   runtimeMin?:    number | null
 *   runtimeMax?:    number | null
 *   countryCodes?:  string[] | null         — country 열 overlap 필터
 *   desired:        Partial<Record<TagKey, number>>  — 선호 태그 (0~10)
 *   avoidViolence?: boolean
 *   avoidAdult?:    boolean
 *   avoidHorror?:   boolean
 *   avoidSad?:      boolean
 *
 * Returns: RecommendResult[]  (상위 15개, match_score 내림차순)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── 타입 ────────────────────────────────────────────────────────────────────

const TAG_KEYS = [
  'lightness', 'tension', 'emotion', 'horror', 'laughter', 'romance', 'healing',
  'concentration', 'violence', 'adult', 'background_watch', 'episode_length',
  'with_partner', 'with_family', 'with_friend', 'solo',
] as const;

type TagKey = (typeof TAG_KEYS)[number];
type Tags = Record<TagKey, number>;

export interface RecommendResult {
  id: string;
  title: string;
  show_type: string;
  content_type: string;
  overview: string | null;
  release_year: number | null;
  runtime: number | null;
  episode_count: number | null;
  is_ended: boolean | null;
  genres: string[];
  country: string[];
  rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  netflix_link: string | null;
  match_score: number;
}

interface ContentRow {
  id: string;
  title: string;
  show_type: string;
  content_type: string;
  overview: string | null;
  release_year: number | null;
  runtime: number | null;
  episode_count: number | null;
  is_ended: boolean | null;
  genres: string[];
  country: string[];
  rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  netflix_link: string | null;
  tags: Tags;
}

interface RecommendRequest {
  contentTypes?: string[] | null;
  isEnded?: boolean | null;
  episodeMin?: number | null;
  episodeMax?: number | null;
  runtimeMin?: number | null;
  runtimeMax?: number | null;
  countryCodes?: string[] | null;
  desired: Partial<Record<TagKey, number>>;
  avoidViolence?: boolean;
  avoidAdult?: boolean;
  avoidHorror?: boolean;
  avoidSad?: boolean;
}

// ── 점수 계산 ────────────────────────────────────────────────────────────────

function computeScore(tags: Tags, desired: Partial<Record<TagKey, number>>): number {
  const entries = Object.entries(desired) as [TagKey, number][];
  if (entries.length === 0) return 50;

  let total = 0;
  let count = 0;
  for (const [key, val] of entries) {
    const tv = tags[key];
    if (tv === undefined || tv === null) continue;
    total += 1 - Math.abs(tv - val) / 10;
    count++;
  }
  return count > 0 ? Math.round((total / count) * 100) : 50;
}

// ── 핸들러 ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: RecommendRequest = await req.json();
    const {
      contentTypes,
      isEnded,
      episodeMin,
      episodeMax,
      runtimeMin,
      runtimeMax,
      countryCodes,
      desired,
      avoidViolence = false,
      avoidAdult = false,
      avoidHorror = false,
      avoidSad = false,
    } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // ── Supabase 쿼리 (기본 필터 + 상위 2000개) ─────────────────────────────
    let query = supabase
      .from('netflix_contents')
      .select(
        'id, title, show_type, content_type, overview, release_year, runtime, episode_count, is_ended, genres, country, rating, poster_url, backdrop_url, netflix_link, tags'
      )
      .eq('is_active', true)
      .not('tags', 'is', null)
      .order('rating', { ascending: false })
      .limit(2000);

    // content_type 필터 (SQL에서 처리)
    if (contentTypes && contentTypes.length > 0) {
      query = query.in('content_type', contentTypes);
    }

    // is_ended 필터 (SQL에서 처리)
    if (isEnded === true) {
      query = query.eq('is_ended', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    let rows = data as ContentRow[];

    // ── JS 필터 ─────────────────────────────────────────────────────────────

    // episode_count 범위 (null은 통과)
    if (episodeMax !== null && episodeMax !== undefined) {
      rows = rows.filter(r => r.episode_count === null || r.episode_count <= episodeMax);
    }
    if (episodeMin !== null && episodeMin !== undefined) {
      rows = rows.filter(r => r.episode_count === null || r.episode_count >= episodeMin);
    }

    // runtime 범위 (null은 통과)
    if (runtimeMax !== null && runtimeMax !== undefined) {
      rows = rows.filter(r => r.runtime === null || r.runtime <= runtimeMax);
    }
    if (runtimeMin !== null && runtimeMin !== undefined) {
      rows = rows.filter(r => r.runtime === null || r.runtime >= runtimeMin);
    }

    // country overlap (null/empty = 필터 없음)
    if (countryCodes && countryCodes.length > 0) {
      const codeSet = new Set(countryCodes);
      rows = rows.filter(r =>
        (r.country ?? []).some(c => codeSet.has(c))
      );
    }

    // 회피 항목 하드 필터
    if (avoidViolence) rows = rows.filter(r => (r.tags?.violence ?? 0) < 7);
    if (avoidAdult)    rows = rows.filter(r => (r.tags?.adult   ?? 0) < 7);
    if (avoidHorror)   rows = rows.filter(r => (r.tags?.horror  ?? 0) < 7);
    if (avoidSad)      rows = rows.filter(r => (r.tags?.emotion ?? 0) < 8);

    // ── 점수 계산 + 정렬 + 상위 15개 ────────────────────────────────────────
    const results: RecommendResult[] = rows
      .map(row => ({
        id: row.id,
        title: row.title,
        show_type: row.show_type,
        content_type: row.content_type,
        overview: row.overview,
        release_year: row.release_year,
        runtime: row.runtime,
        episode_count: row.episode_count,
        is_ended: row.is_ended,
        genres: row.genres ?? [],
        country: row.country ?? [],
        rating: row.rating,
        poster_url: row.poster_url,
        backdrop_url: row.backdrop_url,
        netflix_link: row.netflix_link,
        match_score: computeScore(row.tags, desired),
      }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 15);

    return NextResponse.json(results);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[recommend] 실패:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
