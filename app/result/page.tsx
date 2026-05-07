import { Suspense } from 'react';
import type { Metadata } from 'next';
import ResultContent from './ResultContent';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/result${q ? `?q=${q}` : ''}`;

  return {
    title: '너로 정했다 🍽️',
    description: '오늘 메뉴는..',
    openGraph: {
      title: '너로 정했다 🍽️',
      description: '오늘 메뉴는..',
      url,
    },
  };
}

function LoadingFallback() {
  return (
    <main className="min-h-screen flex justify-center items-start">
      <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col items-center justify-center shadow-2xl shadow-rose-200/50">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResultContent searchParams={searchParams} />
    </Suspense>
  );
}
