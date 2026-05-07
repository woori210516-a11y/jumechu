'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ResultView from '@/app/components/ResultView';
import { parseShareParam } from '@/app/lib/share';
import menusData from '@/data/menus.json';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ResultContent({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const router = useRouter();

  const q = typeof params.q === 'string' ? params.q : '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = parseShareParam(q, menusData.menus as any);

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">
        <ResultView
          results={results}
          showFunnyMessage={false}
          onRestart={() => router.push('/')}
        />
      </div>
    </main>
  );
}
