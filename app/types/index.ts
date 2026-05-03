export interface Menu {
  id: number;
  name: string;
  category: string;
  subItems?: string[];
  diet: '좋음' | '보통' | '나쁨';
  drinkType: Record<string, string>;
  isSnack: boolean | string;
  meatType?: string;
  mood?: string;
  tags: {
    foodType: Record<string, string>;
    soup: string;
    spicy: Record<string, number>;
    amount: Record<string, string>;
    condition: Record<string, string>;
    weather: Record<string, string>;
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
