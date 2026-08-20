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
