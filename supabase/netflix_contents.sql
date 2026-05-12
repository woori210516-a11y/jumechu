-- 넷플릭스 콘텐츠 추천 — 스키마
-- 실행 위치: Supabase SQL Editor
-- 주의: 이 파일은 한 번에 통째로 실행해도 안전하도록 idempotent하게 작성됨

-- ── 메인 테이블 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS netflix_contents (
  id              TEXT PRIMARY KEY,                       -- Streaming Availability API 고유 ID
  title           TEXT NOT NULL,                          -- 한국어 제목
  original_title  TEXT,
  show_type       TEXT NOT NULL,                          -- 'movie' | 'series'
  content_type    TEXT NOT NULL,                          -- 'movie' | 'drama' | 'animation' | 'documentary' | 'variety'
  overview        TEXT,                                   -- 줄거리
  release_year    INTEGER,
  runtime         INTEGER,                                -- 분 단위 (시리즈는 에피소드 평균)
  episode_count   INTEGER,                                -- 시리즈만
  is_ended        BOOLEAN,                                -- 시리즈 완결 여부
  country         TEXT[] DEFAULT '{}',                    -- ['KR', 'US' 등]
  genres          TEXT[] DEFAULT '{}',
  rating          INTEGER,                                -- 0~100
  poster_url      TEXT,
  backdrop_url    TEXT,
  netflix_link    TEXT,
  tags            JSONB DEFAULT '{}'::jsonb,              -- Claude가 부여한 태그 점수
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 인덱스 ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS netflix_contents_is_active_idx ON netflix_contents (is_active);
CREATE INDEX IF NOT EXISTS netflix_contents_show_type_idx ON netflix_contents (show_type);
CREATE INDEX IF NOT EXISTS netflix_contents_content_type_idx ON netflix_contents (content_type);
CREATE INDEX IF NOT EXISTS netflix_contents_release_year_idx ON netflix_contents (release_year);
CREATE INDEX IF NOT EXISTS netflix_contents_rating_idx ON netflix_contents (rating);
CREATE INDEX IF NOT EXISTS netflix_contents_last_updated_idx ON netflix_contents (last_updated);

-- 배열/JSONB 검색용 GIN 인덱스
CREATE INDEX IF NOT EXISTS netflix_contents_genres_gin_idx ON netflix_contents USING GIN (genres);
CREATE INDEX IF NOT EXISTS netflix_contents_country_gin_idx ON netflix_contents USING GIN (country);
CREATE INDEX IF NOT EXISTS netflix_contents_tags_gin_idx ON netflix_contents USING GIN (tags);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE netflix_contents ENABLE ROW LEVEL SECURITY;

-- 익명/인증 사용자: 활성 콘텐츠만 읽기 가능
DROP POLICY IF EXISTS "netflix_contents_select_active" ON netflix_contents;
CREATE POLICY "netflix_contents_select_active" ON netflix_contents
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- 쓰기는 service_role만 (크론 잡에서만 사용)
DROP POLICY IF EXISTS "netflix_contents_service_write" ON netflix_contents;
CREATE POLICY "netflix_contents_service_write" ON netflix_contents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
