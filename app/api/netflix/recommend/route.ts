/**
 * Netflix 콘텐츠 추천 API
 * POST /api/netflix/recommend
 * Body: { desired: Partial<Record<TagKey, number>> }
 * Returns: RecommendResult[] (상위 10개)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  genres: string[];
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
  genres: string[];
  rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  netflix_link: string | null;
  tags: Tags;
}

function computeScore(tags: Tags, desired: Partial<Record<TagKey, number>>): number {
  const entries = Object.entries(desired) as [TagKey, number][];
  if (entries.length === 0) return 50;

  let total = 0;
  let count = 0;
  for (const [key, val] of entries) {
    const tagVal = tags[key];
    if (tagVal === undefined || tagVal === null) continue;
    const diff = Math.abs(tagVal - val) / 10;
    total += (1 - diff);
    count += 1;
  }
  return count > 0 ? Math.round((total / count) * 100) : 50;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const desired: Partial<Record<TagKey, number>> = body.desired ?? body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 태깅된 활성 콘텐츠 최대 2000개 조회 (평점 높은 순으로)
    const { data, error } = await supabase
      .from('netflix_contents')
      .select(
        'id, title, show_type, content_type, overview, release_year, runtime, episode_count, genres, rating, poster_url, backdrop_url, netflix_link, tags'
      )
      .eq('is_active', true)
      .not('tags', 'is', null)
      .order('rating', { ascending: false })
      .limit(2000);

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // JS에서 점수 계산 후 상위 10개 추출
    const scored: RecommendResult[] = (data as ContentRow[])
      .map((row) => ({
        id: row.id,
        title: row.title,
        show_type: row.show_type,
        content_type: row.content_type,
        overview: row.overview,
        release_year: row.release_year,
        runtime: row.runtime,
        episode_count: row.episode_count,
        genres: row.genres ?? [],
        rating: row.rating,
        poster_url: row.poster_url,
        backdrop_url: row.backdrop_url,
        netflix_link: row.netflix_link,
        match_score: computeScore(row.tags, desired),
      }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 10);

    return NextResponse.json(scored);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[recommend] 실패:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
