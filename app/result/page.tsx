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

export default function Page() {
  return (
    <Suspense>
      <ResultContent />
    </Suspense>
  );
}
