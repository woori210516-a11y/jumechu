import type { Answers, Menu, ScoredMenu } from '@/app/types';

const WEIGHTS = {
  drinkType: 5,
  foodType: 5,
  spicy: 5,
  condition: 2,
  weather: 2,
  soup: 5,
  amount: 3,
  mood: 3,
};

const conditionMap: Record<string, string> = {
  '날아다님': '날아다님',
  '멀쩡함': '멀쩡',
  '피곤함': '피곤',
  '쓰러지기직전': '쓰러짐',
  // '이미사망' — 별도 처리, 점수 계산 스킵
};

const weatherMap: Record<string, string> = {
  '더움': '더움',
  '추움·쌀쌀': '추움',
  '비·눈': '비',
};

const foodTypeMap: Record<string, string> = {
  '밥': '밥',
  '면': '면',
  '빵': '빵',
  '고기': '고기',
  '생선': '생선',
  '채소 위주': '채소',
};

const spicyMap: Record<string, string> = {
  '안 매운 거': '안매움',
  '적당히': '보통',
  '매운 거': '매움',
};

const amountMap: Record<string, string> = {
  '가볍게': '가볍',
  '든든하게': '든든',
};

const drinkTypeMap: Record<string, string> = {
  '소주': '소주',
  '맥주': '맥주',
  '막걸리': '막걸리',
  '와인·양주': '와인·양주',
};

function scoreNumeric(tagObj: Record<string, number>, key: string, weight: number): number {
  return ((tagObj[key] ?? 0) * weight) / 10;
}

export function calculateScore(menu: Menu, answers: Answers): number {
  if (answers.drink === '안 마심' && menu.isSnack === '안주(전용)') {
    return Number.NEGATIVE_INFINITY;
  }
  if (answers.diet === '빡세게 중' && menu.diet === '나쁨') {
    return Number.NEGATIVE_INFINITY;
  }
  if (
    answers.avoid &&
    !answers.avoid.includes('없음') &&
    answers.avoid.length > 0 &&
    menu.avoidCategory?.some((cat) => answers.avoid!.includes(cat))
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (answers.diet === '적당히 신경씀' && menu.diet === '나쁨') {
    score -= 3;
  }

  if (answers.condition && answers.condition !== '상관없음') {
    const key = conditionMap[answers.condition];
    if (key) score += scoreNumeric(menu.tags.condition, key, WEIGHTS.condition);
  }

  if (answers.weather && answers.weather !== '상관없음') {
    const key = weatherMap[answers.weather];
    if (key) score += scoreNumeric(menu.tags.weather, key, WEIGHTS.weather);
  }

  if (answers.foodType && !answers.foodType.includes('상관없음') && answers.foodType.length > 0) {
    let best = 0;
    for (const ft of answers.foodType) {
      const key = foodTypeMap[ft];
      if (key) best = Math.max(best, scoreNumeric(menu.tags.foodType, key, WEIGHTS.foodType));
    }
    score += best;
  }

  if (answers.soup && answers.soup !== '상관없음') {
    const soupValue = menu.tags.soup;
    if (answers.soup === '없는 거' && soupValue > 0) return Number.NEGATIVE_INFINITY;
    if (answers.soup === '있는 거' && soupValue === 0) return Number.NEGATIVE_INFINITY;
    if (answers.soup === '있는 거') {
      score += (soupValue * WEIGHTS.soup) / 10;
    }
  }

  if (answers.spicy && answers.spicy !== '상관없음') {
    const key = spicyMap[answers.spicy];
    if (key) {
      const spicyValue = menu.tags.spicy[key] ?? 0;
      if (spicyValue === 0) return Number.NEGATIVE_INFINITY;
      score += (spicyValue * WEIGHTS.spicy) / 10;
    }
  }

  if (answers.amount && answers.amount !== '상관없음') {
    const key = amountMap[answers.amount];
    if (key) score += scoreNumeric(menu.tags.amount, key, WEIGHTS.amount);
  }

  if (answers.drink === '마심' && answers.drinkType && answers.drinkType !== '상관없음') {
    const key = drinkTypeMap[answers.drinkType];
    if (key) score += scoreNumeric(menu.drinkType, key, WEIGHTS.drinkType);
  }

  if (answers.mood && answers.mood !== '상관없음') {
    const moodKey = answers.mood === '익숙하고 편한 거' ? '편한' : '색다른';
    if (menu.mood === moodKey) {
      score += WEIGHTS.mood * 2;
    }
  }

  if (
    answers.foodType?.includes('고기') &&
    answers.meatType &&
    !answers.meatType.includes('상관없음') &&
    answers.meatType.length > 0
  ) {
    if (menu.meatType) {
      if (answers.meatType.includes(menu.meatType)) {
        score += 6;
      } else {
        score -= 3;
      }
    }
  }

  return score;
}

export function calculateResults(answers: Answers, menus: Menu[]): ScoredMenu[] {
  return menus
    .map((menu) => ({ menu, score: calculateScore(menu, answers) }))
    .filter((item) => item.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
