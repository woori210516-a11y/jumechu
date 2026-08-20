import RoomRedirect from './RoomRedirect';

export async function generateStaticParams() {
  // Toss static export용 — 실제 방은 클라이언트에서 처리
  return [{ roomId: '_' }];
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <RoomRedirect roomId={roomId} />;
}
