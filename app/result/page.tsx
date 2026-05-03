import { Suspense } from 'react';
import type { Metadata } from 'next';
import ResultContent from './ResultContent';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).flatMap(([k, v]) =>
        v == null ? [] : Array.isArray(v) ? [[k, v.join(',')]] : [[k, v]]
      )
    )
  ).toString();
  const url = `${baseUrl}/result${qs ? `?${qs}` : ''}`;

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
