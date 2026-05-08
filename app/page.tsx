'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import CharacterImage from '@/app/components/CharacterImage';
import ResultView from '@/app/components/ResultView';
import { GroupPeopleView, GroupInviteView, GroupWaitingView } from '@/app/components/GroupFlow';
import { questions, getActiveQuestions } from '@/app/lib/questions';
import { calculateResults } from '@/app/lib/scoring';
import { resultsToShareParam } from '@/app/lib/share';
import { createRoom, joinRoom, fetchRoom, fetchRoomState, submitResult } from '@/app/lib/group';
import type { Answers, Concept, ScoredMenu } from '@/app/types';
import { menus } from '@/app/lib/menus';

type View = 'intro' | 'quiz' | 'result' | 'group-people' | 'group-invite' | 'group-waiting' | 'room-error';

interface HistoryEntry {
  qIdx: number;
  answers: Answers;
}

interface GroupState {
  roomId: string;
  nickname: string;
  participantId: string;
  maxMembers: number;
}

const CONCEPT_CONFIG: Record<Concept, { label: string; title: string; sub: string; button: string }> = {
  boyfriend: {
    label: '남친',
    title: '울자기 머먹을까?',
    sub: '이것도 싫고ㅎ저것도 싫다고 해서~ 준비해봣어ㅎ',
    button: '아무거나 먹자며..',
  },
  mom: {
    label: '엄마',
    title: '아휴 엄마가 밥먹으랬지!!!',
    sub: '너너 맨날 라면이나 처먹으니까 살이찌지 저거저거 어휴 내가 못살아',
    button: '아 알겟다고 ㅠ',
  },
  together: {
    label: '같이고르기',
    title: '그래서 오늘 뭐먹을껀데?',
    sub: '다 고르면 깨워라..',
    button: '안 고르면 라면',
  },
};

const CONCEPT_IMAGE: Record<Concept, { main: string; quiz: string }> = {
  boyfriend: { main: '/boyfriend-main.png', quiz: '/boyfriend-quiz.png' },
  mom:       { main: '/mom-main.png',       quiz: '/mom-quiz.png' },
  together:  { main: '/group-main.png',     quiz: '/group-quiz.png' },
};

const CONCEPT_ORDER: Concept[] = ['boyfriend', 'mom', 'together'];

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────────

function HomeContent() {
  const searchParams = useSearchParams();
  const hasJoinedRef = useRef(false);

  const [view, setView] = useState<View>('intro');
  const [concept, setConcept] = useState<Concept>('boyfriend');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [results, setResults] = useState<ScoredMenu[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [groupState, setGroupState] = useState<GroupState | null>(null);
  const [roomErrorInfo, setRoomErrorInfo] = useState<{ title: string; sub: string }>({
    title: '방을 찾을 수 없어요',
    sub: '링크가 잘못됐거나 이미 삭제된 방이야',
  });

  // 공유 링크 접속 처리
  useEffect(() => {
    if (hasJoinedRef.current) return;
    const roomId = searchParams.get('room');
    if (!roomId) return;
    hasJoinedRef.current = true;

    // URL 즉시 정리
    window.history.replaceState({}, '', '/');

    function showRoomError(title: string, sub: string) {
      setRoomErrorInfo({ title, sub });
      setView('room-error');
    }

    async function doJoin() {
      try {
        // 1. 방 존재 여부 확인
        const room = await fetchRoom(roomId!);
        if (!room) {
          showRoomError('방을 찾을 수 없어요', '링크가 잘못됐거나 이미 삭제된 방이야');
          return;
        }

        // 2. 만료 여부 확인
        if (room.expires_at && new Date(room.expires_at) < new Date()) {
          showRoomError('방이 만료됐어요 😢', '30분이 지나 방이 사라졌어요');
          return;
        }

        // 3. 이미 완료된 방 → 최종 결과 바로 표시
        if (room.status === 'done' && room.final_result) {
          setConcept('together');
          const menu = menus.find((m) => m.name === room.final_result);
          setResults(menu ? [{ menu, score: 99 }] : []);
          setView('result');
          return;
        }

        setConcept('together');

        // 참여자 목록 한 번만 조회 (4·5번 분기에 공통 사용)
        const roomState = await fetchRoomState(roomId!);

        // 4. 로컬스토리지에 이력 있음 → 재접속
        const storedNickname = localStorage.getItem(`group_nickname_${roomId}`);
        const storedParticipantId = localStorage.getItem(`group_participant_id_${roomId}`);

        if (storedNickname && storedParticipantId) {
          const me = roomState.participants.find((p) => p.id === storedParticipantId);
          if (me) {
            setGroupState({ roomId: roomId!, nickname: me.nickname, participantId: me.id, maxMembers: room.max_members });
            if (me.completed) {
              setView('group-waiting');
            } else {
              setQuestionIndex(0);
              setAnswers({});
              setMultiSelect([]);
              setHistory([]);
              setView('quiz');
            }
            return;
          }
          // 로컬에는 있지만 DB에 없음 → 신규 참여로 fallthrough
        }

        // 5. 신규 참여자
        if (roomState.participants.length >= room.max_members) {
          showRoomError('인원이 꽉 찼어요', `최대 ${room.max_members}명까지 참여할 수 있어`);
          return;
        }
        const { nickname, participantId } = await joinRoom(roomId!);
        setGroupState({ roomId: roomId!, nickname, participantId, maxMembers: room.max_members });
        // 링크로 참여한 신규 멤버는 바로 설문 시작
        setQuestionIndex(0);
        setAnswers({});
        setMultiSelect([]);
        setHistory([]);
        setView('quiz');
      } catch (e) {
        console.error('join error:', e);
        showRoomError('오류가 발생했어요', '잠시 후 다시 시도해줘');
      }
    }
    doJoin();
  }, [searchParams]);

  const activeQuestions = getActiveQuestions(answers.drink, answers.foodType);
  const currentQuestion = activeQuestions[questionIndex];
  const total = activeQuestions.length;

  function startQuiz() {
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
    if (concept === 'together') {
      setView('group-people');
    } else {
      setView('quiz');
    }
  }

  async function handleGroupPeopleNext(maxMembers: number) {
    const roomId = await createRoom(maxMembers);
    const { nickname, participantId } = await joinRoom(roomId);
    setGroupState({ roomId, nickname, participantId, maxMembers });
    setView('group-invite');
  }

  function handleGroupStart() {
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
    setView('quiz');
  }

  function handleGroupFinalResult(menuName: string) {
    const menu = menus.find((m) => m.name === menuName);
    // score를 높게 고정해서 저점수(햇반) 화면이 뜨지 않도록 함
    setResults(menu ? [{ menu, score: 99 }] : []);
    setView('result');
  }

  function advance(newAnswers: Answers) {
    const newActiveQuestions = getActiveQuestions(newAnswers.drink, newAnswers.foodType);
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
    if (history.length === 0) {
      setView(groupState ? 'group-invite' : 'intro');
      return;
    }
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
        if (withoutExclusive.includes(option)) return withoutExclusive.filter((x) => x !== option);
        return [...withoutExclusive, option];
      });
    }
  }

  function finishQuiz(finalAnswers: Answers) {
    const scored = calculateResults(finalAnswers, menus);
    setResults(scored);

    if (groupState && scored.length > 0) {
      submitResult(groupState.participantId, scored[0].menu.name).catch(console.error);
      setView('group-waiting');
    } else {
      setView('result');
    }
  }

  function restart() {
    setView('intro');
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
    setResults([]);
    setIsDead(false);
    setGroupState(null);
  }

  // 그룹 모드 전용: 사망 시 설문 처음으로 (groupState 유지)
  function restartQuizOnly() {
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelect([]);
    setHistory([]);
    setResults([]);
    setIsDead(false);
    setView('quiz');
  }

  const showFunnyMessage = answers.diet === '빡세게 중' && answers.drink === '마심';

  const shareUrl =
    view === 'result' && results.length > 0
      ? groupState
        ? `${window.location.origin}/room/${groupState.roomId}`
        : `${window.location.origin}/result?q=${resultsToShareParam(results)}`
      : undefined;

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">

        {view === 'intro' && (
          <IntroView concept={concept} onConceptChange={setConcept} onStart={startQuiz} />
        )}

        {view === 'group-people' && (
          <GroupPeopleView
            onNext={handleGroupPeopleNext}
            onBack={() => setView('intro')}
          />
        )}

        {view === 'group-invite' && groupState && (
          <GroupInviteView
            roomId={groupState.roomId}
            nickname={groupState.nickname}
            onStart={handleGroupStart}
            onBack={() => setView('intro')}
          />
        )}

        {view === 'quiz' && currentQuestion && (
          <QuizView
            question={currentQuestion}
            questionNumber={questionIndex + 1}
            total={total}
            multiSelect={multiSelect}
            quizImageSrc={CONCEPT_IMAGE[concept].quiz}
            onSingleAnswer={handleSingleAnswer}
            onToggleMulti={toggleMultiOption}
            onMultiConfirm={handleMultiConfirm}
            onBack={handleBack}
          />
        )}

        {view === 'group-waiting' && groupState && (
          <GroupWaitingView
            roomId={groupState.roomId}
            nickname={groupState.nickname}
            maxMembers={groupState.maxMembers}
            onFinalResult={handleGroupFinalResult}
          />
        )}

        {view === 'room-error' && (
          <RoomErrorView title={roomErrorInfo.title} sub={roomErrorInfo.sub} onBack={restart} />
        )}

        {view === 'result' && (
          <ResultView
            results={results}
            showFunnyMessage={showFunnyMessage}
            shareUrl={isDead ? undefined : shareUrl}
            onRestart={restart}
            onRestartQuiz={groupState ? restartQuizOnly : undefined}
            isDead={isDead}
            concept={concept}
          />
        )}

      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <HomeContent />
    </Suspense>
  );
}

// ── 방 오류 화면 ───────────────────────────────────────────────────────────────────

function RoomErrorView({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 gap-8 animate-fade-slide">
      <div className="flex flex-col items-center gap-5">
        <Image src="/hungry.png" alt="오류" width={200} height={200} className="object-contain" priority />
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">{title}</p>
          <p className="mt-2 text-gray-400 text-sm leading-relaxed">{sub}</p>
        </div>
      </div>
      <button
        onClick={onBack}
        className="w-full py-4 rounded-2xl bg-orange-400 text-white font-bold text-base shadow-lg shadow-orange-100 active:scale-95 transition-transform"
      >
        처음으로
      </button>
    </div>
  );
}

// ── 인트로 화면 ────────────────────────────────────────────────────────────────────

interface IntroViewProps {
  concept: Concept;
  onConceptChange: (c: Concept) => void;
  onStart: () => void;
}

function IntroView({ concept, onConceptChange, onStart }: IntroViewProps) {
  const cfg = CONCEPT_CONFIG[concept];

  return (
    <div className="flex flex-col flex-1 animate-fade-slide">
      {/* 컨셉 탭 */}
      <div className="px-5 pt-5">
        <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
          {CONCEPT_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => onConceptChange(c)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                concept === c ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
              }`}
            >
              {CONCEPT_CONFIG[c].label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center">
            <Image
              src={CONCEPT_IMAGE[concept].main}
              alt="캐릭터"
              width={200}
              height={200}
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{cfg.title}</h1>
            <p className="mt-3 text-gray-400 text-sm leading-relaxed">{cfg.sub}</p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl bg-orange-400 text-white text-base font-bold tracking-wide shadow-lg shadow-orange-200 active:scale-95 transition-transform"
          >
            {cfg.button}
          </button>
          <p className="text-center text-xs text-gray-300">총 10여 가지 질문 · 1분 이내</p>
        </div>
      </div>
    </div>
  );
}

// ── 설문 화면 ──────────────────────────────────────────────────────────────────────

interface QuizViewProps {
  question: (typeof questions)[0];
  questionNumber: number;
  total: number;
  multiSelect: string[];
  quizImageSrc: string;
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
  quizImageSrc,
  onSingleAnswer,
  onToggleMulti,
  onMultiConfirm,
  onBack,
}: QuizViewProps) {
  const progress = (questionNumber / total) * 100;

  return (
    <div className="flex flex-col flex-1 px-5 pt-5 pb-6 gap-5 animate-fade-slide">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 font-medium active:scale-95 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          이전
        </button>
        <span className="text-xs font-semibold text-gray-400 tracking-widest">
          {questionNumber} / {total}
        </span>
        <div className="w-10" />
      </div>

      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-3 pt-1">
        <CharacterImage size={40} src={quizImageSrc} className="shrink-0 mt-1" />
        <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
          <p className="text-base font-bold text-gray-800 leading-snug">{question.text}</p>
          {question.subText && (
            <p className="mt-1 text-xs text-gray-400">{question.subText}</p>
          )}
        </div>
      </div>

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
