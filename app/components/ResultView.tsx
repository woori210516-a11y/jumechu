'use client';

import { useState } from 'react';
import CharacterImage from '@/app/components/CharacterImage';
import type { ScoredMenu } from '@/app/types';

interface ResultViewProps {
  results: ScoredMenu[];
  showFunnyMessage: boolean;
  shareUrl?: string;
  onRestart: () => void;
}

export default function ResultView({ results, showFunnyMessage, shareUrl, onRestart }: ResultViewProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 gap-6 animate-fade-slide">
        <CharacterImage size={100} />
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">😅 이런...</p>
          <p className="mt-2 text-gray-500">
            조건에 맞는 메뉴를 못 찾겠어ㅠㅠ
            <br />
            조건을 조금 바꿔서 다시 해볼까?
          </p>
        </div>
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-400 text-white font-bold text-lg shadow-lg shadow-rose-200 active:scale-95 transition-transform"
        >
          다시 고르기 🔄
        </button>
      </div>
    );
  }

  const [first, second, third] = results;

  return (
    <div className="flex flex-col flex-1 px-5 pt-8 pb-6 gap-5 animate-fade-slide">
      <div className="flex flex-col items-center gap-3">
        <CharacterImage size={80} />
        <h2 className="text-xl font-bold text-gray-800">오늘 메뉴 추천!</h2>
      </div>

      {showFunnyMessage && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 animate-pop">
          <p className="text-sm text-yellow-800 font-medium">
            😂 여보 다이어트중인데 술 골랐네..? 오늘 치팅데이야?
          </p>
        </div>
      )}

      <div className="bg-gradient-to-br from-rose-400 to-orange-400 rounded-3xl p-5 shadow-lg shadow-rose-200 animate-pop">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-bold text-rose-100 bg-white/20 px-2 py-0.5 rounded-full">
            🥇 1위
          </span>
          {first.score > 0 && (
            <span className="text-xs text-rose-100">점수 {first.score}</span>
          )}
        </div>
        <p className="text-2xl font-bold text-white mt-1">{first.menu.name}</p>
        <p className="text-rose-100 text-sm mt-1">
          오늘은 {first.menu.name} 어때? 딱 맞을 것 같은데 😊
        </p>
        {first.menu.subItems && first.menu.subItems.length > 0 && (
          <div className="mt-3 bg-white/20 rounded-2xl px-3 py-2">
            <p className="text-white text-xs font-medium">
              {first.menu.subItems.join(', ')} 중에 골라봐!
            </p>
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
            {first.menu.category}
          </span>
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
            다이어트 {first.menu.diet}
          </span>
        </div>
      </div>

      {(second || third) && (
        <div>
          <p className="text-sm text-gray-400 mb-3 font-medium">아니면 이것도 괜찮아~</p>
          <div className="flex flex-col gap-3">
            {second && <AlternativeCard rank={2} item={second} />}
            {third && <AlternativeCard rank={3} item={third} />}
          </div>
        </div>
      )}

      <div className="mt-auto pt-2 flex flex-col gap-3">
        {shareUrl && (
          <button
            onClick={handleShare}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-400 text-white font-bold text-base shadow-lg shadow-rose-200 active:scale-95 transition-all"
          >
            {copied ? '복사 완료! 카톡에 붙여넣으세요. 📋' : '결과 공유하기 🔗'}
          </button>
        )}
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-2xl border-2 border-orange-300 text-orange-500 font-bold text-base active:scale-95 hover:bg-orange-50 transition-all"
        >
          다시 고르기 🔄
        </button>
      </div>
    </div>
  );
}

function AlternativeCard({ rank, item }: { rank: number; item: ScoredMenu }) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-orange-400">
            {rank === 2 ? '🥈' : '🥉'} {rank}위
          </span>
          <span className="font-bold text-gray-800 text-base">{item.menu.name}</span>
        </div>
        {item.score > 0 && <span className="text-xs text-gray-400">{item.score}점</span>}
      </div>
      {item.menu.subItems && item.menu.subItems.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">{item.menu.subItems.join(' / ')}</p>
      )}
      <div className="mt-2 flex gap-1.5">
        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
          {item.menu.category}
        </span>
        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
          다이어트 {item.menu.diet}
        </span>
      </div>
    </div>
  );
}
