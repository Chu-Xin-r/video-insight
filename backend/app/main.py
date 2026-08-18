"""FastAPI 入口：账号认证 / 上传 / 任务 / 每用户配置与设置 API + 托管前端。"""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles

from . import auth as auth_store
from . import tasks as task_store
from .config import DEFAULT_MODEL_SIZES
from .export_routes import router as export_router
from .models import LoginIn, ProviderIn, SettingsIn
from .pipeline import BASE_DIR, TASK_DIR, UPLOAD_DIR, default_model_size, start_task

app = FastAPI(title="视频信息提取工具", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TASK_DIR.mkdir(parents=True, exist_ok=True)
task_store.init_db()
auth_store.init_auth_db()

ALLOWED_EXT = {".mp4", ".mkv", ".mov", ".avi", ".flv", ".wmv", ".webm", ".m4v", ".ts"}


def _own(user: dict, task_id: str):
    """校验任务归属，返回任务 dict；不归属返回 None。"""
    t = task_store.get_task(task_id)
    if not t:
        return None
    if t.get("user_id") and str(t["user_id"]) != str(user["id"]):
        return None
    return t


# ---------- 账号 ----------

@app.post("/api/register")
def register(body: LoginIn):
    try:
        user = auth_store.register(body.username, body.password)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "user": user}


@app.post("/api/login")
def login(body: LoginIn):
    try:
        return auth_store.login(body.username, body.password)
    except ValueError as e:
        raise HTTPException(400, str(e))


_http_bearer = HTTPBearer(auto_error=False)


@app.post("/api/logout")
def logout(cred: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
           user: dict = Depends(auth_store.require_user)):
    if cred and cred.credentials:
        auth_store.logout(cred.credentials)
    return {"ok": True}


@app.get("/api/me")
def me(user: dict = Depends(auth_store.require_user)):
    return {"user": user}


# ---------- 每用户设置 ----------

@app.get("/api/settings")
def get_settings(user: dict = Depends(auth_store.require_user)):
    return {"settings": auth_store.get_settings(user["id"])}


@app.put("/api/settings")
def put_settings(body: SettingsIn, user: dict = Depends(auth_store.require_user)):
    auth_store.save_settings(user["id"], body.settings or {})
    return {"ok": True}


# ---------- 上传与任务 ----------

@app.get("/api/health")
def health():
    from .transcribe import cuda_available
    return {"status": "ok", "cuda": cuda_available(), "default_model": default_model_size()}


@app.post("/api/upload")
async def upload_video(
    file: UploadFile = File(...),
    model_size: str = Form(""),
    video_understanding: bool = Form(False),
    provider_id: str = Form(""),
    vision_provider_id: str = Form(""),
    summary_style: str = Form("detailed"),
    user: dict = Depends(auth_store.require_user),
):
    """上传视频并启动分析任务，返回任务信息。"""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"不支持的文件类型 {ext or '未知'}，支持: {sorted(ALLOWED_EXT)}")
    if not auth_store.resolve_provider(user["id"], provider_id):
        raise HTTPException(400, f"提供商 {provider_id} 不存在，请到 API 设置添加")

    task = task_store.create_task(file.filename or "video", user_id=str(user["id"]))
    task_id = task["id"]
    video_path = UPLOAD_DIR / f"{task_id}{ext}"

    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    options = {
        "model_size": model_size or default_model_size(),
        "video_understanding": video_understanding,
        "provider_id": provider_id,
        "vision_provider_id": vision_provider_id or provider_id,
        "summary_style": summary_style,
        "user_id": str(user["id"]),
    }
    start_task(task_id, str(video_path), options)
    return task_store.get_task(task_id)


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str, user: dict = Depends(auth_store.require_user)):
    t = _own(user, task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    return t


@app.get("/api/tasks")
def list_tasks(user: dict = Depends(auth_store.require_user)):
    return task_store.list_tasks(user_id=str(user["id"]))


@app.delete("/api/tasks/{task_id}")
def del_task(task_id: str, user: dict = Depends(auth_store.require_user)):
    """删除任务：数据库记录 + 上传视频副本 + 任务产物目录（帧图等）。"""
    t = task_store.delete_task(task_id, user_id=str(user["id"]))
    if not t:
        raise HTTPException(404, "任务不存在")
    try:
        for f in UPLOAD_DIR.glob(f"{task_id}.*"):
            f.unlink(missing_ok=True)
    except Exception:
        pass
    try:
        shutil.rmtree(TASK_DIR / task_id, ignore_errors=True)
    except Exception:
        pass
    return {"ok": True, "deleted": task_id}


@app.get("/api/task_files/{task_id}/{name:path}")
def task_file(task_id: str, name: str, user: dict = Depends(auth_store.require_user)):
    """返回任务产物（帧图等），name 形如 frames/frame_123.jpg。"""
    if not _own(user, task_id):
        raise HTTPException(404, "文件不存在")
    base = (TASK_DIR / task_id).resolve()
    target = (base / name).resolve()
    if not str(target).startswith(str(base)) or not target.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(str(target))


# ---------- 每用户提供商（API 配置）管理 ----------

@app.get("/api/providers")
def providers(user: dict = Depends(auth_store.require_user)):
    return {"providers": auth_store.list_providers(user["id"]), "model_sizes": DEFAULT_MODEL_SIZES}


@app.post("/api/providers")
def add_provider(p: ProviderIn, user: dict = Depends(auth_store.require_user)):
    try:
        return auth_store.save_provider(user["id"], p.id, p.name, p.base_url, p.api_key, p.model, p.vision)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/providers/{pid}")
def del_provider(pid: str, user: dict = Depends(auth_store.require_user)):
    if not auth_store.delete_provider(user["id"], pid):
        raise HTTPException(404, "提供商不存在或为内置")
    return {"ok": True}


@app.post("/api/providers/{pid}/test")
def test_provider(pid: str, user: dict = Depends(auth_store.require_user)):
    p = auth_store.resolve_provider(user["id"], pid)
    if not p or not p.get("api_key"):
        raise HTTPException(400, "该提供商未配置 API Key")
    try:
        from openai import OpenAI
        client = OpenAI(base_url=p["base_url"], api_key=p["api_key"], timeout=30)
        resp = client.chat.completions.create(
            model=p.get("model") or "gpt-4o-mini",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
        )
        return {"ok": True, "reply": (resp.choices[0].message.content or "")[:50]}
    except Exception as e:
        raise HTTPException(400, f"连接失败: {e}")


# ---------- 前端静态资源 ----------

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def index():
        return JSONResponse({"message": "VideoInsight API 运行中", "docs": "/docs",
                             "hint": "前端未构建，请先构建 frontend 或直接使用 API"})
