# 05. Edge Function — matgil_category_keys 자동 분류 저장

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (04)

- `src/api/placeApi.js`: `matgil_category_keys` SELECT 추가, `matgilCategoryKeys` 반환
- `src/features/explore/data/exploreOptions.js`: 키워드 매칭 제거 → DB 배열 기반 필터로 교체, `CATEGORIES` 19개로 확장
- Edge Function 로컬 파일 없음 상태로 세션 종료

---

## 이번 세션에서 한 것

### 배경

04 세션 종료 시점에 `supabase/functions/mg-tour-seed/index.ts`가 로컬에 없었다.
사용자가 Supabase Dashboard에서 현재 배포된 코드를 직접 복사하여 로컬 파일로 저장한 뒤 형상관리 목적으로 커밋했다.

---

### 작업 1: Edge Function 로컬 백업 커밋

사용자가 직접:

- Supabase Dashboard의 `mg-tour-seed` 함수 코드를 `supabase/functions/mg-tour-seed/index.ts`로 저장
- 커밋 `55f133a` — Edge Function 로컬 백업 최초 등록

---

### 작업 2: `supabase/functions/mg-tour-seed/index.ts` 수정

**변경 내용:**

#### 1. `classifyMatgilCategories` 함수 추가 (`insertPlace` 바로 위)

```ts
function classifyMatgilCategories(title: unknown, firstMenu: unknown): string[]
```

- `title + firstMenu` 텍스트만 사용 (`treatMenu`, `tags` 제외)
- 한 식당이 복수 카테고리를 가질 수 있음
- 아무것도 매칭되지 않으면 `["other"]` 반환
- key 값은 프론트 `CATEGORIES`와 정확히 일치

**분류 룰 (17개 카테고리):**

| key | 키워드 |
|---|---|
| `bbq` | 갈비, 불고기, 삼겹살, 목살, 곱창, 막창, 대창, 숯불, 갈매기살, 고기, 고깃집, 흑염소 |
| `noodle` | 칼국수, 냉면, 국수, 라면, 우동, 짜장, 짬뽕, 쌀국수, 라멘, 소바 |
| `stew` | 찌개, 탕, 매운탕, 해장, 전골, 아구찜, 아귀찜, 갈비찜, 찜닭, 찜 |
| `seafood` | 해물, 해산물, 아구, 아귀, 회, 조개, 낙지, 오징어, 생선, 초밥, 스시, 새우, 게, 대게, 랍스터 |
| `chicken` | 치킨, 닭갈비, 닭볶음탕, 삼계탕, 찜닭, 후라이드, 양념치킨 |
| `street` | 떡볶이, 순대, 어묵, 김밥, 분식, 만두, 호떡, 핫도그 |
| `cafe` | 카페, 커피, 디저트, 베이커리, 케이크, 빵, 마카롱, 도넛, 와플, 빙수 |
| `rice` | 비빔밥, 덮밥, 국밥, 볶음밥, 백반, 한정식, 도시락, 쌈밥 |
| `pork` | 돈까스, 돈가스, 족발, 보쌈, 돼지, 제육 |
| `chinese` | 중식, 중국집, 탕수육, 마라탕, 훠궈, 딤섬, 양꼬치, 양갈비 |
| `japanese` | 일식, 초밥, 스시, 라멘, 우동, 소바, 돈부리, 오마카세, 이자카야, 가츠, 카츠, 규카츠 |
| `western` | 양식, 스테이크, 브런치, 리조또, 샐러드, 그릴, 필라프 |
| `pasta` | 파스타, 스파게티, 라자냐, 뇨끼, 알리오, 까르보나라, 볼로네제 |
| `pizza` | 피자, 화덕피자, 피제리아 |
| `burger` | 버거, 햄버거, 수제버거 |
| `indian` | 인도, 커리, 카레, 난, 탄두리, 마살라, 비리야니 |
| `southeast_asian` | 베트남, 태국, 타이, 팟타이, 똠얌, 분짜, 반미, 나시고랭, 미고랭, 동남아 |

#### 2. `mg_places` insert에 `matgil_category_keys` 추가

```ts
matgil_category_keys: classifyMatgilCategories(listItem.title, introItem?.firstmenu),
```

- `food_category_code_3` 바로 아래에 삽입
- 기존 필드, 중복 체크, 저장 순서 모두 유지

커밋 `4721a5c`

---

### 작업 3: Edge Function CLI 배포 및 테스트 (사용자 직접)

사용자가 직접:

- Supabase CLI로 `mg-tour-seed` 함수 배포 완료
- 다음 10개 데이터 수집 테스트 실행
- `mg_places.matgil_category_keys`에 분류값 정상 저장 확인
- 프론트 화면에서 신규 데이터 조회 및 Food Type 필터 정상 동작 확인

---

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| Edge Function 로컬 파일 | `supabase/functions/mg-tour-seed/index.ts` 존재, 형상관리 중 |
| 신규 수집 시 자동 분류 | `title + firstMenu` 기준 17개 룰, 미매칭 시 `other` |
| `matgil_category_keys` 저장 | insert 시 자동 저장 |
| 프론트 필터 | DB 배열 기반, 정상 동작 확인 |
| 기존 수동 입력 10개 데이터 | 이전 세션에서 수동 업데이트 완료, 유지 |

---

## 다음 세션 참고

- 기존 수동 입력 데이터(10개)는 키워드 룰 기준과 다를 수 있음. 필요 시 재분류 고려.
- `japanese` / `noodle` / `seafood`처럼 키워드가 겹치는 카테고리는 복수 태그 정상 동작.
- FilterSheet에 현재 미노출 카테고리(`rice`, `pork`, `chinese` 등)는 `CATEGORIES` 배열에 추가하면 UI에 즉시 반영 가능.
- TourAPI pageNo 3~10 추가 수집을 완료했다.

현재 mg_places 총 100개이고, matgil_category_keys 빈 배열 데이터는 0개다.

카테고리 분포는 other 35, stew 20, bbq 19, noodle 12, street 8, seafood 7, pork 5, japanese 4, rice 3, cafe 3, chinese 2, chicken 2, western 1 정도다.

other 비율이 높지만 MVP 코스 기능 구현을 먼저 진행하기로 했다.