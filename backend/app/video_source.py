"""在线视频 URL → 本地视频文件：优先视频库磁盘匹配（按文件名），其次 HTTP 流式下载。"""
from __future__ import annotations

import os
import shutil
import urllib.request
from pathlib import Path
from urllib.parse import unquote, urlparse

from .config import VIDEO_LIBRARY_ROOTS

ALLOWED_EXT = {'.mp4', '.mkv', '.mov', '.avi', '.flv', '.wmv', '.webm', '.m4v', '.ts'}


def filename_from_url(url: str) -> str:
    """URL 路径末段解码出文件名。"""
    path = unquote(urlparse(url).path)
    name = path.rstrip('/').rsplit('/', 1)[-1]
    return name or 'video'


def find_in_library(url: str) -> Path | None:
    """在视频库根目录按文件名（忽略大小写）递归查找。"""
    fname = filename_from_url(url)
    want = fname.lower()
    if not want:
        return None
    for root in VIDEO_LIBRARY_ROOTS:
        r = Path(root)
        if not r.is_dir():
            continue
        for dirpath, _dirnames, filenames in os.walk(r):
            for fn in filenames:
                if fn.lower() == want:
                    return Path(dirpath) / fn
    return None


def prepare_video(url: str, dest: Path, on_progress=None) -> tuple[bool, str]:
    """把 URL 解析为本地视频文件。dest 为不含扩展名的目标路径。
    返回 (ok, message)。"""
    # 1) 视频库磁盘匹配 → 复制（秒级）
    lib = find_in_library(url)
    if lib:
        ext = lib.suffix.lower() or '.mp4'
        target = dest.with_suffix(ext)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(lib), str(target))
        return True, f'已从视频库匹配：{lib.name}（{lib.parent}）'
    # 2) HTTP 流式下载（兜底）
    fname = filename_from_url(url)
    ext = Path(fname).suffix.lower()
    if ext not in ALLOWED_EXT:
        ext = '.mp4'
    target = dest.with_suffix(ext)
    target.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            total = int(resp.headers.get('Content-Length') or 0)
            done = 0
            with open(target, 'wb') as f:
                while True:
                    chunk = resp.read(1024 * 512)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    if on_progress and total:
                        on_progress(min(1.0, done / total))
        mb = done // (1024 * 1024)
        return True, f'已下载视频（{mb} MB）'
    except Exception as e:
        target.unlink(missing_ok=True)
        return False, f'视频下载失败: {e}'
