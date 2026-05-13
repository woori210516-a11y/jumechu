'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { RecommendResult } from '@/app/api/netflix/recommend/route';

// ── 타입 ─────────────────────────────────────────────────────────────────────

type TagKey =
  | 'lightness' | 'tension' | 'emotion' | 'horror' | 'laughter' | 'romance' | 'healing'
  | 'concentration' | 'violence' | 'adult' | 'background_watch' | 'episode_length'
  | 'with_partner' | 'with_family' | 'with_friend' | 'solo';

type Desired = Partial<Record<TagKey, number>>;

type StepId = 'q1' | 'q1_1' | 'q1_2' | 'q2' | 'q3' | 'q5' | 'q6' | 'q7' | 'q8';

type View = 'intro' | 'quiz' | 'loading' | 'result' | 'no-result';

interface SurveyState {
  contentTypes: string[];     // 'movie'|'drama'|'animation'|'documentary'|'variety'|'any'
  isEnded: boolean | null;
  episodeMin: number | null;
  episodeMax: number | null;
  runtimeMin: number | null;
  runtimeMax: number | null;
  countries: string[];        // 국가 그룹 선택: 'kr'|'jp'|'cn'|'eu'|'us'|'other'|'any'
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

function toggleMulti(
  prev: string[],
  value: string,
  exclusiveValues: string[]
): string[] {
  if (exclusiveValues.includes(value)) return [value];
  const withoutExclusive = prev.filter(v => !exclusiveValues.includes(v));
  if (withoutExclusive.includes(value)) return withoutExclusive.filter(v => v !== value);
  return [...withoutExclusive, value];
}

// ── Q1 선택지 ─────────────────────────────────────────────────────────────────

const Q1_OPTIONS = [
  { label: '영화',        emoji: '🎬', value: 'movie' },
  { label: '드라마',      emoji: '📺', value: 'drama' },
  { label: '애니메이션',  emoji: '✨', value: 'animation' },
  { label: '다큐멘터리',  emoji: '🎥', value: 'documentary' },
  { label: '예능',        emoji: '🎭', value: 'variety' },
  { label: '상관없음',    emoji: '🎲', value: 'any' },
];

// ── Q3 선택지 (국가) ──────────────────────────────────────────────────────────

const Q3_OPTIONS = [
  { label: '한국',    emoji: '🇰🇷', value: 'kr' },
  { label: '일본',    emoji: '🇯🇵', value: 'jp' },
  { label: '중국',    emoji: '🇨🇳', value: 'cn' },
  { label: '유럽',    emoji: '🇪🇺', value: 'eu' },
  { label: '헐리웃',  emoji: '🎬', value: 'us' },
  { label: '기타',    emoji: '🌏', value: 'other' },
  { label: '상관없음', emoji: '🎲', value: 'any' },
];

// 국가 그룹 → ISO 코드 매핑
const COUNTRY_CODES: Record<string, string[]> = {
  kr:    ['KR'],
  jp:    ['JP'],
  cn:    ['CN', 'TW', 'HK'],
  eu:    ['DE', 'FR', 'IT', 'ES', 'SE', 'NO', 'DK', 'NL', 'PL', 'FI', 'BE', 'AT', 'CH'],
  us:    ['US', 'GB', 'CA', 'AU'],
  other: ['TH', 'IN', 'PH', 'SG', 'ID', 'VN', 'MY', 'TR', 'MX', 'AR', 'BR', 'RU'],
};

// ── Q5 선택지 ─────────────────────────────────────────────────────────────────

const Q5_OPTIONS = [
  { label: '가볍게 웃을 수 있는',  value: 'funny',   emoji: '😂', desired: { laughter: 9, lightness: 8 } as Desired },
  { label: '긴장감 넘치는',       value: 'tension', emoji: '😰', desired: { tension: 9 } as Desired },
  { label: '감동적인',            value: 'moving',  emoji: '🥺', desired: { emotion: 8, romance: 4 } as Desired },
  { label: '무서운',              value: 'horror',  emoji: '😱', desired: { horror: 8, tension: 5 } as Desired },
  { label: '설레는',              value: 'romance', emoji: '💕', desired: { romance: 9, lightness: 6 } as Desired },
  { label: '생각하게 되는',       value: 'deep',    emoji: '🤔', desired: { concentration: 8 } as Desired },
  { label: '슬픈',               value: 'sad',     emoji: '😢', desired: { emotion: 8, lightness: 3 } as Desired },
];

// ── Q6 선택지 ─────────────────────────────────────────────────────────────────

const Q6_OPTIONS = [
  { label: '자막 집중해서 볼거야',   emoji: '🎯', desired: { concentration: 8, background_watch: 2 } as Desired },
  { label: '그냥 틀어만 놓을거야',   emoji: '📱', desired: { background_watch: 8, concentration: 2 } as Desired },
  { label: '중간 정도',             emoji: '😌', desired: { concentration: 5, background_watch: 5 } as Desired },
];

// ── Q7 선택지 ─────────────────────────────────────────────────────────────────

const Q7_OPTIONS = [
  { label: '혼자',    emoji: '🎧', desired: { solo: 10 } as Desired },
  { label: '연인이랑', emoji: '👫', desired: { with_partner: 10 } as Desired },
  { label: '가족이랑', emoji: '👨‍👩‍👦', desired: { with_family: 10 } as Desired },
  { label: '친구랑',  emoji: '🍿', desired: { with_friend: 10 } as Desired },
];

// ── Q8 선택지 ─────────────────────────────────────────────────────────────────

const Q8_OPTIONS = [
  { label: '폭력적인 장면', emoji: '🔪', value: 'violence' },
  { label: '성인 콘텐츠',   emoji: '🔞', value: 'adult'   },
  { label: '무서운 거',     emoji: '👻', value: 'horror'  },
  { label: '너무 슬픈 거',  emoji: '😢', value: 'sad'     },
  { label: '없음',          emoji: '✅', value: 'none'    },
];

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

export default function NetflixPage() {
  const [view,         setView]         = useState<View>('intro');
  const [currentStep,  setCurrentStep]  = useState<StepId>('q1');
  const [stepHistory,  setStepHistory]  = useState<Array<{ step: StepId; survey: SurveyState }>>([]);
  const [survey,       setSurvey]       = useState<SurveyState>(INITIAL_SURVEY);
  const [multiTemp,    setMultiTemp]    = useState<string[]>([]);
  const [results,      setResults]      = useState<RecommendResult[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [hiddenIds,    setHiddenIds]    = useState<Set<string>>(new Set());

  // 멀티셀렉트 스텝 진입 시 초기화 (뒤로가기 지원)
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

  // ── 상태 초기화 ─────────────────────────────────────────────────────────────

  function resetAll() {
    setView('intro');
    setCurrentStep('q1');
    setStepHistory([]);
    setSurvey(INITIAL_SURVEY);
    setMultiTemp([]);
    setResults([]);
    setError(null);
    setHiddenIds(new Set());
  }

  function handleStart() {
    resetAll();
    setView('quiz');
  }

  // ── 뒤로가기 ────────────────────────────────────────────────────────────────

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

  // ── 공통: 다음 스텝으로 진행 ────────────────────────────────────────────────

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

  // ── API 호출 ─────────────────────────────────────────────────────────────────

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
      } else {
        setResults(data);
        setView('result');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setView('result');
    }
  }

  // ── 단일 선택 핸들러 ─────────────────────────────────────────────────────────

  function handleQ1_1(isEnded: boolean | null) {
    advance({ ...survey, isEnded });
  }
  function handleQ1_2(episodeMin: number | null, episodeMax: number | null) {
    advance({ ...survey, episodeMin, episodeMax });
  }
  function handleQ2(runtimeMin: number | null, runtimeMax: number | null) {
    advance({ ...survey, runtimeMin, runtimeMax });
  }
  function handleQ5Confirm() {
    if (multiTemp.length === 0) return;
    let merged: Desired = {};
    for (const val of multiTemp) {
      const opt = Q5_OPTIONS.find(o => o.value === val);
      if (opt) merged = mergeDesired(merged, opt.desired);
    }
    advance({ ...survey, desired: mergeDesired(survey.desired, merged) });
  }
  function handleQ6(desired: Desired) {
    advance({ ...survey, desired: mergeDesired(survey.desired, desired) });
  }
  function handleQ7(desired: Desired) {
    advance({ ...survey, desired: mergeDesired(survey.desired, desired) });
  }

  // ── 다중 선택 확인 핸들러 ────────────────────────────────────────────────────

  function handleQ1Confirm() {
    if (multiTemp.length === 0) return;
    advance({ ...survey, contentTypes: multiTemp });
  }
  function handleQ3Confirm() {
    if (multiTemp.length === 0) return;
    advance({ ...survey, countries: multiTemp });
  }
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

  // ── 진행 상태 계산 ──────────────────────────────────────────────────────────

  const activeSteps   = computeActiveSteps(survey);
  const stepNumber    = stepHistory.length + 1;
  const totalSteps    = activeSteps.length;

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex justify-center items-start" style={{ background: '#141414' }}>
      <div className="w-full max-w-[390px] min-h-screen flex flex-col" style={{ background: '#141414' }}>

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
            hiddenIds={hiddenIds}
            onHide={id => setHiddenIds(prev => new Set([...prev, id]))}
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
    <div className="flex flex-col flex-1 animate-fade-slide">
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

      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-8">
          <div className="text-5xl font-bold tracking-tight" style={{ color: '#E50914' }}>넷플</div>
          <div className="text-center flex flex-col gap-3">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#fff' }}>
              오늘 뭐볼까?<br />넷플에서 골라봐
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#888' }}>
              몇 가지 질문으로 딱 맞는 콘텐츠 추려줄게
            </p>
          </div>
          <div className="flex gap-3">
            {['🎬', '🍿', '😱', '💕', '😂'].map((e, i) => (
              <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#1f1f1f' }}>
                {e}
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
          <p className="text-center text-xs" style={{ color: '#555' }}>1분 이내</p>
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

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-6 gap-5 animate-fade-slide">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={p.onBack}
          className="flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-all"
          style={{ color: '#888' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          이전
        </button>
        <span className="text-xs font-semibold tracking-widest" style={{ color: '#666' }}>
          {p.stepNumber} / {p.totalSteps}
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

      {/* 스텝별 렌더 */}
      {p.step === 'q1' && (
        <MultiStep
          title="오늘 뭐 보고 싶어요?"
          subTitle="복수 선택 가능해요"
          options={Q1_OPTIONS}
          selected={p.multiTemp}
          exclusiveValues={['any']}
          onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['any']))}
          onConfirm={p.onQ1Confirm}
        />
      )}

      {p.step === 'q1_1' && (
        <SingleStep
          title="완결난 드라마가 좋아요?"
          options={[
            { label: '완결난 거 보고 싶어', emoji: '✅' },
            { label: '완결 안 나도 상관없어', emoji: '📺' },
          ]}
          onSelect={(label) => {
            p.onQ1_1(label.startsWith('완결난') ? true : null);
          }}
        />
      )}

      {p.step === 'q1_2' && (
        <SingleStep
          title="몇 편 정도 볼 수 있어요?"
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
        <SingleStep
          title="얼마나 볼 수 있어요?"
          options={[
            { label: '1시간 이내', emoji: '⏱' },
            { label: '1~2시간',   emoji: '🕐' },
            { label: '2시간 이상', emoji: '🎬' },
            { label: '시간 상관없어', emoji: '⏳' },
          ]}
          onSelect={(label) => {
            if (label === '1시간 이내')    p.onQ2(null, 60);
            else if (label === '1~2시간')   p.onQ2(60, 120);
            else if (label === '2시간 이상') p.onQ2(120, null);
            else                             p.onQ2(null, null);
          }}
        />
      )}

      {p.step === 'q3' && (
        <MultiStep
          title="어느 나라 콘텐츠가 좋아요?"
          subTitle="복수 선택 가능해요"
          options={Q3_OPTIONS}
          selected={p.multiTemp}
          exclusiveValues={['any']}
          onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['any']))}
          onConfirm={p.onQ3Confirm}
        />
      )}

      {p.step === 'q5' && (
        <MultiStep
          title="어떤 느낌이 보고 싶어요?"
          subTitle="복수 선택 가능해요"
          options={Q5_OPTIONS}
          selected={p.multiTemp}
          exclusiveValues={[]}
          onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, []))}
          onConfirm={p.onQ5Confirm}
        />
      )}

      {p.step === 'q6' && (
        <SingleStep
          title="얼마나 집중할 수 있어요?"
          options={Q6_OPTIONS.map(o => ({ label: o.label, emoji: o.emoji }))}
          onSelect={(label) => {
            const opt = Q6_OPTIONS.find(o => o.label === label)!;
            p.onQ6(opt.desired);
          }}
        />
      )}

      {p.step === 'q7' && (
        <SingleStep
          title="누구랑 봐요?"
          options={Q7_OPTIONS.map(o => ({ label: o.label, emoji: o.emoji }))}
          onSelect={(label) => {
            const opt = Q7_OPTIONS.find(o => o.label === label)!;
            p.onQ7(opt.desired);
          }}
        />
      )}

      {p.step === 'q8' && (
        <MultiStep
          title="피하고 싶은 게 있어요?"
          subTitle="복수 선택 가능해요"
          options={Q8_OPTIONS}
          selected={p.multiTemp}
          exclusiveValues={['none']}
          onChange={(v) => p.setMultiTemp(toggleMulti(p.multiTemp, v, ['none']))}
          onConfirm={p.onQ8Confirm}
          confirmLabel="결과 보기"
        />
      )}
    </div>
  );
}

// ── 단일 선택 공통 컴포넌트 ───────────────────────────────────────────────────

interface SingleStepProps {
  title: string;
  options: { label: string; emoji: string }[];
  onSelect: (label: string) => void;
}

function SingleStep({ title, options, onSelect }: SingleStepProps) {
  return (
    <div className="flex flex-col gap-5 flex-1 pt-2">
      <h2 className="text-xl font-bold leading-snug" style={{ color: '#fff' }}>{title}</h2>
      <div className="flex flex-col gap-2.5">
        {options.map(opt => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 active:scale-[0.98] transition-all"
            style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', color: '#fff' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E50914';
              (e.currentTarget as HTMLButtonElement).style.background = '#2a0a0a';
            }}
            onMouseLeave={e => {
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

// ── 다중 선택 공통 컴포넌트 ───────────────────────────────────────────────────

interface MultiStepProps {
  title: string;
  subTitle?: string;
  options: { label: string; emoji: string; value: string }[];
  selected: string[];
  exclusiveValues: string[];
  onChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

function MultiStep({
  title, subTitle, options, selected, onChange, onConfirm, confirmLabel = '다음',
}: MultiStepProps) {
  return (
    <div className="flex flex-col gap-4 flex-1 pt-2">
      <div>
        <h2 className="text-xl font-bold leading-snug" style={{ color: '#fff' }}>{title}</h2>
        {subTitle && <p className="text-sm mt-1" style={{ color: '#888' }}>{subTitle}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2.5 flex-1">
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="py-4 px-3 rounded-2xl flex flex-col items-center gap-1.5 active:scale-[0.97] transition-all"
              style={{
                background: isSelected ? '#2a0a0a' : '#1f1f1f',
                border: `1px solid ${isSelected ? '#E50914' : '#2a2a2a'}`,
                color: isSelected ? '#fff' : '#aaa',
              }}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-sm font-medium text-center leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onConfirm}
        disabled={selected.length === 0}
        className="w-full py-4 rounded-2xl text-white text-base font-bold active:scale-95 transition-transform disabled:opacity-40"
        style={{ background: '#E50914', boxShadow: selected.length > 0 ? '0 8px 24px rgba(229,9,20,0.3)' : 'none' }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

// ── 로딩 ─────────────────────────────────────────────────────────────────────

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
        <div className="flex gap-2 pt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: '#E50914',
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
        <span className="text-6xl">📺</span>
        <h2 className="text-xl font-bold" style={{ color: '#fff' }}>
          에휴 그냥<br />유튜브나 보세요..
        </h2>
        <p className="text-sm" style={{ color: '#666' }}>
          조건에 맞는 콘텐츠를 못 찾겠어
        </p>
      </div>
      <button
        onClick={onRestart}
        className="w-full py-4 rounded-2xl text-white text-base font-bold active:scale-95 transition-transform"
        style={{ background: '#E50914', boxShadow: '0 8px 24px rgba(229,9,20,0.4)' }}
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
  onHide: (id: string) => void;
  onRestart: () => void;
}

function ResultView({ results, error, hiddenIds, onHide, onRestart }: ResultViewProps) {
  const visible = results.filter(r => !hiddenIds.has(r.id));

  return (
    <div className="flex flex-col flex-1 animate-fade-slide">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#fff' }}>오늘의 추천 🎬</h2>
          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
            {error ? '오류가 발생했어요' : `${visible.length}개 골라왔어`}
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
        <div className="mx-5 mb-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#2a0a0a', color: '#ff6b6b' }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 pb-8 pt-1">
        {visible.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <span className="text-4xl">🎬</span>
            <p className="text-sm" style={{ color: '#666' }}>아직 데이터가 없어. 내일 다시 와봐!</p>
          </div>
        )}
        {visible.map((item, idx) => (
          <ContentCard
            key={item.id}
            item={item}
            rank={idx + 1}
            onHide={() => onHide(item.id)}
          />
        ))}
      </div>

      {visible.length > 0 && (
        <div className="px-5 pb-8 mt-auto">
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
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      {/* 상단: 포스터 + 기본 정보 */}
      <div className="flex gap-3">
        {/* 포스터 */}
        <div className="relative shrink-0 w-20 h-28 overflow-hidden" style={{ background: '#0f0f0f' }}>
          <div
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold z-10"
            style={{ background: '#E50914', color: '#fff' }}
          >
            {rank}
          </div>
          {item.poster_url ? (
            <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
          )}
        </div>

        {/* 텍스트 */}
        <div className="flex flex-col flex-1 py-3 pr-3 gap-1.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-sm font-bold leading-snug flex-1 min-w-0"
              style={{
                color: '#fff',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {item.title}
            </h3>
            <span
              className="shrink-0 px-1.5 py-0.5 rounded-md text-xs font-bold"
              style={{ background: `${matchColor}22`, color: matchColor, border: `1px solid ${matchColor}44` }}
            >
              {matchPct}%
            </span>
          </div>

          {/* 배지 */}
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: '#2a2a2a', color: '#E50914' }}>
              {TYPE_LABEL[item.content_type] ?? item.content_type}
            </span>
            {item.release_year && (
              <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: '#2a2a2a', color: '#888' }}>
                {item.release_year}
              </span>
            )}
            {lengthLabel && (
              <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: '#2a2a2a', color: '#888' }}>
                {lengthLabel}
              </span>
            )}
          </div>

          {item.genres.length > 0 && (
            <p className="text-xs" style={{ color: '#666' }}>{item.genres.slice(0, 2).join(' · ')}</p>
          )}

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
        </div>
      </div>

      {/* 하단: 액션 버튼 */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderTop: '1px solid #2a2a2a' }}
      >
        {/* 넷플릭스 앱 열기 */}
        {deepLink && (
          <a
            href={deepLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
            style={{ background: '#E50914', color: '#fff' }}
          >
            <span>▶</span>
            <span>넷플에서 보기</span>
          </a>
        )}
        {!deepLink && item.netflix_link && (
          <a
            href={item.netflix_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
            style={{ background: '#E50914', color: '#fff' }}
          >
            <span>▶</span>
            <span>넷플에서 보기</span>
          </a>
        )}

        {/* 네이버 검색 */}
        <a
          href={getNaverSearchUrl(item.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium active:scale-95 transition-all"
          style={{ background: '#1f1f1f', color: '#03c75a', border: '1px solid #2a2a2a' }}
        >
          검색
        </a>

        {/* 이건 봤어요 */}
        <button
          onClick={onHide}
          className="flex items-center justify-center py-2.5 px-3 rounded-xl text-sm font-medium active:scale-95 transition-all"
          style={{ background: '#1f1f1f', color: '#666', border: '1px solid #2a2a2a' }}
          title="이건 봤어요"
        >
          봤어
        </button>
      </div>
    </div>
  );
}
