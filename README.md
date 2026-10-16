# 살피소 현장 신고 테스트 앱

이 폴더만 Vercel 배포 대상으로 사용하세요. 상위 업무 폴더 전체를 GitHub/Vercel에 연결하지 마세요.

- `index.html`: 현장 업무 화면
- `kakao-config.js`: Kakao JavaScript 앱 키 설정
- `api/reports.js`: Vercel 신고 저장/조회 API
- `api/analyze.js`: Gemini 사진 분석 API
- `supabase/schema.sql`: 신고 테이블과 비공개 사진 버킷 생성 SQL
- `VERCEL_SUPABASE_SETUP.md`: Supabase 및 Vercel 설정 절차

빠른 시작:

1. 이 폴더의 내용만 별도 GitHub 저장소에 올리고 Vercel에서 해당 저장소를 Import합니다.
2. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Vercel 프로젝트 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`를 설정하고 재배포합니다.
4. 배포된 URL에서 사진을 첨부하고 **사진 분석**을 눌러 초안을 확인한 뒤 신고를 등록합니다.

지도 키를 바꾸려면 `kakao-config.js`의 `kakaoMapAppKey` 값만 수정하면 됩니다. 이 키는 브라우저에 전달되는 공개 키이므로 Kakao Developers에서 서비스 도메인을 허용 목록으로 제한하세요.

로그인 기능이 없는 테스트 앱입니다. 가짜 데이터로만 검증하고 실제 개인정보를 입력하지 마세요. Supabase 및 Gemini API 키는 Vercel 환경변수로만 관리하고 GitHub 저장소에 올리지 않습니다.
