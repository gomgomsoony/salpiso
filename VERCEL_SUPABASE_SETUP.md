# Vercel + Supabase 신고 저장 설정

이 화면은 Vercel의 Node.js Serverless Function(`/api/reports`)를 통해 Supabase에 신고 데이터를 저장합니다. 데이터베이스와 사진은 Supabase에 영구 보관하며, Vercel 함수의 임시 파일시스템에는 저장하지 않습니다.

## 1. Supabase 준비

1. Supabase에서 테스트용 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다. `reports` 테이블과 비공개 `salpiso-photos` Storage 버킷이 생성됩니다. 기존 테이블을 쓰는 경우에도 `routing_reason` 열 추가를 위해 이 SQL을 다시 실행합니다.
3. Project Settings의 API 항목에서 Project URL과 `service_role` 키를 확인합니다. `service_role` 키는 서버 전용 비밀값이므로 HTML, Git 저장소, 브라우저 코드에 넣지 않습니다.

## 2. Vercel 환경변수

Vercel 프로젝트의 **Settings → Environment Variables**에 다음 값을 추가합니다.

| 변수 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` 키 |
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 비밀 API 키 |

사진 분석 모델은 선택 환경변수 `GEMINI_MODEL`로 바꿀 수 있으며, 기본값은 `gemini-3.5-flash-lite`입니다. Preview와 Production에서 사용할 환경을 선택하고 저장한 뒤, **새 배포(Redeploy)**를 실행합니다. 환경변수 변경은 기존 배포에 자동 반영되지 않습니다.

카카오 지도 앱 키는 `kakao-config.js`의 `kakaoMapAppKey`에서 관리합니다. 브라우저에 전달되는 공개 키이므로 Kakao Developers에서 배포 도메인만 허용하도록 설정하세요.

## 3. Vercel 프로젝트 생성 및 테스트

1. GitHub에 새 저장소를 만들고 이 프로젝트 폴더의 내용만 올립니다. 저장소 루트에 `index.html`, `package.json`, `api/`, `supabase/`가 보여야 합니다. 상위 업무 폴더나 비밀 키는 올리지 마세요.
2. Vercel 대시보드에서 **Add New → Project** 또는 **Import Project**를 선택해 방금 만든 GitHub 저장소를 가져옵니다.
3. 설정 화면에서 Framework Preset은 **Other**로 둡니다. 저장소 루트에 `index.html`이 있다면 Root Directory는 `./`로 설정하고, Build Command와 Output Directory는 비워 둡니다. 루트에 프로젝트 폴더가 한 겹 더 있다면 Root Directory를 그 폴더로 선택합니다.
4. **Deploy**를 눌러 배포합니다. Vercel은 루트의 `index.html`을 화면으로 제공하고 `api/` 아래 파일을 서버리스 API로 배포합니다. 별도 `vercel.json`은 필요하지 않습니다.
5. 배포가 끝나면 Project Settings → Environment Variables에 위 환경변수를 등록하고 **Redeploy**합니다. 이미 등록했다면 최신 코드가 포함된 배포인지 확인합니다.
6. 배포된 주소에서 사진을 첨부해 **사진 분석**을 테스트한 다음 신고를 제출합니다. Supabase Table Editor의 `reports`와 Storage의 비공개 `salpiso-photos`에서 저장 여부도 확인합니다.

사진 분석은 신고 등록 창에서 사진을 첨부하고 **사진 분석** 버튼을 눌러 확인합니다. Gemini가 제안한 신고 유형과 설명은 입력란에 초안으로 채워지며, 내용을 검토·수정한 뒤 사용자가 신고를 제출해야 저장됩니다. 분석 API(`/api/analyze`)는 서버에서 Gemini를 호출하므로 API 키를 브라우저에 노출하지 않습니다.

로컬의 단순 정적 서버(`python -m http.server`)는 `/api/analyze`와 `/api/reports` 서버리스 함수를 실행하지 않습니다. 사진 분석과 DB 저장은 Vercel Preview 배포 또는 Vercel CLI 개발 서버에서 테스트하세요.

## 자동 부서 배부

신고 제출 시 서버가 신고 유형과 내용을 첨부된 대구광역시 본청 팀별 분장사무에 대조해 담당 팀과 배부 근거를 저장합니다. 분장표에 소관이 명시된 업무는 해당 팀으로 배부하고, 일치하는 업무를 찾지 못하거나 판단이 겹치는 신고는 소통민원과 민원관리팀으로 보내 재분류하도록 표시합니다. 첨부 분장표에는 구·군별 담당부서 기준이 없으므로 주소의 구·군에 따른 구청 내부 배부는 수행하지 않습니다.

## 보안 주의

현재 화면에는 사용자 로그인이 없으므로 API를 열어 둔 상태로 실제 민원·정밀 위치·개인정보를 저장하면 안 됩니다. 사진 분석 시 첨부 사진은 초안 생성을 위해 Google Gemini API로 전송됩니다. 이 구성은 테스트 데이터 용도로만 사용하세요. 실제 운영 전에는 Vercel Deployment Protection 또는 시 내부 인증, 신고자·담당부서별 권한검사, 분석 API의 사용량 제한, 감사 로그와 사진 열람 권한을 추가해야 합니다. 앱 키는 공개 가능한 Kakao JavaScript 키만 사용하고 허용 도메인을 제한합니다.
