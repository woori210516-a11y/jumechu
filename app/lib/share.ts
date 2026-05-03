import type { Answers } from '@/app/types';

export function answersToParams(answers: Answers): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: string, val: string | undefined) => { if (val) p.set(key, val); };
  const setArr = (key: string, val: string[] | undefined) => { if (val?.length) p.set(key, val.join(',')); };

  set('condition', answers.condition);
  set('weather', answers.weather);
  set('diet', answers.diet);
  setArr('foodType', answers.foodType);
  set('soup', answers.soup);
  set('spicy', answers.spicy);
  set('amount', answers.amount);
  set('drink', answers.drink);
  set('drinkType', answers.drinkType);
  setArr('avoid', answers.avoid);
  set('mood', answers.mood);
  setArr('meatType', answers.meatType);
  return p;
}

export function paramsToAnswers(params: URLSearchParams): Answers {
  const get = (k: string) => params.get(k) ?? undefined;
  const getArr = (k: string) => { const v = params.get(k); return v ? v.split(',') : undefined; };
  return {
    condition: get('condition'),
    weather: get('weather'),
    diet: get('diet'),
    foodType: getArr('foodType'),
    soup: get('soup'),
    spicy: get('spicy'),
    amount: get('amount'),
    drink: get('drink'),
    drinkType: get('drinkType'),
    avoid: getArr('avoid'),
    mood: get('mood'),
    meatType: getArr('meatType'),
  };
}
