import { useState } from 'react';
import type { Answers } from '@/app/types';

export interface HistoryEntry {
  qIdx: number;
  answers: Answers;
}

/**
 * 설문(퀴즈) 진행 상태를 묶어서 관리하는 훅.
 * 4개의 상태(questionIndex/answers/multiSelect/history)와 reset()을 한 번에 제공.
 */
export function useQuizState() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function reset() {
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
  }

  return {
    questionIndex,
    setQuestionIndex,
    answers,
    setAnswers,
    multiSelect,
    setMultiSelect,
    history,
    setHistory,
    reset,
  };
}
