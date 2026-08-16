"""音频提取（ffmpeg）+ 语音转写（faster-whisper，GPU 优先、CPU 自动回退）。

纯 CPU 部署无需任何额外库：CTranslate2 + int8 量化即可运行，
GPU 只是可选加速（需 cuBLAS/cuDNN 运行库）。
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Callable


def _add_nvidia_libs_to_path() -> None:
    """把 pip 安装的 nvidia-* 运行库 bin 目录加入 PATH（GPU 加速用，CPU 可忽略）。"""
    try:
        import site
        for base in site.getsitepackages():
            nv = Path(base) / "nvidia"
            if not nv.exists():
                continue
            for sub in nv.iterdir():
                b = sub / "bin"
                if b.is_dir() and str(b) not in os.environ.get("PATH", ""):
                    os.environ["PATH"] = str(b) + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass


_add_nvidia_libs_to_path()


def _ffmpeg_path() -> str:
    """ffmpeg 可执行文件路径：优先环境变量 FFMPEG_PATH，否则用系统 PATH 中的 ffmpeg。
    服务器部署时建议设 FFMPEG_PATH（如 C:\ffmpeg\bin\ffmpeg.exe）。"""
    p = os.environ.get("FFMPEG_PATH", "").strip()
    if p:
        return p
    # 自动探测常见安装位置（服务器部署友好）
    for cand in (r"E:\FormatFactory\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe",
                  r"C:\tools\ffmpeg\bin\ffmpeg.exe", r"D:\ffmpeg\bin\ffmpeg.exe"):
        if os.path.exists(cand):
            return cand
    return "ffmpeg"

def extract_audio(video_path: str, wav_path: str) -> None:
    """ffmpeg 抽取音轨 → 16kHz 单声道 wav。"""
    Path(wav_path).parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        _ffmpeg_path(), "-y", "-i", video_path,
        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
        wav_path,
    ]
    subprocess.run(cmd, capture_output=True, timeout=1800, check=True)


def cuda_available() -> bool:
    """探测 CUDA 是否可用。纯 CPU 环境返回 False，自动走 int8 量化。"""
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def resolve_model_path(model_size: str) -> str:
    """优先使用本地 models 目录的模型（避免在线下载），否则返回模型名走默认下载。"""
    local = Path(__file__).resolve().parent.parent / "models" / f"faster-whisper-{model_size}"
    if local.exists() and (local / "model.bin").exists() and (local / "model.bin").stat().st_size > 10_000_000:
        return str(local)
    return model_size


def _run_transcription(model, wav_path: str, on_progress: Callable | None, device: str = "cpu") -> dict:
    """执行转写并返回结果字典。"""
    segments_iter, info = model.transcribe(
        wav_path,
        language=None,          # 自动检测语言
        vad_filter=True,        # 过滤静音
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=False,
    )
    duration = info.duration or 1.0
    segments = []
    texts = []
    for seg in segments_iter:
        segments.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        texts.append(seg.text.strip())
        if on_progress:
            on_progress(min(1.0, seg.end / duration))
    return {
        "text": "".join(texts),
        "segments": segments,
        "language": getattr(info, "language", None),
        "duration": round(duration, 1),
        "device": device,
        "model": getattr(model, "model_path", ""),
    }


def transcribe(wav_path: str, model_size: str = "small",
               on_progress: Callable[[float], None] | None = None) -> dict:
    """转写 wav → {text, segments, language, duration, device}。

    设备策略：
    - GPU 可用：float16 + CUDA（快）
    - 无 GPU 或 GPU 库缺失：自动回退 CPU + int8（纯 CPU 服务器可用）
    """
    from faster_whisper import WhisperModel

    model_path = resolve_model_path(model_size)
    use_cuda = cuda_available()

    try:
        model = WhisperModel(
            model_path,
            device="cuda" if use_cuda else "cpu",
            compute_type="float16" if use_cuda else "int8",
        )
        return _run_transcription(model, wav_path, on_progress, device="cuda" if use_cuda else "cpu")
    except RuntimeError as e:
        # GPU 库缺失（cublas/cudnn 等）→ 自动回退 CPU
        if use_cuda and any(k in str(e).lower() for k in ("cublas", "cudnn", "cuda")):
            model = WhisperModel(model_path, device="cpu", compute_type="int8")
            return _run_transcription(model, wav_path, on_progress, device="cpu (GPU 库缺失自动回退)")
        raise