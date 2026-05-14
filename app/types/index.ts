export interface Menu {
  id: number;
  name: string;
  category: string;
  avoidCategory?: string[];
  subItems?: string[];
  diet: '좋음' | '보통' | '나쁨';
  drinkType: Record<string, number>;
  isSnack: boolean | string;
  meatType?: string;
  mood?: string;
  tags: {
    foodType: Record<string, number>;
    soup: number;
    spicy: Record<string, number>;
    amount: Record<string, number>;
    condition: Record<string, number>;
    weather: Record<string, number>;
  };
}

export interface Answers {
  condition?: string;
  weather?: string;
  diet?: string;
  foodType?: string[];
  soup?: string;
  spicy?: string;
  amount?: string;
  drink?: string;
  drinkType?: string;
  avoid?: string[];
  mood?: string;
  meatType?: string[];
}

export type Concept = 'solo' | 'together';

export interface ScoredMenu {
  menu: Menu;
  score: number;
}

export interface Question {
  id: keyof Answers;
  text: string;
  subText?: string;
  options: string[];
  type: 'single' | 'multi';
  conditional?: boolean;
}
