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
你是一名专业的课程笔记整理助手。用户正在通过视频学习这门课程，
需要一份能当笔记用的分析。下面是视频语音转写稿（带时间戳），
请分析讲师讲了哪些知识点，输出严格的 JSON（不要输出任何其他文字）：

{{
  "title": "不超过 20 字的课程主题标题",
  "summary": "全文摘要（{style_desc}），以「这节课学了什么」为主线组织",
  "chapters": [
    {{
      "title": "知识点名称（教学术语，一句话概括，如：极限的唯一性）",
      "start": 讲师开始讲解该知识点的秒数(数字),
      "end": 讲解结束的秒数(数字),
      "points": ["讲解要点/结论", "关键例子或推导", "易错点"]
    }}
  ],
  "keywords": ["关键词1", "关键词2"]
}}

要求：
- 核心任务：识别「讲师开始讲解一个新知识点」的时刻作为章节起点；不要把视频按时间等分
- 每个知识点一个章节，按时间顺序排列；标题用知识点本身的教学术语
- points 提炼「讲了什么、结论是什么、有没有例题/推导」2~6 条
- keywords 5~10 个，用本学科的术语
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
    """找出「讲师讲解知识点 / 展示板书 PPT / 公式 / 例题」的关键时刻（供抽帧识别）。

    优先让 LLM 基于语义判断知识点讲解时刻（比正则准确），失败时回退正则。
    """
    if not segments:
        return []
    # 抽样控制 token
    step = max(1, len(segments) // 220)
    sample = segments[::step]
    lines = [f"[{int(s['start'])}s] {s['text'].strip()[:60]}" for s in sample]
    body = chr(10).join(lines)
    if len(body) > 22000:
        body = body[:22000] + '……'

    prompt = (
        '你是视频画面抓取助手。用户在通过视频课程学习，需要在「讲师正在讲解重要知识点、'
        '并展示板书 / PPT / 图表 / 公式推导 / 代码 / 例题」的时刻截取画面，交给多模态模型识别。'
        '下面是带时间戳的文字稿片段（抽样），请选出最适合截图的 4~8 个时刻：'
        '- 时刻必须是下面列表中存在的秒数'
        '- 优先选：开始讲新知识点、展示关键公式/图表/例题、做推导或演示'
        '- 避免：寒暄、重复、与知识点无关的内容'
        '输出严格 JSON：{"keypoints": [{"time": 秒数, "reason": "为什么选这里(20字内)"}]}'
        + chr(10)
        + body
    )
    try:
        raw = _chat(provider_id, [
            {'role': 'system', 'content': '你只输出合法 JSON，不输出其他内容。'},
            {'role': 'user', 'content': prompt},
        ], temperature=0.2)
        data = _parse_json(raw)
        kps = data.get('keypoints', []) if isinstance(data, dict) else []
        times = {int(s['start']) for s in sample}
        result = []
        for k in kps:
            t = int(k.get('time', 0) or 0)
            if t in times and len(result) < 10:
                result.append({'time': t, 'reason': str(k.get('reason', ''))[:40]})
        if result:
            return result
    except Exception:
        pass
    # 回退：正则启发
    import re
    kws = ('如图', '大家看', '注意', '重点', '这个图', '这个表', '演示', '代码',
           '例题', '定义', '定理', '性质', '公式', '推导', '证明', '接下来', '结论')
    selected = []
    n = max(1, len(sample) // 10)
    for i in range(0, len(sample), n):
        seg = sample[i]
        t = seg['text']
        if any(k in t for k in kws) or i % max(1, len(sample) // 3) == 0:
            selected.append({'time': seg['start'], 'reason': t[:40]})
        if len(selected) >= 10:
            break
    if selected:
        return selected
    return [{'time': s['start'], 'reason': s['text'][:40]} for s in sample[:: max(1, len(sample) // 6)]][:8]

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