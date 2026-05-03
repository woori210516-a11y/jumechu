'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ResultView from '@/app/components/ResultView';
import { paramsToAnswers } from '@/app/lib/share';
import { calculateResults } from '@/app/lib/scoring';
import menusData from '@/data/menus.json';

function ResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const answers = paramsToAnswers(searchParams);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = calculateResults(answers, menusData.menus as any);
  const showFunnyMessage = answers.diet === '빡세게 중' && answers.drink === '마심';

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">
        <ResultView
          results={results}
          showFunnyMessage={showFunnyMessage}
          onRestart={() => router.push('/')}
        />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ResultPage />
    </Suspense>
  );
}
