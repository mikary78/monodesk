# ============================================================
# utils/file_upload.py — 이미지 파일 업로드 처리 유틸리티
# 영수증/거래명세서 이미지 저장을 담당합니다.
# 저장 경로: (프로젝트루트)/uploads/receipts/YYYY-MM-DD/
# ============================================================

import os
import uuid
from datetime import datetime

# 프로젝트 루트 경로 (backend의 부모 디렉터리)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

# 영수증 업로드 기본 경로
RECEIPTS_BASE_DIR = os.path.join(PROJECT_ROOT, "uploads", "receipts")

# 허용 이미지 확장자
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}

# 최대 파일 크기 (20MB)
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024


def save_receipt_image(image_bytes: bytes, original_filename: str) -> str:
    """
    영수증 이미지를 날짜별 폴더에 저장합니다.
    파일명은 UUID로 생성하여 중복을 방지합니다.

    Args:
        image_bytes: 이미지 파일 바이트
        original_filename: 원본 파일명 (확장자 추출용)

    Returns:
        저장된 파일의 상대 경로 (uploads/receipts/YYYY-MM-DD/파일명)

    Raises:
        ValueError: 허용되지 않는 파일 형식 또는 크기 초과
        OSError: 파일 저장 실패
    """
    # 파일 크기 검증
    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB까지 허용됩니다.")

    # 확장자 추출 및 검증
    _, ext = os.path.splitext(original_filename.lower())
    if not ext:
        ext = ".jpg"  # 확장자 없으면 JPEG로 기본 처리
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"허용되지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})")

    # 날짜별 폴더 생성 (예: uploads/receipts/2026-03-12/)
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    date_dir = os.path.join(RECEIPTS_BASE_DIR, today_str)
    os.makedirs(date_dir, exist_ok=True)

    # UUID 기반 고유 파일명 생성
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(date_dir, unique_filename)

    # 파일 저장
    with open(full_path, "wb") as f:
        f.write(image_bytes)

    # 상대 경로 반환 (PROJECT_ROOT 기준)
    relative_path = os.path.relpath(full_path, PROJECT_ROOT)
    # Windows 경로 구분자를 슬래시로 통일
    relative_path = relative_path.replace("\\", "/")

    return relative_path


def validate_image_file(content_type: str, file_size: int) -> None:
    """
    업로드 파일의 Content-Type과 크기를 사전 검증합니다.

    Args:
        content_type: HTTP Content-Type 헤더 값
        file_size: 파일 크기 (바이트)

    Raises:
        ValueError: 검증 실패
    """
    # Content-Type 검증
    allowed_types = {
        "image/jpeg", "image/jpg", "image/png",
        "image/bmp", "image/tiff", "image/webp"
    }
    if content_type and content_type not in allowed_types:
        raise ValueError(f"허용되지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.")

    # 파일 크기 검증
    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"파일 크기가 {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB를 초과합니다.")
