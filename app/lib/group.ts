import { supabase } from './supabase';

export const NICKNAMES = ['김햇반', '최두부', '덕복희', '유당근', '김김찌', '장팝콘'];

export interface RoomData {
  id: string;
  status: string;
  final_result: string | null;
  max_members: number;
  expires_at: string | null;
}

export interface ParticipantData {
  id: string;
  nickname: string;
  result: string | null;
  completed: boolean;
}

export async function createRoom(maxMembers: number): Promise<string> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ max_members: maxMembers, expires_at: expiresAt })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchRoom(roomId: string): Promise<RoomData | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, status, final_result, max_members, expires_at')
    .eq('id', roomId)
    .single();
  if (error) return null;
  return data;
}

export async function joinRoom(
  roomId: string,
): Promise<{ nickname: string; participantId: string }> {
  // 로컬스토리지에 이미 참여 이력이 있으면 그대로 반환
  const storedNickname = localStorage.getItem(`group_nickname_${roomId}`);
  const storedId = localStorage.getItem(`group_participant_id_${roomId}`);
  if (storedNickname && storedId) {
    return { nickname: storedNickname, participantId: storedId };
  }

  // 이미 사용 중인 닉네임 조회
  const { data: existing } = await supabase
    .from('participants')
    .select('nickname')
    .eq('room_id', roomId);

  const used = (existing ?? []).map((p: { nickname: string }) => p.nickname);
  const available = NICKNAMES.filter((n) => !used.includes(n));
  if (!available.length) throw new Error('방이 가득 찼어요');

  const nickname = available[Math.floor(Math.random() * available.length)];

  const { data, error } = await supabase
    .from('participants')
    .insert({ room_id: roomId, nickname })
    .select('id')
    .single();
  if (error) throw error;

  localStorage.setItem(`group_nickname_${roomId}`, nickname);
  localStorage.setItem(`group_participant_id_${roomId}`, data.id);
  return { nickname, participantId: data.id };
}

export async function submitResult(
  participantId: string,
  topMenuName: string,
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ result: topMenuName, completed: true })
    .eq('id', participantId);
  if (error) throw error;
}

export async function pickRandom(roomId: string, results: string[]): Promise<void> {
  if (!results.length) return;
  const final = results[Math.floor(Math.random() * results.length)];
  // status='waiting' 조건 → 최초 클릭만 유효
  await supabase
    .from('rooms')
    .update({ status: 'done', final_result: final })
    .eq('id', roomId)
    .eq('status', 'waiting');
}

export async function fetchRoomState(
  roomId: string,
): Promise<{ room: RoomData; participants: ParticipantData[] }> {
  const [roomRes, partRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, status, final_result, max_members, expires_at')
      .eq('id', roomId)
      .single(),
    supabase
      .from('participants')
      .select('id, nickname, result, completed')
      .eq('room_id', roomId)
      .order('created_at'),
  ]);
  if (roomRes.error) throw roomRes.error;
  return { room: roomRes.data, participants: partRes.data ?? [] };
}
