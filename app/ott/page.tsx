'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { RecommendResult } from '@/app/api/netflix/recommend/route';

// ── iOS 네이티브 브리지 타입 ──────────────────────────────────────────────────
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        watched?: { postMessage: (data: unknown) => void };
      };
    };
    __setWatchedIds?: (ids: string[]) => void;
    __nativeUIState?: (state: 'home' | 'survey' | 'result') => void;
  }
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

type TagKey =
  | 'lightness' | 'tension' | 'emotion' | 'horror' | 'laughter' | 'romance' | 'healing'
  | 'concentration' | 'violence' | 'adult' | 'background_watch' | 'episode_length'
  | 'with_partner' | 'with_family' | 'with_friend' | 'solo';

type Desired = Partial<Record<TagKey, number>>;

type StepId = 'q1' | 'q1_1' | 'q1_2' | 'q2' | 'q3' | 'q5' | 'q6' | 'q7' | 'q8';

type View = 'intro' | 'quiz' | 'loading' | 'result' | 'no-result';

interface SurveyState {
  contentTypes: string[];
  isEnded: boolean | null;
  episodeMin: number | null;
  episodeMax: number | null;
  runtimeMin: number | null;
  runtimeMax: number | null;
  countries: string[];
  desired: Desired;
  avoidViolence: boolean;
  avoidAdult: boolean;
  avoidHorror: boolean;
  avoidSad: boolean;
}

const INITIAL_SURVEY: SurveyState = {
  contentTypes: [],
  isEnded: null,
  episodeMin: null,
  episodeMax: null,
  runtimeMin: null,
  runtimeMax: null,
  countries: [],
  desired: {},
  avoidViolence: false,
  avoidAdult: false,
  avoidHorror: false,
  avoidSad: false,
};

// ── 스텝 흐름 계산 ────────────────────────────────────────────────────────────

function computeActiveSteps(survey: SurveyState): StepId[] {
  const steps: StepId[] = ['q1'];
  const ct = survey.contentTypes;
  const notAny = ct.length > 0 && !ct.includes('any');

  if (notAny && ct.includes('drama'))  steps.push('q1_1', 'q1_2');
  if (notAny && ct.includes('movie'))  steps.push('q2');

  steps.push('q3', 'q5', 'q6', 'q7', 'q8');
  return steps;
}

function getNextStep(current: StepId, survey: SurveyState): StepId | null {
  const steps = computeActiveSteps(survey);
  const idx = steps.indexOf(current);
  return idx === -1 || idx === steps.length - 1 ? null : steps[idx + 1];
}

// ── desired 태그 병합 ─────────────────────────────────────────────────────────

function mergeDesired(base: Desired, add: Desired): Desired {
  const result: Desired = { ...base };
  for (const [k, v] of Object.entries(add) as [TagKey, number][]) {
    result[k] = result[k] !== undefined ? Math.round((result[k]! + v) / 2) : v;
  }
  return result;
}

// ── 멀티셀렉트 exclusive 토글 ──────────────────────────────────────────────────

function toggleMulti(prev: string[], value: string, exclusiveValues: string[]): string[] {
  if (exclusiveValues.includes(value)) return [value];
  const withoutExclusive = prev.filter(v => !exclusiveValues.includes(v));
  if (withoutExclusive.includes(value)) return withoutExclusive.filter(v => v !== value);
  return [...withoutExclusive, value];
}

// ── 선택지 데이터 ─────────────────────────────────────────────────────────────

const Q1_OPTIONS = [
  { label: '영화',        emoji: '🎬', value: 'movie' },
  { label: '드라마',      emoji: '📺', value: 'drama' },
  { label: '애니메이션',  emoji: '✨', value: 'animation' },
  { label: '다큐멘터리',  emoji: '🎥', value: 'documentary' },
  { label: '예능',        emoji: '🎭', value: 'variety' },
  { label: '상관없음',    emoji: '🎲', value: 'any' },
];

const Q3_OPTIONS = [
  { label: '한국',    emoji: '🇰🇷', value: 'kr' },
  { label: '일본',    emoji: '🇯🇵', value: 'jp' },
  { label: '중국',    emoji: '🇨🇳', value: 'cn' },
  { label: '유럽',    emoji: '🇪🇺', value: 'eu' },
  { label: '헐리웃',  emoji: '🎬', value: 'us' },
  { label: '기타',    emoji: '🌏', value: 'other' },
  { label: '상관없음', emoji: '🎲', value: 'any' },
];

const COUNTRY_CODES: Record<string, string[]> = {
  kr:    ['KR'],
  jp:    ['JP'],
  cn:    ['CN', 'TW', 'HK'],
  eu:    ['DE', 'FR', 'IT', 'ES', 'SE', 'NO', 'DK', 'NL', 'PL', 'FI', 'BE', 'AT', 'CH'],
  us:    ['US', 'GB', 'CA', 'AU'],
  other: ['TH', 'IN', 'PH', 'SG', 'ID', 'VN', 'MY', 'TR', 'MX', 'AR', 'BR', 'RU'],
};

const Q5_OPTIONS = [
  { label: '가볍게 웃을 수 있는',  value: 'funny',   emoji: '😂', desired: { laughter: 9, lightness: 8 } as Desired },
  { label: '긴장감 넘치는',       value: 'tension', emoji: '😰', desired: { tension: 9 } as Desired },
  { label: '감동적인',            value: 'moving',  emoji: '🥺', desired: { emotion: 8, romance: 4 } as Desired },
  { label: '무서운',              value: 'horror',  emoji: '😱', desired: { horror: 8, tension: 5 } as Desired },
  { label: '설레는',              value: 'romance', emoji: '💕', desired: { romance: 9, lightness: 6 } as Desired },
  { label: '생각하게 되는',       value: 'deep',    emoji: '🤔', desired: { concentration: 8 } as Desired },
  { label: '슬픈',               value: 'sad',     emoji: '😢', desired: { emotion: 8, lightness: 3 } as Desired },
];

const Q6_OPTIONS = [
  { label: '자막 집중해서 볼거야',   emoji: '🎯', desired: { concentration: 8, background_watch: 2 } as Desired },
  { label: '그냥 틀어만 놓을거야',   emoji: '📱', desired: { background_watch: 8, concentration: 2 } as Desired },
  { label: '중간 정도',             emoji: '😌', desired: { concentration: 5, background_watch: 5 } as Desired },
];

const Q7_OPTIONS = [
  { label: '혼자',    emoji: '🎧', desired: { solo: 10 } as Desired },
  { label: '연인이랑', emoji: '👫', desired: { with_partner: 10 } as Desired },
  { label: '가족이랑', emoji: '👨‍👩‍👦', desired: { with_family: 10 } as Desired },
  { label: '친구랑',  emoji: '🍿', desired: { with_friend: 10 } as Desired },
];

const Q8_OPTIONS = [
  { label: '폭력적인 장면', emoji: '🔪', value: 'violence' },
  { label: '성인 콘텐츠',   emoji: '🔞', value: 'adult'   },
  { label: '무서운 거',     emoji: '👻', value: 'horror'  },
  { label: '너무 슬픈 거',  emoji: '😢', value: 'sad'     },
  { label: '없음',          emoji: '✅', value: 'none'    },
];

// 스텝별 질문 텍스트
const STEP_META: Record<StepId, { title: string; sub?: string }> = {
  q1:   { title: '오늘 뭐 보고 싶어요?',       sub: '복수 선택 가능해요' },
  q1_1: { title: '완결난 드라마가 좋아요?' },
  q1_2: { title: '몇 편 정도 볼 수 있어요?' },
  q2:   { title: '얼마나 볼 수 있어요?' },
  q3:   { title: '어느 나라 콘텐츠가 좋아요?',  sub: '복수 선택 가능해요' },
  q5:   { title: '어떤 느낌이 보고 싶어요?',    sub: '복수 선택 가능해요' },
  q6:   { title: '얼마나 집중할 수 있어요?' },
  q7:   { title: '누구랑 봐요?' },
  q8:   { title: '피하고 싶은 게 있어요?',     sub: '복수 선택 가능해요' },
};

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

export default function NetflixPage() {
  const [view,             setView]             = useState<View>('intro');
  const [currentStep,      setCurrentStep]      = useState<StepId>('q1');
  const [stepHistory,      setStepHistory]      = useState<Array<{ step: StepId; survey: SurveyState }>>([]);
  const [survey,           setSurvey]           = useState<SurveyState>(INITIAL_SURVEY);
  const [multiTemp,        setMultiTemp]        = useState<string[]>([]);
  const [results,          setResults]          = useState<RecommendResult[]>([]);
  const [error,            setError]            = useState<string | null>(null);
  const [hiddenIds,        setHiddenIds]        = useState<Set<string>>(new Set());
  const [nativeWatchedIds, setNativeWatchedIds] = useState<Set<string>>(new Set());

  // ── iOS 네이티브 브리지 ──────────────────────────────────────────────────────
  useEffect(() => {
    window.__setWatchedIds = (ids: string[]) => {
      setNativeWatchedIds(new Set(ids));
    };
    return () => { delete window.__setWatchedIds; };
  }, []);

  useEffect(() => {
    if (view !== 'quiz') return;
    if (currentStep === 'q1') {
      setMultiTemp(survey.contentTypes);
    } else if (currentStep === 'q3') {
      setMultiTemp(survey.countries);
    } else if (currentStep === 'q5') {
      setMultiTemp([]);
    } else if (currentStep === 'q8') {
      const a: string[] = [];
      if (survey.avoidViolence) a.push('violence');
      if (survey.avoidAdult)    a.push('adult');
      if (survey.avoidHorror)   a.push('horror');
      if (survey.avoidSad)      a.push('sad');
      setMultiTemp(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, view]);

  function resetAll() {
    setView('intro');
    setCurrentStep('q1');
    setStepHistory([]);
    setSurvey(INITIAL_SURVEY);
    setMultiTemp([]);
    setResults([]);
    setError(null);
    setHiddenIds(new Set());
    window.__nativeUIState?.('survey');
  }

  function handleStart() {
    resetAll();
    setView('quiz');
  }

  function handleBack() {
    if (stepHistory.length === 0) {
      setView('intro');
      return;
    }
    const prev = stepHistory[stepHistory.length - 1];
    setStepHistory(h => h.slice(0, -1));
    setCurrentStep(prev.step);
    setSurvey(prev.survey);
  }

  function advance(newSurvey: SurveyState) {
    const next = getNextStep(currentStep, newSurvey);
    setStepHistory(h => [...h, { step: currentStep, survey }]);
    setSurvey(newSurvey);
    if (next === null) {
      void submitSurvey(newSurvey);
    } else {
      setCurrentStep(next);
    }
  }

  async function submitSurvey(s: SurveyState) {
    setView('loading');
    try {
      const contentTypes =
        s.contentTypes.length === 0 || s.contentTypes.includes('any') ? null : s.contentTypes;

      const countryCodes: string[] | null =
        s.countries.length === 0 || s.countries.includes('any')
          ? null
          : s.countries.flatMap(g => COUNTRY_CODES[g] ?? []);

      const res = await fetch('/api/netflix/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentTypes,
          isEnded: s.isEnded,
          episodeMin: s.episodeMin,
          episodeMax: s.episodeMax,
          runtimeMin: s.runtimeMin,
          runtimeMax: s.runtimeMax,
          countryCodes,
          desired: s.desired,
          avoidViolence: s.avoidViolence,
          avoidAdult: s.avoidAdult,
          avoidHorror: s.avoidHorror,
          avoidSad: s.avoidSad,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }

      const data: RecommendResult[] = await res.json();

      if (data.length === 0 || (data[0]?.match_score ?? 0) < 20) {
        setResults(data);
        setView('no-result');
        window.__nativeUIState?.('result');
      } else {
        setResults(data);
        setView('result');
        window.__nativeUIState?.('result');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setView('result');
    }
  }

  function handleQ1_1(isEnded: boolean | null) { advance({ ...survey, isEnded }); }
  function handleQ1_2(episodeMin: number | null, episodeMax: number | null) { advance({ ...survey, episodeMin, episodeMax }); }
  function handleQ2(runtimeMin: number | null, runtimeMax: number | null) { advance({ ...survey, runtimeMin, runtimeMax }); }
  function handleQ5Confirm() {
    if (multiTemp.length === 0) return;
    let merged: Desired = {};
    for (const val of multiTemp) {
      const opt = Q5_OPTIONS.find(o => o.value === val);
      if (opt) merged = mergeDesired(merged, opt.desired);
    }
    advance({ ...survey, desired: mergeDesired(survey.desired, merged) });
  }
  function handleQ6(desired: Desired) { advance({ ...survey, desired: mergeDesired(survey.desired, desired) }); }
  function handleQ7(desired: Desired) { advance({ ...survey, desired: mergeDesired(survey.desired, desired) }); }
  function handleQ1Confirm() { if (multiTemp.length === 0) return; advance({ ...survey, contentTypes: multiTemp }); }
  function handleQ3Confirm() { if (multiTemp.length === 0) return; advance({ ...survey, countries: multiTemp }); }
  function handleQ8Confirm() {
    if (multiTemp.length === 0) return;
    const isNone = multiTemp.includes('none');
    advance({
      ...survey,
      avoidViolence: !isNone && multiTemp.includes('violence'),
      avoidAdult:    !isNone && multiTemp.includes('adult'),
      avoidHorror:   !isNone && multiTemp.includes('horror'),
      avoidSad:      !isNone && multiTemp.includes('sad'),
    });
  }

  const activeSteps = computeActiveSteps(survey);
  const stepNumber  = stepHistory.length + 1;
  const totalSteps  = activeSteps.length;

  return (
    <main className="min-h-screen flex justify-center items-start" style={{ background: '#0D0D0D' }}>
      <div className="w-full max-w-[430px] min-h-screen flex flex-col" style={{ background: '#0D0D0D' }}>

        {view === 'intro' && <IntroView onStart={handleStart} />}

        {view === 'quiz' && (
          <QuizStepView
            step={currentStep}
            stepNumber={stepNumber}
            totalSteps={totalSteps}
            multiTemp={multiTemp}
            setMultiTemp={setMultiTemp}
            onBack={handleBack}
            onQ1Confirm={handleQ1Confirm}
            onQ1_1={handleQ1_1}
            onQ1_2={handleQ1_2}
            onQ2={handleQ2}
            onQ3Confirm={handleQ3Confirm}
            onQ5Confirm={handleQ5Confirm}
            onQ6={handleQ6}
            onQ7={handleQ7}
            onQ8Confirm={handleQ8Confirm}
          />
        )}

        {view === 'loading' && <LoadingView />}

        {view === 'result' && (
          <ResultView
            results={results}
            error={error}
            hiddenIds={new Set([...hiddenIds, ...nativeWatchedIds])}
            onHide={(item) => {
              setHiddenIds(prev => new Set([...prev, item.id]));
              window.webkit?.messageHandlers?.watched?.postMessage({
                id:          item.id,
                title:       item.title,
                posterUrl:   item.poster_url ?? null,
                contentType: item.content_type ?? null,
              });
            }}
            onRestart={resetAll}
          />
        )}

        {view === 'no-result' && <NoResultView onRestart={handleStart} />}

      </div>
    </main>
  );
}

// ── 인트로 ────────────────────────────────────────────────────────────────────

function IntroView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#0D0D0D' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#666', textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          처음으로
        </Link>
      </div>

      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', color: '#E50914', fontStyle: 'italic' }}>NETFLIX</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: 0 }}>오늘 뭐볼까?</h1>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>뭔가 보고싶은데 뭘 보고싶은지 모르겠다면</p>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onStart}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: '#E50914', color: '#fff', fontSize: 13, fontWeight: 800,
              border: 'none', cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            시작하기
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>1분 이내</p>
        </div>
      </div>
    </div>
  );
}

// ── 설문 스텝 ─────────────────────────────────────────────────────────────────

interface QuizStepViewProps {
  step: StepId;
  stepNumber: number;
  totalSteps: number;
  multiTemp: string[];
  setMultiTemp: (v: string[]) => void;
  onBack: () => void;
  onQ1Confirm: () => void;
  onQ1_1: (isEnded: boolean | null) => void;
  onQ1_2: (min: number | null, max: number | null) => void;
  onQ2: (min: number | null, max: number | null) => void;
  onQ3Confirm: () => void;
  onQ5Confirm: () => void;
  onQ6: (d: Desired) => void;
  onQ7: (d: Desired) => void;
  onQ8Confirm: () => void;
}

function QuizStepView(p: QuizStepViewProps) {
  const progress = (p.stepNumber / p.totalSteps) * 100;
  const meta = STEP_META[p.step];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0D0D0D' }} className="animate-fade-slide">

      {/* 헤더 */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={p.onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            이전
          </button>
        </div>

        <div style={{ height: 2, background: '#222', borderRadius: 2, marginBottom: 20 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#E50914', borderRadius: 2, transition: 'width 0.5s ease-out' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: 0 }}>{meta.title}</h2>
          {meta.sub && <p style={{ fontSize: 12, color: '#666', marginTop: 5, marginBottom: 0 }}>{meta.sub}</p>}
        </div>
      </div>

      {/* 스텝별 선택지 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 20px' }}>

        {p.step === 'q1' && (
          <GridMultiStep
            options={Q1_OPTIONS}
            selected={p.multiTemp}
            exclusiveValues={['any']}
            onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['any']))}
            onConfirm={p.onQ1Confirm}
          />
        )}

        {p.step === 'q1_1' && (
          <ListSingleStep
            options={[
              { label: '완결난 거 보고 싶어', emoji: '✅' },
              { label: '완결 안 나도 상관없어', emoji: '📺' },
            ]}
            onSelect={(label) => p.onQ1_1(label.startsWith('완결난') ? true : null)}
          />
        )}

        {p.step === 'q1_2' && (
          <ListSingleStep
            options={[
              { label: '8편 이내', emoji: '✨' },
              { label: '8~16편', emoji: '📺' },
              { label: '길어도 상관없어', emoji: '🔥' },
            ]}
            onSelect={(label) => {
              if (label === '8편 이내')   p.onQ1_2(null, 8);
              else if (label === '8~16편') p.onQ1_2(8, 16);
              else                         p.onQ1_2(null, null);
            }}
          />
        )}

        {p.step === 'q2' && (
          <ListSingleStep
            options={[
              { label: '1시간 이내', emoji: '⏱' },
              { label: '1~2시간',   emoji: '🕐' },
              { label: '2시간 이상', emoji: '🎬' },
              { label: '시간 상관없어', emoji: '⏳' },
            ]}
            onSelect={(label) => {
              if (label === '1시간 이내')     p.onQ2(null, 60);
              else if (label === '1~2시간')   p.onQ2(60, 120);
              else if (label === '2시간 이상') p.onQ2(120, null);
              else                             p.onQ2(null, null);
            }}
          />
        )}

        {p.step === 'q3' && (
          <GridMultiStep
            options={Q3_OPTIONS}
            selected={p.multiTemp}
            exclusiveValues={['any']}
            onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['any']))}
            onConfirm={p.onQ3Confirm}
          />
        )}

        {p.step === 'q5' && (
          <GridMultiStep
            options={Q5_OPTIONS}
            selected={p.multiTemp}
            exclusiveValues={[]}
            onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, []))}
            onConfirm={p.onQ5Confirm}
          />
        )}

        {p.step === 'q6' && (
          <ListSingleStep
            options={Q6_OPTIONS.map(o => ({ label: o.label, emoji: o.emoji }))}
            onSelect={(label) => {
              const opt = Q6_OPTIONS.find(o => o.label === label)!;
              p.onQ6(opt.desired);
            }}
          />
        )}

        {p.step === 'q7' && (
          <ListSingleStep
            options={Q7_OPTIONS.map(o => ({ label: o.label, emoji: o.emoji }))}
            onSelect={(label) => {
              const opt = Q7_OPTIONS.find(o => o.label === label)!;
              p.onQ7(opt.desired);
            }}
          />
        )}

        {p.step === 'q8' && (
          <GridMultiStep
            options={Q8_OPTIONS}
            selected={p.multiTemp}
            exclusiveValues={['none']}
            onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['none']))}
            onConfirm={p.onQ8Confirm}
            confirmLabel="결과 보기"
          />
        )}

      </div>
    </div>
  );
}

// ── 리스트형 단일선택 (q1_1, q1_2, q2, q6, q7) ───────────────────────────────

interface ListSingleStepProps {
  options: { label: string; emoji: string }[];
  onSelect: (label: string) => void;
}

function ListSingleStep({ options, onSelect }: ListSingleStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 32 }}>
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.label)}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1.5px solid #222', background: '#161616',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', transition: 'all 150ms', textAlign: 'left',
          }}
          onTouchStart={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#E50914';
            (e.currentTarget as HTMLButtonElement).style.background = '#1c0303';
          }}
          onTouchEnd={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#222';
            (e.currentTarget as HTMLButtonElement).style.background = '#161616';
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#E50914';
            (e.currentTarget as HTMLButtonElement).style.background = '#1c0303';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#222';
            (e.currentTarget as HTMLButtonElement).style.background = '#161616';
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>{opt.emoji}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#ccc' }}>{opt.label}</span>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #444', flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}

// ── 그리드형 복수선택 (q1, q3, q5, q8) ───────────────────────────────────────

interface GridMultiStepProps {
  options: { label: string; emoji: string; value: string }[];
  selected: string[];
  exclusiveValues: string[];
  onChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

function GridMultiStep({ options, selected, onChange, onConfirm, confirmLabel = '다음' }: GridMultiStepProps) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingBottom: 8 }}>
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '16px 12px', borderRadius: 10,
                border: `1.5px solid ${isSelected ? '#E50914' : '#222'}`,
                background: isSelected ? '#1c0303' : '#161616',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#fff' : '#666', textAlign: 'center', lineHeight: 1.3 }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ position: 'sticky', bottom: 0, padding: '12px 0 24px', background: '#0D0D0D' }}>
        <button
          onClick={onConfirm}
          disabled={selected.length === 0}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: '#E50914', color: '#fff', fontSize: 13, fontWeight: 800,
            border: 'none', cursor: 'pointer',
            opacity: selected.length === 0 ? 0.4 : 1, transition: 'opacity 150ms',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ── 로딩 ─────────────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 animate-fade-slide">
      <div className="flex flex-col items-center gap-4">
        <div style={{ width: 56, height: 56, borderRadius: 12, background: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
          🎬
        </div>
        <div className="flex flex-col items-center gap-1">
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>찾고 있어...</p>
          <p style={{ fontSize: 12, color: '#666' }}>딱 맞는 콘텐츠 고르는 중</p>
        </div>
        <div className="flex gap-2 pt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: '50%', background: '#E50914',
                animation: `dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── 결과 없음 ─────────────────────────────────────────────────────────────────

function NoResultView({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-8 px-6 animate-fade-slide">
      <div className="flex flex-col items-center gap-4 text-center">
        <span style={{ fontSize: 52 }}>📺</span>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.3, margin: 0 }}>에휴 그냥<br />유튜브나 보세요..</h2>
          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>조건에 맞는 콘텐츠를 못 찾겠어</p>
        </div>
      </div>
      <button
        onClick={onRestart}
        style={{
          width: '100%', padding: '14px', borderRadius: 10,
          background: '#E50914', color: '#fff', fontSize: 13, fontWeight: 800,
          border: 'none', cursor: 'pointer',
        }}
      >
        다시 고르기
      </button>
    </div>
  );
}

// ── 결과 화면 ─────────────────────────────────────────────────────────────────

interface ResultViewProps {
  results: RecommendResult[];
  error: string | null;
  hiddenIds: Set<string>;
  onHide: (item: RecommendResult) => void;
  onRestart: () => void;
}

function ResultView({ results, error, hiddenIds, onHide, onRestart }: ResultViewProps) {
  const visible = results.filter(r => !hiddenIds.has(r.id));

  return (
    <div className="flex flex-col animate-fade-slide">
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>오늘의 추천</h2>
          <p style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
            {error ? '오류가 발생했어요' : `${visible.length}개 골라왔어`}
          </p>
        </div>
        <button
          onClick={onRestart}
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'transparent', color: '#E50914', border: '1.5px solid #E50914', cursor: 'pointer',
          }}
        >
          다시하기
        </button>
      </div>

      {error && (
        <div style={{ margin: '0 20px 12px', padding: '12px 14px', borderRadius: 10, background: '#1c0303', color: '#ff6b6b', fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 20px 32px' }}>
        {visible.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <span style={{ fontSize: 36 }}>🎬</span>
            <p style={{ fontSize: 12, color: '#666' }}>아직 데이터가 없어. 내일 다시 와봐!</p>
          </div>
        )}
        {visible.map((item, idx) => (
          <ContentCard key={item.id} item={item} rank={idx + 1} onHide={() => onHide(item)} />
        ))}
      </div>

      {visible.length > 0 && (
        <div style={{ padding: '0 20px 144px' }}>
          <button
            onClick={onRestart}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: '#161616', color: '#666', fontSize: 13, fontWeight: 600,
              border: '1px solid #222', cursor: 'pointer',
            }}
          >
            다른 거 찾아볼게
          </button>
        </div>
      )}
    </div>
  );
}

// ── 콘텐츠 카드 ───────────────────────────────────────────────────────────────

function getNetflixDeepLink(netflixLink: string | null): string | null {
  if (!netflixLink) return null;
  const m = netflixLink.match(/\/title\/(\d+)/);
  return m ? `netflix://title/${m[1]}` : null;
}

function getNaverSearchUrl(title: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(title)}`;
}

const TYPE_LABEL: Record<string, string> = {
  movie: '영화', drama: '드라마', animation: '애니',
  documentary: '다큐', variety: '예능',
};

interface ContentCardProps {
  item: RecommendResult;
  rank: number;
  onHide: () => void;
}

function ContentCard({ item, rank, onHide }: ContentCardProps) {
  const matchPct   = item.match_score;
  const matchColor = matchPct >= 80 ? '#4ade80' : matchPct >= 60 ? '#facc15' : '#f87171';
  const deepLink   = getNetflixDeepLink(item.netflix_link);

  const lengthLabel =
    item.show_type === 'movie'
      ? item.runtime ? `${item.runtime}분` : null
      : item.episode_count ? `${item.episode_count}화` : null;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#161616', border: '1px solid #222' }}>
      {/* 상단: 포스터 + 기본 정보 */}
      <div className="flex gap-3">
        <div style={{ position: 'relative', flexShrink: 0, width: 80, height: 112, background: '#0f0f0f', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 6, left: 6, width: 22, height: 22,
            borderRadius: 6, background: '#E50914',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff', zIndex: 10,
          }}>
            {rank}
          </div>
          {item.poster_url ? (
            <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 28 }}>🎬</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 12px 12px 0', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{
              fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, flex: 1, minWidth: 0,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.title}
            </h3>
            <span style={{
              flexShrink: 0, padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 700,
              background: `${matchColor}22`, color: matchColor, border: `1px solid ${matchColor}44`,
            }}>
              {matchPct}%
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, background: '#222', color: '#E50914' }}>
              {TYPE_LABEL[item.content_type] ?? item.content_type}
            </span>
            {item.release_year && (
              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, background: '#222', color: '#666' }}>
                {item.release_year}
              </span>
            )}
            {lengthLabel && (
              <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, background: '#222', color: '#666' }}>
                {lengthLabel}
              </span>
            )}
          </div>

          {item.genres.length > 0 && (
            <p style={{ fontSize: 11, color: '#555' }}>{item.genres.slice(0, 2).join(' · ')}</p>
          )}

          {item.overview && (
            <p style={{
              fontSize: 11, color: '#555', lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.overview}
            </p>
          )}
        </div>
      </div>

      {/* 하단: 액션 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid #222' }}>
        {deepLink && (
          <a href={deepLink} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: '#E50914', color: '#fff', textDecoration: 'none',
          }}>
            <span>▶</span>
            <span>넷플에서 보기</span>
          </a>
        )}
        {!deepLink && item.netflix_link && (
          <a href={item.netflix_link} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: '#E50914', color: '#fff', textDecoration: 'none',
          }}>
            <span>▶</span>
            <span>넷플에서 보기</span>
          </a>
        )}

        <a href={getNaverSearchUrl(item.title)} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: '#03C75A', color: '#fff', textDecoration: 'none',
        }}>
          검색
        </a>

        <button onClick={onHide} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: '#222', color: '#666', border: 'none', cursor: 'pointer',
        }}>
          봤어
        </button>
      </div>
    </div>
  );
}
