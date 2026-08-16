"""OpenAI 兼容 LLM 客户端：总结、关键点提取、多模态画面描述。"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from openai import OpenAI

from .config import resolve_provider


def _client(provider_id: str):
    p = resolve_provider(provider_id)
    if not p or not p.get("api_key"):
        raise RuntimeError(f"提供商 {provider_id} 未配置 API Key")
    client = OpenAI(base_url=p["base_url"], api_key=p["api_key"], timeout=120)
    return client, p


def _chat(provider_id: str, messages: list, model: str | None = None,
          temperature: float = 0.3) -> str:
    client, p = _client(provider_id)
    resp = client.chat.completions.create(
        model=model or p.get("model") or "gpt-4o-mini",
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


def summarize(provider_id: str, transcript: str, style: str = "detailed",
              language: str = "zh") -> dict:
    """文字稿 → 结构化总结（摘要 + 章节时间轴 + 要点）。"""
    style_desc = {
        "minimal": "精简摘要，只保留核心信息，300 字以内",
        "detailed": "详细笔记，覆盖全部要点，分章节展开",
        "academic": "学术风格，结构化、术语准确、层次分明",
        "tutorial": "教程风格，按学习路径组织，含步骤与要点",
        "xiaohongshu": "小红书风格，口语化、有标题感、适合分享",
        "life_journal": "生活记录风格，叙事流畅",
        "task_oriented": "任务导向，提取行动项与待办",
        "business": "商业风格，突出结论、数据与决策",
        "meeting_minutes": "会议纪要风格，结论/决议/待办分明",
    }.get(style, "详细笔记，覆盖全部要点，分章节展开")

    prompt = f"""
你是一个专业的视频内容分析师。下面是一段视频的语音转写稿（带时间戳），
请分析它讲了什么，输出严格的 JSON（不要输出任何其他文字）：

{{
  "title": "不超过 20 字的标题",
  "summary": "全文摘要（{style_desc}）",
  "chapters": [
    {{
      "title": "章节标题",
      "start": 起始秒数(数字),
      "end": 结束秒数(数字),
      "points": ["要点1", "要点2"]
    }}
  ],
  "keywords": ["关键词1", "关键词2"]
}}

要求：
- chapters 按时间顺序覆盖整个视频，start/end 取转写时间戳中最接近的整数秒
- 每个章节 2~6 个要点，用一句话概括
- keywords 5~10 个
- 语言使用中文

转写稿如下：
"""
    if len(transcript) > 150000:
        transcript = transcript[:150000] + "……（过长截断）"

    raw = _chat(provider_id, [
        {"role": "system", "content": "你只输出合法 JSON，不输出任何其他内容。"},
        {"role": "user", "content": prompt + transcript},
    ], temperature=0.2)
    return _parse_json(raw)


def find_keypoints(provider_id: str, transcript: str, segments: list) -> list:
    """从文字稿里找出适合截图的"关键点"（含时间戳）。"""
    import re
    hints = re.findall(r"(?:如图|大家看|接下来|注意|重点|这里|这个图|这个表|演示|操作|代码|屏幕|画面)", transcript)
    selected = []
    step = max(1, len(segments) // 12) if segments else 1
    for i in range(0, len(segments), step):
        seg = segments[i]
        t = seg["text"]
        if any(k in t for k in ("如图", "大家看", "接下来", "注意", "重点", "这里", "这个图", "这个表", "演示", "操作", "代码", "屏幕", "画面")) or i % (step * 3) == 0:
            selected.append({
                "time": seg["start"],
                "reason": t[:40],
            })
        if len(selected) >= 15:
            break
    if not selected and segments:
        selected = [{"time": s["start"], "reason": s["text"][:40]} for s in segments[:: max(1, len(segments) // 8)]][:10]
    return selected


def describe_frame(provider_id: str, image_path: str | Path, context: str) -> str:
    """多模态：让视觉模型描述一帧画面（PPT/图表/代码/字幕等）。"""
    img = Path(image_path)
    b64 = base64.b64encode(img.read_bytes()).decode()
    ext = img.suffix.lower().lstrip(".") or "jpeg"
    mime = "png" if ext == "png" else "jpeg"

    client, p = _client(provider_id)
    if not p.get("vision"):
        raise RuntimeError(f"提供商 {provider_id} 不支持图片输入，请在设置里选择支持视觉的模型")

    resp = client.chat.completions.create(
        model=p.get("model") or "gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是视频画面分析助手。用中文简要描述图片内容，重点是：PPT/图表/文字/代码/屏幕内容；若画面是人或场景，描述在做什么。60 字以内。"},
            {"role": "user", "content": [
                {"type": "text", "text": f"这是视频在 {context} 时刻的画面，请描述画面内容。"},
                {"type": "image_url", "image_url": {"url": f"data:image/{mime};base64,{b64}"}},
            ]},
        ],
        temperature=0.2,
        max_tokens=300,
    )
    return (resp.choices[0].message.content or "").strip()


def _parse_json(raw: str) -> dict[str, Any]:
    """容错解析模型输出的 JSON（可能带 ```json 包裹或前后废话）。"""
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.startswith("json"):
            s = s[4:]
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        s = s[start:end + 1]
    try:
        return json.loads(s)
    except Exception:
        lines = [l.strip() for l in s.splitlines() if l.strip()]
        return {"title": "视频分析", "summary": "\n".join(lines)[:500], "chapters": [], "keywords": []}