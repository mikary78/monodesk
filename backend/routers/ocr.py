# ============================================================
# routers/ocr.py — 영수증 OCR API 라우터
# POST /api/ocr/scan-receipt  — 이미지 업로드 후 OCR 파싱 결과 반환
# POST /api/ocr/confirm-receipt — 검토 완료 후 지출+재고 동시 저장
# ============================================================

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from schemas.ocr import OcrScanResponse, OcrItemResult, OcrConfirmRequest, OcrConfirmResponse
from models.accounting import ExpenseRecord, ExpenseCategory
from models.inventory import InventoryItem, InventoryAdjustment, PurchaseOrder, PurchaseOrderItem

import services.ocr_service as ocr_service
from utils.file_upload import save_receipt_image, validate_image_file

logger = logging.getLogger(__name__)

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 발주 번호 생성 유틸
# ─────────────────────────────────────────

def _generate_order_number(db: Session) -> str:
    """
    OCR 입고용 발주 번호를 생성합니다.
    형식: OCR-YYYYMMDD-NNN (당일 순번)
    """
    today_prefix = f"OCR-{datetime.utcnow().strftime('%Y%m%d')}"
    # 오늘 생성된 OCR 발주 수 조회
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.order_number.like(f"{today_prefix}-%")
    ).count()
    return f"{today_prefix}-{count + 1:03d}"


# ─────────────────────────────────────────
# 영수증 스캔 API
# ─────────────────────────────────────────

@router.post("/scan-receipt", response_model=OcrScanResponse)
async def scan_receipt(
    file: UploadFile = File(..., description="영수증/거래명세서 이미지 파일"),
    db: Session = Depends(get_db),
):
    """
    영수증 또는 거래명세서 이미지를 업로드하여 Claude Vision API로 OCR 처리합니다.

    처리 순서:
    1. 이미지 파일 저장 (uploads/receipts/)
    2. Claude Vision API 호출 (base64 인코딩 이미지 전달)
    3. JSON 응답 파싱 (날짜, 거래처, 품목, 합계 등)
    4. 기존 재고 품목과 퍼지 매칭

    ※ 이 단계에서는 DB 저장을 하지 않습니다. 사용자 검토용 데이터만 반환합니다.
    ※ 2026-04-07: Tesseract OCR → Claude Vision API로 교체
    """
    # 이미지 바이트 읽기
    image_bytes = await file.read()

    # 파일 크기 / Content-Type 사전 검증
    try:
        validate_image_file(
            content_type=file.content_type,
            file_size=len(image_bytes)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 이미지 저장 (Claude API 호출에 파일 경로 사용, 미리보기용 경로 확보)
    try:
        image_path = save_receipt_image(
            image_bytes=image_bytes,
            original_filename=file.filename or "receipt.jpg"
        )
    except (ValueError, OSError) as e:
        logger.error(f"이미지 저장 실패: {e}")
        raise HTTPException(status_code=400, detail=f"이미지 저장 중 오류가 발생했습니다: {str(e)}")

    # Claude Vision API로 영수증 데이터 추출
    # extract_receipt_data는 blocking I/O이므로 스레드 풀에서 실행 (이벤트 루프 블록 방지)
    # None을 전달하면 asyncio 기본 스레드 풀을 사용 (전용 풀 불필요)
    loop = asyncio.get_event_loop()
    ocr_result = await loop.run_in_executor(
        None,  # 기본 스레드 풀 사용
        ocr_service.extract_receipt_data,
        image_path,  # 저장된 파일 경로 전달 (바이트 아님)
    )

    # OCR 오류 처리: "error" 키가 있으면 실패 응답 반환
    # 이미지는 저장되어 있어 사용자가 수동 입력으로 이어갈 수 있습니다.
    if "error" in ocr_result:
        logger.error(f"OCR 처리 실패: {ocr_result.get('error')}")
        return OcrScanResponse(
            success=False,
            image_path=image_path,
            date=None,
            vendor=None,
            total_amount=0.0,
            items=[],
            raw_text=None,
            error_message=ocr_result.get("error", "OCR 처리에 실패했습니다.")
        )

    # Claude 응답 필드 → 기존 스키마 필드명으로 매핑
    # (기존 Tesseract 기반 parse_receipt 반환 구조와 동일하게 맞춤)
    parsed = {
        "date": ocr_result.get("receipt_date"),
        "vendor": ocr_result.get("vendor_name"),
        "total_amount": float(ocr_result.get("total_amount") or 0),
        "vat": float(ocr_result.get("vat_amount") or 0),
        "payment_method": ocr_result.get("payment_method", "카드"),
        "items": ocr_result.get("items", []),
        "memo": ocr_result.get("memo"),
    }

    # 재고 품목 매칭 (퍼지 매칭으로 기존 재고와 연결)
    try:
        matched_items = ocr_service.match_inventory_items(db, parsed.get("items", []))
    except Exception as e:
        logger.warning(f"재고 매칭 실패 (무시): {e}")
        matched_items = parsed.get("items", [])

    # 품목 스키마 변환 (OcrItemResult 모델로 직렬화)
    item_results = []
    for item in matched_items:
        item_results.append(OcrItemResult(
            name=item.get("name", ""),
            quantity=item.get("quantity", 1.0),
            unit=item.get("unit", "개"),
            unit_price=item.get("unit_price", 0.0),
            amount=item.get("amount", 0.0),
            matched_inventory_id=item.get("matched_inventory_id"),
            matched_inventory_name=item.get("matched_inventory_name"),
            match_score=item.get("match_score"),
            apply_to_inventory=item.get("apply_to_inventory", False),
        ))

    return OcrScanResponse(
        success=True,
        image_path=image_path,
        date=parsed.get("date"),
        vendor=parsed.get("vendor"),
        total_amount=parsed.get("total_amount", 0.0),
        items=item_results,
        raw_text=None,  # Claude Vision API는 raw 텍스트를 별도로 반환하지 않음
        error_message=None,
    )


# ─────────────────────────────────────────
# 영수증 확정 저장 API
# ─────────────────────────────────────────

@router.post("/confirm-receipt", response_model=OcrConfirmResponse)
def confirm_receipt(
    data: OcrConfirmRequest,
    db: Session = Depends(get_db),
):
    """
    사용자가 검토/수정한 영수증 데이터를 두 곳에 동시 저장합니다.

    저장 대상:
    a) expense_records — 지출 기록 (날짜, 거래처, 합계금액, 분류=식재료비)
    b) purchase_orders + purchase_order_items — 발주/입고 레코드
       inventory_adjustments — 재고 수량 자동 증가

    ※ 재고 반영을 선택한 품목만 발주서에 포함됩니다.
    ※ 재고 반영 품목이 하나도 없으면 발주서는 생성하지 않습니다.
    """
    # ── 1. 지출 분류 확인 ──────────────────────────────────────
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == data.expense_category_id,
        ExpenseCategory.is_deleted == 0
    ).first()
    if not category:
        raise HTTPException(
            status_code=404,
            detail=f"지출 분류 ID {data.expense_category_id}를 찾을 수 없습니다."
        )

    # ── 2. 지출 기록 생성 ──────────────────────────────────────
    # 공급가액 = 총액 - 부가세
    supply_amount = data.total_amount - data.vat

    expense = ExpenseRecord(
        expense_date=data.date,
        category_id=data.expense_category_id,
        vendor=data.vendor,
        description=f"{'거래명세서' if data.items else '영수증'} 매입 — {data.vendor or '거래처 미상'}",
        amount=supply_amount,
        vat=data.vat,
        payment_method=data.payment_method,
        memo=data.memo,
        receipt_image_path=data.image_path,
        tax_invoice=False,
    )
    db.add(expense)
    db.flush()  # expense.id 할당을 위한 flush

    # ── 3. 재고 반영 품목 필터링 ──────────────────────────────
    inventory_items_to_process = [
        item for item in data.items
        if item.apply_to_inventory and item.matched_inventory_id is not None
    ]

    purchase_order = None
    inventory_updated_count = 0

    if inventory_items_to_process:
        # ── 4. 발주서 생성 (입고 기록) ────────────────────────
        order_number = _generate_order_number(db)
        purchase_order = PurchaseOrder(
            order_number=order_number,
            supplier=data.vendor or "거래처 미상",
            order_date=data.date,
            expected_date=data.date,
            received_date=data.date,  # 즉시 입고 처리
            status="입고완료",
            total_amount=sum(item.amount for item in inventory_items_to_process),
            memo=f"OCR 영수증 자동 입고 | 지출 기록 ID: {expense.id}",
        )
        db.add(purchase_order)
        db.flush()  # purchase_order.id 할당을 위한 flush

        # ── 5. 발주 품목 및 재고 조정 처리 ────────────────────
        for item in inventory_items_to_process:
            # 재고 품목 조회
            inv_item = db.query(InventoryItem).filter(
                InventoryItem.id == item.matched_inventory_id,
                InventoryItem.is_deleted == 0
            ).first()

            if not inv_item:
                logger.warning(f"재고 품목 ID {item.matched_inventory_id}를 찾을 수 없어 건너뜁니다.")
                continue

            # 발주 품목 레코드 생성
            order_item = PurchaseOrderItem(
                order_id=purchase_order.id,
                item_id=inv_item.id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                received_quantity=item.quantity,  # 즉시 입고
                memo=f"OCR 인식: {item.name}",
            )
            db.add(order_item)

            # 재고 수량 조정 (입고 처리)
            qty_before = inv_item.current_quantity
            qty_after = qty_before + item.quantity

            adjustment = InventoryAdjustment(
                item_id=inv_item.id,
                adjustment_type="입고",
                quantity_change=item.quantity,
                quantity_before=qty_before,
                quantity_after=qty_after,
                adjustment_date=data.date,
                purchase_order_id=purchase_order.id,
                unit_price=item.unit_price,
                memo=f"OCR 영수증 자동 입고 | 발주서: {order_number}",
            )
            db.add(adjustment)

            # 재고 수량 업데이트
            inv_item.current_quantity = qty_after
            # 단가도 최신 매입가로 업데이트
            if item.unit_price > 0:
                inv_item.unit_price = item.unit_price

            inventory_updated_count += 1

    # ── 6. 전체 트랜잭션 커밋 ──────────────────────────────────
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"확정 저장 트랜잭션 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"저장 중 오류가 발생했습니다: {str(e)}"
        )

    # ── 7. 응답 구성 ──────────────────────────────────────────
    message_parts = [f"지출 기록이 등록되었습니다. (지출 ID: {expense.id})"]
    if purchase_order:
        message_parts.append(f"발주/입고 기록이 생성되었습니다. (발주번호: {purchase_order.order_number})")
    if inventory_updated_count > 0:
        message_parts.append(f"재고 {inventory_updated_count}개 품목이 업데이트되었습니다.")

    return OcrConfirmResponse(
        success=True,
        expense_id=expense.id,
        purchase_order_id=purchase_order.id if purchase_order else None,
        inventory_updated_count=inventory_updated_count,
        message=" | ".join(message_parts),
    )
