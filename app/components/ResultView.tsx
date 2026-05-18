'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Concept, Menu, ScoredMenu } from '@/app/types';

const RESULT_HEADER: Record<Concept, string> = {
  solo: '오늘은 이거 어때?',
  together: '싫으면 라면이나 먹자..',
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
}

function MapButtons({ menu }: MapButtonsProps) {
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #ebebeb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#999', flexShrink: 0 }}>근처 맛집</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          href={getNaverMapUrl(menu)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid #ebebeb', borderRadius: 8,
            padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#555',
            textDecoration: 'none',
          }}
        >
          <img src="https://www.naver.com/favicon.ico" alt="" style={{ width: 12, height: 12, borderRadius: 2 }} />
          네이버지도
        </a>
        <a
          href={getKakaoMapUrl(menu)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid #ebebeb', borderRadius: 8,
            padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#555',
            textDecoration: 'none',
          }}
        >
          <img src="https://map.kakao.com/favicon.ico" alt="" style={{ width: 12, height: 12, borderRadius: 2 }} />
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
  onRestartQuiz?: () => void;
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
      <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="flex flex-col items-center gap-4">
            <Image src="/dead.png" alt="이미사망" width={180} height={180} className="object-contain" priority />
            <div className="text-center">
              <p style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>과로로 사망하셨습니다</p>
              <p style={{ marginTop: 4, fontSize: 12, color: '#999' }}>다음 생에는 건물주로 태어나시길</p>
            </div>
          </div>
          <div style={{ border: '1.5px solid #ebebeb', borderRadius: 12, padding: '18px 20px' }} className="animate-pop">
            <span style={{ fontSize: 11, fontWeight: 600, color: '#FF5C00', background: '#fff8f5', padding: '3px 8px', borderRadius: 6 }}>
              영결식 추천 메뉴
            </span>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a', marginTop: 10 }}>육개장</p>
            <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>故人의 마지막 식사.. 맛있게 드세요</p>
          </div>
        </div>
        <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff' }}>
          <button
            onClick={onRestartQuiz ?? onRestart}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              border: '1.5px solid #ebebeb', background: '#fff',
              fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer',
            }}
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
      <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#fff', overflow: 'hidden' }}>
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, overflowY: 'auto', padding: '24px', gap: 20 }}>
          <Image src="/none.png" alt="결과없음" width={180} height={180} className="object-contain" priority />
          <div className="text-center">
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>이것도 싫고 저것도 싫으면</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>뭘 드시겠다는..?</p>
          </div>
        </div>
        <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff' }}>
          <button
            onClick={onRestartQuiz ?? onRestart}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: '#FF5C00', color: '#fff', fontSize: 13, fontWeight: 800,
              border: 'none', cursor: 'pointer',
            }}
          >
            다시 제대로 고르기
          </button>
        </div>
      </div>
    );
  }

  // 최고 점수 2점 이하
  if (results[0].score <= 2) {
    return (
      <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#fff', overflow: 'hidden' }}>
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, overflowY: 'auto', padding: '24px', gap: 20 }}>
          <Image src="/hungry.png" alt="햇반" width={180} height={180} className="object-contain" priority />
          <div className="text-center">
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>오늘은 그냥 햇반이나 드세요</p>
            <p style={{ marginTop: 6, fontSize: 12, color: '#999' }}>아님 걍 굶던가..</p>
          </div>
        </div>
        <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff' }}>
          <button
            onClick={onRestart}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              border: '1.5px solid #FF5C00', background: '#fff',
              fontSize: 13, fontWeight: 600, color: '#FF5C00', cursor: 'pointer',
            }}
          >
            다시 고르기
          </button>
        </div>
      </div>
    );
  }

  const [first, second, third] = results;

  return (
    <div className="flex flex-col flex-1 animate-fade-slide" style={{ background: '#fff', overflow: 'hidden' }}>
      {/* 스크롤 가능 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 헤더 */}
        <div>
          <p style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>오늘의 메뉴 추천</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', marginTop: 3 }}>{RESULT_HEADER[concept]}</p>
        </div>

        {showFunnyMessage && (
          <div style={{ background: '#fff8f5', border: '1.5px solid #ffdccc', borderRadius: 10, padding: '12px 14px' }} className="animate-pop">
            <p style={{ fontSize: 12, color: '#FF5C00', fontWeight: 600 }}>
              다이어트 중이지만 술은 마셔야 하는 당신..
            </p>
          </div>
        )}

        {/* 1위 카드 */}
        <div style={{ border: '1.5px solid #ebebeb', borderRadius: 12, padding: '18px 20px' }} className="animate-pop">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF5C00', background: '#fff8f5', padding: '3px 8px', borderRadius: 6 }}>1위</span>
            {first.score > 0 && <span style={{ fontSize: 11, color: '#ccc' }}>점수 {first.score}</span>}
          </div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a', margin: 0 }}>{first.menu.name}</p>
          <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>오늘은 {first.menu.name} 어때?</p>
          {first.menu.subItems && first.menu.subItems.length > 0 && (
            <div style={{ marginTop: 10, background: '#f9f9f9', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ fontSize: 12, color: '#555' }}>{first.menu.subItems.join(', ')} 중에 골라봐</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#FF5C00', background: '#fff8f5', padding: '3px 8px', borderRadius: 6 }}>{first.menu.category}</span>
            <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', padding: '3px 8px', borderRadius: 6 }}>다이어트 {first.menu.diet}</span>
          </div>
          <MapButtons menu={first.menu} />
        </div>

        {/* 2·3위 */}
        {(second || third) && (
          <div>
            <p style={{ fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 10 }}>다른 선택지</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {second && <AlternativeCard rank={2} item={second} />}
              {third && <AlternativeCard rank={3} item={third} />}
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="shrink-0" style={{ padding: '12px 20px 24px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shareUrl && (
          <button
            onClick={handleShare}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: '#FF5C00', color: '#fff', fontSize: 13, fontWeight: 800,
              border: 'none', cursor: 'pointer',
            }}
          >
            {copied ? '복사 완료 — 카톡에 붙여넣으세요' : '결과 공유하기'}
          </button>
        )}
        <button
          onClick={onRestart}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            border: '1.5px solid #ebebeb', background: '#fff',
            fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer',
          }}
        >
          다시 고르기
        </button>
      </div>
    </div>
  );
}

function AlternativeCard({ rank, item }: { rank: number; item: ScoredMenu }) {
  return (
    <div style={{ border: '1.5px solid #ebebeb', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF5C00', background: '#fff8f5', padding: '2px 7px', borderRadius: 5 }}>{rank}위</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>{item.menu.name}</span>
        </div>
        {item.score > 0 && <span style={{ fontSize: 11, color: '#ccc' }}>{item.score}점</span>}
      </div>
      {item.menu.subItems && item.menu.subItems.length > 0 && (
        <p style={{ marginTop: 4, fontSize: 11, color: '#999' }}>{item.menu.subItems.join(' / ')}</p>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', padding: '3px 8px', borderRadius: 6 }}>{item.menu.category}</span>
        <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', padding: '3px 8px', borderRadius: 6 }}>다이어트 {item.menu.diet}</span>
      </div>
    </div>
  );
}
