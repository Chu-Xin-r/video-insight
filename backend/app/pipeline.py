"""主处理流水线：抽音频 → 转写 → 总结 →（可选）画面理解。"""
from __future__ import annotations

import shutil
import threading
import traceback
from pathlib import Path

from . import tasks as task_store
from .auth import list_providers as _list_user_providers
from .llm import find_keypoints, summarize
from .transcribe import cuda_available, extract_audio, transcribe
from .vision import understand_frames

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
TASK_DIR = BASE_DIR / "tasks"


def default_model_size() -> str:
    """根据设备与本地模型可用性自动选择默认模型。
    GPU 优先 large-v3-turbo/medium，CPU 优先 small（速度优先）；
    本地没有对应模型时自动降级，绝不触发在线下载。
    """
    from .transcribe import resolve_model_path
    pref = ["large-v3-turbo", "medium", "small"] if cuda_available() else ["small", "medium"]
    for m in pref:
        if resolve_model_path(m) != m:  # 本地模型目录存在
            return m
    return "small"


def _with_timeout(fn, timeout: float):
    """daemon 线程 + join 超时：防止第三方调用（如 fxidc 慢响应）无限阻塞任务。
    超时后返回 ('timeout', None)，卡住的 daemon 线程继续跑，进程退出时自动回收。
    线程内异常以 ('error', e) 形式抛出。"""
    box = {}

    def _run() -> None:
        try:
            box["r"] = fn()
        except Exception as e:
            box["e"] = e

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        return "timeout", None
    if "e" in box:
        return "error", box["e"]
    return "ok", box.get("r")


def run_task(task_id: str, video_path: str, options: dict) -> None:
    """后台执行完整流水线。"""
    user_id = options.get("user_id") or ""
    model_size = options.get("model_size") or default_model_size()
    provider_id = options.get("provider_id") or ""
    if not provider_id:
        provider_id = next(iter(_list_user_providers(user_id).keys()), "")
    vision_provider = options.get("vision_provider_id") or provider_id
    if not vision_provider:
        vision_provider = next((k for k, v in _list_user_providers(user_id).items() if v.get("vision")), "")
    use_vision = bool(options.get("video_understanding"))
    style = options.get("summary_style") or "detailed"

    video = Path(video_path)
    task_dir = TASK_DIR / task_id
    frames_dir = task_dir / "frames"
    wav_path = task_dir / "audio.wav"

    try:
        task_dir.mkdir(parents=True, exist_ok=True)

        # 阶段 1：抽音频（10% ~ 20%）
        task_store.update_task(task_id, status="running", progress=10, stage="正在提取音频…")
        extract_audio(str(video), str(wav_path))
        task_store.update_task(task_id, progress=20, stage="音频提取完成，开始语音识别…")

        # 阶段 2：转写（20% ~ 70%）
        def on_prog(ratio: float):
            p = int(20 + ratio * 50)
            task_store.update_task(task_id, progress=p, stage=f"语音识别中 {p}%（{model_size} · {'GPU' if cuda_available() else 'CPU'}）…")

        transcript = transcribe(str(wav_path), model_size=model_size, on_progress=on_prog)
        task_store.update_task(task_id, progress=70, stage="语音识别完成，AI 正在总结…")

        # 阶段 3：AI 总结（70% ~ 85%，5 分钟超时保护）
        try:
            status, summary = _with_timeout(
                lambda: summarize(provider_id, transcript["text"], style=style, user_id=user_id), 300)
            if status == "timeout":
                summary = {"title": "视频分析", "summary": "（总结超时：AI 服务 5 分钟内未响应，可重新上传重试）", "chapters": [], "keywords": []}
                task_store.update_task(task_id, error="总结超时（AI 服务未响应）")
            elif status == "error":
                raise summary  # 原异常
        except Exception as e:
            summary = {"title": "视频分析", "summary": f"（总结失败：{e}）", "chapters": [], "keywords": []}
            task_store.update_task(task_id, error=f"总结失败: {e}")
        task_store.update_task(task_id, progress=85, stage="总结完成，整理结果…")

        # 阶段 4：画面理解（可选，85% ~ 95%）
        frames = []
        if use_vision and transcript.get("segments"):
            task_store.update_task(task_id, progress=88, stage="正在分析关键画面…")
            _, keypoints = _with_timeout(
                lambda: find_keypoints(provider_id, transcript["text"], transcript["segments"], user_id=user_id), 180)
            if not keypoints:
                keypoints = []
            try:
                _, frames = _with_timeout(
                    lambda: understand_frames(str(video), keypoints, vision_provider, frames_dir, user_id=user_id), 900)
                if not frames:
                    frames = []
            except Exception as e:
                frames = []
                task_store.update_task(task_id, error=f"画面理解失败: {e}")
            task_store.update_task(task_id, progress=95, stage="画面分析完成，生成报告…")

        result = {
            **transcript,
            "summary": summary,
            "frames": frames,
            "options": {
                "model_size": model_size,
                "provider_id": provider_id,
                "vision": use_vision,
                "style": style,
            },
        }
        task_store.update_task(task_id, status="done", progress=100, stage="完成", result=result)

    except Exception as e:
        task_store.update_task(task_id, status="failed", stage="失败", error=f"{e}\n{traceback.format_exc()}")
    finally:
        # 清理中间音频文件（保留视频与帧图）
        try:
            wav_path.unlink(missing_ok=True)
        except Exception:
            pass


def start_task(task_id: str, video_path: str, options: dict) -> threading.Thread:
    t = threading.Thread(target=run_task, args=(task_id, video_path, options), daemon=True)
    t.start()
    return t


def run_task_from_url(task_id: str, url: str, options: dict) -> None:
    """URL 任务：解析视频（视频库匹配复制 / HTTP 下载）→ 完整流水线。"""
    try:
        task_dir = TASK_DIR / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        task_store.update_task(task_id, status="running", progress=3, stage="正在获取视频…")

        def on_dl(ratio: float):
            task_store.update_task(task_id, progress=int(3 + ratio * 7), stage="正在下载视频…")

        from .video_source import prepare_video
        ok, msg = prepare_video(url, UPLOAD_DIR / task_id, on_progress=on_dl)
        if not ok:
            task_store.update_task(task_id, status="failed", stage="失败", error=msg)
            return
        task_store.update_task(task_id, progress=10, stage=msg + "，开始分析…")
        video = next(UPLOAD_DIR.glob(f"{task_id}.*"), None)
        if not video:
            task_store.update_task(task_id, status="failed", stage="失败", error="视频文件未生成")
            return
        run_task(task_id, str(video), options)
    except Exception as e:
        task_store.update_task(task_id, status="failed", stage="失败", error=f"{e}\n{traceback.format_exc()}")


def start_task_from_url(task_id: str, url: str, options: dict) -> threading.Thread:
    t = threading.Thread(target=run_task_from_url, args=(task_id, url, options), daemon=True)
    t.start()
    return t
