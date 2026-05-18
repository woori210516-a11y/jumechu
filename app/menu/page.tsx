'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ResultView from '@/app/components/ResultView';
import { GroupPeopleView, GroupInviteView, GroupWaitingView } from '@/app/components/GroupFlow';
import { questions, getActiveQuestions } from '@/app/lib/questions';
import { calculateResults } from '@/app/lib/scoring';
import { resultsToShareParam } from '@/app/lib/share';
import { createRoom, joinRoom, fetchRoom, fetchRoomState, submitResult } from '@/app/lib/group';
import type { Answers, Concept, ScoredMenu } from '@/app/types';
import { menus } from '@/app/lib/menus';
import { useQuizState } from '@/app/lib/useQuizState';

type View = 'intro' | 'quiz' | 'result' | 'group-people' | 'group-invite' | 'group-waiting' | 'room-error';

interface GroupState {
  roomId: string;
  nickname: string;
  participantId: string;
  maxMembers: number;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────────

function MenuContent() {
  const searchParams = useSearchParams();
  const hasJoinedRef = useRef(false);

  const [view, setView] = useState<View>('intro');
  const [concept, setConcept] = useState<Concept>('solo');
  const {
    questionIndex, setQuestionIndex,
    answers, setAnswers,
    multiSelect, setMultiSelect,
    history, setHistory,
    reset: resetQuiz,
  } = useQuizState();
  const [results, setResults] = useState<ScoredMenu[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [groupState, setGroupState] = useState<GroupState | null>(null);
  const [roomErrorInfo, setRoomErrorInfo] = useState<{ title: string; sub: string }>({
    title: '방을 찾을 수 없어요',
    sub: '링크가 잘못됐거나 이미 삭제된 방이예요',
  });

  // 공유 링크 접속 처리
  useEffect(() => {
    if (hasJoinedRef.current) return;
    const roomId = searchParams.get('room');
    if (!roomId) return;
    hasJoinedRef.current = true;

    function cleanUrl(keepRoomUrl = false) {
      const target = keepRoomUrl ? `/room/${roomId}` : '/menu';
      window.history.replaceState({}, '', target);
    }

    function showRoomError(title: string, sub: string) {
      setRoomErrorInfo({ title, sub });
      setView('room-error');
    }

    async function doJoin() {
      try {
        const room = await fetchRoom(roomId!);
        if (!room) {
          showRoomError('방을 찾을 수 없어요', '링크가 잘못됐거나 이미 삭제된 방이예요');
          return;
        }

        if (room.expires_at && new Date(room.expires_at) < new Date()) {
          showRoomError('방이 만료됐어요', '30분이 지나 방이 사라졌어요');
          return;
        }

        if (room.status === 'done' && room.final_result) {
          cleanUrl(true);
          setConcept('together');
          const menu = menus.find((m) => m.name === room.final_result);
          setResults(menu ? [{ menu, score: 99 }] : []);
          setView('result');
          return;
        }

        cleanUrl(false);
        setConcept('together');

        const roomState = await fetchRoomState(roomId!);

        const storedNickname = localStorage.getItem(`group_nickname_${roomId}`);
        const storedParticipantId = localStorage.getItem(`group_participant_id_${roomId}`);

        if (storedNickname && storedParticipantId) {
          const me = roomState.participants.find((p) => p.id === storedParticipantId);
          if (me) {
            setGroupState({ roomId: roomId!, nickname: me.nickname, participantId: me.id, maxMembers: room.max_members });
            if (me.completed) {
              setView('group-waiting');
            } else {
              resetQuiz();
              setView('quiz');
            }
            return;
          }
        }

        if (roomState.participants.length >= room.max_members) {
          showRoomError('인원이 꽉 찼어요', `최대 ${room.max_members}명까지 참여할 수 있어요`);
          return;
        }
        const { nickname, participantId } = await joinRoom(roomId!);
        setGroupState({ roomId: roomId!, nickname, participantId, maxMembers: room.max_members });
        resetQuiz();
        setView('quiz');
      } catch (e) {
        console.error('join error:', e);
        showRoomError('오류가 발생했어요', '잠시 후 다시 시도하세요');
      }
    }
    doJoin();
  }, [searchParams]);

  const activeQuestions = getActiveQuestions(answers.drink, answers.foodType);
  const currentQuestion = activeQuestions[questionIndex];
  const total = activeQuestions.length;

  function startSolo() {
    resetQuiz();
    setConcept('solo');
    setView('quiz');
  }

  function startTogether() {
    resetQuiz();
    setConcept('together');
    setView('group-people');
  }

  async function handleGroupPeopleNext(maxMembers: number) {
    const roomId = await createRoom(maxMembers);
    const { nickname, participantId } = await joinRoom(roomId);
    setGroupState({ roomId, nickname, participantId, maxMembers });
    setView('group-invite');
  }

  function handleGroupStart() {
    resetQuiz();
    setView('quiz');
  }

  function handleGroupFinalResult(menuName: string) {
    const menu = menus.find((m) => m.name === menuName);
    setResults(menu ? [{ menu, score: 99 }] : []);
    if (groupState) {
      window.history.replaceState({}, '', `/room/${groupState.roomId}`);
    }
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

  function getQuizEntryView(): View {
    return groupState ? 'group-invite' : 'intro';
  }

  function handleBack() {
    if (history.length === 0) {
      setView(getQuizEntryView());
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

  function submitToGroupAndWait(topMenuName: string) {
    if (!groupState) return;
    submitResult(groupState.participantId, topMenuName).catch(console.error);
    setView('group-waiting');
  }

  function finishQuiz(finalAnswers: Answers) {
    const scored = calculateResults(finalAnswers, menus);
    setResults(scored);
    if (groupState && scored.length > 0) {
      submitToGroupAndWait(scored[0].menu.name);
    } else {
      setView('result');
    }
  }

  function restart() {
    setView('intro');
    resetQuiz();
    setResults([]);
    setIsDead(false);
    setGroupState(null);
  }

  function restartQuizOnly() {
    resetQuiz();
    setResults([]);
    setIsDead(false);
    setView('quiz');
  }

  const showFunnyMessage = answers.diet === '빡세게 중' && answers.drink === '마심';

  function getShareUrl(): string | undefined {
    if (view !== 'result' || results.length === 0) return undefined;
    return groupState
      ? `${window.location.origin}/room/${groupState.roomId}`
      : `${window.location.origin}/result?q=${resultsToShareParam(results)}&concept=${concept}`;
  }
  const shareUrl = getShareUrl();

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[430px] min-h-screen bg-white flex flex-col">

        {view === 'intro' && (
          <IntroView onSolo={startSolo} onTogether={startTogether} />
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

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <MenuContent />
    </Suspense>
  );
}

// ── 방 오류 화면 ───────────────────────────────────────────────────────────────────

function RoomErrorView({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 animate-fade-slide" style={{ overflow: 'hidden' }}>
      <div className="flex flex-col items-center justify-center" style={{ flex: 1, overflowY: 'auto', padding: '24px', gap: 20 }}>
        <Image src="/hungry.png" alt="오류" width={180} height={180} className="object-contain" priority />
        <div className="text-center">
          <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{title}</p>
          <p style={{ marginTop: 6, fontSize: 13, color: '#999', lineHeight: 1.5 }}>{sub}</p>
        </div>
      </div>
      <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff' }}>
        <button
          onClick={onBack}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: '#FF5C00', color: '#fff', fontSize: 13, fontWeight: 800,
            border: 'none', cursor: 'pointer',
          }}
        >
          처음으로
        </button>
      </div>
    </div>
  );
}

// ── 인트로 화면 ────────────────────────────────────────────────────────────────────

function IntroView({ onSolo, onTogether }: { onSolo: () => void; onTogether: () => void }) {
  return (
    <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#fff', overflow: 'hidden' }}>
      <div className="shrink-0" style={{ padding: '20px 20px 0' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#999', textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          처음으로
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center" style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        <div className="flex flex-col items-center gap-5">
          <Image
            src="/group-main.png"
            alt="음식고르기"
            width={160}
            height={160}
            className="object-contain"
            priority
          />
          <div className="text-center">
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1a1a', lineHeight: 1.2, margin: 0 }}>오늘 뭐 먹지?</h1>
            <p style={{ marginTop: 8, fontSize: 13, color: '#999' }}>혼자 고를지, 같이 고를지 선택하기</p>
          </div>
        </div>
      </div>

      <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onSolo}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: '#FF5C00', color: '#fff', fontSize: 13, fontWeight: 800,
            border: 'none', cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          혼자 고르기
        </button>
        <button
          onClick={onTogether}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: '#fff', color: '#FF5C00', fontSize: 13, fontWeight: 800,
            border: '1.5px solid #FF5C00', cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          같이 고르기
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: 2 }}>총 10여 가지 질문 · 1분 이내</p>
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
  onSingleAnswer: (option: string) => void;
  onToggleMulti: (option: string) => void;
  onMultiConfirm: () => void;
  onBack: () => void;
}

function QuizView({ question, questionNumber, total, multiSelect, onSingleAnswer, onToggleMulti, onMultiConfirm, onBack }: QuizViewProps) {
  const progress = (questionNumber / total) * 100;
  const [pickedOption, setPickedOption] = useState<string | null>(null);

  // 질문이 바뀌면 포커스 초기화
  useEffect(() => { setPickedOption(null); }, [question.id]);

  function handleSinglePick(option: string) {
    if (pickedOption) return; // 중복 클릭 방지
    setPickedOption(option);
    setTimeout(() => onSingleAnswer(option), 150);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }} className="animate-fade-slide">

      {/* 오렌지 헤더 */}
      <div style={{ background: '#FF5C00', padding: '20px 20px 22px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            이전
          </button>
        </div>

        {/* 프로그레스바 */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.25)', borderRadius: 2, marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#fff', borderRadius: 2, transition: 'width 0.5s ease-out' }} />
        </div>

        {/* 질문 */}
        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: 0 }}>{question.text}</h2>
        {question.subText && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 5, marginBottom: 0 }}>{question.subText}</p>
        )}
      </div>

      {/* 선택지 영역 */}
      {question.type === 'single' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {question.options.map((option) => {
              const picked = pickedOption === option;
              return (
                <button
                  key={option}
                  onClick={() => handleSinglePick(option)}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 10,
                    border: `1.5px solid ${picked ? '#FF5C00' : '#ebebeb'}`,
                    background: picked ? '#fff8f5' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 150ms', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: picked ? '#FF5C00' : '#222', flex: 1 }}>{option}</span>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: picked ? '#FF5C00' : 'transparent',
                    border: picked ? 'none' : '1.5px solid #ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {picked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '16px 20px 0' }}>
            {question.options.map((option) => {
              const sel = multiSelect.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => onToggleMulti(option)}
                  style={{
                    padding: '11px 14px', borderRadius: 10,
                    border: `1.5px solid ${sel ? '#FF5C00' : '#ebebeb'}`,
                    background: sel ? '#fff8f5' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 150ms', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: sel ? '#FF5C00' : '#222', flex: 1 }}>{option}</span>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: sel ? '#FF5C00' : 'transparent',
                    border: sel ? 'none' : '1.5px solid #ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ position: 'sticky', bottom: 0, padding: '12px 20px 24px', background: '#fff' }}>
            <button
              onClick={onMultiConfirm}
              disabled={multiSelect.length === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                background: '#FF5C00', color: '#fff', fontSize: 13, fontWeight: 800,
                border: 'none', cursor: 'pointer',
                opacity: multiSelect.length === 0 ? 0.4 : 1, transition: 'opacity 150ms',
              }}
            >
              선택 완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
