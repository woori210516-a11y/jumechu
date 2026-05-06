# jumechu (주메추) — 핸드오프 문서

> 다음 세션에서 바로 이어서 작업하기 위한 현황 정리.

---

## 프로젝트 개요

**"오늘 뭐 먹지?"** — 몇 가지 질문에 답하면 오늘 메뉴를 추천해주는 Next.js 퀴즈 앱.

- **GitHub**: https://github.com/woori210516-a11y/jumechu
- **로컬 경로**: `/Users/junghyunyoon/Desktop/jumechu`
- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS

---

## 파일 구조

```
app/
  page.tsx                  # 메인 페이지 (인트로 → 퀴즈 → 결과 뷰 통합, 'use client')
  layout.tsx                # 루트 레이아웃, OG 메타태그 (metadataBase)
  globals.css               # 글로벌 스타일 + animate-fade-slide / animate-pop 키프레임
  opengraph-image.tsx       # /opengraph-image 자동 생성 (ImageResponse, 1200×630)
  components/
    CharacterImage.tsx      # 캐릭터 이미지 (로컬 /public/character.png)
    ResultView.tsx          # 결과 화면 컴포넌트 (1위 카드 + 2·3위 AlternativeCard)
  lib/
    questions.ts            # 질문 목록 + getActiveQuestions()
    scoring.ts              # 점수 계산 (calculateScore, calculateResults)
    share.ts                # 공유 URL 인코딩/파싱 (resultsToShareParam, parseShareParam)
  result/
    page.tsx                # /result 서버 컴포넌트 (generateMetadata)
    ResultContent.tsx       # /result 클라이언트 컴포넌트 (useSearchParams)
  types/
    index.ts                # Menu, Answers, ScoredMenu, Question 타입
data/
  menus.json                # 메뉴 DB (39개)
```

---

## 핵심 타입 (`app/types/index.ts`)

```ts
interface Menu {
  id: number;
  name: string;
  category: string;
  avoidCategory?: string[];   // 피하기 제외 판정용 세분화 카테고리
  subItems?: string[];
  diet: '좋음' | '보통' | '나쁨';
  drinkType: Record<string, string>;
  isSnack: boolean | string;  // '안주(전용)' | '안주' | false
  meatType?: string;          // '소' | '돼지' | '닭' | '양'
  mood?: string;              // '편한' | '색다른'
  tags: {
    foodType: Record<string, string>;
    soup: string;             // 'strong' | 'normal' | 'none'
    spicy: Record<string, number>; // { 안매움: 0|10, 보통: 0|10, 매움: 0|10 }
    amount: Record<string, string>;
    condition: Record<string, string>;
    weather: Record<string, string>;
  };
}

interface Answers {
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
```

---

## 질문 흐름 (`app/lib/questions.ts`)

총 12개 질문, 조건부 2개:

| 순서 | id | 질문 | 타입 | 조건 |
|---|----|------|------|------|
| 1 | condition | 오늘 컨디션은? | single | - |
| 2 | weather | 오늘 날씨는? | single | - |
| 3 | diet | 다이어트 중이야? | single | - |
| 4 | foodType | 어떤 음식이 당겨? | multi | - |
| 5 | meatType | 어떤 고기? | multi | foodType에 '고기' 포함 시 |
| 6 | soup | 국물 있는 거 vs 없는 거? | single | - |
| 7 | spicy | 맵기는? | single | - |
| 8 | amount | 양은? | single | - |
| 9 | drink | 술 마실 거야? | single | - |
| 10 | drinkType | 무슨 술? | single | drink === '마심' 시 |
| 11 | avoid | 피하고 싶은 카테고리 | multi | - |
| 12 | mood | 어떤 느낌? | single | - |

**avoid 선택지** (17개): 찌개, 국밥, 고기구이, 찜, 중식, 일식, 양식, 분식, 치킨, 피자, 안주, 면류, 햄버거, 기타국물요리, 생선구이, 튀김, 없음

---

## 점수 계산 로직 (`app/lib/scoring.ts`)

### 가중치
| 항목 | 가중치 |
|------|--------|
| drinkType | 6 |
| foodType | 5 |
| spicy | 5 |
| mood | 3 |
| condition | 2 |
| weather | 2 |
| soup | 2 |
| amount | 1 |

### 제외 규칙 (NEGATIVE_INFINITY 반환)
- `drink === '안 마심'` + `isSnack === '안주(전용)'` → 제외
- `diet === '빡세게 중'` + `menu.diet === '나쁨'` → 제외
- `menu.avoidCategory` 중 하나라도 `answers.avoid`에 포함 → 제외
- `soup` 선택 시 국물 유무 불일치 → 제외
- `spicy` 선택 시 해당 맵기 값이 0인 메뉴 → 제외

### 특수 로직
- **spicy**: `menu.tags.spicy[key]`가 0이면 제외, 10이면 `10 * 5 / 10 = 5점` 가산
- **meatType**: 고기 선택 시 일치하면 +6, 불일치하면 -3
- **mood**: 일치하면 `WEIGHTS.mood * 2 = +6`
- **diet '적당히 신경씀'**: `menu.diet === '나쁨'`이면 -3

---

## 메뉴 DB (`data/menus.json`)

- 총 **39개** 메뉴 (id 1~39)
- 최근 추가: 비빔국수(36), 아구찜(37), 감자탕(38), 타코(39)

### avoidCategories 전체 목록
```json
["찌개","국밥","고기구이","찜","중식","일식","양식","분식","치킨","피자","안주","면류","햄버거","기타국물요리","생선구이","튀김"]
```

---

## 결과 공유 (`app/lib/share.ts`)

- **공유 URL 형식**: `/result?q=1-21-17` (상위 3개 메뉴 id를 `-`로 연결)
- `resultsToShareParam(results)` → `"1-21-17"` 문자열 생성
- `parseShareParam(q, menus)` → id로 메뉴 찾아 `ScoredMenu[]` 반환 (score=0)
- 공유된 결과에서는 점수 배지 미표시 (`score > 0`일 때만 표시)

---

## 주요 UI 동작 (`app/page.tsx`)

- **뷰 전환**: `'intro' → 'quiz' → 'result'`
- **뒤로가기**: `history` 스택으로 이전 질문+답변 상태 복원
- **멀티셀렉트 exclusive 옵션**: `'없음'`, `'상관없음'` 선택 시 나머지 해제
- **재밌는 메시지**: `diet === '빡세게 중'` + `drink === '마심'` 동시 선택 시 표시
- **공유 버튼**: 결과 화면에서 URL을 클립보드 복사 → 2.5초간 "복사 완료!" 표시

---

## OG 메타태그

- **메인 페이지** (`app/layout.tsx`): title "오늘 뭐 먹지? 🍽️", description "뭐 먹을지 모르겠다면 ㄱㄱ"
- **결과 페이지** (`app/result/page.tsx`): title "너로 정했다 🍽️", og:url = 현재 공유 URL
- **OG 이미지** (`app/opengraph-image.tsx`): 1200×630, rose→orange 그라디언트, 이모지 장식
- **환경변수**: `NEXT_PUBLIC_BASE_URL` (미설정 시 `http://localhost:3000`)

---

## Git 커밋 히스토리

```
d7f0f73 feat: 메뉴 피하기 카테고리 세분화 및 메뉴 4개 추가
1a61b5b feat: 결과 공유 URL을 메뉴 ID 기반 단축 형식으로 변경 (?q=1-21-17)
502d279 Add OG meta tags and opengraph-image
8cfe268 Update spicy tag structure, scoring logic, and menu data
9ad554d Add food recommendation quiz app (jumechu)
083e195 Initial commit from Create Next App
```

---

## 다음 세션에서 이어서 할 수 있는 것들

아직 논의되지 않은 개선 아이디어 (우선순위 없음):

- [ ] 결과 공유 시 OG 이미지에 메뉴 이름 동적 반영
- [ ] 메뉴 추가 / 태그 값 튜닝 (계속 가능)
- [ ] 피하기 카테고리 질문 UI 개선 (선택지 많아서 스크롤 길어짐)
- [ ] 배포 (Vercel 등) + `NEXT_PUBLIC_BASE_URL` 환경변수 설정
- [ ] 애니메이션 / 디자인 추가 개선
