"""JWT authentication — register, login, refresh, and user dependency."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.database import get_session
from src.models.orm import RefreshToken, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "email": email, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# User dependency (optional auth — returns None if no token)
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Extract user from JWT. Returns None if no token (public access)."""
    if credentials is None:
        return None

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "access":
            return None
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def require_user(
    user: User | None = Depends(get_current_user),
) -> User:
    """Strict auth — raises 401 if not authenticated."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Create a new user account."""
    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(email=body.email, hashed_password=_hash_password(body.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    access_token = _create_access_token(user.id, user.email)
    raw_refresh = _create_refresh_token()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    session.add(rt)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Authenticate with email + password."""
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = _create_access_token(user.id, user.email)
    raw_refresh = _create_refresh_token()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    session.add(rt)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Rotate refresh token and issue new access token."""
    token_hash = _hash_refresh_token(body.refresh_token)

    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = result.scalar_one_or_none()

    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Revoke old token
    rt.revoked = True

    # Look up user
    user_result = await session.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Issue new tokens
    access_token = _create_access_token(user.id, user.email)
    raw_refresh = _create_refresh_token()

    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    session.add(new_rt)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)
