'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { RecommendResult } from '@/app/api/netflix/recommend/route';

// ── 태그 타입 ─────────────────────────────────────────────────────────────────

type TagKey =
  | 'lightness' | 'tension' | 'emotion' | 'horror' | 'laughter' | 'romance' | 'healing'
  | 'concentration' | 'violence' | 'adult' | 'background_watch' | 'episode_length'
  | 'with_partner' | 'with_family' | 'with_friend' | 'solo';

type Desired = Partial<Record<TagKey, number>>;

// ── 설문 문항 정의 ─────────────────────────────────────────────────────────────

interface QuizOption {
  label: string;
  emoji: string;
  desired: Desired;
}

interface QuizQuestion {
  id: string;
  text: string;
  subText?: string;
  options: QuizOption[];
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'mood',
    text: '지금 어떤 거 보고 싶어?',
    subText: '오늘의 기분에 맞는 걸 골라봐',
    options: [
      { label: '웃겨야 함', emoji: '🤣', desired: { laughter: 9, lightness: 8, tension: 2 } },
      { label: '감동 받고 싶어', emoji: '😭', desired: { emotion: 9, romance: 5, healing: 6 } },
      { label: '무섭고 스릴있게', emoji: '😱', desired: { horror: 8, tension: 8, lightness: 2 } },
      { label: '따뜻하게 힐링', emoji: '🌿', desired: { healing: 9, lightness: 7, emotion: 5 } },
      { label: '긴장감 빡빡하게', emoji: '💀', desired: { tension: 9, lightness: 2, horror: 4 } },
      { label: '로맨틱하게', emoji: '💕', desired: { romance: 9, emotion: 6, laughter: 4 } },
    ],
  },
  {
    id: 'focus',
    text: '오늘 얼마나 집중할 수 있어?',
    options: [
      { label: '자막 다 읽고 집중할게', emoji: '🎯', desired: { concentration: 9, background_watch: 1 } },
      { label: '적당히 볼게', emoji: '😌', desired: { concentration: 5, background_watch: 5 } },
      { label: '틀어놓고 딴짓할 거야', emoji: '📱', desired: { background_watch: 9, concentration: 2 } },
    ],
  },
  {
    id: 'viewer',
    text: '누구랑 봐?',
    options: [
      { label: '혼자 볼 거임', emoji: '🎧', desired: { solo: 10 } },
      { label: '남친 / 여친이랑', emoji: '👫', desired: { with_partner: 10 } },
      { label: '가족이랑', emoji: '👨‍👩‍👦', desired: { with_family: 10 } },
      { label: '친구들이랑', emoji: '🍿', desired: { with_friend: 10 } },
    ],
  },
  {
    id: 'length',
    text: '얼마나 볼 수 있어?',
    options: [
      { label: '영화 한 편만', emoji: '🎬', desired: { episode_length: 1 } },
      { label: '몇 편 정도', emoji: '📺', desired: { episode_length: 4 } },
      { label: '정주행 각이야', emoji: '🔥', desired: { episode_length: 9 } },
    ],
  },
  {
    id: 'rating',
    text: '수위는 어떻게?',
    options: [
      { label: '순한 맛으로', emoji: '🥛', desired: { violence: 1, adult: 0 } },
      { label: '중간 정도', emoji: '🌶', desired: { violence: 5, adult: 3 } },
      { label: '강한 맛도 괜찮아', emoji: '🔥', desired: { violence: 9, adult: 7 } },
    ],
  },
];

// ── 설문 답변 병합 ─────────────────────────────────────────────────────────────

function mergeDesired(answerList: Desired[]): Desired {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const ans of answerList) {
    for (const [key, val] of Object.entries(ans) as [TagKey, number][]) {
      sums[key] = (sums[key] ?? 0) + val;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const merged: Desired = {};
  for (const key of Object.keys(sums) as TagKey[]) {
    merged[key] = Math.round(sums[key] / counts[key]);
  }
  return merged;
}

// ── 뷰 타입 ──────────────────────────────────────────────────────────────────

type View = 'intro' | 'quiz' | 'loading' | 'result';

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function NetflixPage() {
  const [view, setView] = useState<View>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Desired[]>([]);
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setView('intro');
    setQuestionIndex(0);
    setAnswers([]);
    setResults([]);
    setError(null);
  }

  function handleStart() {
    reset();
    setView('quiz');
  }

  async function handleAnswer(desired: Desired) {
    const newAnswers = [...answers, desired];
    setAnswers(newAnswers);

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      // 마지막 질문 → 추천 API 호출
      setView('loading');
      try {
        const merged = mergeDesired(newAnswers);
        const res = await fetch('/api/netflix/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desired: merged }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data: RecommendResult[] = await res.json();
        setResults(data);
        setView('result');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setView('result');
      }
    }
  }

  function handleBack() {
    if (questionIndex === 0) {
      setView('intro');
      setAnswers([]);
    } else {
      setQuestionIndex(questionIndex - 1);
      setAnswers(answers.slice(0, -1));
    }
  }

  return (
    <main className="min-h-screen flex justify-center items-start" style={{ background: '#141414' }}>
      <div className="w-full max-w-[390px] min-h-screen flex flex-col" style={{ background: '#141414' }}>
        {view === 'intro' && <IntroView onStart={handleStart} />}
        {view === 'quiz' && (
          <QuizView
            question={QUESTIONS[questionIndex]}
            questionIndex={questionIndex}
            total={QUESTIONS.length}
            onAnswer={handleAnswer}
            onBack={handleBack}
          />
        )}
        {view === 'loading' && <LoadingView />}
        {view === 'result' && (
          <ResultView results={results} error={error} onRestart={reset} />
        )}
      </div>
    </main>
  );
}

// ── 인트로 화면 ────────────────────────────────────────────────────────────────

function IntroView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col flex-1 animate-fade-slide">
      {/* 상단 뒤로가기 */}
      <div className="px-5 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-all"
          style={{ color: '#888' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          처음으로
        </Link>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-8">
          {/* 넷플릭스 로고 스타일 */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="text-5xl font-bold tracking-tight"
              style={{ color: '#E50914', fontFamily: 'NeoDGM, sans-serif' }}
            >
              넷플
            </div>
            <div className="text-lg font-medium" style={{ color: '#888' }}>추천기</div>
          </div>

          <div className="text-center flex flex-col gap-3">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#fff' }}>
              오늘 뭐볼까?<br />넷플에서 골라봐
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#888' }}>
              5가지 질문으로 딱 맞는 콘텐츠 10개 추려줄게
            </p>
          </div>

          {/* 장식 요소 */}
          <div className="flex gap-3">
            {['🎬', '🍿', '😱', '💕', '😂'].map((emoji, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: '#1f1f1f' }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl text-white text-base font-bold tracking-wide active:scale-95 transition-transform"
            style={{ background: '#E50914', boxShadow: '0 8px 24px rgba(229,9,20,0.4)' }}
          >
            시작하기
          </button>
          <p className="text-center text-xs" style={{ color: '#555' }}>5가지 질문 · 1분 이내</p>
        </div>
      </div>
    </div>
  );
}

// ── 설문 화면 ─────────────────────────────────────────────────────────────────

interface QuizViewProps {
  question: QuizQuestion;
  questionIndex: number;
  total: number;
  onAnswer: (desired: Desired) => void;
  onBack: () => void;
}

function QuizView({ question, questionIndex, total, onAnswer, onBack }: QuizViewProps) {
  const progress = ((questionIndex + 1) / total) * 100;

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-6 gap-5 animate-fade-slide">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-all"
          style={{ color: '#888' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          이전
        </button>
        <span className="text-xs font-semibold tracking-widest" style={{ color: '#666' }}>
          {questionIndex + 1} / {total}
        </span>
        <div className="w-10" />
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: '#E50914' }}
        />
      </div>

      {/* 질문 */}
      <div className="flex flex-col gap-2 pt-2">
        <h2 className="text-xl font-bold leading-snug" style={{ color: '#fff' }}>
          {question.text}
        </h2>
        {question.subText && (
          <p className="text-sm" style={{ color: '#888' }}>{question.subText}</p>
        )}
      </div>

      {/* 선택지 */}
      <div className="flex flex-col gap-2.5 flex-1 pt-2">
        {question.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onAnswer(opt.desired)}
            className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 active:scale-[0.98] transition-all"
            style={{
              background: '#1f1f1f',
              border: '1px solid #2a2a2a',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E50914';
              (e.currentTarget as HTMLButtonElement).style.background = '#2a0a0a';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
              (e.currentTarget as HTMLButtonElement).style.background = '#1f1f1f';
            }}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="font-medium text-base">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 로딩 화면 ─────────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 animate-fade-slide">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: '#E50914', boxShadow: '0 8px 24px rgba(229,9,20,0.4)' }}
        >
          🎬
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg font-bold" style={{ color: '#fff' }}>찾고 있어...</p>
          <p className="text-sm" style={{ color: '#888' }}>딱 맞는 콘텐츠 고르는 중</p>
        </div>
        {/* 점 세 개 애니메이션 */}
        <div className="flex gap-2 pt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: '#E50914',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── 결과 화면 ─────────────────────────────────────────────────────────────────

interface ResultViewProps {
  results: RecommendResult[];
  error: string | null;
  onRestart: () => void;
}

function ResultView({ results, error, onRestart }: ResultViewProps) {
  return (
    <div className="flex flex-col flex-1 animate-fade-slide">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#fff' }}>
            오늘의 추천 🎬
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
            {error ? '오류가 발생했어요' : `딱 맞는 ${results.length}개 골라왔어`}
          </p>
        </div>
        <button
          onClick={onRestart}
          className="px-4 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all"
          style={{ background: '#1f1f1f', color: '#E50914', border: '1px solid #E50914' }}
        >
          다시하기
        </button>
      </div>

      {error && (
        <div className="mx-5 px-4 py-3 rounded-xl text-sm" style={{ background: '#2a0a0a', color: '#ff6b6b' }}>
          {error}
        </div>
      )}

      {/* 카드 리스트 */}
      <div className="flex flex-col gap-3 px-5 pb-8 pt-2">
        {results.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 pt-16" style={{ color: '#666' }}>
            <span className="text-4xl">🎬</span>
            <p className="text-sm">아직 데이터가 없어. 내일 다시 와봐!</p>
          </div>
        )}
        {results.map((item, idx) => (
          <ContentCard key={item.id} item={item} rank={idx + 1} />
        ))}
      </div>

      {/* 하단 버튼 */}
      {results.length > 0 && (
        <div className="px-5 pb-6 mt-auto">
          <button
            onClick={onRestart}
            className="w-full py-4 rounded-2xl text-white text-base font-bold active:scale-95 transition-transform"
            style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
          >
            다른 거 찾아볼게
          </button>
        </div>
      )}
    </div>
  );
}

// ── 콘텐츠 카드 ───────────────────────────────────────────────────────────────

function ContentCard({ item, rank }: { item: RecommendResult; rank: number }) {
  const matchPct = item.match_score;
  const matchColor =
    matchPct >= 80 ? '#4ade80' : matchPct >= 60 ? '#facc15' : '#f87171';

  const typeLabel =
    item.content_type === 'movie'
      ? '영화'
      : item.content_type === 'drama'
      ? '드라마'
      : item.content_type === 'animation'
      ? '애니'
      : item.content_type === 'documentary'
      ? '다큐'
      : '예능';

  const lengthLabel =
    item.show_type === 'movie'
      ? item.runtime
        ? `${item.runtime}분`
        : null
      : item.episode_count
      ? `${item.episode_count}화`
      : null;

  return (
    <div
      className="flex gap-3 rounded-2xl overflow-hidden active:scale-[0.99] transition-all"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      {/* 포스터 */}
      <div className="relative shrink-0 w-20 h-28 overflow-hidden" style={{ background: '#0f0f0f' }}>
        {/* 순위 배지 */}
        <div
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold z-10"
          style={{ background: '#E50914', color: '#fff' }}
        >
          {rank}
        </div>
        {item.poster_url ? (
          <Image
            src={item.poster_url}
            alt={item.title}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex flex-col flex-1 py-3 pr-3 gap-1.5 min-w-0">
        {/* 제목 + 매치율 */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-bold leading-snug flex-1 min-w-0"
            style={{ color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          >
            {item.title}
          </h3>
          <div
            className="shrink-0 px-1.5 py-0.5 rounded-md text-xs font-bold"
            style={{ background: `${matchColor}22`, color: matchColor, border: `1px solid ${matchColor}44` }}
          >
            {matchPct}%
          </div>
        </div>

        {/* 태그 뱃지들 */}
        <div className="flex flex-wrap gap-1">
          <span
            className="px-2 py-0.5 rounded-md text-xs"
            style={{ background: '#2a2a2a', color: '#E50914' }}
          >
            {typeLabel}
          </span>
          {item.release_year && (
            <span
              className="px-2 py-0.5 rounded-md text-xs"
              style={{ background: '#2a2a2a', color: '#888' }}
            >
              {item.release_year}
            </span>
          )}
          {lengthLabel && (
            <span
              className="px-2 py-0.5 rounded-md text-xs"
              style={{ background: '#2a2a2a', color: '#888' }}
            >
              {lengthLabel}
            </span>
          )}
        </div>

        {/* 장르 */}
        {item.genres.length > 0 && (
          <p className="text-xs" style={{ color: '#666' }}>
            {item.genres.slice(0, 2).join(' · ')}
          </p>
        )}

        {/* 줄거리 */}
        {item.overview && (
          <p
            className="text-xs leading-relaxed"
            style={{
              color: '#666',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.overview}
          </p>
        )}

        {/* 넷플릭스 링크 */}
        {item.netflix_link && (
          <a
            href={item.netflix_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium mt-0.5"
            style={{ color: '#E50914' }}
          >
            넷플에서 보기
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15,3 21,3 21,9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
