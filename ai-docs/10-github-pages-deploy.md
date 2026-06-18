# 10. GitHub Pages 배포 설정

## 배포 주소

```
https://eclipticwin.github.io/matgil/
```

---

## 현재 설정 상태 (완료)

### vite.config.js

```js
export default defineConfig({
  plugins: [react()],
  base: '/matgil/',   // ← 서브경로 필수. 없으면 흰 화면
});
```

### .github/workflows/deploy.yml

- `main` 브랜치 push 시 자동 실행
- `actions/checkout` → `actions/setup-node` (Node 20) → `npm ci` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- `dist` 폴더를 artifact로 업로드해 Pages에 배포

---

## GitHub 저장소에서 반드시 설정해야 할 것

### 1. Pages 소스

```
Settings → Pages → Source → GitHub Actions
```

### 2. Repository Secrets (Actions용)

```
Settings → Secrets and variables → Actions
```

등록해야 할 Secret 3개:

| Secret 이름 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_KAKAO_MAP_JS_KEY` | 카카오맵 JS API 키 |

Secret이 없으면 빌드는 되지만 Supabase/카카오맵 기능이 동작하지 않음.

### 3. Actions 권한

```
Settings → Actions → General → Workflow permissions → Read and write permissions
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 배포 후 흰 화면 | `vite.config.js`에 `base: '/matgil/'` 없음 | `base` 추가 후 재빌드 |
| Actions가 실행 안 됨 | Pages Source가 GitHub Actions 아님 | Settings → Pages → Source 변경 |
| Supabase/지도 기능 안 됨 | Secrets 미등록 | Secret 3개 등록 |
| deploy job 권한 오류 | Workflow permissions 부족 | Read and write 설정 |

---

## 향후 배포 흐름

`main` 브랜치에 push하면 자동으로 빌드 + 배포가 실행된다.
수동 실행도 가능: `Actions` 탭 → `Deploy to GitHub Pages` → `Run workflow`.
