"""账号、会话、每用户设置与 API 提供商管理（SQLite 持久化）。

- 密码：pbkdf2_hmac 加盐哈希（标准库，零依赖）
- 会话：随机 token，登录时签发
- 提供商：每个账号独立配置；首个注册账号自动迁移旧 data/providers.json
"""
from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "auth.db"
_lock = threading.Lock()


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init_auth_db() -> None:
    with _lock, _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            settings TEXT
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS user_providers (
            user_id INTEGER NOT NULL,
            id TEXT NOT NULL,
            name TEXT,
            base_url TEXT,
            api_key TEXT,
            model TEXT,
            vision INTEGER DEFAULT 0,
            is_builtin INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, id)
        )""")
        c.commit()


# ---------- 密码 ----------

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100_000)
    return f"{salt}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, hx = stored.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100_000)
        return secrets.compare_digest(dk.hex(), hx)
    except Exception:
        return False


# ---------- 用户/会话 ----------

def register(username: str, password: str) -> dict:
    username = (username or "").strip()
    if not username or len(username) < 2:
        raise ValueError("用户名至少 2 个字符")
    if not password or len(password) < 4:
        raise ValueError("密码至少 4 个字符")
    with _lock, _conn() as c:
        row = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()
        is_admin = 1 if (row["n"] or 0) == 0 else 0
        try:
            cur = c.execute(
                "INSERT INTO users (username,password_hash,is_admin,created_at) VALUES (?,?,?,?)",
                (username, _hash_password(password), is_admin,
                 datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            uid = cur.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError("用户名已存在")
        if is_admin:
            _migrate_legacy_providers(uid, c)
    return {"id": uid, "username": username, "is_admin": bool(is_admin)}


def _migrate_legacy_providers(user_id: int, c: sqlite3.Connection) -> None:
    """首个用户注册时，把旧 data/providers.json 的配置迁移到该账号。"""
    old = Path(__file__).resolve().parent.parent / "data" / "providers.json"
    if not old.exists():
        return
    try:
        data = json.loads(old.read_text(encoding="utf-8-sig"))
    except Exception:
        return
    for pid, p in data.items():
        if not isinstance(p, dict) or not p.get("base_url"):
            continue
        c.execute(
            "INSERT OR IGNORE INTO user_providers (user_id,id,name,base_url,api_key,model,vision,is_builtin) VALUES (?,?,?,?,?,?,?,1)",
            (user_id, pid, p.get("name") or pid, p.get("base_url", ""),
             p.get("api_key", ""), p.get("model", ""), 1 if p.get("vision") else 0))


def login(username: str, password: str) -> dict:
    username = (username or "").strip()
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not row or not _verify_password(password, row["password_hash"]):
        raise ValueError("用户名或密码错误")
    token = secrets.token_hex(24)
    with _lock, _conn() as c:
        c.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
        c.execute("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)",
                  (token, row["id"], datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    return {"token": token, "user": {"id": row["id"], "username": row["username"],
                                     "is_admin": bool(row["is_admin"])}}


def logout(token: str) -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (token,))


def verify_token(token: str) -> dict | None:
    if not token:
        return None
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT u.id, u.username, u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
            (token,)).fetchone()
    if not row:
        return None
    return {"id": row["id"], "username": row["username"], "is_admin": bool(row["is_admin"])}


# ---------- 每用户设置 ----------

def get_settings(user_id: int) -> dict:
    with _lock, _conn() as c:
        row = c.execute("SELECT settings FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
    if not row or not row["settings"]:
        return {}
    try:
        return json.loads(row["settings"])
    except Exception:
        return {}


def save_settings(user_id: int, settings: dict) -> None:
    data = json.dumps(settings or {}, ensure_ascii=False)
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO user_settings (user_id,settings) VALUES (?,?) "
            "ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings",
            (user_id, data))


# ---------- 每用户提供商 ----------

def _mask(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "****" + key[-2:]


def list_providers(user_id: int) -> dict[str, dict[str, Any]]:
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT * FROM user_providers WHERE user_id=? ORDER BY is_builtin DESC, id", (user_id,)).fetchall()
    result: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = r["api_key"] or ""
        hint = "本地配置" if key else "未配置 Key"
        result[r["id"]] = {
            "id": r["id"],
            "name": r["name"] or r["id"],
            "base_url": r["base_url"],
            "api_key": _mask(key) if key else None,
            "api_key_hint": hint,
            "model": r["model"] or "",
            "vision": bool(r["vision"]),
            "builtin": bool(r["is_builtin"]),
        }
    return result


def save_provider(user_id: int, pid: str, name: str, base_url: str, api_key: str,
                  model: str, vision: bool) -> dict:
    pid = (pid or "").strip()
    if not pid or not base_url:
        raise ValueError("id 和 base_url 必填")
    if not model:
        raise ValueError("model 必填")
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT is_builtin FROM user_providers WHERE user_id=? AND id=?", (user_id, pid)).fetchone()
        if row and row["is_builtin"] and not api_key:
            raise ValueError("内置提供商不可修改，请新建自己的配置")
        c.execute(
            "INSERT INTO user_providers (user_id,id,name,base_url,api_key,model,vision,is_builtin) "
            "VALUES (?,?,?,?,?,?,?,0) "
            "ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name, base_url=excluded.base_url, "
            "api_key=excluded.api_key, model=excluded.model, vision=excluded.vision",
            (user_id, pid, name or pid, base_url.rstrip("/"), api_key, model, 1 if vision else 0))
    return {"id": pid, "name": name or pid, "base_url": base_url.rstrip("/"),
            "api_key": _mask(api_key) if api_key else None, "model": model,
            "vision": bool(vision), "builtin": False}


def delete_provider(user_id: int, pid: str) -> bool:
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT is_builtin FROM user_providers WHERE user_id=? AND id=?", (user_id, pid)).fetchone()
        if not row or row["is_builtin"]:
            return False
        c.execute("DELETE FROM user_providers WHERE user_id=? AND id=?", (user_id, pid))
    return True


def resolve_provider(user_id: int, pid: str) -> dict[str, Any] | None:
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT * FROM user_providers WHERE user_id=? AND id=?", (user_id, pid)).fetchone()
    if not row:
        return None
    return {"id": row["id"], "name": row["name"] or row["id"], "base_url": row["base_url"],
            "api_key": row["api_key"] or "", "model": row["model"] or "",
            "vision": bool(row["vision"]), "builtin": bool(row["is_builtin"])}

# ---------- FastAPI 认证依赖 ----------

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def require_user(request: Request,
                 cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    """FastAPI 依赖：Authorization: Bearer <token> 或 ?token= 解析当前用户
    （query 参数用于 <img>/<a href> 等无法带 header 的浏览器请求）。"""
    token = ""
    if cred and cred.credentials:
        token = cred.credentials
    elif request is not None:
        token = request.query_params.get("token", "")
    if not token:
        raise HTTPException(401, "未登录或登录已过期")
    user = verify_token(token)
    if not user:
        raise HTTPException(401, "未登录或登录已过期")
    return user