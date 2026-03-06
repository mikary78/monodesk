# MonoDesk 코딩 규칙 (Coding Rules)

이 문서는 MonoDesk 프로젝트에서 Claude Code(AI 코파일럿)가 작업할 때 따를 개발 지침입니다.
모든 응답과 작업은 이 문서의 규칙을 우선으로 하고 서브 에이전트를 적극 활용해서 개발을 진행합니다.

---

## 1. 언어 원칙

- 모든 응답, 문서, 주석은 기본적으로 **한국어**로 작성합니다.
- 코드 내 변수명/함수명은 영어(camelCase, snake_case)를 사용하되, 주석은 반드시 한국어로 작성합니다.
- 에러 메시지는 반드시 한국어로 표시합니다.
- 사용자가 별도 요청 시 예외를 허용합니다.

---

## 2. 변경 관리 원칙

### 작업 전 사전 안내
- 코드나 파일을 추가·수정·삭제할 때는 작업 전에 **무엇을, 왜 하는지** 먼저 채팅에 설명합니다.
- 변경 후에는 **적용된 내용(파일 경로 + 변경 내용)** 을 채팅에 표시합니다.

### 중대한 변경 시 브랜치 생성 필수
아래 경우는 반드시 새로운 Git 브랜치를 생성합니다.
- 신기능 구현
- DB 구조 변경
- UI 레이아웃 대규모 변경
- AI 모듈 추가/변경

브랜치 네이밍 규칙
```
feature/{짧은-설명}   → 새 기능 추가
fix/{짧은-설명}       → 버그 수정
design/{짧은-설명}    → UI/UX 변경
refactor/{짧은-설명}  → 코드 구조 개선
chore/{짧은-설명}     → 설정/문서 변경
```

### 변경 이력 기록 (history/ 폴더)
중대한 변경을 적용할 때는 `history/` 폴더에 변경 내역 문서를 추가합니다.
문서에 반드시 포함할 항목
```
- 날짜
- 요청 내용 요약
- 변경한 내용 (파일/쿼리/설계 요약)
- 테스트 및 검증 방법
- 향후 작업 제안 또는 주의사항
```

파일 명명 규칙: `history/YYYYMMDD_변경내용요약.md`

### 커밋 메시지 규칙
```
[타입] 변경 내용 요약

타입 종류:
[기능추가]    새로운 기능 추가
[버그수정]    오류 수정
[디자인]      UI/UX 변경
[리팩토링]    코드 구조 개선
[DB변경]      데이터베이스 구조 변경
[AI추가]      AI 기능 추가/변경
[문서]        문서 수정
[설정]        환경 설정 변경

예시:
[기능추가] 세무/회계 월별 손익 계산 기능 추가
[버그수정] 매출 입력 시 날짜 오류 수정
[디자인]   대시보드 카드 레이아웃 개선
[DB변경]   직원 테이블에 고용형태 컬럼 추가
```

---

## 3. 테스트 코드 작성 원칙

- 새로운 기능이나 변경이 있을 경우 **반드시 테스트 코드를 함께 작성**합니다.
- Frontend 테스트: `vitest` 사용
- Backend 테스트: `pytest` 사용
- 테스트 파일 위치
```
frontend/src/__tests__/   → React 컴포넌트 테스트
backend/tests/            → FastAPI 백엔드 테스트
```
- 계산 로직(매출, 지분 정산, 원가율 등)은 **반드시 단위 테스트 포함**합니다.
- 민감 데이터(급여, 지분) 관련 기능 변경 시 테스트 통과 후 적용합니다.

---

## 4. 출처 및 참조 명시

- 외부 API, 라이브러리, 문서 등을 참고하거나 사용한 경우 **출처(URL 또는 라이브러리명/버전)** 를 명시합니다.
- 오픈소스 라이브러리 사용 시 라이선스 확인 후 사용합니다.
- 보안/민감정보/라이선스 문제로 출처를 공개할 수 없는 경우 그 사실을 명시하고 대체 설명을 제공합니다.

---

## 5. 폴더 구조

```
MonoDesk/
├── frontend/                   # React 프론트엔드
│   ├── src/
│   │   ├── components/         # 재사용 컴포넌트
│   │   │   ├── common/         # 공통 컴포넌트 (버튼, 입력, 카드 등)
│   │   │   └── modules/        # 모듈별 컴포넌트
│   │   ├── pages/              # 페이지 컴포넌트
│   │   ├── hooks/              # 커스텀 훅
│   │   ├── utils/              # 유틸리티 함수
│   │   ├── api/                # API 호출 함수
│   │   └── styles/             # 스타일 파일
│   └── src/__tests__/          # 프론트엔드 테스트
├── backend/                    # Python FastAPI 백엔드
│   ├── routers/                # API 라우터 (모듈별)
│   ├── models/                 # 데이터베이스 모델
│   ├── schemas/                # 데이터 유효성 검사
│   ├── services/               # 비즈니스 로직
│   ├── ai/                     # AI 기능 모듈
│   ├── utils/                  # 유틸리티 함수
│   └── tests/                  # 백엔드 테스트
├── database/                   # SQLite DB 파일
├── uploads/                    # 업로드 파일 저장
│   ├── receipts/               # 영수증 이미지 (YYYY/MM/)
│   ├── documents/              # 법인 문서
│   └── audio/                  # 회의록 음성 파일
├── backup/                     # 자동/수동 백업
├── history/                    # 중대한 변경 이력 문서
└── .claude/                    # Claude 설정
    ├── CLAUDE.md
    ├── agents/
    └── policies/
```

---

## 6. Frontend 코딩 규칙 (React)

### 파일 규칙
- 파일명: PascalCase (예: SalesReport.jsx)
- 컴포넌트 파일 최대 200줄
- 하나의 파일에 하나의 컴포넌트 원칙

### 코드 규칙
- 함수형 컴포넌트만 사용
- React Hooks (useState, useEffect 등) 활용
- props는 구조분해할당으로 명확하게 표현
- 상수는 파일 상단에 대문자로 정의
- 모든 함수에 한국어 주석으로 역할 설명 필수

### 예시
```jsx
// 월별 매출 현황을 보여주는 컴포넌트
const MonthlySales = ({ year, month }) => {
  // 매출 데이터 상태 관리
  const [salesData, setSalesData] = useState([]);

  // 컴포넌트 로드 시 매출 데이터 불러오기
  useEffect(() => {
    fetchSalesData(year, month);
  }, [year, month]);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {/* 매출 차트 표시 영역 */}
    </div>
  );
};

export default MonthlySales;
```

---

## 7. Backend 코딩 규칙 (Python FastAPI)

### 파일 규칙
- 파일명: snake_case (예: sales_router.py)
- 파일 최대 200줄
- 모듈별로 router 파일 분리

### 코드 규칙
- 모든 함수에 한국어 docstring 필수
- 타입 힌트 반드시 사용
- 에러 처리는 try-except로 명확하게
- 에러 메시지는 한국어로 작성

### 예시
```python
@router.get("/sales/{year}/{month}")
async def get_monthly_sales(year: int, month: int):
    """
    특정 월의 매출 데이터를 반환하는 API
    - year: 조회 연도
    - month: 조회 월
    """
    try:
        # 데이터베이스에서 매출 데이터 조회
        sales = await sales_service.get_monthly(year, month)
        return {"success": True, "data": sales}
    except Exception as e:
        # 에러 발생 시 한국어 메시지 반환
        raise HTTPException(
            status_code=500,
            detail=f"매출 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )
```

---

## 8. Database 규칙 (SQLite)

### 테이블 명명 규칙
- 테이블명: snake_case 복수형 (예: sales_records)
- 컬럼명: snake_case (예: created_at)
- PK: id (자동증가)
- 날짜 컬럼: created_at, updated_at 항상 포함

### 필수 컬럼
```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### DB 변경 원칙
- DB 구조 변경 시 반드시 마이그레이션 파일 생성
- 마이그레이션 파일 위치: `backend/migrations/`
- 파일명: `YYYYMMDD_HHMMSS_변경내용요약.sql`
- 변경 전 반드시 백업 확인 후 진행

---

## 9. AI 관련 코딩 원칙

- 모든 AI 처리는 로컬(Ollama)에서만 실행
- Ollama 미실행 상태에서도 기본 기능은 반드시 동작
- AI 처리 결과는 사용자 확인 후 저장 (자동 저장 금지)
- AI 기능 실패 시 수동 입력으로 자동 대체

---

## 10. 금지 사항

- 외부 API 호출 금지 (로컬 전용 시스템)
- 하드코딩 금지 (상수는 별도 파일로 관리)
- 미완성 코드 제공 금지
- 주석 없는 코드 제공 금지
- 민감 데이터(급여, 지분, 계좌) 로그 출력 금지
- .env 파일 Git 커밋 금지

---

## 11. 예외와 투명성

- 보안/민감정보/라이선스 문제로 외부 출처를 공개할 수 없는 경우
  그 사실을 명시하고 가능한 대체 설명(요약)을 제공합니다.
- 구현이 불가능하거나 위험한 요청의 경우
  이유를 한국어로 명확히 설명하고 대안을 제시합니다.

---

이 문서는 MonoDesk 프로젝트의 개발 기준입니다.
변경이나 추가가 필요하면 대표님이 요청해주세요.
