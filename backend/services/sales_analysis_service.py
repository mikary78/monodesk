# ============================================================
# services/sales_analysis_service.py — 매출 분석 비즈니스 로직
# CSV 파싱, 트렌드 분석, 메뉴 분석, 시간대 분석 등을 담당합니다.
# ============================================================

import hashlib
import io
import csv
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from models.sales_analysis import PosImport, PosSalesRaw, MenuItem, SalesTarget
from schemas.sales_analysis import (
    PosImportResult,
    SalesTrendResponse, TrendDataPoint,
    SalesSummaryResponse,
    MenuAnalysisResponse, MenuAnalysisItem,
    TimeAnalysisResponse, HourlyDataPoint, WeekdayDataPoint,
    PaymentAnalysisResponse, PaymentMethodItem,
    MenuItemCreate, MenuItemUpdate,
    SalesTargetCreate,
    AiInsightResponse,
)

# 요일 레이블 (0=월요일)
WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"]

# 결제 수단 정규화 매핑 (POS마다 표기가 다름)
PAYMENT_METHOD_MAP = {
    "신용카드": "카드",
    "체크카드": "카드",
    "카드": "카드",
    "현금": "현금",
    "네이버페이": "네이버페이",
    "카카오페이": "카카오페이",
    "제로페이": "간편결제",
    "토스": "간편결제",
    "삼성페이": "간편결제",
}


# ─────────────────────────────────────────
# CSV 파싱 및 가져오기 서비스
# ─────────────────────────────────────────

def calculate_file_hash(file_bytes: bytes) -> str:
    """
    파일 바이트로부터 SHA256 해시를 계산합니다.
    중복 파일 가져오기 방지에 사용합니다.
    """
    return hashlib.sha256(file_bytes).hexdigest()


def detect_csv_columns(headers: List[str]) -> Dict[str, str]:
    """
    CSV 헤더를 분석하여 컬럼 매핑을 자동으로 감지합니다.
    여러 POS 기종의 다양한 컬럼명을 지원합니다.
    반환: {'date': '실제컬럼명', 'time': ..., 'menu': ..., ...}
    """
    # 각 필드에 해당하는 가능한 컬럼명 목록
    column_candidates = {
        "date": ["날짜", "판매일", "거래일", "주문일", "date", "sale_date", "order_date"],
        "time": ["시간", "판매시간", "거래시간", "주문시간", "time", "sale_time"],
        "menu": ["메뉴", "상품명", "메뉴명", "품목", "item", "menu", "product", "menu_name"],
        "category": ["분류", "카테고리", "메뉴분류", "category"],
        "quantity": ["수량", "판매수량", "qty", "quantity", "count"],
        "unit_price": ["단가", "가격", "판매가", "unit_price", "price"],
        "total_price": ["금액", "판매금액", "매출금액", "합계", "total", "amount", "total_price"],
        "payment": ["결제수단", "결제방법", "결제", "payment", "pay_method"],
        "order_no": ["주문번호", "영수증번호", "거래번호", "order_no", "receipt_no"],
        "cancelled": ["취소", "취소여부", "cancelled", "cancel"],
    }

    # 헤더를 소문자로 정규화하여 비교
    headers_lower = {h.lower().strip(): h for h in headers}
    mapping = {}

    for field, candidates in column_candidates.items():
        for candidate in candidates:
            if candidate.lower() in headers_lower:
                mapping[field] = headers_lower[candidate.lower()]
                break

    return mapping


def normalize_payment_method(raw_method: Optional[str]) -> str:
    """
    결제 수단 문자열을 정규화합니다.
    POS마다 다른 표기를 통일된 명칭으로 변환합니다.
    """
    if not raw_method:
        return "기타"
    raw_stripped = raw_method.strip()
    # 직접 매핑 시도
    if raw_stripped in PAYMENT_METHOD_MAP:
        return PAYMENT_METHOD_MAP[raw_stripped]
    # 부분 매핑 시도
    for key, value in PAYMENT_METHOD_MAP.items():
        if key in raw_stripped:
            return value
    return "기타"


def parse_csv_file(
    db: Session,
    file_bytes: bytes,
    file_name: str
) -> PosImportResult:
    """
    CSV 파일을 파싱하여 pos_sales_raw 테이블에 저장합니다.
    - 파일 해시로 중복 감지
    - 헤더 자동 컬럼 매핑
    - 유효하지 않은 행 건너뜀
    """
    # 파일 해시 계산 및 중복 체크
    file_hash = calculate_file_hash(file_bytes)
    existing = db.query(PosImport).filter(PosImport.file_hash == file_hash).first()
    if existing:
        return PosImportResult(
            success=False,
            message=f"이미 가져온 파일입니다. (이전 가져오기: {existing.created_at.strftime('%Y-%m-%d %H:%M')})",
            import_id=existing.id,
            row_count=existing.row_count,
            duplicate=True,
        )

    # CSV 파싱 (UTF-8 시도 후 CP949 폴백)
    try:
        text_content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = file_bytes.decode("cp949")
        except UnicodeDecodeError:
            text_content = file_bytes.decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(text_content))
    headers = reader.fieldnames or []
    if not headers:
        return PosImportResult(
            success=False,
            message="CSV 파일에서 헤더를 찾을 수 없습니다. 파일 형식을 확인해주세요.",
            row_count=0,
        )

    # 컬럼 매핑 감지
    col_map = detect_csv_columns(list(headers))

    # 필수 컬럼 검사 (날짜, 메뉴명, 금액)
    required_fields = ["date", "menu", "total_price"]
    missing = [f for f in required_fields if f not in col_map]
    if missing:
        field_names = {"date": "날짜", "menu": "메뉴명", "total_price": "금액"}
        missing_kr = [field_names.get(f, f) for f in missing]
        return PosImportResult(
            success=False,
            message=f"필수 컬럼을 찾을 수 없습니다: {', '.join(missing_kr)}. CSV 헤더를 확인해주세요.",
            row_count=0,
        )

    # 가져오기 이력 레코드 생성 (처리 중)
    pos_import = PosImport(
        file_name=file_name,
        file_hash=file_hash,
        status="processing",
    )
    db.add(pos_import)
    db.flush()  # ID 확보

    # 행 단위 파싱 및 저장
    rows_saved = 0
    errors = []
    dates_seen = []

    for row_idx, row in enumerate(reader, start=2):
        try:
            # 날짜 파싱
            raw_date = row.get(col_map.get("date", ""), "").strip()
            if not raw_date:
                continue
            sale_date = _parse_date_str(raw_date)
            if not sale_date:
                errors.append(f"행 {row_idx}: 날짜 형식 오류 ({raw_date})")
                continue

            dates_seen.append(sale_date)

            # 시간 파싱
            raw_time = row.get(col_map.get("time", ""), "").strip() if "time" in col_map else ""
            sale_time = _parse_time_str(raw_time)
            hour = int(sale_time[:2]) if sale_time else None
            weekday = _get_weekday(sale_date)

            # 메뉴명
            menu_name = row.get(col_map.get("menu", ""), "").strip()
            if not menu_name:
                continue

            # 카테고리
            menu_category = row.get(col_map.get("category", ""), "").strip() if "category" in col_map else None

            # 수량
            raw_qty = row.get(col_map.get("quantity", ""), "1").strip() if "quantity" in col_map else "1"
            quantity = _parse_int(raw_qty, default=1)

            # 금액
            raw_total = row.get(col_map.get("total_price", ""), "0").strip()
            total_price = _parse_float(raw_total, default=0)

            # 단가
            raw_unit = row.get(col_map.get("unit_price", ""), "").strip() if "unit_price" in col_map else ""
            unit_price = _parse_float(raw_unit, default=(total_price / quantity if quantity > 0 else 0))

            # 결제 수단
            raw_payment = row.get(col_map.get("payment", ""), "").strip() if "payment" in col_map else ""
            payment_method = normalize_payment_method(raw_payment)

            # 주문 번호
            order_no = row.get(col_map.get("order_no", ""), "").strip() if "order_no" in col_map else None

            # 취소 여부
            raw_cancelled = row.get(col_map.get("cancelled", ""), "").strip() if "cancelled" in col_map else ""
            is_cancelled = raw_cancelled.lower() in ["y", "yes", "취소", "1", "true"]

            # 메뉴 마스터 자동 등록
            _upsert_menu_item(db, menu_name, menu_category, unit_price)

            # POS 원본 데이터 저장
            sale_row = PosSalesRaw(
                import_id=pos_import.id,
                sale_date=sale_date,
                sale_time=sale_time or None,
                weekday=weekday,
                hour=hour,
                menu_name=menu_name,
                menu_category=menu_category,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                payment_method=payment_method,
                order_no=order_no,
                is_cancelled=is_cancelled,
            )
            db.add(sale_row)
            rows_saved += 1

            # 배치 커밋 (500행마다)
            if rows_saved % 500 == 0:
                db.flush()

        except Exception as e:
            errors.append(f"행 {row_idx}: {str(e)}")
            continue

    # 가져오기 이력 업데이트
    date_from = min(dates_seen) if dates_seen else None
    date_to = max(dates_seen) if dates_seen else None
    pos_import.row_count = rows_saved
    pos_import.status = "success" if rows_saved > 0 else "failed"
    pos_import.date_from = date_from
    pos_import.date_to = date_to
    if errors:
        pos_import.error_message = f"총 {len(errors)}개 행 오류. 첫 오류: {errors[0]}"

    db.commit()

    if rows_saved == 0:
        return PosImportResult(
            success=False,
            message="유효한 데이터를 찾을 수 없습니다. CSV 파일 내용을 확인해주세요.",
            import_id=pos_import.id,
            row_count=0,
        )

    return PosImportResult(
        success=True,
        message=f"{rows_saved:,}개의 판매 데이터를 성공적으로 가져왔습니다.",
        import_id=pos_import.id,
        row_count=rows_saved,
        date_from=date_from,
        date_to=date_to,
    )


def get_import_history(db: Session, limit: int = 20) -> List[PosImport]:
    """가져오기 이력 목록 조회 (최신순)"""
    return db.query(PosImport).order_by(PosImport.created_at.desc()).limit(limit).all()


def delete_import(db: Session, import_id: int) -> bool:
    """
    특정 가져오기 이력 및 연결된 판매 데이터 삭제.
    잘못 가져온 데이터를 제거할 때 사용합니다.
    """
    pos_import = db.query(PosImport).filter(PosImport.id == import_id).first()
    if not pos_import:
        return False
    # 연결된 판매 데이터 소프트 삭제
    db.query(PosSalesRaw).filter(
        PosSalesRaw.import_id == import_id
    ).update({"is_deleted": 1})
    db.delete(pos_import)
    db.commit()
    return True


# ─────────────────────────────────────────
# 매출 요약 KPI 서비스
# ─────────────────────────────────────────

def get_sales_summary(db: Session, year: int, month: int) -> SalesSummaryResponse:
    """
    월별 매출 요약 KPI를 계산합니다.
    총매출, 주문건수, 평균주문금액, 전월 대비, 목표 달성률을 반환합니다.
    """
    start_date, end_date = _get_month_range(year, month)

    # 이번 달 집계 (취소 건 제외)
    result = db.query(
        func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("total_amount"),
        func.count(PosSalesRaw.id).label("total_count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).first()

    total_amount = float(result.total_amount or 0)
    total_count = int(result.total_count or 0)
    avg_order_amount = round(total_amount / total_count, 0) if total_count > 0 else 0

    # 전월 집계
    prev_year, prev_month = _get_prev_month(year, month)
    prev_start, prev_end = _get_month_range(prev_year, prev_month)
    prev_result = db.query(
        func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("total")
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= prev_start,
        PosSalesRaw.sale_date < prev_end,
    ).first()
    prev_amount = float(prev_result.total or 0)
    growth_rate = round((total_amount - prev_amount) / prev_amount * 100, 1) if prev_amount > 0 else None

    # 목표 매출 조회
    target = db.query(SalesTarget).filter(
        SalesTarget.year == year,
        SalesTarget.month == month,
    ).first()
    target_amount = target.target_amount if target else None
    achievement_rate = round(total_amount / target_amount * 100, 1) if target_amount and target_amount > 0 else None

    # 데이터 날짜 범위 조회
    date_range = db.query(
        func.min(PosSalesRaw.sale_date).label("min_date"),
        func.max(PosSalesRaw.sale_date).label("max_date"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).first()

    return SalesSummaryResponse(
        year=year,
        month=month,
        total_amount=total_amount,
        total_count=total_count,
        avg_order_amount=avg_order_amount,
        prev_month_amount=prev_amount,
        growth_rate=growth_rate,
        target_amount=target_amount,
        achievement_rate=achievement_rate,
        date_from=date_range.min_date if date_range else None,
        date_to=date_range.max_date if date_range else None,
    )


# ─────────────────────────────────────────
# 매출 트렌드 서비스
# ─────────────────────────────────────────

def get_sales_trend(
    db: Session,
    year: int,
    month: int,
    period_type: str = "daily"
) -> SalesTrendResponse:
    """
    매출 트렌드 데이터를 반환합니다.
    period_type: 'daily' (일별) | 'weekly' (주별) | 'monthly' (월별 최근 12개월)
    """
    if period_type == "daily":
        return _get_daily_trend(db, year, month)
    elif period_type == "weekly":
        return _get_weekly_trend(db, year, month)
    else:
        return _get_monthly_trend(db, year)


def _get_daily_trend(db: Session, year: int, month: int) -> SalesTrendResponse:
    """일별 매출 트렌드 계산"""
    start_date, end_date = _get_month_range(year, month)

    rows = db.query(
        PosSalesRaw.sale_date.label("date"),
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).group_by(PosSalesRaw.sale_date).order_by(PosSalesRaw.sale_date).all()

    data = []
    total = 0
    for row in rows:
        amount = float(row.amount or 0)
        count = int(row.count or 0)
        total += amount
        # YYYY-MM-DD → MM/DD 형태로 레이블 변환
        label = row.date[5:].replace("-", "/") if row.date else row.date
        data.append(TrendDataPoint(
            label=label,
            amount=amount,
            count=count,
            avg_amount=round(amount / count, 0) if count > 0 else 0,
        ))

    avg_daily = round(total / len(data), 0) if data else 0
    return SalesTrendResponse(
        period_type="daily",
        data=data,
        total_amount=total,
        total_count=sum(d.count for d in data),
        avg_daily_amount=avg_daily,
    )


def _get_weekly_trend(db: Session, year: int, month: int) -> SalesTrendResponse:
    """주별 매출 트렌드 계산 (해당 월의 주 단위 집계)"""
    start_date, end_date = _get_month_range(year, month)

    rows = db.query(
        PosSalesRaw.sale_date.label("date"),
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).group_by(PosSalesRaw.sale_date).order_by(PosSalesRaw.sale_date).all()

    # 날짜별 데이터를 주 단위로 묶기
    weekly: Dict[int, Dict] = {}
    for row in rows:
        d = datetime.strptime(row.date, "%Y-%m-%d")
        week_no = d.isocalendar()[1]
        if week_no not in weekly:
            weekly[week_no] = {"amount": 0, "count": 0, "dates": []}
        weekly[week_no]["amount"] += float(row.amount or 0)
        weekly[week_no]["count"] += int(row.count or 0)
        weekly[week_no]["dates"].append(row.date)

    data = []
    for i, (week_no, wdata) in enumerate(sorted(weekly.items()), start=1):
        dates = sorted(wdata["dates"])
        label = f"{i}주 ({dates[0][5:].replace('-', '/')}~)"
        data.append(TrendDataPoint(
            label=label,
            amount=wdata["amount"],
            count=wdata["count"],
            avg_amount=round(wdata["amount"] / wdata["count"], 0) if wdata["count"] > 0 else 0,
        ))

    total = sum(d.amount for d in data)
    return SalesTrendResponse(
        period_type="weekly",
        data=data,
        total_amount=total,
        total_count=sum(d.count for d in data),
        avg_daily_amount=round(total / len(data), 0) if data else 0,
    )


def _get_monthly_trend(db: Session, year: int) -> SalesTrendResponse:
    """월별 매출 트렌드 (해당 연도의 전체 월 집계)"""
    rows = db.query(
        func.substr(PosSalesRaw.sale_date, 1, 7).label("month"),
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        func.substr(PosSalesRaw.sale_date, 1, 4) == str(year),
    ).group_by(func.substr(PosSalesRaw.sale_date, 1, 7)).order_by(
        func.substr(PosSalesRaw.sale_date, 1, 7)
    ).all()

    data = []
    for row in rows:
        amount = float(row.amount or 0)
        count = int(row.count or 0)
        label = f"{row.month[5:]}월"
        data.append(TrendDataPoint(
            label=label,
            amount=amount,
            count=count,
            avg_amount=round(amount / count, 0) if count > 0 else 0,
        ))

    total = sum(d.amount for d in data)
    return SalesTrendResponse(
        period_type="monthly",
        data=data,
        total_amount=total,
        total_count=sum(d.count for d in data),
        avg_daily_amount=round(total / len(data), 0) if data else 0,
    )


# ─────────────────────────────────────────
# 메뉴 분석 서비스
# ─────────────────────────────────────────

def get_menu_analysis(
    db: Session,
    year: int,
    month: int,
    category: Optional[str] = None,
) -> MenuAnalysisResponse:
    """
    메뉴별 판매 분석을 반환합니다.
    - 전체 메뉴 중 TOP 10 / BOTTOM 10
    - 카테고리별 집계
    - 매출 기여도 (%) 계산
    """
    start_date, end_date = _get_month_range(year, month)

    query = db.query(
        PosSalesRaw.menu_name,
        PosSalesRaw.menu_category,
        func.sum(PosSalesRaw.quantity).label("total_qty"),
        func.sum(PosSalesRaw.total_price).label("total_amount"),
        func.avg(PosSalesRaw.unit_price).label("avg_unit_price"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    )

    if category:
        query = query.filter(PosSalesRaw.menu_category == category)

    rows = query.group_by(
        PosSalesRaw.menu_name, PosSalesRaw.menu_category
    ).order_by(func.sum(PosSalesRaw.total_price).desc()).all()

    # 전체 매출 합계 (기여도 계산용)
    total_amount = sum(float(r.total_amount or 0) for r in rows)

    # 메뉴 분석 아이템 생성 (순위 포함)
    all_items = []
    for rank, row in enumerate(rows, start=1):
        amount = float(row.total_amount or 0)
        all_items.append(MenuAnalysisItem(
            menu_name=row.menu_name,
            menu_category=row.menu_category or "미분류",
            total_quantity=int(row.total_qty or 0),
            total_amount=amount,
            contribution_rate=round(amount / total_amount * 100, 1) if total_amount > 0 else 0,
            avg_unit_price=round(float(row.avg_unit_price or 0), 0),
            rank=rank,
        ))

    # 카테고리별 집계
    cat_rows = db.query(
        func.coalesce(PosSalesRaw.menu_category, "미분류").label("category"),
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).group_by(func.coalesce(PosSalesRaw.menu_category, "미분류")).all()

    category_summary = [
        {
            "category": r.category,
            "amount": float(r.amount or 0),
            "count": int(r.count or 0),
            "rate": round(float(r.amount or 0) / total_amount * 100, 1) if total_amount > 0 else 0,
        }
        for r in sorted(cat_rows, key=lambda x: float(x.amount or 0), reverse=True)
    ]

    return MenuAnalysisResponse(
        year=year,
        month=month,
        total_menu_count=len(all_items),
        total_amount=total_amount,
        top_menus=all_items[:10],
        bottom_menus=list(reversed(all_items[-10:])) if len(all_items) >= 10 else list(reversed(all_items)),
        category_summary=category_summary,
    )


# ─────────────────────────────────────────
# 시간대/요일 분석 서비스
# ─────────────────────────────────────────

def get_time_analysis(db: Session, year: int, month: int) -> TimeAnalysisResponse:
    """
    시간대별, 요일별 매출 패턴을 분석합니다.
    피크 시간대와 요일을 자동으로 감지합니다.
    """
    start_date, end_date = _get_month_range(year, month)

    base_filter = and_(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    )

    # 시간대별 집계
    hourly_rows = db.query(
        PosSalesRaw.hour,
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        base_filter,
        PosSalesRaw.hour.isnot(None),
    ).group_by(PosSalesRaw.hour).order_by(PosSalesRaw.hour).all()

    # 0~23시 전체 버킷 채우기
    hourly_dict = {row.hour: row for row in hourly_rows}
    hourly_data = []
    for h in range(24):
        row = hourly_dict.get(h)
        amount = float(row.amount or 0) if row else 0
        count = int(row.count or 0) if row else 0
        hourly_data.append(HourlyDataPoint(
            hour=h,
            label=f"{h:02d}시",
            amount=amount,
            count=count,
        ))

    # 요일별 집계
    weekday_rows = db.query(
        PosSalesRaw.weekday,
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        base_filter,
        PosSalesRaw.weekday.isnot(None),
    ).group_by(PosSalesRaw.weekday).order_by(PosSalesRaw.weekday).all()

    weekday_dict = {row.weekday: row for row in weekday_rows}
    weekday_data = []
    for wd in range(7):
        row = weekday_dict.get(wd)
        amount = float(row.amount or 0) if row else 0
        count = int(row.count or 0) if row else 0
        weekday_data.append(WeekdayDataPoint(
            weekday=wd,
            label=WEEKDAY_LABELS[wd],
            amount=amount,
            count=count,
            avg_amount=round(amount / count, 0) if count > 0 else 0,
        ))

    # 피크/한산 시간대 계산
    peak_hour = max(hourly_data, key=lambda x: x.amount).hour if hourly_data else None
    quiet_hours = [h for h in hourly_data if h.amount > 0]
    quiet_hour = min(quiet_hours, key=lambda x: x.amount).hour if quiet_hours else None
    peak_weekday = max(weekday_data, key=lambda x: x.amount).weekday if weekday_data else None

    return TimeAnalysisResponse(
        year=year,
        month=month,
        hourly_data=hourly_data,
        weekday_data=weekday_data,
        peak_hour=peak_hour,
        peak_weekday=peak_weekday,
        quiet_hour=quiet_hour,
    )


# ─────────────────────────────────────────
# 결제 수단 분석 서비스
# ─────────────────────────────────────────

def get_payment_analysis(db: Session, year: int, month: int) -> PaymentAnalysisResponse:
    """
    결제 수단별 매출 분석을 반환합니다.
    비중(%) 및 최근 6개월 추이를 포함합니다.
    """
    start_date, end_date = _get_month_range(year, month)

    # 이번 달 결제 수단별 집계
    rows = db.query(
        PosSalesRaw.payment_method,
        func.sum(PosSalesRaw.total_price).label("amount"),
        func.count(PosSalesRaw.id).label("count"),
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date,
    ).group_by(PosSalesRaw.payment_method).order_by(
        func.sum(PosSalesRaw.total_price).desc()
    ).all()

    total_amount = sum(float(r.amount or 0) for r in rows)
    items = [
        PaymentMethodItem(
            method=r.payment_method or "기타",
            amount=float(r.amount or 0),
            count=int(r.count or 0),
            rate=round(float(r.amount or 0) / total_amount * 100, 1) if total_amount > 0 else 0,
        )
        for r in rows
    ]

    # 최근 6개월 추이
    monthly_trend = _get_payment_monthly_trend(db, year, month, months=6)

    return PaymentAnalysisResponse(
        year=year,
        month=month,
        total_amount=total_amount,
        items=items,
        monthly_trend=monthly_trend,
    )


def _get_payment_monthly_trend(
    db: Session, year: int, month: int, months: int = 6
) -> List[dict]:
    """결제 수단별 최근 N개월 추이 계산"""
    trend = []
    for i in range(months - 1, -1, -1):
        # i개월 전 계산
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        start, end = _get_month_range(y, m)

        rows = db.query(
            PosSalesRaw.payment_method,
            func.sum(PosSalesRaw.total_price).label("amount"),
        ).filter(
            PosSalesRaw.is_deleted == 0,
            PosSalesRaw.is_cancelled == False,
            PosSalesRaw.sale_date >= start,
            PosSalesRaw.sale_date < end,
        ).group_by(PosSalesRaw.payment_method).all()

        month_data: Dict[str, float] = {}
        for r in rows:
            month_data[r.payment_method or "기타"] = float(r.amount or 0)
        month_data["label"] = f"{m}월"
        trend.append(month_data)

    return trend


# ─────────────────────────────────────────
# 메뉴 마스터 서비스
# ─────────────────────────────────────────

def get_menu_items(db: Session, active_only: bool = True) -> List[MenuItem]:
    """메뉴 마스터 목록 조회"""
    query = db.query(MenuItem).filter(MenuItem.is_deleted == 0)
    if active_only:
        query = query.filter(MenuItem.is_active == True)
    return query.order_by(MenuItem.name).all()


def update_menu_item(
    db: Session, menu_id: int, data: MenuItemUpdate
) -> Optional[MenuItem]:
    """메뉴 마스터 정보 수정 (원가, 카테고리 등)"""
    item = db.query(MenuItem).filter(
        MenuItem.id == menu_id,
        MenuItem.is_deleted == 0,
    ).first()
    if not item:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


# ─────────────────────────────────────────
# 목표 매출 서비스
# ─────────────────────────────────────────

def upsert_sales_target(db: Session, data: SalesTargetCreate) -> SalesTarget:
    """
    목표 매출 등록 또는 수정.
    해당 연월에 목표가 없으면 생성, 있으면 수정합니다.
    """
    existing = db.query(SalesTarget).filter(
        SalesTarget.year == data.year,
        SalesTarget.month == data.month,
    ).first()

    if existing:
        existing.target_amount = data.target_amount
        existing.memo = data.memo
        db.commit()
        db.refresh(existing)
        return existing

    target = SalesTarget(**data.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def get_sales_target(db: Session, year: int, month: int) -> Optional[SalesTarget]:
    """특정 월의 목표 매출 조회"""
    return db.query(SalesTarget).filter(
        SalesTarget.year == year,
        SalesTarget.month == month,
    ).first()


# ─────────────────────────────────────────
# AI 인사이트 서비스
# ─────────────────────────────────────────

def generate_ai_insight(db: Session, year: int, month: int) -> AiInsightResponse:
    """
    Ollama를 사용하여 매출 데이터 기반 경영 인사이트를 생성합니다.
    Ollama가 실행 중이 아닌 경우 기본 텍스트 분석으로 대체합니다.
    """
    from datetime import datetime as dt

    # 분석 데이터 수집
    summary = get_sales_summary(db, year, month)
    menu_data = get_menu_analysis(db, year, month)
    time_data = get_time_analysis(db, year, month)

    # 기본 분석 텍스트 생성 (Ollama 없이도 동작)
    anomalies = []
    recommendations = []

    # 전월 대비 이상 감지
    if summary.growth_rate is not None:
        if summary.growth_rate < -20:
            anomalies.append(f"전월 대비 매출이 {abs(summary.growth_rate):.1f}% 급감했습니다.")
        elif summary.growth_rate > 50:
            anomalies.append(f"전월 대비 매출이 {summary.growth_rate:.1f}% 급증했습니다.")

    # 목표 달성률 확인
    if summary.achievement_rate is not None and summary.achievement_rate < 80:
        anomalies.append(f"목표 달성률이 {summary.achievement_rate:.1f}%로 낮습니다.")

    # 피크 타임 기반 추천
    if time_data.peak_hour is not None:
        recommendations.append(
            f"피크 시간({time_data.peak_hour:02d}시)에 충분한 인력을 배치하세요."
        )
    if time_data.quiet_hour is not None:
        recommendations.append(
            f"한산한 {time_data.quiet_hour:02d}시대에 프로모션을 고려해보세요."
        )
    if time_data.peak_weekday is not None:
        recommendations.append(
            f"{WEEKDAY_LABELS[time_data.peak_weekday]}요일이 가장 바쁜 날입니다. 사전 준비를 강화하세요."
        )

    # 인기 메뉴 추천
    if menu_data.top_menus:
        top_menu = menu_data.top_menus[0]
        recommendations.append(
            f"'{top_menu.menu_name}'이(가) 전체 매출의 {top_menu.contribution_rate:.1f}%를 차지하는 인기 메뉴입니다."
        )

    # Ollama 호출 시도
    insight_text = _call_ollama_insight(summary, menu_data, time_data, year, month)

    return AiInsightResponse(
        success=True,
        insight=insight_text,
        anomalies=anomalies,
        recommendations=recommendations,
        generated_at=dt.now().strftime("%Y-%m-%d %H:%M:%S"),
    )


def _call_ollama_insight(summary, menu_data, time_data, year: int, month: int) -> str:
    """
    Ollama API를 호출하여 자연어 경영 인사이트를 생성합니다.
    Ollama가 실행 중이 아니면 기본 분석 텍스트를 반환합니다.
    """
    try:
        import urllib.request
        import json

        # 분석 데이터를 프롬프트에 포함
        top_menus_str = ", ".join([f"{m.menu_name}({m.total_quantity}개)" for m in menu_data.top_menus[:5]])
        peak_hour_str = f"{time_data.peak_hour:02d}시" if time_data.peak_hour is not None else "데이터 없음"
        peak_day_str = WEEKDAY_LABELS[time_data.peak_weekday] + "요일" if time_data.peak_weekday is not None else "데이터 없음"

        prompt = f"""당신은 외식업 전문 경영 컨설턴트입니다.
다음은 서울 용산구 제철해산물 전문 주점 '여남동'의 {year}년 {month}월 매출 데이터입니다.

[매출 현황]
- 총 매출: {summary.total_amount:,.0f}원
- 주문 건수: {summary.total_count:,}건
- 평균 주문 금액: {summary.avg_order_amount:,.0f}원
- 전월 대비: {f'{summary.growth_rate:+.1f}%' if summary.growth_rate is not None else '비교 불가'}

[메뉴 현황]
- 인기 TOP 5: {top_menus_str if top_menus_str else '데이터 없음'}

[운영 패턴]
- 피크 시간대: {peak_hour_str}
- 가장 바쁜 요일: {peak_day_str}

위 데이터를 바탕으로 한국어로 3~5문장의 경영 인사이트를 작성해주세요.
매출 특징, 개선점, 제철 해산물 특성을 고려한 실용적인 조언을 포함해주세요."""

        data = json.dumps({
            "model": "llama3.2",
            "prompt": prompt,
            "stream": False,
        }).encode("utf-8")

        req = urllib.request.Request(
            "http://localhost:11434/api/generate",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result.get("response", "").strip()

    except Exception:
        # Ollama 미실행 시 기본 분석 텍스트 반환
        growth_str = ""
        if summary.growth_rate is not None:
            trend = "증가" if summary.growth_rate >= 0 else "감소"
            growth_str = f" 전월 대비 {abs(summary.growth_rate):.1f}% {trend}했습니다."

        achieve_str = ""
        if summary.achievement_rate is not None:
            achieve_str = f" 목표 달성률은 {summary.achievement_rate:.1f}%입니다."

        peak_str = ""
        if time_data.peak_hour is not None:
            peak_str = f" 피크 시간대는 {time_data.peak_hour:02d}시입니다."

        return (
            f"{year}년 {month}월 총 매출은 {summary.total_amount:,.0f}원이며, "
            f"총 {summary.total_count:,}건의 주문이 있었습니다.{growth_str}{achieve_str}{peak_str} "
            f"더 자세한 AI 인사이트를 원하시면 Ollama 서비스를 실행 후 다시 시도해주세요."
        )


# ─────────────────────────────────────────
# 내부 헬퍼 함수
# ─────────────────────────────────────────

def _get_month_range(year: int, month: int):
    """월의 시작일과 종료일(다음 달 1일) 문자열 반환"""
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    return start_date, end_date


def _get_prev_month(year: int, month: int):
    """전월의 연도와 월 반환"""
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _parse_date_str(raw: str) -> Optional[str]:
    """다양한 날짜 형식을 YYYY-MM-DD로 변환합니다."""
    raw = raw.strip()
    # 지원 형식 목록
    formats = [
        "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
        "%Y%m%d", "%m/%d/%Y", "%d/%m/%Y",
    ]
    for fmt in formats:
        try:
            d = datetime.strptime(raw, fmt)
            return d.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_time_str(raw: str) -> Optional[str]:
    """시간 문자열을 HH:MM 형식으로 변환합니다."""
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ["%H:%M:%S", "%H:%M", "%H시%M분"]:
        try:
            t = datetime.strptime(raw, fmt)
            return t.strftime("%H:%M")
        except ValueError:
            continue
    # 숫자만 있는 경우 (예: "1430" → "14:30")
    if raw.isdigit() and len(raw) >= 4:
        return f"{raw[:2]}:{raw[2:4]}"
    return None


def _get_weekday(date_str: str) -> Optional[int]:
    """YYYY-MM-DD 문자열에서 요일(0=월, 6=일)을 반환합니다."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.weekday()
    except ValueError:
        return None


def _parse_float(raw: str, default: float = 0) -> float:
    """문자열을 float으로 변환합니다. 콤마 제거 처리 포함."""
    try:
        return float(raw.replace(",", "").replace("원", "").strip())
    except (ValueError, AttributeError):
        return default


def _parse_int(raw: str, default: int = 0) -> int:
    """문자열을 int로 변환합니다."""
    try:
        return int(float(raw.replace(",", "").strip()))
    except (ValueError, AttributeError):
        return default


def _upsert_menu_item(
    db: Session,
    name: str,
    category: Optional[str],
    price: float,
) -> None:
    """
    메뉴 마스터에 없는 메뉴를 자동으로 등록합니다.
    이미 있는 경우 건너뜁니다.
    """
    existing = db.query(MenuItem).filter(MenuItem.name == name).first()
    if not existing:
        db.add(MenuItem(
            name=name,
            category=category or "기타",
            price=price,
        ))
