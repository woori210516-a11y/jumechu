import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0D0D0D', overflow: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 430, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 음식 — 상단 50% */}
        <Link
          href="/menu"
          style={{
            flex: 1,
            background: '#FF5C00',
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            textDecoration: 'none',
          }}
        >
          <img
            src="/food-illust.png"
            alt=""
            style={{ position: 'absolute', top: '20%', left: 0, width: 160, height: 160, objectFit: 'contain', objectPosition: 'left center', zIndex: 0 }}
          />
          <div style={{
            position: 'absolute',
            bottom: 28,
            left: 24,
            right: 24,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.5)' }}>FOOD</span>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>오늘 뭐 먹지?</h2>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>메뉴 추천받기</span>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, lineHeight: 1,
            }}>→</div>
          </div>
        </Link>

        {/* 영화 — 하단 50% */}
        <Link
          href="/ott"
          style={{
            flex: 1,
            background: '#0D0D0D',
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            textDecoration: 'none',
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <img
            src="/netflix-illust.png"
            alt=""
            style={{ position: 'absolute', top: '10%', right: 0, width: 160, height: 160, objectFit: 'contain', objectPosition: 'right center', zIndex: 0 }}
          />
          <div style={{
            position: 'absolute',
            bottom: 28,
            left: 24,
            right: 24,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', color: '#E50914', fontStyle: 'italic' }}>NETFLIX</span>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.1 }}>오늘 뭐 보지?</h2>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>콘텐츠 추천받기</span>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(229,9,20,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#E50914', fontSize: 20, lineHeight: 1,
            }}>→</div>
          </div>
        </Link>

      </div>
    </main>
  );
}
