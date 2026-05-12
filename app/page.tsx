import Link from 'next/link';

export default function Page() {
  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">
        <div className="flex flex-col flex-1 items-center justify-center px-6 gap-4">

          {/* 음식 */}
          <Link
            href="/menu"
            className="w-full rounded-3xl overflow-hidden active:scale-[0.98] transition-transform shadow-lg"
            style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '2px solid #fed7aa' }}
          >
            <div className="flex items-center gap-5 px-6 py-7">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-md"
                style={{ background: '#fb923c' }}
              >
                🍜
              </div>
              <p className="text-xl font-bold text-gray-900">오늘 뭐 먹지?</p>
              <svg className="ml-auto text-orange-300 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </Link>

          {/* 넷플릭스 */}
          <Link
            href="/ott"
            className="w-full rounded-3xl overflow-hidden active:scale-[0.98] transition-transform shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1a0000 0%, #2d0000 100%)', border: '2px solid #7f1d1d' }}
          >
            <div className="flex items-center gap-5 px-6 py-7">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-md"
                style={{ background: '#E50914' }}
              >
                🎬
              </div>
              <p className="text-xl font-bold text-white">오늘 뭐 보지?</p>
              <svg className="ml-auto shrink-0" style={{ color: '#E50914' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </Link>

        </div>
      </div>
    </main>
  );
}
