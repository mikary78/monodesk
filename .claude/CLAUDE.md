# MonoDesk 프로젝트 총괄 가이드

## 프로젝트 개요
- 프로그램명: MonoDesk
- 법인명: MonoBound
- 매장명: 여남동 (용산 삼각지 제철해산물 주점)
- 목적: 외식업 통합 관리 로컬 웹앱
- 개발 방식: 바이브코딩 (비전문가 주도)
- 사용 환경: Windows 로컬 전용

## 기술 스택
- Frontend: React 18 + Tailwind CSS
- Backend: Python FastAPI
- Database: SQLite + SQLAlchemy
- AI: Ollama + Whisper + ChromaDB + Tesseract
- 개발 도구: VS Code + Claude Code

## 모듈 개발 순서 (우선순위)
1. 세무/회계 관리
2. 매출 분석 (POS 연동)
3. 재고/발주 관리
4. 메뉴 관리
5. 직원 관리
6. 대시보드
7. 법인 관리
8. 운영 관리

## 사업체 정보
- 업종: 제철해산물 전문 주점
- 동업자: 4명 (3명 각 29%, 1명 13%)
- 정산: 급여(매월) + 배당(연말)
- 세무: 세무사 위탁

## 에이전트 구성
- dev-orchestrator: 모든 작업의 시작점, 에이전트 협업 조율
- system-architect: 전체 구조 설계
- react-fastapi-developer: 코드 작성
- ui-designer: UI/UX 디자인
- ai-engineer: AI 기능 개발
- business-expert: 비즈니스 로직
- qa-engineer: 품질 관리

## 에이전트 활용 원칙
- 모든 개발 요청은 dev-orchestrator를 통해 시작
- dev-orchestrator가 작업 분석 후 적절한 에이전트에 위임
- 새 모듈 개발 순서:
  1. system-architect → 구조 설계
  2. business-expert → 비즈니스 로직 정의
  3. ui-designer → 화면 설계
  4. react-fastapi-developer → 코드 구현
  5. qa-engineer → 테스트 및 검증

## 개발 정책 참조
- 코딩 규칙: .claude/policies/coding-rules.md
- 디자인 시스템: .claude/policies/design-system.md
- AI 정책: .claude/policies/ai-policy.md
- 데이터 정책: .claude/policies/data-policy.md
- Git 정책: .claude/policies/git-policy.md

## 핵심 원칙
- 모든 코드에 한국어 주석 필수
- 로컬 전용 (외부 서버 없음)
- AI는 전부 로컬 Ollama 기반
- 단계적 모듈 개발 (하나씩 완성 후 다음으로)
- 비전문가도 유지보수 가능한 구조 유지
