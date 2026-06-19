`ai-docs` 폴더에 `14-current-location-recommendation-plan.md` 파일을 새로 만들어줘.

이번 문서는 **Matgil Map 화면에 현재 위치 기반 추천 기능을 추가하기 위한 구현 계획 문서**다.

아직 구현하지 말고, 현재 프로젝트 구조를 확인한 뒤 계획 문서만 작성해줘.

## 문서 제목

```md
# 14. 현재 위치 기반 추천 기능 계획
```

---

## 작업 배경

Matgil은 외국인 서울 여행자를 위한 음식 동선 추천 서비스다.

현재 Map 화면은 아래 흐름을 지원한다.

```txt
장소 검색 기반 추천
프리셋 hot place 기반 추천
Food Type 필터 기반 추천
```

추가로 필요한 흐름은 아래다.

```txt
현재 위치 기반 추천
```

사용자는 여행 전에는 서울의 특정 장소를 검색해 동선을 추천받을 수 있어야 한다.

그리고 실제 서울 여행 중에는 웨이팅, 피로, 일정 변경 같은 문제가 생길 수 있으므로, 현재 위치에서 바로 새 먹방 동선을 추천받을 수 있어야 한다.

이번 기능은 이 목적을 위한 것이다.

---

## 기능 목표

GPS 버튼을 눌렀을 때 브라우저 현재 위치를 1회 가져와서, 그 위치를 기준으로 지도 중심과 추천 코스를 갱신한다.

이번 단계는 실시간 위치 추적이 아니다.

```txt
이번 단계: navigator.geolocation.getCurrentPosition 1회 사용
이번 단계 아님: navigator.geolocation.watchPosition 실시간 추적
```

---

## 현재 화면 전제

현재 Map 화면에는 Kakao Map과 3단계 Bottom Sheet가 있다.

Bottom Sheet는 아래 3단계로 움직인다.

```txt
1. 접힌 상태
   - 하단 메뉴바 바로 위쪽까지 내려감
   - 지도 대부분이 보임

2. 중간 상태
   - 화면 첫 진입 시 기본 상태
   - 시트가 화면 중간 정도까지 올라와 TODAY'S PICKS가 보임

3. 확장 상태
   - 시트가 화면 상단 가까이 올라옴
   - 추천 코스 목록/상세 내용을 더 많이 보여줌
```

현재 이 Bottom Sheet 동작은 이미 구현되어 있으므로, 기존 snap/drag 동작을 깨지 않는 방식으로 GPS 버튼을 추가해야 한다.

---

## 원하는 GPS 버튼 UX

GPS 버튼은 지도 위에 고정된 floating button이 아니라, Bottom Sheet 움직임과 함께 움직이는 느낌이어야 한다.

원하는 위치:

```txt
Bottom Sheet 오른쪽 상단 근처
```

원하는 동작:

```txt
- Bottom Sheet가 중간 상태이면 GPS 버튼도 시트 오른쪽 상단 근처에 위치
- Bottom Sheet가 접힌 상태로 내려가면 GPS 버튼도 같이 내려가서 하단 메뉴바 바로 위쪽 근처에 위치
- Bottom Sheet가 확장되어 화면을 덮으면 GPS 버튼은 시트에 가려지거나 자연스럽게 보이지 않아야 함
```

즉 버튼은 Bottom Sheet의 위치 변화와 시각적으로 연동되어야 한다.

현재 Bottom Sheet가 어떤 컴포넌트에서 snap/drag 상태를 관리하는지 먼저 확인하고, 프로젝트 구조에 가장 맞는 배치 방식을 계획해줘.

---

## GPS 버튼 상태

버튼 상태는 아래처럼 나누고 싶다.

```txt
idle: 기본 상태
loading: 현재 위치 가져오는 중
active: 현재 위치 사용 성공
denied: 위치 권한 거부
error: 위치 가져오기 실패
unsupported: 브라우저 미지원
```

표시 방향:

```txt
idle: 기존 UI와 어울리는 흰색/중립 버튼
loading: 로딩 표시 또는 disabled 상태
active: 파란색 활성 상태
denied/error/unsupported: 기본 상태로 복귀 + 짧은 안내 문구 표시
```

문구는 현재 앱 스타일에 맞게 짧게 제안해줘.

예상 문구:

```txt
Location permission is needed to use your current location.
Could not get your current location.
Location is not supported in this browser.
```

---

## 성공 시 동작

현재 위치를 가져오면 아래처럼 동작해야 한다.

```txt
1. 현재 좌표(lat/lng)를 얻음
2. selectedLocation을 현재 위치 기준으로 변경
3. 지도 중심을 현재 위치로 이동
4. Bottom Sheet 제목이 현재 위치 기준으로 변경
5. nearby places와 추천 코스를 현재 위치 기준으로 재계산
6. 기존 Food Type 필터와 기타 필터 조건은 그대로 유지
7. GPS 버튼은 active 상태로 파란색 표시
```

selectedLocation 예시:

```js
{
  key: 'current_location',
  label: 'Current location',
  lat,
  lng,
  source: 'gps',
  address: null
}
```

현재 앱 UI가 영어 중심이므로 `Current location`을 우선 검토해줘.

---

## 기존 흐름과의 관계

현재 Map 화면에는 이미 아래 흐름이 있다.

```txt
프리셋 hot place 선택 → selectedLocation 변경
Kakao 검색 결과 선택 → selectedLocation 변경
Food Type 필터 선택 → 기존 기준 위치에서 추천 재계산
```

GPS는 이 흐름에 새 입력 방식을 추가하는 것이다.

```txt
GPS 버튼 클릭 → selectedLocation 변경
```

따라서 추천 알고리즘 자체를 새로 만들지 말고, 기존 selectedLocation 기반 추천 흐름을 재사용하는 방향으로 계획해줘.

추가로 아래 상태 전환도 고려해줘.

```txt
GPS active 상태에서 검색 결과 선택 → gpsActive 해제
GPS active 상태에서 프리셋 hot place 선택 → gpsActive 해제
GPS active 상태에서 Food Type 필터만 변경 → gpsActive 유지, 현재 위치 기준으로 재추천
```

---

## 권한 처리

브라우저 Geolocation API를 사용한다.

```js
navigator.geolocation.getCurrentPosition(...)
```

처리해야 할 상황:

```txt
브라우저에서 geolocation 미지원
사용자가 위치 권한 허용
사용자가 위치 권한 거부
위치 요청 timeout
위치 요청 중 알 수 없는 error
```

PC 브라우저에서도 권한 요청이 동작해야 한다.

모바일 GitHub Pages 배포본에서도 권한 요청과 현재 위치 획득이 동작해야 한다.

GitHub Pages는 HTTPS이므로 geolocation 사용이 가능하다는 전제로 계획한다.

---

## 이번 단계에서 하지 않을 것

아래는 이번 작업 범위에서 제외한다.

```txt
watchPosition 실시간 추적
사용자 위치 DB 저장
위치 이동 기록 저장
Edge Function 수정
Supabase DB 수정
영문 데이터 작업
추천 알고리즘 대규모 변경
Kakao 검색 로직 변경
Voice help / TTS 수정
```

이번 작업은 프론트 Map UX와 selectedLocation 연결만 다룬다.

---

## 조사해야 할 파일 후보

현재 프로젝트 구조를 직접 확인해서 실제 파일명을 기준으로 작성해줘.

확인 후보:

```txt
src/pages/HomePage.jsx
src/features/explore/components/NearbySheet.jsx
src/features/explore/components/KakaoMap.jsx
src/features/explore/components/LocationSheet.jsx
src/features/explore/components/SearchOverlay.jsx
src/features/explore/data/locations.js
src/features/explore/data/courseBuilder.js
```

특히 Bottom Sheet가 어떤 컴포넌트에서 3단계 snap/drag 상태를 관리하는지 반드시 확인해줘.

---

## 문서에 포함할 내용

아래 항목을 문서에 정리해줘.

1. 현재 Bottom Sheet 구조 파악 결과
2. GPS 버튼을 어느 컴포넌트에 두는 게 가장 자연스러운지
3. 버튼이 시트 움직임과 함께 움직이게 할 방법
4. 필요한 state 목록
5. 현재 위치 성공 시 selectedLocation 연결 방식
6. 권한 거부/미지원/실패 처리 방식
7. 검색/프리셋 선택 시 gpsActive 해제 방식
8. Food Type 필터 변경 시 gpsActive 유지 방식
9. 수정 예상 파일 목록
10. 이번 작업에서 건드리지 않을 파일/기능
11. 구현 시 위험한 부분과 방지책
12. 구현 후 테스트 시나리오

---

## 문서 스타일

* 기존 ai-docs 문서 스타일을 따라줘.
* 구현 전에 참고할 수 있는 계획 문서로 작성해줘.
* 너무 추상적으로 쓰지 말고, 현재 프로젝트 파일 구조 기준으로 작성해줘.
* 코드 전체를 작성하지 말고 계획 중심으로 정리해줘.
* 나중에 이 문서를 읽고 바로 구현 지시를 내릴 수 있게 작성해줘.

---

## 작업 제한

* `ai-docs/14-current-location-recommendation-plan.md` 파일만 생성해줘.
* 코드 수정하지 마.
* docs 폴더 수정하지 마.
* README 수정하지 마.
* Edge Function 수정하지 마.
* Supabase 관련 파일 수정하지 마.
* Git commit / push 하지 마.

---

## 작업 후 보고

1. 생성한 파일명
2. 현재 Bottom Sheet 구조 파악 결과 요약
3. GPS 버튼 배치 계획 요약
4. selectedLocation 연결 계획 요약
5. 수정하지 않은 파일/영역 확인
