'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { fetchRoomState, pickRandom } from '@/app/lib/group';
import type { RoomData, ParticipantData } from '@/app/lib/group';

// ── 점 애니메이션 ────────────────────────────────────────────────────────────────

function DotsLoader() {
  const [d, setD] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setD((n) => (n >= 3 ? 1 : n + 1)), 500);
    return () => clearInterval(t);
  }, []);
  return <>{'.'.repeat(d)}</>;
}

// ── 인원 선택 화면 ────────────────────────────────────────────────────────────────

interface GroupPeopleViewProps {
  onNext: (maxMembers: number) => Promise<void>;
  onBack: () => void;
}

export function GroupPeopleView({ onNext, onBack }: GroupPeopleViewProps) {
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    setLoading(true);
    setError(null);
    try {
      await onNext(count);
    } catch (e: unknown) {
      console.error('방 생성 오류:', e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : JSON.stringify(e);
      setError(msg);
      setLoading(false);
    }
  }

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
        <span className="text-xs font-semibold text-gray-400 tracking-widest">같이 고르기</span>
        <div className="w-10" />
      </div>

      <div className="flex flex-col flex-1 items-center justify-center gap-12">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">몇 명이서 먹어요?</p>
          <p className="mt-2 text-gray-400 text-sm">최대 6명까지</p>
        </div>

        <div className="flex items-center gap-10">
          {/* 위 화살표 = 증가, 아래 = 감소 (명수 크게 중앙) */}
          <button
            onClick={() => setCount((c) => Math.max(2, c - 1))}
            disabled={count <= 2}
            className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-25 active:scale-95 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div className="text-center w-20">
            <span className="text-7xl font-bold text-orange-400">{count}</span>
            <p className="text-sm text-gray-400 mt-1">명</p>
          </div>

          <button
            onClick={() => setCount((c) => Math.min(6, c + 1))}
            disabled={count >= 6}
            className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-25 active:scale-95 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center px-2 -mt-6">{error}</p>
        )}
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-orange-400 text-white text-base font-bold shadow-lg shadow-orange-100 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? '방 만드는 중...' : '다음'}
        </button>
      </div>
    </div>
  );
}

// ── 링크 공유 화면 ────────────────────────────────────────────────────────────────

interface GroupInviteViewProps {
  roomId: string;
  nickname: string;
  onStart: () => void;
  onBack: () => void;
}

export function GroupInviteView({ roomId, nickname, onStart, onBack }: GroupInviteViewProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '';

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

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
        <span className="text-xs font-semibold text-gray-400 tracking-widest">같이고르기</span>
        <div className="w-10" />
      </div>

      <div className="flex flex-col flex-1 items-center justify-center gap-8">
        <Image src="/group-main.png" alt="같이고르기" width={200} height={200} className="object-contain" priority />

        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">공유하고 같이 골라요</p>
          <p className="mt-2 text-sm text-gray-500">
            내 닉네임:{' '}
            <span className="font-bold text-orange-400">{nickname}</span>
          </p>
          <p className="mt-1 text-xs text-gray-300">링크를 복사해서 친구에게 공유하세요</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleCopy}
            className="w-full py-4 rounded-2xl border border-orange-300 text-orange-400 text-base font-bold active:scale-95 transition-all hover:bg-orange-50"
          >
            {copied ? '복사완료! 카톡에 붙여넣으세요' : '링크 복사하기'}
          </button>
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl bg-orange-400 text-white text-base font-bold shadow-lg shadow-orange-100 active:scale-95 transition-transform"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 대기 화면 ────────────────────────────────────────────────────────────────

interface GroupWaitingViewProps {
  roomId: string;
  nickname: string;
  maxMembers: number;
  onFinalResult: (menuName: string) => void;
}

export function GroupWaitingView({
  roomId,
  nickname,
  maxMembers,
  onFinalResult,
}: GroupWaitingViewProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const finalCalledRef = useRef(false);

  const fetchState = useCallback(async () => {
    try {
      const state = await fetchRoomState(roomId);
      setRoom(state.room);
      setParticipants(state.participants);

      if (state.room.status === 'done' && state.room.final_result && !finalCalledRef.current) {
        finalCalledRef.current = true;
        onFinalResult(state.room.final_result);
      }
    } catch (e) {
      console.error(e);
    }
  }, [roomId, onFinalResult]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const completedCount = participants.filter((p) => p.completed).length;
  const allCompleted = participants.length >= maxMembers && participants.every((p) => p.completed);

  async function handlePickRandom() {
    if (isPicking || !allCompleted) return;
    setIsPicking(true);
    try {
      const results = participants.filter((p) => p.result).map((p) => p.result!);
      await pickRandom(roomId, results);
      // 다음 폴링에서 status=done 감지
    } catch (e) {
      console.error(e);
      setIsPicking(false);
    }
  }

  // max_members만큼 슬롯 표시
  const slots = Array.from({ length: maxMembers }, (_, i) => participants[i] ?? null);

  return (
    <div className="flex flex-col flex-1 px-5 pt-7 pb-6 gap-4 animate-fade-slide">
      {/* 헤더 */}
      <div className="text-center">
        <p className="text-xs text-gray-400 font-medium tracking-widest">같이고르기</p>
        <p className="text-lg font-bold text-gray-800 mt-1">
          {allCompleted
            ? '다 골랐어! 랜덤뽑기 해봐'
            : room
            ? `${completedCount} / ${maxMembers}명 완료`
            : '불러오는 중...'}
        </p>
      </div>

      {/* 참여자 카드 */}
      <div className="flex flex-col gap-2">
        {slots.map((p, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-3 flex items-center justify-between border ${
              p?.completed
                ? 'bg-orange-50 border-orange-200'
                : 'bg-gray-50 border-gray-100'
            }`}
          >
            {p ? (
              <>
                <span className="font-semibold text-gray-700 text-sm">{p.nickname}</span>
                <span className={`text-sm ${p.completed ? 'font-bold text-orange-500' : 'text-gray-400'}`}>
                  {p.completed ? (
                    p.result
                  ) : (
                    <>
                      고르는 중<DotsLoader />
                    </>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="text-gray-300 text-sm">아직 안 들어왔어</span>
                <span className="text-xs text-gray-200 bg-gray-100 px-2 py-0.5 rounded-full">
                  미입장
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 랜덤뽑기 버튼 */}
      <div className="mt-auto pt-2">
        <button
          onClick={handlePickRandom}
          disabled={!allCompleted || isPicking}
          className="w-full py-4 rounded-2xl bg-orange-400 text-white font-bold text-base shadow-lg shadow-orange-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {isPicking
            ? '뽑는 중...'
            : allCompleted
            ? '랜덤뽑기'
            : `아직 ${maxMembers - completedCount}명 더 기다려야 해`}
        </button>
      </div>
    </div>
  );
}
