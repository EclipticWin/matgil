# PLAN: 음식 카테고리 DB 관리 체계 전환 (우선순위 4위)

관련 이슈: ISSUE-25, 26, 27 (2026-07-11-MATGIL-OPEN-ISSUES.md)
선행: PLAN-admin-foundation(관리자 쓰기용 — 조회 전환은 선행 없이 가능), PLAN-i18n-consolidation의 pickLabel 헬퍼(권장)

## 1. 작업 제목
음식 카테고리를 mg_categories 테이블로 이관 — 라벨·키워드·아이콘 데이터화, "고기 구이" 표기 정책 반영

## 2. 현재 문제
카테고리 하나를 바꾸려면 최소 4곳(추가 시 6곳+재배포)을 수정해야 한다:
- 키+라벨: `src/features/explore/data/exploreOptions.js` CATEGORIES 19종 (label/labelKo)
- 분류 키워드: `supabase/functions/mg-tour-seed/index.ts:175-205` — 17종 한국어 키워드 맵 하드코딩 (함수 재배포 필요)
- 아이콘: `src/features/explore/components/CategoryIcon.jsx` PATHS — 키별 SVG 맵
- 코스 제목 템플릿: `courseBuilder.js:129-143` ≡ `courseDisplay.js:17-36` 완전 중복 (+ dictionary courseTitle.* dead keys)
- 스코어링: `courseBuilder.js:70-113` — cafe 보너스/other 감점 등 특정 키 의미 의존
- 표기 정책 미반영: KO 라벨 "한국식 BBQ" → "고기 구이" 변경 필요 (exploreOptions.js:6, courseDisplay.js:25, courseBuilder.js:132, dictionary.js:316)
- 기존 데이터 재분류 수단 없음: mg_places.matgil_category_keys는 시드 시점 1회 분류 + 수동 SQL(docs/03:52).

## 3. 사용자 영향
- 즉시: KO 사용자에게 어색한 "한국식 BBQ" 표기.
- 장기: 카테고리 추가·정리(예: pasta/pizza/burger → western 통합)가 개발자 배포 없이는 불가능 — 데이터 품질 개선 속도 제한.

## 4. 목표
카테고리의 키·라벨(다국어)·키워드·정렬·활성화를 DB 단일 소스로 이관하고, 기존 `matgil_category_keys` 키 값과 100% 호환을 유지한다. 관리자 편집 UI는 후속(이번엔 SQL 관리까지).

## 5. 이번 작업 범위
1. `mg_categories` 테이블 신설 + 현행 19키 시드(이때 bbq의 label_ko를 '고기 구이'로).
2. 프론트: CATEGORIES를 DB 조회로 전환(정적 폴백 유지 — phrases 카테고리와 동일 패턴), 라벨 소비처를 pickLabel 헬퍼로 통일.
3. 제목 템플릿 단일화: courseBuilder/courseDisplay 중복 제거(courseDisplay 한 곳으로), dictionary courseTitle.* 삭제.
4. mg-tour-seed: 분류 키워드를 mg_categories.keywords에서 로드.
5. 재분류 지원: mg-tour-seed에 `reclassifyOnly` 모드 추가(기존 mg_places 대상 matgil_category_keys 재산출, dryRun 지원).

## 6. 제외 범위
- 관리자 편집 화면(후속 — admin-foundation의 /admin 셸에 추가 예정), 아이콘 업로드(키→아이콘 맵은 프론트 유지 + 기본 아이콘 폴백), 스코어링 규칙의 데이터화(cafe 보너스 등은 코드 유지 — 키 존재 여부만 방어), 커뮤니티 카테고리(별개 체계 — communityConstants.js는 대상 아님).

## 7. 현재 관련 코드 흐름
- 필터: FilterSheet(CATEGORIES 렌더, 최대 3개) → HomePage state → applyFilters(exploreOptions.js:46-60, matgil_category_keys some 매칭) → courseBuilder 후보.
- 표시: PlaceDetailSheet.jsx:12-16(키→라벨), 57(대표 카테고리), NearbySheet/TodayCourseDetail(코스 카테고리 요약).
- 분류: mg-tour-seed classifyMatgilCategories(이름·카테고리 문자열에 키워드 includes) → mg_places.matgil_category_keys text[].
- 제목: courseBuilder.makeTitle(신규 코스) / courseDisplay(저장 코스 재현) — 지배 카테고리(street/bbq/noodle/cafe) 분기.

## 8. 수정할 파일
- `src/features/explore/data/exploreOptions.js` — CATEGORIES를 `fetchCategories()` 결과로 대체 가능한 구조로(정적 배열은 FALLBACK_CATEGORIES로 개명·유지). applyFilters는 키 기반이라 무변경.
- `src/features/explore/components/FilterSheet.jsx` — categories prop/훅 소비 + 로딩 처리.
- `src/features/explore/components/CategoryIcon.jsx` — 미지의 키 → 기본 아이콘 폴백 추가.
- `src/features/explore/components/PlaceDetailSheet.jsx` — 라벨 조회를 카테고리 맵 기반으로(12-16행), raw 키 chip 노출(81행) 제거 또는 라벨화.
- `src/features/explore/data/courseBuilder.js` — KO_TITLES/EN_TITLES 삭제 → courseDisplay 템플릿 재사용.
- `src/features/courses/utils/courseDisplay.js` — 제목 템플릿 단일 소스화 + bbq KO 템플릿 '고기 구이 동선'류로 갱신.
- `src/shared/i18n/dictionary.js` — courseTitle.* 삭제.
- `supabase/functions/mg-tour-seed/index.ts` — RULES를 mg_categories 조회로 대체, reclassifyOnly 모드.
- `src/pages/HomePage.jsx` 또는 신규 훅 — 카테고리 1회 로드 공유.

## 9. 새로 만들 파일
- `src/api/categoryApi.js` — fetchCategories() (mg_categories select, is_active, sort_order).
- `src/shared/hooks/useCategories.jsx` — 로드 + 폴백 + 캐시(모듈 레벨 1회).
- `docs/sql-food-categories-2026-07-11.md` — 아래 SQL 모음.

## 10. DB 변경 필요 여부
필요 — 테이블 1개 신설 + 시드. 기존 테이블 변경 없음(matgil_category_keys는 그대로).

## 11. DDL/DML 초안

**Claude가 작성할 SQL (사용자 실행):**
```sql
-- (1) 테이블
create table public.mg_categories (
  key text primary key,                    -- 기존 matgil_category_keys 값과 동일 ('bbq' 등)
  label_en text not null,
  label_ko text not null,
  keywords text[] not null default '{}',   -- mg-tour-seed 분류용 (ko 키워드)
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_filterable boolean not null default true,  -- 'all'은 필터 전용 가상 키이므로 시드 제외
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mg_categories enable row level security;
create policy "categories public read" on public.mg_categories
  for select using (is_active = true);
create policy "categories admin write" on public.mg_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.mg_categories to anon, authenticated;

-- (2) 시드: 현행 exploreOptions.js 18키('all' 제외) + mg-tour-seed 키워드 맵 이식.
--     bbq의 label_ko는 정책 반영: '고기 구이'
insert into public.mg_categories (key, label_en, label_ko, keywords, sort_order) values
  ('bbq','Korean BBQ','고기 구이', array['구이','갈비','삼겹','불고기','고기','바베큐','숯불'], 10),
  ('noodle','Noodles','면 요리', array['국수','면','냉면','칼국수','라면','우동','소바'], 20),
  ('stew','Stew & Soup','찌개·탕', array['찌개','탕','국','전골','수제비'], 30),
  ('seafood','Seafood','해산물', array['해물','회','수산','조개','생선','오징어','문어','게'], 40),
  ('chicken','Chicken','치킨', array['치킨','닭','통닭'], 50),
  ('street','Street Food','길거리 음식', array['분식','떡볶이','순대','튀김','김밥','만두'], 60),
  ('cafe','Cafe & Dessert','카페·디저트', array['카페','커피','디저트','베이커리','빵','케이크','차'], 70),
  ('rice','Rice Meals','밥·덮밥', array['밥','덮밥','비빔밥','정식','한정식','백반'], 80),
  ('pork','Pork Cutlet & Pork','돼지고기', array['돈까스','돈가스','족발','보쌈','제육'], 90),
  ('chinese','Chinese','중식', array['중국','중식','짜장','짬뽕','마라'], 100),
  ('japanese','Japanese','일식', array['일식','초밥','스시','돈부리','이자카야','라멘'], 110),
  ('western','Western','양식', array['양식','스테이크','브런치'], 120),
  ('pasta','Pasta','파스타', array['파스타','스파게티'], 130),
  ('pizza','Pizza','피자', array['피자'], 140),
  ('burger','Burger','버거', array['버거','햄버거'], 150),
  ('indian','Indian','인도 음식', array['인도','커리','카레'], 160),
  ('southeast_asian','Southeast Asian','동남아 음식', array['쌀국수','베트남','태국','팟타이','분짜'], 170),
  ('other','Other','기타', array[]::text[], 999);
```
> 주의: 위 keywords는 mg-tour-seed/index.ts:175-205의 실제 키워드 맵을 **구현 시점에 원문 그대로 이식**해야 한다(위 값은 자리표시 초안 — 실행 전 원문 대조 필수).

**실행 전 확인 SQL:**
```sql
select to_regclass('public.mg_categories');                       -- null이어야 신규 생성 가능
select distinct unnest(matgil_category_keys) from public.mg_places order by 1;  -- 실사용 키 전수 (시드 커버리지 검증)
```

**실행 후 검증 SQL:**
```sql
select count(*) from public.mg_categories;   -- 18
-- 실데이터의 키 중 mg_categories에 없는 키 = 0행이어야 함
select distinct k from (select unnest(matgil_category_keys) k from public.mg_places) s
where not exists (select 1 from public.mg_categories c where c.key = s.k) and k <> 'all';
```

**rollback SQL:**
```sql
drop table if exists public.mg_categories;
```

## 12. RLS/트리거/인덱스 영향
- 신규 테이블 자체 RLS(공개 읽기 + 관리자 쓰기). is_admin()은 PLAN-admin-foundation 선행 필요 — 없으면 admin write 정책만 뒤로 미루고 읽기 전환 먼저 가능.
- PK가 곧 조회 키라 추가 인덱스 불필요.

## 13. 기존 데이터 마이그레이션
- mg_places.matgil_category_keys는 **변경하지 않음** — mg_categories.key가 동일 값이므로 조인·매칭 그대로 성립.
- 실행 전 확인 SQL의 "실사용 키 전수"로 시드 누락 키를 잡는다(있다면 시드에 추가).

## 14. 하위 호환 전략
- 프론트는 fetch 실패 시 FALLBACK_CATEGORIES(현행 정적 배열)로 폴백 — DB 미적용 상태에서도 동작.
- 'all'은 프론트 가상 키로 유지(테이블 미저장).
- 저장 코스 스냅샷은 키 기반 재생성이므로 라벨 변경('고기 구이')이 과거 저장분에도 자동 반영 — 별도 마이그레이션 불필요.
- mg-tour-seed는 mg_categories 조회 실패 시 에러 반환(무음 폴백 금지 — 잘못된 분류 방지).

## 15. 단계별 구현 순서
1. 실행 전 확인 SQL로 실사용 키 전수 확보 → 시드 SQL 확정(키워드 원문 이식).
2. 테이블 생성 + 시드 (admin write 정책은 admin-foundation 완료 여부에 따라 포함/보류).
3. 프론트 조회 전환(categoryApi + useCategories + FALLBACK) — 라벨 '고기 구이' 자동 반영.
4. 제목 템플릿 단일화 + dictionary dead keys 삭제.
5. mg-tour-seed 키워드 DB 로드 + reclassifyOnly 모드 → 재배포.
6. (선택) reclassifyOnly dryRun으로 기존 데이터 재분류 미리보기 → 적용.

## 16. 사용자 수동 작업
- SQL 실행(11번), mg-tour-seed 재배포, 재분류 실행 여부 결정(dryRun 결과 검토 후).

## 17. 롤백 방법
- 프론트: FALLBACK 폴백이 있어 테이블 drop만으로도 동작 복원. 코드 revert.
- 함수: 이전 버전 재배포.

## 18. 엣지 케이스
- DB에 있으나 프론트 아이콘 맵에 없는 신규 키 → CategoryIcon 기본 아이콘 폴백.
- is_active=false 처리된 키가 기존 mg_places에 남은 경우 → 필터 목록에서만 제외, 장소 상세 라벨은 여전히 해석 가능해야 함(라벨 맵은 is_active 무관 전체 조회 또는 비활성 포함 조회).
- 카테고리 fetch가 필터 시트 열기보다 늦는 경우 → 로딩 스피너 또는 폴백 우선 표시 후 교체.
- 저장 코스 제목은 저장 시점 문자열(title 컬럼)이 이미 존재 — 표시 재생성 로직과 어긋나지 않는지(normalizeSavedCourseForDisplay가 재생성 우선) 확인.

## 19. 회귀 위험
- 필터·코스 생성은 키 기반이라 라벨 변경 영향 없음. 위험 지점은 (a) mg-tour-seed 키워드 이식 오탈자 → 분류 품질 저하(dryRun으로 방어), (b) 제목 템플릿 단일화 시 신규/저장 코스 제목 불일치(양쪽 스냅샷 비교 테스트).
- checkCourseAlreadySaved가 제목 문자열 기준(ISSUE-15)인 상태에서 라벨 변경 시 KO 제목이 바뀌어 중복 판정이 어긋남 — **PLAN-i18n-consolidation의 place_ids 통일을 먼저 적용하거나 동시 적용 권장**.

## 20. 테스트 시나리오
1. KO 필터 시트: bbq 칩이 "고기 구이"로 표시, EN은 "Korean BBQ" 유지.
2. bbq 지배 코스 생성 → KO 제목에 새 표기 반영, EN 제목 불변.
3. 과거 저장 코스(스냅샷) KO 표시 → 새 라벨/제목으로 재생성.
4. DB 차단 상태(폴백) → 필터 정상 동작(구 라벨).
5. reclassifyOnly dryRun → 변경 예정 목록 합리성 검토.
6. 신규 카테고리 1개 insert → 필터에 노출 + 기본 아이콘 + 분류 반영(시드 재실행 시).

## 21. 완료 기준
- 카테고리 추가·라벨 수정·비활성화가 SQL만으로 가능(코드 배포 불필요). "한국식 BBQ" 문자열이 코드에서 소멸. 제목 템플릿 소스 1곳. 기존 필터/코스/저장 코스 회귀 없음.

## 22. 작업 후 확인 명령
```bash
npm run build
grep -rn "한국식 BBQ\|courseTitle" src/ || echo CLEAN
grep -n "KO_TITLES" src/features/explore/data/courseBuilder.js || echo TEMPLATES-UNIFIED
```
+ 20번 시나리오, 11번 검증 SQL.
