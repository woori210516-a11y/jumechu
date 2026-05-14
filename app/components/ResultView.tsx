'use client';

import { useState } from 'react';
import Image from 'next/image';
import CharacterImage from '@/app/components/CharacterImage';
import type { Concept, Menu, ScoredMenu } from '@/app/types';

const RESULT_HEADER: Record<Concept, string> = {
  solo: '오늘은 이거 어때?',
  together: '싫으면 각자 집에 배달시켜놓고 영통이나 해',
};

const RESULT_IMAGE: Record<Concept, string> = {
  solo:     '/group-quiz.png',
  together: '/group-quiz.png',
};

function getKeyword(menu: Menu): string {
  return menu.subItems ? menu.category : menu.name;
}

function getNaverMapUrl(menu: Menu): string {
  const keyword = getKeyword(menu);
  const isMobile = /iPhone|iPad|Android/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );
  return isMobile
    ? `https://m.map.naver.com/search?query=${encodeURIComponent(keyword)}`
    : `https://map.naver.com/search/${encodeURIComponent(keyword)}`;
}

function getKakaoMapUrl(menu: Menu): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(getKeyword(menu))}`;
}

interface MapButtonsProps {
  menu: Menu;
  variant: 'light' | 'dark';
}

function MapButtons({ menu, variant }: MapButtonsProps) {
  const isDark = variant === 'dark';
  const dividerCls = isDark ? 'border-white/20' : 'border-gray-100';
  const labelCls = isDark ? 'text-white/60' : 'text-gray-400';
  const naverCls = isDark
    ? 'border border-lime-200 text-lime-100'
    : 'border border-gray-200 text-gray-500';
  const kakaoCls = isDark
    ? 'border border-yellow-200 text-yellow-100'
    : 'border border-yellow-300 text-yellow-600';

  return (
    <div className={`mt-3 pt-3 border-t ${dividerCls} flex items-center justify-between gap-2`}>
      <span className={`text-xs font-semibold ${labelCls} shrink-0`}>근처 맛집</span>
      <div className="flex gap-1.5">
        <a
          href={getNaverMapUrl(menu)}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 ${naverCls} text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-95 transition-all`}
        >
          <img src="https://www.naver.com/favicon.ico" alt="" className="w-3 h-3 rounded-sm" />
          네이버지도
        </a>
        <a
          href={getKakaoMapUrl(menu)}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 ${kakaoCls} text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-95 transition-all`}
        >
          <img src="https://map.kakao.com/favicon.ico" alt="" className="w-3 h-3 rounded-sm" />
          카카오맵
        </a>
      </div>
    </div>
  );
}

interface ResultViewProps {
  results: ScoredMenu[];
  showFunnyMessage: boolean;
  shareUrl?: string;
  onRestart: () => void;
  onRestartQuiz?: () => void; // 그룹 모드: 사망 시 설문 첫 화면으로
  isDead?: boolean;
  concept?: Concept;
}

export default function ResultView({ results, showFunnyMessage, shareUrl, onRestart, onRestartQuiz, isDead, concept = 'solo' }: ResultViewProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // 이미사망 특별 화면
  if (isDead) {
    return (
      <div className="flex flex-col flex-1 px-5 pt-8 pb-6 gap-5 animate-fade-slide">
        <div className="flex flex-col items-center gap-3">
          <Image src="/dead.png" alt="이미사망" width={200} height={200} className="object-contain" priority />
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">과로로 사망하셨습니다</p>
            <p className="mt-1 text-gray-400 text-sm">다음 생에는 건물주로 태어나시길</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-3xl p-5 shadow-lg animate-pop">
          <span className="text-xs font-semibold text-gray-400 bg-white/10 px-2.5 py-1 rounded-full">
            영결식 추천 메뉴
          </span>
          <p className="text-2xl font-bold text-white mt-3">육개장</p>
          <p className="text-gray-400 text-sm mt-1">故人의 마지막 식사.. 맛있게 드세요</p>
        </div>
        <div className="mt-auto pt-2">
          <button
            onClick={onRestartQuiz ?? onRestart}
            className="w-full py-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-base active:scale-95 hover:bg-gray-50 transition-all"
          >
            다시 고르기
          </button>
        </div>
      </div>
    );
  }

  // 결과 없음
  if (results.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-8 animate-fade-slide">
        <div className="flex flex-col items-center gap-5">
          <Image src="/none.png" alt="결과없음" width={200} height={200} className="object-contain" priority />
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">이것도 싫고 저것도 싫으면</p>
            <p className="text-xl font-bold text-gray-800">뭘 드시겠다는..?</p>
          </div>
        </div>
        <button
          onClick={onRestartQuiz ?? onRestart}
          className="w-full py-4 rounded-2xl bg-orange-400 text-white font-bold text-base shadow-lg shadow-orange-100 active:scale-95 transition-transform"
        >
          다시 제대로 고르기
        </button>
      </div>
    );
  }

  // 최고 점수 2점 이하
  if (results[0].score <= 2) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-8 animate-fade-slide">
        <div className="flex flex-col items-center gap-5">
          <Image src="/hungry.png" alt="햇반" width={200} height={200} className="object-contain" priority />
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">오늘은 그냥 햇반이나 드세요</p>
            <p className="mt-2 text-gray-400 text-sm">아님 걍 굶던가..</p>
          </div>
        </div>
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-2xl border border-orange-200 text-orange-400 font-semibold text-base active:scale-95 hover:bg-orange-50 transition-all"
        >
          다시 고르기
        </button>
      </div>
    );
  }

  const [first, second, third] = results;

  return (
    <div className="flex flex-col flex-1 px-5 pt-7 pb-6 gap-5 animate-fade-slide">
      {/* 헤더 */}
      <div className="flex flex-col items-center gap-2">
        <Image src={RESULT_IMAGE[concept]} alt="결과" width={200} height={200} className="object-contain" priority />
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium">오늘의 메뉴 추천</p>
          <p className="text-base font-bold text-gray-800 leading-tight">{RESULT_HEADER[concept]}</p>
        </div>
      </div>

      {showFunnyMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 animate-pop">
          <p className="text-sm text-amber-700 font-medium">
            다이어트 중인데 술 골랐네.. 오늘 치팅데이야?
          </p>
        </div>
      )}

      {/* 1위 카드 */}
      <div className="bg-orange-400 rounded-3xl p-5 shadow-lg shadow-orange-100 animate-pop">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs font-bold text-orange-100 bg-white/20 px-2.5 py-1 rounded-full tracking-wide">
            1위
          </span>
          {first.score > 0 && (
            <span className="text-xs text-orange-200">점수 {first.score}</span>
          )}
        </div>
        <p className="text-2xl font-bold text-white mt-2">{first.menu.name}</p>
        <p className="text-orange-100 text-sm mt-1">
          오늘은 {first.menu.name} 어때?
        </p>
        {first.menu.subItems && first.menu.subItems.length > 0 && (
          <div className="mt-3 bg-white/15 rounded-2xl px-3 py-2">
            <p className="text-white text-xs font-medium">
              {first.menu.subItems.join(', ')} 중에 골라봐
            </p>
          </div>
        )}
        <div className="mt-2.5 flex gap-1.5 flex-wrap">
          <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">
            {first.menu.category}
          </span>
          <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">
            다이어트 {first.menu.diet}
          </span>
        </div>
        <MapButtons menu={first.menu} variant="dark" />
      </div>

      {/* 2·3위 */}
      {(second || third) && (
        <div>
          <p className="text-xs text-gray-400 mb-2.5 font-semibold tracking-wide uppercase">다른 선택지</p>
          <div className="flex flex-col gap-2.5">
            {second && <AlternativeCard rank={2} item={second} />}
            {third && <AlternativeCard rank={3} item={third} />}
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="mt-auto pt-2 flex flex-col gap-2.5">
        {shareUrl && (
          <button
            onClick={handleShare}
            className="w-full py-4 rounded-2xl bg-orange-400 text-white font-bold text-base shadow-lg shadow-orange-100 active:scale-95 transition-all"
          >
            {copied ? '복사 완료 — 카톡에 붙여넣으세요' : '결과 공유하기'}
          </button>
        )}
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-base active:scale-95 hover:bg-gray-50 transition-all"
        >
          다시 고르기
        </button>
      </div>
    </div>
  );
}

function AlternativeCard({ rank, item }: { rank: number; item: ScoredMenu }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full">
            {rank}위
          </span>
          <span className="font-bold text-gray-800 text-base">{item.menu.name}</span>
        </div>
        {item.score > 0 && <span className="text-xs text-gray-300">{item.score}점</span>}
      </div>
      {item.menu.subItems && item.menu.subItems.length > 0 && (
        <p className="mt-1 text-xs text-gray-400">{item.menu.subItems.join(' / ')}</p>
      )}
      <div className="mt-2 flex gap-1.5 flex-wrap">
        <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border border-gray-100">
          {item.menu.category}
        </span>
        <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border border-gray-100">
          다이어트 {item.menu.diet}
        </span>
      </div>
      <MapButtons menu={item.menu} variant="light" />
    </div>
  );
}
