# 살피소 현장 신고 테스트 앱

이 폴더만 Vercel 배포 대상으로 사용하세요. 상위 업무 폴더 전체를 GitHub/Vercel에 연결하지 마세요.

- `index.html`: 현장 업무 화면
- `kakao-config.js`: Kakao JavaScript 앱 키 설정
- `department-routing.js`: 업무분장 기준 담당 부서 자동 분류 규칙
- `api/reports.js`: Vercel 신고 저장/조회 API
- `api/analyze-photo.js`: Gemini 사진 분석 API
- `supabase/schema.sql`: 신고 테이블과 비공개 사진 버킷 생성 SQL
- `VERCEL_SUPABASE_SETUP.md`: Supabase 및 Vercel 설정 절차

## 관리자 대시보드

현장 업무 화면의 **관리자 대시보드** 메뉴에서 현재 불러온 신고의 전체·상태별 건수, 완료율, 신고 유형별/담당 부서별 업무량, 최근 신고, 신고 제목·유형·내용을 분석한 키워드 워드클라우드를 확인할 수 있습니다. 키워드는 신고 1건에 같은 단어가 반복돼도 한 번만 집계하며, 단어를 누르면 해당 신고 검색 결과로 이동합니다. 지표 카드를 누르면 해당 상태의 신고 목록으로 이동하고, 새로고침으로 현재 데이터 원본을 다시 읽습니다.

현재 앱은 시연 모드입니다. 관리자 메뉴는 인증·권한 검사를 하지 않으며, 시연에서는 브라우저 세션 신고와 예시 신고를 합쳐 표시합니다. 실제 민원 전체 현황을 운영하려면 서버에서 검증하는 관리자 인증/권한과 DB 기반 조회가 필요합니다. 현재 신고 목록 API는 최근 최대 100건만 반환하므로 그 이상을 집계하려면 페이지네이션 또는 서버 집계도 추가해야 합니다.

## Gemini 사진 분석 시연 (Supabase 불필요)

1. 로컬에서는 `python -m http.server`로 화면을 열고 로그인 화면의 Gemini API 키 입력란에 키를 입력합니다. 로컬일 때는 브라우저에서 Gemini를 직접 호출합니다.
2. Vercel에서는 이 폴더를 프로젝트의 Root Directory로 배포하고, **Settings → Environment Variables**에 `GEMINI_API_KEY`와 `KAKAO_MAP_APP_KEY`를 등록합니다. Vercel은 `api/analyze-photo.js` 서버 API로 Gemini를 호출하고, `api/public-config.js`에서 공개 카카오 지도 키를 읽습니다.
3. Vercel 환경변수 저장 후에는 **Redeploy**하고 배포 주소에서 사진 분석을 테스트합니다.

사진 분석은 Supabase 연결 없이 동작합니다. 로컬 브라우저 입력 키는 현재 세션에 보관하고 브라우저에서 Gemini로 직접 전송하므로 개발자 도구에서 노출됩니다. 시연용 키만 사용하고 Google Cloud에서 API 제한을 설정하세요. Vercel에서는 API 키를 서버 환경변수로 관리하는 방식을 권장합니다. 시연 모드의 신고 제출은 업무분장 기준 담당 부서를 자동 분류해 화면에 표시하지만 신고 내용은 브라우저 세션에만 보관하며 실제 부서 통보나 DB 저장은 하지 않습니다. 사진은 Gemini로 전송됩니다.

`file://`에서는 브라우저 보안 제한으로 분석이 차단될 수 있으므로 `python -m http.server` 또는 Vercel 배포 주소를 사용하세요. 시연 키를 HTML/저장소에 직접 기록하지 마세요.

## Supabase 연동 (선택)

신고 내용을 브라우저 세션이 아니라 영구 저장하려는 경우에만 Supabase를 설정합니다.

1. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 추가합니다. `service_role` 키는 서버 전용입니다.
3. 다시 배포하고 신고 저장을 확인합니다.

카카오 지도 키는 브라우저에 전달되는 공개 키입니다. Vercel 환경변수 `KAKAO_MAP_APP_KEY`로 관리하고 Kakao Developers에서 서비스 도메인을 허용 목록으로 제한하세요. 로컬 정적 시연에서는 기존 `kakao-config.js` 설정을 사용합니다.

로그인 화면은 시연용 임시 계정으로만 동작하며 실제 인증이나 API 보호 기능은 없습니다. 계정 정보가 브라우저 코드에 포함되고 신고·사진·Gemini API도 로그인 없이 호출할 수 있으므로, 가짜 데이터로만 검증하고 실제 개인정보를 입력하지 마세요. 실제 운영에는 Supabase Auth 등 서버 검증 기반 인증을 적용해야 합니다. API 서비스 키는 GitHub 저장소에 올리지 않습니다.
