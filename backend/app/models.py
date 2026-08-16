"""Pydantic 数据模型。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ProviderIn(BaseModel):
    id: str
    name: str = ""
    base_url: str
    api_key: str = ""
    model: str = ""
    vision: bool = False


class ProviderOut(BaseModel):
    id: str
    name: str
    base_url: str
    api_key: str | None
    api_key_hint: str
    model: str
    vision: bool
    builtin: bool


class TaskCreate(BaseModel):
    filename: str
    model_size: str = "large-v3-turbo"   # whisper 模型大小
    video_understanding: bool = False     # 是否开启画面理解
    provider_id: str = ""   # 总结用提供商
    vision_provider_id: str = ""          # 画面理解用提供商（为空则用 provider_id）
    summary_style: str = "detailed"       # 总结风格

class TaskOut(BaseModel):
    id: str
    filename: str
    status: str          # pending | running | done | failed
    progress: int        # 0-100
    stage: str           # 当前阶段描述
    error: str | None = None
    result: dict[str, Any] | None = None
    created_at: str = ""
