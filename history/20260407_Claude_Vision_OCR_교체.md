# Tesseract OCR → Claude Vision API 교체 + 모바일 카메라 지원

## 작업 일자
2026-04-07

## 작업 목표
기존 Tesseract + OpenCV 기반 OCR 파이프라인을 Claude Vision API로 교체하고,
프론트엔드에 모바일 카메라 촬영 지원 UI를 추가한다.

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `backend/requirements.txt` | anthropic>=0.40.0 추가 / pytesseract·Pillow·opencv-python 주석 처리 |
| `backend/services/ocr_service.py` | 완전 재작성 — Claude Vision API 기반 |
| `backend/routers/ocr.py` | scan_receipt 엔드포인트 수정 (confirm-receipt 유지) |
| `frontend/src/components/common/ReceiptScanner.jsx` | 카메라 버튼 추가, 업로드 UI 개선, 스캔 메시지 업데이트 |

---

## 기술 변경 사항

### 이전 흐름 (Tesseract)
```
이미지 바이트 → OpenCV 전처리(그레이스케일/이진화) → Tesseract OCR → 정규식 파싱 → 반환
```

### 새 흐름 (Claude Vision API)
```
이미지 파일 → base64 인코딩 → Claude Vision API 호출 → JSON 파싱 → 반환
```

---

## 주요 구현 내용

### ocr_service.py 핵심 함수: `extract_receipt_data(image_path)`
- `anthropic.Anthropic()` 클라이언트 싱글턴 사용
- 모델: `claude-sonnet-4-20250514`
- 이미지를 base64로 인코딩 후 Vision API 호출
- 응답은 JSON 전용 프롬프트로 직접 파싱 (정규식 불필요)
- 오류 유형별 분기: `APIConnectionError`, `AuthenticationError`, `RateLimitError`

### 라우터 변경: `routers/ocr.py`
- `ocr_service._ocr_executor` 참조 제거 → `None` (기본 asyncio 스레드 풀) 사용
- `extract_text` + `parse_receipt` 2단계 호출 → `extract_receipt_data` 단일 호출로 통합
- Claude 응답 필드(receipt_date, vendor_name 등) → 기존 스키마 필드(date, vendor 등) 매핑
- `confirm-receipt` 엔드포인트는 변경 없음

### 프론트엔드 변경: `ReceiptScanner.jsx`
- `Camera` 아이콘 추가 (lucide-react)
- `cameraInputRef` / `fileInputRef` 2개 ref로 분리
- 업로드 영역: 드래그&드롭 + 카메라 촬영 버튼 + 이미지 선택 버튼 3가지 방식 지원
- `capture="environment"` 속성으로 모바일 후면 카메라 직접 실행
- 스캔 중 메시지: "Claude AI가 영수증을 분석하고 있습니다..." 로 업데이트

---

## 환경 요구사항
- `backend/.env` 에 `ANTHROPIC_API_KEY` 설정 필요
- `pip install anthropic>=0.40.0` 설치 필요

---

## 빌드 결과
```
vite build → ✓ built in 5.05s (에러 없음)
```
