# ============================================================
# routers/auth.py — 인증 및 계정 관리 API 라우터
# 로그인, 토큰 검증, 계정 CRUD 엔드포인트 제공
# ============================================================

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.auth import User
from schemas.auth import (
    LoginRequest, TokenResponse, UserBrief,
    UserCreate, UserUpdate, UserResponse,
)
from auth import (
    verify_password, get_password_hash,
    create_access_token, get_current_user, require_role,
)

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 로그인 / 인증 관련 엔드포인트
# ─────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    로그인 엔드포인트.
    아이디와 비밀번호를 검증 후 JWT 토큰을 반환합니다.
    로그인 성공 시 last_login을 현재 시각으로 업데이트합니다.
    """
    # 사용자 조회 (활성 계정만)
    user = db.query(User).filter(
        User.username == data.username,
        User.is_active == True,
    ).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # JWT 토큰 생성 — sub에 사용자 ID 저장
    access_token = create_access_token(data={"sub": str(user.id)})

    # 마지막 로그인 시각 업데이트
    user.last_login = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserBrief(
            id=user.id,
            username=user.username,
            name=user.name,
            role=user.role,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    현재 로그인한 사용자 정보를 반환합니다.
    Authorization 헤더의 JWT 토큰으로 인증합니다.
    """
    return current_user


@router.post("/logout")
def logout():
    """
    로그아웃 처리.
    서버는 Stateless이므로 클라이언트의 토큰 삭제를 안내합니다.
    실제 토큰 무효화는 클라이언트 측에서 localStorage를 비워 처리합니다.
    """
    return {"success": True, "message": "로그아웃 되었습니다."}


# ─────────────────────────────────────────
# 계정 관리 엔드포인트 (admin 전용)
# ─────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    전체 사용자 계정 목록 조회 — admin 전용.
    비활성 계정도 포함하여 반환합니다.
    """
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    새 계정 생성 — admin 전용.
    아이디 중복 시 409 에러를 반환합니다.
    """
    # 아이디 중복 확인
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"이미 사용 중인 아이디입니다: {data.username}",
        )

    # 비밀번호 해시 후 저장
    new_user = User(
        username=data.username,
        password_hash=get_password_hash(data.password),
        name=data.name,
        role=data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    계정 정보 수정 — admin 전용.
    이름, 역할, 비밀번호, 활성화 여부를 선택적으로 수정합니다.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 계정을 찾을 수 없습니다.",
        )

    # 변경된 필드만 업데이트
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.password is not None:
        user.password_hash = get_password_hash(data.password)
    if data.is_active is not None:
        user.is_active = data.is_active

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    계정 비활성화 — admin 전용 (소프트 삭제).
    admin 본인 계정은 비활성화할 수 없습니다.
    """
    # admin 본인 삭제 방지
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인 계정은 비활성화할 수 없습니다.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 계정을 찾을 수 없습니다.",
        )

    # 소프트 삭제 — is_active를 0으로 설정
    user.is_active = False
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": f"{user.name} 계정이 비활성화되었습니다."}
