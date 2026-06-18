# 16. 검색한 음식점/카페 anchor 매칭, 추천 코스 포함, 로딩 상태 개선

## 작업 일자

2026-06-18

---

## 이전 작업 기준

- 이전 문서: `docs/15-map-search-overlay-and-base-location-unification.md`
- `docs/15`에서 Map 검색 오버레이, Kakao Places 검색, selectedLocation 통합, 서울 검색 제한, 기준 위치 marker 표시까지 구현했다.
- 하지만 검색 결과가 음식점/카페인 경우에도 단순히 기준 위치로만 사용했다. 검색한 장소가 우리 DB에 존재해도 추천 코스에 포함된다는 보장이 없었다.

---

## 이번 작업 목표

1. Kakao 검색 결과가 음식점(FD6) 또는 카페(CB2)인지 판정
2. 해당 장소를 우리 DB places에서 좌표·이름 기준으로 매칭
3. 매칭 성공 시 첫 번째 추천 코스에 anchorPlace로 포함
4. 매칭 실패 시 기존 검색 위치 기준 추천 유지
5. 추천 코스 로딩 중과 실제 빈 결과 상태 구분
6. 로딩 스피너 크기 개선

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/services/anchorMatchService.js` | 신규 |
| `src/features/explore/data/courseBuilder.js` | 수정 |
| `src/features/explore/components/SearchOverlay.jsx` | 수정 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. 음식점/카페 판정

Kakao Places 검색 결과의 `category_group_code` 기준:

| code | 의미 |
|---|---|
| `FD6` | 음식점 |
| `CB2` | 카페 |

이 두 코드 중 하나인 경우에만 DB 매칭을 시도한다. 역·건물·관광지·공원 등은 즉시 `null` 반환 — 기존 기준 위치 추천으로 진행.

Matgil 코스에는 카페도 포함될 수 있으므로 CB2도 anchor 대상에 포함했다.

---

### 2. DB place 매칭 방식

Kakao 검색 결과 자체를 course stop으로 직접 넣지 않는다. 코스에 포함할 수 있는 것은 반드시 Supabase DB에서 가져온 `place` 객체여야 한다.

`anchorMatchService.js`의 `findAnchorPlace(kakaoResult, places)` 함수가 두 단계로 매칭한다.

**1단계 — 좌표 필터 (하드 컷)**

Kakao 결과 좌표 기준 150m 이내 DB places만 후보로 남긴다. 좌표 계산은 기존 `calcDistanceKm` 함수 재사용.

**2단계 — 이름 매칭 (소프트 필터)**

공백 제거 + 소문자 변환 후 아래 세 조건 중 하나 충족 시 매칭:

```txt
완전 일치
Kakao 이름이 DB 이름을 포함
DB 이름이 Kakao 이름을 포함
```

후보가 여러 개면 가장 가까운 place 선택. 이름 미매칭 시 `null` 반환.

---

### 3. anchorPlace 상태 흐름

`HomePage.jsx`에 `anchorPlace` state 추가.

**검색 결과 선택 시:**

```txt
Kakao result 선택
→ selectedLocation 업데이트
→ FD6/CB2이면 findAnchorPlace 호출
→ 매칭 성공 → anchorPlace 저장
→ 매칭 실패 → anchorPlace = null
→ 검색 오버레이 닫힘
→ 추천 코스 재계산 (anchorPlace 포함 또는 기존 방식)
```

**프리셋 hot place 선택 시 (LocationSheet):**

```txt
프리셋 선택
→ selectedLocation 업데이트
→ anchorPlace = null (명시 리셋)
```

anchorPlace는 직접 검색으로 선택한 음식점/카페가 DB와 매칭된 경우에만 설정된다.

`SearchOverlay`에서 `onSelect` 호출 시 `categoryGroupCode: r.category_group_code`를 loc 객체에 포함하도록 수정했다. `handleSearchSelect`에서 이 값을 이용해 `findAnchorPlace`를 호출한다.

---

### 4. 코스 생성 로직 변경

`buildOneCourse`에 `anchorPlace = null` 인자 추가.

anchor가 있으면 해당 place를 포함하는 조합만 우선 평가:

```txt
anchoredCombos = anchor가 포함된 조합
anchoredCombos가 비어 있으면 → 전체 combos fallback
```

`buildRecommendedCourses`에 `anchorPlace = null` 인자 추가.

- 첫 번째 코스(`i === 0`)에서만 anchor 사용
- anchor가 candidatePool에 없으면, validPlaces(food-type 필터 통과한 places)에서 찾아 재주입 (20-place 슬라이스 한계 대응)
- 재주입 버전은 `distanceKm`이 포함된 정상 객체 사용

두 번째 이후 코스는 기존 추천 로직 그대로.

---

### 5. 확인 사례

#### 광화문국밥 검색

Kakao 검색 결과 `place_name`과 우리 DB `name`이 이름·좌표 기준으로 매칭됨. anchorPlace로 지정되어 첫 번째 추천 코스 stops에 포함됨. 기준 위치 marker와 코스 stop marker가 지도에 동시에 표시됨.

#### 명동교자 1호점 검색

Kakao 검색 결과가 선택됐으나, 우리 DB의 명동교자 관련 항목과 좌표 차이가 150m를 초과하거나 이름 조건을 충족하지 못함. anchorPlace 매칭 실패 → 기존 검색 위치 기준 주변 추천으로 fallback. 같은 이름이라도 지점이 다르면 억지 매칭하지 않는 것이 안전하다.

---

### 6. 추천 코스 로딩/빈 상태 개선

**기존 문제:**

places 로딩이 완료되기 전에도 `No routes` 빈 상태가 먼저 표시됐다. 잠시 뒤 코스가 뜨더라도 처음엔 추천이 없는 것처럼 보여 혼란을 줬다.

**개선 내용:**

`HomePage`에 `placesLoading` state 추가. Supabase 응답 완료 시 `false`로 전환 (에러 시도 `false`).

`NearbySheet`에 `isLoading` prop 추가. 빈 상태 분기:

| 조건 | 표시 |
|---|---|
| `courses.length > 0` | 코스 목록 |
| `isLoading === true` | 스피너 + "Finding routes nearby…" |
| `isLoading === false && courses.length === 0` | "No routes found nearby." + 안내 문구 |

places 재계산(위치 변경, 필터 변경)은 `useMemo`로 동기 처리되므로 별도 로딩 상태 없이 즉시 반영된다.

---

### 7. 로딩 스피너 크기 조정

| 위치 | 변경 전 | 변경 후 |
|---|---|---|
| 초기 추천 코스 로딩 스피너 | `h-5 w-5` | `h-8 w-8` |
| 스크롤 추가 로딩 스피너 | `h-5 w-5` | `h-7 w-7` |

로딩 상태와 빈 결과 상태를 사용자가 더 쉽게 구분할 수 있도록 크기를 키웠다.

---

## 동작 확인

- Kakao 검색 결과가 FD6/CB2이고 DB 매칭 성공 → 첫 번째 코스에 해당 식당 포함
- Kakao 검색 결과가 역/건물/관광지 → anchor 없이 기존 위치 기준 추천
- 매칭 실패 (좌표/이름 불일치) → anchor 없이 기존 위치 기준 추천
- 프리셋 hot place 선택 → anchorPlace null 리셋, 기존 추천
- places 로딩 중 → 스피너 표시, No routes 미표시
- 로딩 완료 후 코스 없음 → "No routes found nearby." 표시
- `npm run build` 146 modules, 에러 없음

---

## 이번 작업에서 하지 않은 것

- Supabase DB 수정
- Supabase Edge Function 수정
- Supabase deploy
- Git commit / push
- API key / env / GitHub Secrets 수정
- LLM / OpenAI / Solar 관련 작업
- 외부 패키지 설치
- Kakao 검색 결과 DB 저장
- Kakao 검색 결과 자체를 course stop으로 직접 사용
- TTS / Voice help 수정
- Food Type 필터 UI/로직 수정
- Courses 탭 수정

---

## 현재 한계

- DB 커버리지가 낮은 지역에서는 anchor 매칭 성공률이 낮음
- 지점명 차이나 좌표 오차가 크면 매칭 실패 (억지 매칭 없음)
- anchor는 첫 번째 추천 코스에만 우선 반영
- Food Type 필터가 활성화된 상태에서 anchor place가 필터를 통과하지 못하면 코스에 포함되지 않음 (설계상 의도된 동작)

---

## 다음 작업 후보

- DB 데이터 확장 — anchor 매칭 성공률 향상
- 매칭 성공/실패에 대한 UI 힌트 ("명동교자를 코스에 포함했습니다" 등)
- 검색한 장소가 DB에 없을 때 "near this place" 안내 메시지 보완
- 좌표 기준 150m 임계값 조정 여부 검토 (DB 좌표 정밀도에 따라)
- anchor 포함 코스의 제목 개선 (검색한 장소명 반영)
