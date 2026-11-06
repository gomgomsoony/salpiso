# Vercel Gemini 분석 및 Supabase 신고 저장 설정

Gemini 사진 분석은 Supabase 없이 Vercel의 Node.js Serverless Function(`/api/analyze-photo`)로 사용할 수 있습니다. Supabase 연결은 신고 내용을 영구 저장할 때만 필요합니다. 시연 모드에서는 신고 내용을 현재 브라우저 세션에만 임시 저장하고 사진은 보관하지 않습니다.

## 1. Gemini 사진 분석 시연 준비

1. 로컬 시연은 `python -m http.server`로 화면을 열고 로그인 화면의 Gemini API 키 입력란에 키를 넣습니다. 로컬에서는 브라우저가 Gemini API를 직접 호출합니다.
2. Vercel에서 시연할 경우 이 폴더를 프로젝트의 Root Directory로 배포하고 `api/analyze-photo.js`, `api/public-config.js`를 포함합니다. Vercel **Settings → Environment Variables**에 `GEMINI_API_KEY`와 `KAKAO_MAP_APP_KEY`를 등록하고 Preview/Production 중 사용할 환경을 선택합니다. Kakao 키는 공개용 JavaScript 키를 사용하고 Kakao Developers에서 도메인을 제한하세요.
3. 환경변수를 저장한 뒤 새 배포(Redeploy)를 실행합니다.
4. 배포된 Vercel 주소에서 로그인하고 사진을 첨부한 다음 **사진 분석**을 눌러 테스트합니다.

`GEMINI_MODEL`은 선택 항목이며 기본값은 `gemini-3.6-flash`입니다. 기존에 `GEMINI_MODEL`을 등록했다면 값이 `gemini-3.6-flash`인지 확인하세요. Gemini가 일시적 혼잡(503)을 반환하면 API가 최대 3회까지 짧게 자동 재시도합니다. 분석할 때 첨부 사진이 Google Gemini API로 전송됩니다. 로컬 로그인 화면의 키는 브라우저 세션에 보관되며 브라우저에서 Gemini로 직접 전송되므로 개발자 도구에 노출될 수 있습니다. 시연용 키만 사용하고, 실제 사용에서는 Vercel 환경변수를 이용하세요.

카카오 지도 키는 `KAKAO_MAP_APP_KEY` 환경변수에서 제공됩니다. 로컬 정적 서버에서는 이 Vercel 설정 API가 실행되지 않으므로 `kakao-config.js`의 기존 키를 사용합니다. `file://`에서는 브라우저 보안 제한으로 요청이 차단될 수 있습니다. 로컬 정적 서버에서는 Gemini 직접 분석 시연은 가능하지만 Vercel 함수와 DB 저장은 실행되지 않습니다. Supabase 연결 없이도 Gemini 분석은 가능합니다.

## 2. 신고 영구 저장이 필요한 경우에만: Supabase 준비

1. Supabase에서 테스트용 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다. `reports` 테이블과 비공개 `salpiso-photos` Storage 버킷이 생성됩니다. 기존 테이블을 쓰는 경우에도 `routing_reason` 열 추가를 위해 이 SQL을 다시 실행합니다.
3. Project Settings의 API 항목에서 Project URL과 `service_role` 키를 확인합니다. `service_role` 키는 서버 전용 비밀값이므로 HTML, Git 저장소, 브라우저 코드에 넣지 않습니다.

## 3. Supabase 연동 Vercel 환경변수

영구 저장을 설정할 때만 Vercel 프로젝트의 **Settings → Environment Variables**에 아래 값을 추가합니다.

| 변수 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` 키 |
| `GEMINI_API_KEY` | 사진 분석을 사용할 경우 추가 (Google AI Studio API 키) |
| `GEMINI_MODEL` (선택) | 사용할 Gemini 모델 ID (기본값: `gemini-3.6-flash`) |
| `KAKAO_MAP_APP_KEY` | Kakao Developers의 JavaScript 키 |

Preview와 Production에서 테스트할 환경을 선택하고 저장한 뒤, **새 배포(Redeploy)**를 실행합니다. 환경변수 변경은 기존 배포에 자동 반영되지 않습니다.

카카오 지도 키는 `KAKAO_MAP_APP_KEY` 환경변수에서 읽어 브라우저에 전달합니다. 공개 가능한 JavaScript 키만 사용하고 Kakao Developers에서 배포 도메인만 허용하도록 설정하세요.

## 4. 테스트

1. Vercel 프로젝트의 Root Directory를 이 파일들이 있는 폴더로 지정하고 화면 파일 및 `api/analyze-photo.js`를 포함해 배포합니다. Supabase 저장을 사용할 경우 `api/reports.js`도 포함합니다.
2. 시연은 Vercel 배포 주소에서 사진 분석을 테스트합니다. Supabase를 연동했다면 신고를 등록한 뒤 Table Editor의 `reports`와 Storage 버킷도 확인합니다.
3. Supabase 시연 모드의 임시 신고 내역은 브라우저 세션에만 유지됩니다.

로컬 정적 서버(`python -m http.server`)는 Gemini 브라우저 직접 호출 시연은 가능하지만 Vercel 서버리스 함수와 DB 저장은 실행하지 않습니다. 서버 API까지 로컬에서 검증하려면 Vercel CLI 개발 서버를 사용하세요.

## 자동 부서 배부

신고 제출 시 `department-routing.js`가 신고 유형과 내용의 시설물 키워드를 첨부된 「대구광역시 본청 팀별 분장사무」(2025.9.10. 개정)에 대조해 담당 팀과 근거를 정합니다. 예를 들어 현수막은 도시디자인과 도시환경개선팀, 불법 쓰레기·무단투기는 자원순환과 자원순환행정팀, 도로·보도·안전봉·가로등은 도로과 도로정비팀, 교통신호기·안전표지판은 교통정보운영과 교통시설팀, 하수도·배수시설은 물환경과 하수시설팀, 공원시설은 공원조성과 공원시설팀으로 분류합니다. 분장사무를 특정하기 어렵거나 서로 다른 부서 단서가 겹치면 소통민원과 민원행정팀에 재분류 대상으로 배부합니다. 불법 쓰레기 민원은 주소지 구·군의 실제 수거·단속 담당을 별도로 확인해야 할 수 있습니다. 첨부 자료에 구·군별 담당 기준은 없어 구·군청 내부 배부는 하지 않습니다. 실제 신고 저장 경로에서는 담당부서와 배부 근거를 DB에 저장하고, 시연 모드에서는 분류 결과만 화면에 표시합니다.

현재 앱은 실제 대구시 민원 시스템이나 부서 알림망에 연결되어 있지 않습니다. 따라서 여기서의 자동 배부는 앱 내부 신고 목록의 담당부서를 지정하는 기능이며, 실제 업무 시스템으로 전송하려면 해당 시스템과의 연동 및 담당 부서 확인이 별도로 필요합니다.

## 보안 주의

로그인 화면의 임시 계정은 브라우저에서만 확인하는 시연용이며 실제 인증이 아닙니다. 계정 정보가 화면 코드에 포함되고 신고·사진·Gemini API도 로그인 없이 호출할 수 있으므로 실제 민원·정밀 위치·개인정보를 저장하면 안 됩니다. 실제 운영 전에는 Supabase Auth 등의 서버 검증 기반 인증과 API별 세션 검증, 신고자·담당부서별 권한검사, API 속도 제한, 감사 로그와 사진 열람 권한을 추가해야 합니다. Gemini API 사용량과 비용에도 유의하고, 앱 키는 공개 가능한 Kakao JavaScript 키만 사용해 허용 도메인을 제한합니다.
