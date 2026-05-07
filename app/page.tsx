'use client';

import { useState } from 'react';
import CharacterImage from '@/app/components/CharacterImage';
import ResultView from '@/app/components/ResultView';
import { questions, getActiveQuestions } from '@/app/lib/questions';
import { calculateResults } from '@/app/lib/scoring';
import { resultsToShareParam } from '@/app/lib/share';
import type { Answers, ScoredMenu } from '@/app/types';
import menusData from '@/data/menus.json';

type View = 'intro' | 'quiz' | 'result';

interface HistoryEntry {
  qIdx: number;
  answers: Answers;
}

export default function Home() {
  const [view, setView] = useState<View>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [results, setResults] = useState<ScoredMenu[]>([]);
  const [isDead, setIsDead] = useState(false);

  const activeQuestions = getActiveQuestions(answers.drink, answers.foodType);
  const currentQuestion = activeQuestions[questionIndex];
  const total = activeQuestions.length;

  function advance(newAnswers: Answers) {
    const newActiveQuestions = questions.filter((q) => {
      if (!q.conditional) return true;
      if (q.id === 'drinkType') return newAnswers.drink === '마심';
      if (q.id === 'meatType') return newAnswers.foodType?.includes('고기') ?? false;
      return false;
    });
    const nextIndex = questionIndex + 1;
    if (nextIndex < newActiveQuestions.length) {
      setQuestionIndex(nextIndex);
      setMultiSelect([]);
    } else {
      finishQuiz(newAnswers);
    }
  }

  function handleSingleAnswer(option: string) {
    const newAnswers: Answers = { ...answers, [currentQuestion.id]: option };
    setHistory((prev) => [...prev, { qIdx: questionIndex, answers }]);
    setAnswers(newAnswers);

    if (currentQuestion.id === 'condition' && option === '이미사망') {
      setIsDead(true);
      setView('result');
      return;
    }

    advance(newAnswers);
  }

  function handleMultiConfirm() {
    const newAnswers: Answers = { ...answers };
    if (currentQuestion.id === 'foodType') newAnswers.foodType = multiSelect;
    else if (currentQuestion.id === 'avoid') newAnswers.avoid = multiSelect;
    else if (currentQuestion.id === 'meatType') newAnswers.meatType = multiSelect;
    setHistory((prev) => [...prev, { qIdx: questionIndex, answers }]);
    setAnswers(newAnswers);
    advance(newAnswers);
  }

  function handleBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setQuestionIndex(prev.qIdx);
    setAnswers(prev.answers);
    setMultiSelect([]);
  }

  function toggleMultiOption(option: string) {
    const exclusives = ['없음', '상관없음'];
    if (exclusives.includes(option)) {
      setMultiSelect([option]);
    } else {
      setMultiSelect((prev) => {
        const withoutExclusive = prev.filter((x) => !exclusives.includes(x));
        if (withoutExclusive.includes(option)) {
          return withoutExclusive.filter((x) => x !== option);
        }
        return [...withoutExclusive, option];
      });
    }
  }

  function finishQuiz(finalAnswers: Answers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored = calculateResults(finalAnswers, menusData.menus as any);
    setResults(scored);
    setView('result');
  }

  function restart() {
    setView('intro');
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
    setResults([]);
    setIsDead(false);
  }

  const showFunnyMessage = answers.diet === '빡세게 중' && answers.drink === '마심';

  const shareUrl =
    view === 'result' && results.length > 0
      ? `${window.location.origin}/result?q=${resultsToShareParam(results)}`
      : undefined;

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">
        {view === 'intro' && (
          <IntroView onStart={() => setView('quiz')} />
        )}
        {view === 'quiz' && currentQuestion && (
          <QuizView
            question={currentQuestion}
            questionNumber={questionIndex + 1}
            total={total}
            multiSelect={multiSelect}
            showBack={history.length > 0}
            onSingleAnswer={handleSingleAnswer}
            onToggleMulti={toggleMultiOption}
            onMultiConfirm={handleMultiConfirm}
            onBack={handleBack}
          />
        )}
        {view === 'result' && (
          <ResultView
            results={results}
            showFunnyMessage={showFunnyMessage}
            shareUrl={isDead ? undefined : shareUrl}
            onRestart={restart}
            isDead={isDead}
          />
        )}
      </div>
    </main>
  );
}

// ── Intro ─────────────────────────────────────────────────────────────────────

function IntroView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col flex-1 px-6 animate-fade-slide">
      <div className="flex flex-col flex-1 items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-orange-50 flex items-center justify-center shadow-inner shadow-orange-100">
              <CharacterImage size={112} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center shadow-md">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold tracking-widest text-orange-400 uppercase mb-2">주메추</p>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
              오늘 뭐 먹지?
            </h1>
            <p className="mt-3 text-gray-400 text-sm leading-relaxed">
              몇 가지 질문에 답하면<br />딱 맞는 메뉴를 추천해줄게
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl bg-orange-400 text-white text-base font-bold tracking-wide shadow-lg shadow-orange-200 active:scale-95 transition-transform"
          >
            메뉴 추천받기
          </button>
          <p className="text-center text-xs text-gray-300">총 10여 가지 질문 · 1분 이내</p>
        </div>
      </div>
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

interface QuizViewProps {
  question: (typeof questions)[0];
  questionNumber: number;
  total: number;
  multiSelect: string[];
  showBack: boolean;
  onSingleAnswer: (option: string) => void;
  onToggleMulti: (option: string) => void;
  onMultiConfirm: () => void;
  onBack: () => void;
}

function QuizView({
  question,
  questionNumber,
  total,
  multiSelect,
  showBack,
  onSingleAnswer,
  onToggleMulti,
  onMultiConfirm,
  onBack,
}: QuizViewProps) {
  const progress = (questionNumber / total) * 100;

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-6 gap-5 animate-fade-slide">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        {showBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 font-medium active:scale-95 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            이전
          </button>
        ) : (
          <div />
        )}
        <span className="text-xs font-semibold text-gray-400 tracking-widest">
          {questionNumber} / {total}
        </span>
        <div className="w-10" />
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 캐릭터 + 질문 말풍선 */}
      <div className="flex items-start gap-3 pt-1">
        <CharacterImage size={40} className="shrink-0 mt-1" />
        <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
          <p className="text-base font-bold text-gray-800 leading-snug">
            {question.text}
          </p>
          {question.subText && (
            <p className="mt-1 text-xs text-gray-400">{question.subText}</p>
          )}
        </div>
      </div>

      {/* 선택지 */}
      {question.type === 'single' ? (
        <div className="flex flex-col gap-2.5 flex-1">
          {question.options.map((option) => (
            <button
              key={option}
              onClick={() => onSingleAnswer(option)}
              className="w-full py-3.5 px-5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium text-base text-left active:scale-[0.98] active:bg-orange-50 hover:border-orange-300 transition-all shadow-sm"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1">
          <div className="grid grid-cols-2 gap-2.5">
            {question.options.map((option) => {
              const selected = multiSelect.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => onToggleMulti(option)}
                  className={`py-3 px-4 rounded-2xl border font-medium text-sm transition-all active:scale-95 ${
                    selected
                      ? 'border-orange-400 bg-orange-400 text-white shadow-md shadow-orange-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 shadow-sm'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-2">
            <button
              onClick={onMultiConfirm}
              disabled={multiSelect.length === 0}
              className="w-full py-4 rounded-2xl bg-orange-400 text-white font-bold text-base shadow-lg shadow-orange-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              선택 완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
