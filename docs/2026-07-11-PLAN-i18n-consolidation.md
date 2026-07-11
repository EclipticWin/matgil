# PLAN: i18n 통합 — 라벨 헬퍼·하드코딩 이관·저장 코스 locale 정합성 (우선순위 5위)

관련 이슈: ISSUE-14, 15, 17, 20, 26(부분), 27, 28, 36(조사만), 37 (2026-07-11-MATGIL-OPEN-ISSUES.md)

## 1. 작업 제목
pickLabel 공용 헬퍼 도입, 하드코딩 문구 사전 이관, 저장 코스 스냅샷 양언어 보존 + 중복 판정 통일

## 2. 현재 문제
- `locale === 'ko' ? x.labelKo : x.label` 삼항이 10곳에 산재하고 locale 분기가 총 27곳/18파일 — 전부 ko/en 이분법이라 제3언어 추가 시 약 25개 파일을 수정해야 한다(Agent D 전수 목록).
- 사전 키가 있는데도 하드코딩된 문구(VoiceHelpPlaceholder 에러문, TopBar 브랜드명)와 사전에 없는 하드코딩(SignUpPage 검증문 EN, PlaceDetailSheet '가능' KO, EditProfileSheet '6자 이상' KO, PopularPlaceCard '음식점' KO)이 양방향 locale 혼입을 만든다.
- 저장 코스 스냅샷: KO 모드 저장 시 stops[].name이 한국어뿐이라 EN 표시가 불가능하고(courseDisplay.js:72-73), address/description/firstMenu는 재지역화 대상조차 아니다. anchor_label 역변환도 EN→KO만 존재(56-60행).
- 중복 저장 판정이 제목 문자열 기준(savedCourseService.js:77-86)이라 locale 전환 시 같은 코스를 중복 저장할 수 있고, 목록 배지(isSameCourse, place_ids 기준)와 판정이 이원화되어 있다.
- AUTH_ERROR_KO 매핑이 LoginForm/SignUpPage에 중복.

## 3. 사용자 영향
- EN 사용자: 'Parking: 가능', 한국어 정류지명·주소가 섞인 저장 코스, '6자 이상' placeholder.
- KO 사용자: 영어 가입 검증문, 영어 Voice help 에러문.
- 언어 전환 사용자: 같은 코스 중복 저장 / 다른 코스 저장 불가 오탐.

## 4. 목표
UI 문구의 단일 소스를 dictionary로, 데이터 라벨의 단일 해석기를 pickLabel로 통일하고, 저장 코스가 어느 locale에서 저장·표시되든 일관되게 보이게 한다. 제3언어 추가 비용을 "사전 1트리 + labels 객체 + 폴백 체인" 수준으로 낮추는 기반을 만든다.

## 5. 이번 작업 범위
1. `pickLabel(item, locale)` 공용 헬퍼(src/shared/i18n/) — labelKo/label 및 향후 labels 객체 대응. 소비처 10곳 교체.
2. 하드코딩 문구 사전 이관: SignUpPage 4곳, VoiceHelpPlaceholder 3곳(기존 키 연결), PlaceDetailSheet '가능/불가', EditProfileSheet placeholder, TopBar 브랜드, CommentBottomSheet 답글 삼항 2곳, SearchOverlay 안내문. (aria-label은 2차 — 목록만 표기)
3. AUTH_ERROR_KO 통합: 공용 모듈(예: src/features/auth/authErrorMessages.js)로 1곳.
4. 저장 코스 스냅샷 양언어 보존: saveCourse 시 stops[]에 `nameEn`(현재 locale이 ko면 place.name 원본 유지 + placeApi가 이미 nameKo 보존 — 대칭으로 nameEn도 normalize에서 보존해 스냅샷에 포함), anchor_label을 labelKey 방식(프리셋 키/검색어 원문 구분)으로 저장. getLocalizedStopName/Label을 양방향 대응으로 수정.
5. 중복 판정 통일: checkCourseAlreadySaved를 place_ids 배열 비교로 교체(isSameCourse 로직 재사용).
6. mg_phrases 다국어 구조는 **조사·설계 메모만** 남기고 변경하지 않음(ISSUE-36 후속).

## 6. 제외 범위
- 제3언어 실제 추가, mg_place_texts 폴백 체인 개편, mg_phrases 스키마 변경, 레거시 화면 문구(PLAN-user-facing-reliability에서 화면 자체 제거), 카테고리 라벨 소스 전환(PLAN-food-category-management), aria-label 전면 이관(후속).

## 7. 현재 관련 코드 흐름
- 라벨: 각 컴포넌트가 개별 삼항으로 labelKo/label 선택(FilterSheet.jsx:108, LocationSheet.jsx:18, PlaceDetailSheet.jsx:15,64, CommunityTabs.jsx:14, PostComposer.jsx:132, PhraseCategoryTabs.jsx:12, NearbySheet.jsx:126, TodayCourseDetail.jsx:22, courseBuilder.js:239).
- 저장: TodayCourseDetail 저장 버튼 → saveCourse(현재 locale의 course 객체 스냅샷) → mg_saved_courses.
- 표시: CoursesPage/SavedCourseDetailPage/NearbySheet → normalizeSavedCourseForDisplay(courseDisplay.js) → 제목·정류지명만 재생성.
- normalize: placeApi.js normalizePlace가 name(요청 locale)·nameKo(항상)를 만든다 — nameEn은 없음.

## 8. 수정할 파일
- `src/api/placeApi.js` — normalizePlace에 `nameEn`(en 텍스트 행 존재 시) 추가.
- `src/features/courses/services/savedCourseService.js` — saveCourse stops에 nameEn/nameKo 저장 보장, checkCourseAlreadySaved를 place_ids 기준으로 재작성.
- `src/features/courses/utils/courseDisplay.js` — getLocalizedStopName 양방향(en 요청 시 nameEn ?? name), getLocalizedLocationLabel을 labelKey 기반으로.
- `src/features/explore/components/TodayCourseDetail.jsx` — 저장 호출부(labelKey 전달).
- `src/pages/HomePage.jsx` — selectedLocation labelKey 구조(PLAN-user-facing-reliability 6번과 동일 작업 — 선행돼 있으면 재사용).
- 라벨 소비처 10파일 — pickLabel 교체.
- `src/pages/SignUpPage.jsx`, `src/features/auth/components/LoginForm.jsx` — 문구 사전화 + authErrorMessages 공용화.
- `src/features/phrases/components/VoiceHelpPlaceholder.jsx` — 기존 사전 키(phrases.voiceFailed/voiceDenied/voiceError) 연결.
- `src/features/explore/components/PlaceDetailSheet.jsx`, `src/features/profile/components/EditProfileSheet.jsx`, `src/shared/components/TopBar.jsx`, `src/features/community/components/CommentBottomSheet.jsx`, `src/features/explore/components/SearchOverlay.jsx` — 문구 사전화.
- `src/shared/i18n/dictionary.js` — 신규 키 추가(EN/KO 대칭 유지).

## 9. 새로 만들 파일
- `src/shared/i18n/pickLabel.js` — `pickLabel(item, locale)` + (준비용) labels 객체 우선 해석.
- `src/features/auth/authErrorMessages.js` — Supabase 에러 → locale별 메시지.

## 10. DB 변경 필요 여부
불필요. (stops는 jsonb — 필드 추가는 스키마 변경 아님. 단, EN 텍스트 커버리지가 낮으면 nameEn null이 많아짐 — REQUIRED-USER-INPUTS I의 translation_status 분포로 규모 확인.)

## 11. DDL/DML 초안
해당 없음. (선택) 기존 저장 코스의 nameEn 백필은 하지 않음 — 폴백으로 처리.

## 12. RLS/트리거/인덱스 영향
없음.

## 13. 기존 데이터 마이그레이션
- 기존 mg_saved_courses 행의 stops에는 nameEn이 없음 → getLocalizedStopName이 `nameEn ?? name` 폴백으로 자연 처리(구 데이터는 현행과 동일하게 동작 — 악화 없음).
- anchor_label 구 데이터(문자열) → labelKey 부재 시 기존 getLocalizedLocationLabel 경로 유지(신 데이터만 개선).

## 14. 하위 호환 전략
- 스냅샷 필드는 추가만(제거 없음) — 구버전 프론트가 읽어도 무해.
- checkCourseAlreadySaved 교체 후에도 서버 스키마 불변 — 프론트 단독 배포 가능.
- pickLabel은 기존 labelKo/label 구조를 그대로 해석 — 데이터 파일 개편(labels 객체화)은 이번에 하지 않음.

## 15. 단계별 구현 순서
1. pickLabel 도입 + 소비처 10곳 교체(순수 리팩터 — 동작 불변 확인).
2. 문구 사전 이관(신규 키 EN/KO 동시 추가, 대칭 검증).
3. authErrorMessages 통합.
4. placeApi nameEn 추가 → saveCourse/courseDisplay 양방향화 → 중복 판정 place_ids 통일.
5. 회귀 확인: 구 저장 코스 표시, 신규 저장→양언어 표시.

## 16. 사용자 수동 작업
- 없음(코드 전용). 단, EN 텍스트 커버리지(REQUIRED-USER-INPUTS I) 결과가 낮으면 LLM 번역 배치(mg-place-translate-en) 실행을 권장 — 별도 결정.

## 17. 롤백 방법
- 단계별 커밋 revert. 스냅샷 신 필드는 구 코드가 무시하므로 롤백 안전.

## 18. 엣지 케이스
- en 텍스트가 없는 장소를 KO에서 저장 → nameEn null → EN 표시에서 name(한국어) 폴백 — 현행과 동일하되 커버리지만큼 개선.
- 같은 place_ids인데 순서만 다른 코스 → 중복으로 볼지 결정 필요(기본안: 정렬 후 비교 = 중복으로 판정).
- 저장 당시 place가 이후 비활성화 → 스냅샷 표시는 유지(설계 의도), 중복 판정은 place_ids라 영향 없음.
- dictionary 키 추가 시 EN/KO 비대칭 실수 → 15-2 단계에서 대칭 검사(스크립트 또는 수동 카운트).
- 브랜드명 't(brand.name)' 전환 시 KO '맛길'/EN 'Matgil' 유지 확인.

## 19. 회귀 위험
- pickLabel 교체 10곳은 기계적이나 `(ko ? labelKo : null) || label` 변형(4곳)과 `labelKo ?? label` 변형의 미묘한 차이(labelKo가 빈 문자열인 경우) — 헬퍼에서 `??` 기준으로 통일하고 데이터에 빈 문자열 없는지 확인.
- checkCourseAlreadySaved 교체로 저장 버튼 상태 머신(idle/checking/saving/saved/failed — TodayCourseDetail)의 checking 단계 쿼리가 select place_ids로 바뀜 — 응답 형태 변경 주의.
- SignUp 검증 문구 교체 시 검증 로직 자체는 불변 유지.

## 20. 테스트 시나리오
1. EN 모드 전 화면 순회 → 한국어 혼입 0(장소 고유명 제외). KO 모드 → 영어 혼입 0(브랜드/고유명 제외).
2. KO에서 코스 저장 → EN 전환 → 목록·상세의 제목/정류지명/위치 라벨 영어 표시(en 텍스트 있는 장소 기준), 주소는 스냅샷 한계 명시 확인.
3. EN에서 저장한 코스를 KO에서 재저장 시도 → "이미 저장됨" 판정(중복 차단).
4. 제목이 같고 정류지가 다른 두 코스 → 각각 저장 가능.
5. 구 저장 코스(마이그레이션 전 데이터) 표시 회귀 없음.
6. 가입 검증 문구가 locale 따라 표시, Voice help 에러문 KO 표시.

## 21. 완료 기준
- locale 삼항 소비처가 pickLabel 1곳으로 수렴(데이터 파일 제외 grep 기준). 사전 키 EN/KO 대칭 유지. 신규 저장 코스가 양 locale에서 일관 표시. 중복 판정 단일 기준. `npm run build` 성공.

## 22. 작업 후 확인 명령
```bash
npm run build
grep -rn "labelKo ?? \|labelKo : " src/features src/pages | grep -v pickLabel || echo CONSOLIDATED
grep -rn "Passwords do not match\|6자 이상\|'가능'" src/ || echo NO-HARDCODE
```
+ 20번 시나리오 수동 확인.
