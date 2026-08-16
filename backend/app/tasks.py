"""任务状态管理（SQLite 持久化 + 内存缓存）。"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "tasks.db"
_lock = threading.Lock()


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _lock, _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                filename TEXT,
                status TEXT,
                progress INTEGER,
                stage TEXT,
                error TEXT,
                result TEXT,
                created_at TEXT
            )
        """)
        c.commit()


def create_task(filename: str) -> dict:
    task_id = uuid.uuid4().hex[:12]
    row = {
        "id": task_id,
        "filename": filename,
        "status": "pending",
        "progress": 0,
        "stage": "排队中",
        "error": None,
        "result": None,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    with _lock, _conn() as c:
        c.execute("INSERT INTO tasks (id,filename,status,progress,stage,error,result,created_at) VALUES (?,?,?,?,?,?,?,?)",
                  (row["id"], row["filename"], row["status"], 0, row["stage"], None, None, row["created_at"]))
        c.commit()
    return row


def update_task(task_id: str, **fields) -> None:
    allowed = {"status", "progress", "stage", "error", "result"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    if "result" in sets and sets["result"] is not None:
        sets["result"] = json.dumps(sets["result"], ensure_ascii=False)
    cols = ", ".join(f"{k}=?" for k in sets)
    with _lock, _conn() as c:
        c.execute(f"UPDATE tasks SET {cols} WHERE id=?", (*sets.values(), task_id))
        c.commit()


def get_task(task_id: str) -> dict | None:
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if row is None:
        return None
    d = dict(row)
    if d.get("result"):
        try:
            d["result"] = json.loads(d["result"])
        except Exception:
            pass
    return d


def list_tasks(limit: int = 50) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for row in rows:
        d = dict(row)
        if d.get("result"):
            try:
                d["result"] = json.loads(d["result"])
            except Exception:
                pass
        out.append(d)
    return out



def delete_task(task_id: str) -> dict | None:
    """删除任务数据库记录，返回任务信息（供清理文件）。"""
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if row is None:
            return None
        c.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        c.commit()
    return dict(row)
