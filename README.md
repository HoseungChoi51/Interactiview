# 인터랙티브 인터뷰집 (Interactiview)

16명의 인터뷰 원고(노션에서 내보낸 MD)를 바탕으로, 독자가 인터뷰이 한 명 한 명에게 직접 묻고 답을 듣는 웹서비스입니다.

- 답변은 세 종류로 나뉘고 화면에 항상 표시됩니다: **원문 인용**, **원고를 바탕으로 AI가 이어 쓴 답**, **아직 답하지 않은 질문**.
- 인용문은 서버가 원고와 글자 단위로 대조해서, 원고에 없는 문장은 내보내지 않습니다.
- 원고에 없는 질문은 독자가 "직접 물어보기"를 누르면 인터뷰이 대기열에 들어갑니다. 인터뷰이는 매주 메일로 받은 링크에서 답할 질문을 직접 고릅니다.
- 독자의 질문, 공감, "더 듣고 싶어요", "답이 어긋났어요" 반응이 모두 기록되고 관리 페이지와 CSV로 볼 수 있습니다.

설계 문서: https://claude.ai/artifact/YZBJTtpfn4GN6wbM6u4sms

## 원고 넣기

1. 노션에서 인터뷰이 페이지를 **Markdown**으로 내보냅니다.
2. 파일을 `content/personas/` 에 넣습니다. 파일 이름이 주소가 됩니다 (`kim-minji.md` → `/p/kim-minji`). 노션이 붙이는 긴 ID는 자동으로 떼어냅니다.
3. 원고 형식: 첫 질문 제목 전까지가 자기소개, `## 질문`이 질문, 그 아래 본문이 답입니다. `##`이 없으면 `###`을 질문으로 봅니다.
4. 파일 맨 위에 이름, 한 줄 소개, 예시 질문, 말투 메모를 붙이면 더 좋습니다. `content/personas/_TEMPLATE.md` 를 참고하세요.
5. 예시 파일 `sample-jiwoo.md`, `sample-minho.md` 는 가상의 인물입니다. 실제 원고를 넣으면 지워주세요.

## 로컬에서 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (비워둬도 데모 모드로 동작)
npm run dev
```

- `ANTHROPIC_API_KEY` 가 없으면 **데모 모드**: 질문과 단어가 겹치는 문단을 찾아 인용만 합니다.
- `SUPABASE_URL` 이 없으면 `.data/db.json` 파일에 저장합니다 (로컬 전용).
- 들어가기: `http://localhost:3000/join?code=<INVITE_CODE>`
- 관리 페이지: `http://localhost:3000/admin?key=<ADMIN_KEY>`

```bash
npm test         # 원고 파서, 인용 검증, 링크 토큰 테스트
npm run build
```

## 배포 (Vercel + Supabase)

1. **Supabase**: 새 프로젝트 생성 → SQL Editor 에 `supabase/schema.sql` 붙여넣고 실행 → Project Settings > API 에서 URL 과 `service_role` 키 복사.
2. **Claude API**: https://console.anthropic.com 에서 API 키 발급. 월 사용 한도를 걸어두세요.
3. **Resend**(메일): 키 발급, 보내는 도메인 인증.
4. **Vercel**: 이 저장소를 Import → Environment Variables 에 `.env.example` 의 값을 모두 넣기 → Deploy.
5. 베타 테스터에게 `https://<도메인>/join?code=<INVITE_CODE>` 를 공유합니다.

주간 메일은 `vercel.json` 의 예약 작업으로 매주 월요일 09:00(KST)에 나갑니다. `/api/cron/weekly?key=<ADMIN_KEY>&dry=1` 로 보내지 않고 미리 볼 수 있습니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx` | 서가(16명), 내 질문에 온 새 답변 |
| `app/p/[slug]` | 1:1 대화, `read/` 는 원고 전문 |
| `app/answer/[token]` | 인터뷰이 답변 페이지 (로그인 없이 링크로) |
| `app/admin` | 통계, 주제, 공감 문단, 대기 질문, CSV |
| `app/api/cron/weekly` | 인터뷰이 주간 메일, 운영자 리포트 |
| `lib/prompt.ts` | 인터뷰이 목소리 규칙과 원고가 들어가는 프롬프트 |
| `lib/ai.ts` | Claude 호출 (대화: Claude Opus 5.5, 보조: Claude Haiku 5.5) |
| `lib/quotes.ts` | 인용문 원고 대조 |
| `lib/store/` | Supabase / 로컬 파일 저장소 |

원고가 사람당 8,000자 정도라 벡터 검색 없이 그 사람의 원고 전체를 프롬프트에 넣고 프롬프트 캐시를 씁니다.
