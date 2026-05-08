'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ResultView from '@/app/components/ResultView';
import { parseShareParam } from '@/app/lib/share';
import { menus } from '@/app/lib/menus';
import type { Concept } from '@/app/types';

const VALID_CONCEPTS: Concept[] = ['boyfriend', 'mom', 'together'];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ResultContent({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const router = useRouter();

  const q = typeof params.q === 'string' ? params.q : '';
  const results = parseShareParam(q, menus);

  const rawConcept = typeof params.concept === 'string' ? params.concept : '';
  const concept: Concept = VALID_CONCEPTS.includes(rawConcept as Concept)
    ? (rawConcept as Concept)
    : 'boyfriend';

  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col shadow-2xl shadow-rose-200/50">
        <ResultView
          results={results}
          showFunnyMessage={false}
          concept={concept}
          onRestart={() => router.push('/')}
        />
      </div>
    </main>
  );
}
