"""画面理解：按时间戳抽帧 + 多模态描述 + 生成章节配图。"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .llm import describe_frame


def extract_frame(video_path: str, t: float, out_path: str | Path) -> Path | None:
    """ffmpeg 在 t 秒处抽 1 帧。失败返回 None。"""
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-ss", f"{max(0.0, t):.2f}", "-i", video_path,
        "-frames:v", "1", "-q:v", "2", str(out),
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=60, check=True)
        return out if out.exists() and out.stat().st_size > 0 else None
    except Exception:
        return None


def understand_frames(video_path: str, keypoints: list,
                      provider_id: str, frames_dir: Path) -> list:
    """对每个关键点抽帧并让多模态模型描述，返回 [{time, context, image, description}]。"""
    frames_dir.mkdir(parents=True, exist_ok=True)
    results = []
    seen = set()
    for kp in keypoints:
        t = float(kp["time"])
        if int(t) in seen:
            continue
        seen.add(int(t))
        frame_path = frames_dir / f"frame_{int(t)}.jpg"
        fp = extract_frame(video_path, t, frame_path)
        if fp is None:
            continue
        try:
            desc = describe_frame(provider_id, fp, f"{int(t // 60)}分{int(t % 60)}秒")
        except Exception as e:
            desc = f"（画面识别失败：{e}）"
        results.append({
            "time": t,
            "context": kp.get("reason", ""),
            "image": f"frames/{frame_path.name}",
            "description": desc,
        })
    return results