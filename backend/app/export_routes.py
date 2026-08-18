"""任务结果导出：文字稿 txt / 分析报告 md / 打包 zip。"""
from __future__ import annotations

import zipfile
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException

from .auth import require_user
from fastapi.responses import Response

from . import tasks as task_store
from .pipeline import TASK_DIR

router = APIRouter()


def _fmt_ts(sec: float) -> str:
    sec = max(0, int(round(sec)))
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _export_payload(task_id: str, user_id: str = "") -> tuple[str, str]:
    """返回 (文字稿文本, Markdown 报告)。"""
    t = task_store.get_task(task_id)
    if not t or not t.get("result"):
        raise HTTPException(404, "任务无结果")
    if user_id and t.get("user_id") and str(t["user_id"]) != str(user_id):
        raise HTTPException(404, "任务不存在")
    r = t["result"]
    sm = r.get("summary") or {}
    segs = r.get("segments") or []

    if segs:
        text_content = "\n".join(
            f"[{_fmt_ts(x.get('start', 0))}] {x.get('text', '').strip()}" for x in segs
        )
    else:
        text_content = r.get("text", "") or ""

    md: list[str] = [f"# {sm.get('title', '视频分析报告')}", "", "## 摘要", sm.get("summary", ""), ""]
    kws = sm.get("keywords") or []
    if kws:
        md += ["## 关键词", "、".join(kws), ""]
    chs = sm.get("chapters") or []
    if chs:
        md += ["## 章节脉络"]
        for i, ch in enumerate(chs):
            md.append(f"### {i + 1}. {ch.get('title', '')} ({_fmt_ts(ch.get('start', 0))})")
            for pt in ch.get("points") or []:
                md.append(f"- {pt}")
        md.append("")
    frs = r.get("frames") or []
    if frs:
        md += ["## 关键画面"]
        for f in frs:
            desc = f.get("context") or f.get("description") or ""
            md.append(f"- **{_fmt_ts(f.get('time', 0))}**：{desc}")
        md.append("")
    md += [f"## 完整文字稿（{len(r.get('text', ''))} 字）", ""]
    md.append(text_content)
    return text_content, "\n".join(md)


@router.get("/api/tasks/{task_id}/export/text")
def export_text(task_id: str, user: dict = Depends(require_user)):
    """下载文字稿（带时间戳 txt）。"""
    text_content, _ = _export_payload(task_id, user["id"])
    return Response(
        text_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="transcript_{task_id}.txt"'},
    )


@router.get("/api/tasks/{task_id}/export/report")
def export_report(task_id: str, user: dict = Depends(require_user)):
    """下载分析报告（Markdown）。"""
    _, md = _export_payload(task_id, user["id"])
    return Response(
        md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="report_{task_id}.md"'},
    )


@router.get("/api/tasks/{task_id}/export/zip")
def export_zip(task_id: str, user: dict = Depends(require_user)):
    """打包下载：文字稿 + 报告 + 关键帧图片。"""
    t = task_store.get_task(task_id)
    if not t or not t.get("result"):
        raise HTTPException(404, "任务无结果")
    if user["id"] and t.get("user_id") and str(t["user_id"]) != str(user["id"]):
        raise HTTPException(404, "任务不存在")
    text_content, md = _export_payload(task_id)
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("transcript.txt", text_content.encode("utf-8"))
        z.writestr("report.md", md.encode("utf-8"))
        for f in t["result"].get("frames") or []:
            img = TASK_DIR / task_id / f.get("image", "")
            if img.exists() and img.is_file():
                z.write(str(img), f"frames/{img.name}")
    buf.seek(0)
    return Response(
        buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="analysis_{task_id}.zip"'},
    )