import type { Question } from '@/app/types';

export const questions: Question[] = [
  {
    id: 'condition',
    text: '오늘 컨디션은 어때?',
    options: ['피곤함', '멀쩡함', '스트레스받음', '상관없음'],
    type: 'single',
  },
  {
    id: 'weather',
    text: '오늘 날씨는?',
    options: ['더움', '추움·쌀쌀', '비·눈', '상관없음'],
    type: 'single',
  },
  {
    id: 'diet',
    text: '다이어트 중이야?',
    options: ['빡세게 중', '적당히 신경씀', '아니 맘껏 먹을래'],
    type: 'single',
  },
  {
    id: 'foodType',
    text: '어떤 음식이 당겨?',
    subText: '여러 개 선택 가능해',
    options: ['밥', '면', '빵', '고기', '생선', '상관없음'],
    type: 'multi',
  },
  {
    id: 'meatType',
    text: '어떤 고기?',
    subText: '여러 개 선택 가능해',
    options: ['소', '양', '닭', '돼지', '상관없음'],
    type: 'multi',
    conditional: true,
  },
  {
    id: 'soup',
    text: '국물 있는 거 vs 없는 거?',
    options: ['있는 거', '없는 거', '상관없음'],
    type: 'single',
  },
  {
    id: 'spicy',
    text: '맵기는 어느 정도?',
    options: ['안 매운 거', '적당히', '매운 거', '상관없음'],
    type: 'single',
  },
  {
    id: 'amount',
    text: '양은 얼마나?',
    options: ['가볍게', '든든하게', '상관없음'],
    type: 'single',
  },
  {
    id: 'drink',
    text: '오늘 술 마실 거야?',
    options: ['마심', '안 마심'],
    type: 'single',
  },
  {
    id: 'drinkType',
    text: '무슨 술 마실 거야?',
    options: ['소주', '맥주', '막걸리', '와인·양주', '상관없음'],
    type: 'single',
    conditional: true,
  },
  {
    id: 'avoid',
    text: '최근에 먹어서 피하고 싶은 거 있어?',
    subText: '여러 개 선택 가능해',
    options: ['찌개', '국밥', '고기구이', '찜', '중식', '일식', '양식', '분식', '치킨', '피자', '안주', '면류', '햄버거', '기타국물요리', '생선구이', '튀김', '없음'],
    type: 'multi',
  },
  {
    id: 'mood',
    text: '오늘 어떤 느낌으로 먹고 싶어?',
    options: ['익숙하고 편한 거', '색다르고 특별한 거', '상관없음'],
    type: 'single',
  },
];

export function getActiveQuestions(drinkAnswer?: string, foodType?: string[]): Question[] {
  return questions.filter((q) => {
    if (!q.conditional) return true;
    if (q.id === 'drinkType') return drinkAnswer === '마심';
    if (q.id === 'meatType') return foodType?.includes('고기') ?? false;
    return false;
  });
}
