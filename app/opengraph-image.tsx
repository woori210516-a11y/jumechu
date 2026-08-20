import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const alt = '오늘 뭐 먹지? 🍽️';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #fb7185 0%, #fb923c 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '32px',
        }}
      >
        <div style={{ fontSize: 160, lineHeight: 1, letterSpacing: '16px' }}>
          🍔🌮🥘
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: 'white',
            textShadow: '0 2px 16px rgba(0,0,0,0.15)',
          }}
        >
          오늘 뭐 먹지?
        </div>
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          뭐 먹을지 모르겠다면 ㄱㄱ
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
