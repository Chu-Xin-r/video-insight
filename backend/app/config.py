"""API 提供商配置管理（OpenAI 兼容，支持自定义）。

Key 获取优先级：
  1. 环境变量（如 OPENAI_API_KEY）
  2. DSH 凭据文件 ~/.dsh/.credentials.yaml（本机共享，不复制到项目）
  3. 用户在本工具设置页保存的自定义提供商（data/providers.json）

预置提供商不内置在代码中：可通过 data/providers.json 配置
（该目录已被 .gitignore 排除，不会进入版本库）。
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CONFIG_FILE = DATA_DIR / "providers.json"

DEFAULT_MODEL_SIZES = ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"]


def _load_dsh_credentials() -> dict[str, str]:
    """从 DSH 凭据文件读取 Key（~/.dsh/.credentials.yaml）。"""
    home = Path.home() / ".dsh" / ".credentials.yaml"
    creds: dict[str, str] = {}
    if home.exists():
        try:
            for line in home.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if ":" in line and not line.startswith("#"):
                    k, _, v = line.partition(":")
                    creds[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass
    return creds


def _dsh_key(env_name: str) -> str:
    """按优先级取 Key：环境变量 → DSH 凭据。"""
    v = os.environ.get(env_name, "").strip()
    if v:
        return v
    return _load_dsh_credentials().get(env_name, "").strip()


def _load_custom() -> dict[str, dict[str, Any]]:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_custom(custom: dict[str, dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(custom, ensure_ascii=False, indent=2), encoding="utf-8")


def _mask(key: str | None) -> str | None:
    """把 Key 打码，只显示首尾。"""
    if not key:
        return None
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "****" + key[-2:]


def get_providers() -> dict[str, dict[str, Any]]:
    """返回全部提供商（Key 一律打码/隐藏）。"""
    custom = _load_custom()
    result: dict[str, dict[str, Any]] = {}
    for pid, p in custom.items():
        env = p.get("api_key_env")
        if env:
            has_key = bool(_dsh_key(env))
            result[pid] = {**p, "id": pid, "api_key": None,
                           "api_key_hint": f"Key {env}" + ("（已配置 ✓）" if has_key else "（未配置）")}
        else:
            result[pid] = {**p, "id": pid, "api_key": _mask(p.get("api_key")),
                           "api_key_hint": "本地配置"}
    return result


def save_provider(pid: str, name: str, base_url: str, api_key: str, model: str, vision: bool) -> dict:
    """新增/更新自定义提供商。返回打码后的信息。"""
    custom = _load_custom()
    custom[pid] = {
        "name": name or pid,
        "base_url": base_url.rstrip("/"),
        "api_key": api_key,
        "model": model,
        "vision": bool(vision),
        "builtin": False,
    }
    _save_custom(custom)
    return {"id": pid, **custom[pid], "api_key": _mask(api_key)}


def delete_provider(pid: str) -> bool:
    custom = _load_custom()
    if pid in custom and not custom[pid].get("builtin"):
        del custom[pid]
        _save_custom(custom)
        return True
    return False


def resolve_provider(pid: str) -> dict[str, Any] | None:
    """取出可用于调用 API 的完整提供商配置（含真实 Key）。"""
    custom = _load_custom()
    if pid in custom:
        p = dict(custom[pid])
        env = p.get("api_key_env")
        if env:
            p["api_key"] = _dsh_key(env)
        return p
    return None
