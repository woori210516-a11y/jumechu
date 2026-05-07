import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 빌드 타임(env 미설정)에도 오류가 안 나도록 URL 유효성 확인 후 fallback 사용.
const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co';
const supabaseKey = rawKey || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);
