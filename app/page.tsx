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
            shareUrl={shareUrl}
            onRestart={restart}
          />
        )}
      </div>
    </main>
  );
}

// ── Intro ─────────────────────────────────────────────────────────────────────

function IntroView({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 gap-8 animate-fade-slide">
      <div className="flex flex-col items-center gap-4">
        <CharacterImage size={140} />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            오늘 뭐 먹지? 🍽️
          </h1>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-400 text-white text-lg font-bold shadow-lg shadow-rose-200 active:scale-95 transition-transform"
      >
        메뉴 고르기 🎯
      </button>
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
    <div className="flex flex-col flex-1 px-5 pt-6 pb-6 gap-4 animate-fade-slide">
      {showBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1 text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors active:scale-95"
        >
          ← 이전으로
        </button>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CharacterImage size={36} />
          <span className="text-sm font-medium text-gray-500">
            {questionNumber}/{total}
          </span>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rose-400 to-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1">
        <p className="text-xl font-bold text-gray-800 leading-snug">
          {question.text}
        </p>
        {question.subText && (
          <p className="mt-1 text-sm text-gray-400">{question.subText}</p>
        )}
      </div>

      {question.type === 'single' ? (
        <div className="flex flex-col gap-3 flex-1">
          {question.options.map((option) => (
            <button
              key={option}
              onClick={() => onSingleAnswer(option)}
              className="w-full py-4 px-5 rounded-2xl border-2 border-orange-200 bg-white text-gray-700 font-medium text-base text-left active:scale-95 active:bg-orange-50 hover:border-rose-300 hover:bg-rose-50 transition-all"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((option) => {
              const selected = multiSelect.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => onToggleMulti(option)}
                  className={`py-3 px-4 rounded-2xl border-2 font-medium text-sm transition-all active:scale-95 ${
                    selected
                      ? 'border-rose-400 bg-gradient-to-br from-rose-400 to-orange-400 text-white shadow-md shadow-rose-200'
                      : 'border-orange-200 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50'
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
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-400 text-white font-bold text-base shadow-lg shadow-rose-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              선택 완료 ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
