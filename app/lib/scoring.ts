import type { Answers, Menu, ScoredMenu } from '@/app/types';

const WEIGHTS = {
  drinkType: 6,
  foodType: 5,
  spicy: 5,
  condition: 2,
  weather: 2,
  soup: 2,
  amount: 1,
  mood: 3,
};

const GRADE: Record<string, number> = {
  strong: 2,
  normal: 1,
};

const conditionMap: Record<string, string> = {
  '피곤함': '피곤',
  '멀쩡함': '멀쩡',
  '스트레스받음': '스트레스',
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
  '와인·양주': '와인',
};

function scoreTag(
  tagObj: Record<string, string>,
  key: string,
  weight: number
): number {
  const grade = tagObj[key];
  return grade ? weight * (GRADE[grade] ?? 0) : 0;
}

export function calculateScore(menu: Menu, answers: Answers): number {
  // Exclusion rules
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

  // Diet moderate penalty
  if (answers.diet === '적당히 신경씀' && menu.diet === '나쁨') {
    score -= 3;
  }

  // Condition
  if (answers.condition && answers.condition !== '상관없음') {
    const key = conditionMap[answers.condition];
    if (key) score += scoreTag(menu.tags.condition, key, WEIGHTS.condition);
  }

  // Weather
  if (answers.weather && answers.weather !== '상관없음') {
    const key = weatherMap[answers.weather];
    if (key) score += scoreTag(menu.tags.weather, key, WEIGHTS.weather);
  }

  // Food type (multi-select — take best matching score)
  if (answers.foodType && !answers.foodType.includes('상관없음') && answers.foodType.length > 0) {
    let best = 0;
    for (const ft of answers.foodType) {
      const key = foodTypeMap[ft];
      if (key) best = Math.max(best, scoreTag(menu.tags.foodType, key, WEIGHTS.foodType));
    }
    score += best;
  }

  // Soup — binary exclusion
  if (answers.soup && answers.soup !== '상관없음') {
    const hasSoup = menu.tags.soup === 'normal' || menu.tags.soup === 'strong';
    if (answers.soup === '없는 거' && hasSoup) return Number.NEGATIVE_INFINITY;
    if (answers.soup === '있는 거' && !hasSoup) return Number.NEGATIVE_INFINITY;
    // '있는 거' 선택 시 국물이 많을수록 가산점
    if (answers.soup === '있는 거') {
      score += WEIGHTS.soup * (GRADE[menu.tags.soup] ?? 0);
    }
  }

  // Spicy — spicy 값이 0이면 제외, 아니면 값 × 가중치 / 10 점수 반영
  if (answers.spicy && answers.spicy !== '상관없음') {
    const key = spicyMap[answers.spicy];
    if (key) {
      const spicyValue = menu.tags.spicy[key] ?? 0;
      if (spicyValue === 0) return Number.NEGATIVE_INFINITY;
      score += (spicyValue * WEIGHTS.spicy) / 10;
    }
  }

  // Amount
  if (answers.amount && answers.amount !== '상관없음') {
    const key = amountMap[answers.amount];
    if (key) score += scoreTag(menu.tags.amount, key, WEIGHTS.amount);
  }

  // Drink type (only when drinking)
  if (
    answers.drink === '마심' &&
    answers.drinkType &&
    answers.drinkType !== '상관없음'
  ) {
    const key = drinkTypeMap[answers.drinkType];
    if (key) score += scoreTag(menu.drinkType, key, WEIGHTS.drinkType);
  }

  // Mood
  if (answers.mood && answers.mood !== '상관없음') {
    const moodKey = answers.mood === '익숙하고 편한 거' ? '편한' : '색다른';
    if (menu.mood === moodKey) {
      score += WEIGHTS.mood * 2;
    }
  }

  // Meat type (only when 고기 selected in foodType)
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
