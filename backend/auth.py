# ============================================================
# auth.py — JWT 인증 헬퍼 모듈
# 비밀번호 해시, 토큰 생성/검증, 권한 확인 유틸리티
# ============================================================

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models.auth import User

# ─────────────────────────────────────────
# 설정 상수
# ─────────────────────────────────────────

# JWT 서명 키 — 실제 운영 시 환경변수로 교체 권장
SECRET_KEY = "monodesk-secret-key-change-in-production"
ALGORITHM = "HS256"
# 토큰 만료 시간: 8시간 (1 영업일 기준)
ACCESS_TOKEN_EXPIRE_HOURS = 8

# ─────────────────────────────────────────
# 역할별 권한 정의
# ─────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [
        "dashboard",
        "accounting",
        "accounting_dividend",   # 지분 정산 탭 (admin 전용)
        "sales",
        "inventory",
        "menu",
        "employee",
        "employee_attendance",
        "corporate",
        "operations",
        "document",
    ],
    "manager": [
        "dashboard",
        "accounting",            # 지분 정산 탭 제외
        "sales",
        "inventory",
        "menu",
        "employee_attendance",   # 근태/근무표만 허용
        "operations",
    ],
    "staff": [
        "employee_attendance",   # 근무표 조회만 허용
    ],
}

# ─────────────────────────────────────────
# 비밀번호 처리
# ─────────────────────────────────────────

# bcrypt 해시 컨텍스트
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    평문 비밀번호와 해시 비밀번호를 비교합니다.
    로그인 시 비밀번호 검증에 사용합니다.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    비밀번호를 bcrypt 해시로 변환합니다.
    계정 생성/비밀번호 변경 시 사용합니다.
    """
    return pwd_context.hash(password)


# ─────────────────────────────────────────
# JWT 토큰 처리
# ─────────────────────────────────────────

# OAuth2 토큰 추출 — Authorization: Bearer <token> 헤더에서 추출
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict) -> str:
    """
    JWT 액세스 토큰을 생성합니다.
    data에 사용자 정보를 담고 만료 시각을 추가합니다.
    """
    to_encode = data.copy()
    # 토큰 만료 시각 계산
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    # JWT 서명 및 인코딩
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Authorization 헤더의 JWT 토큰을 검증하고 현재 사용자를 반환합니다.
    토큰이 유효하지 않거나 사용자가 없으면 401 에러를 발생시킵니다.
    """
    # 인증 실패 시 반환할 예외
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # JWT 디코딩 및 payload 추출
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # DB에서 사용자 조회
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if user is None:
        raise credentials_exception

    return user


def require_role(*roles: str):
    """
    특정 역할을 가진 사용자만 접근 허용하는 의존성 팩토리.
    사용 예시: Depends(require_role("admin", "manager"))
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        """역할 검증 — 허용되지 않은 역할이면 403 에러 반환"""
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"접근 권한이 없습니다. 필요한 역할: {', '.join(roles)}",
            )
        return current_user

    return role_checker
