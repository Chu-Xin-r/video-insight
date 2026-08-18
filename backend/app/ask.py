"""基于视频文字稿的 AI 问答：相关片段检索 + LLM 回答 + 时间戳引用。"""
from __future__ import annotations

import re

from .llm import _chat


def _score_segments(segments: list, question: str) -> list:
    """按问题关键词给片段打分，返回 [(score, seg), ...] 降序。"""
    words = [w for w in re.split(r"[\s，。？！、；：,.!?;:()（）\"'<>《》【】\d_]+", question) if len(w) >= 2]
    out = []
    for s in segments:
        st = s.get("text") or ""
        score = sum(1 for w in words if w in st)
        if score:
            out.append((score, s))
    out.sort(key=lambda x: -x[0])
    return out


def answer_question(text: str, segments: list, question: str,
                    provider_id: str, user_id=None) -> dict:
    """返回 {"answer": str, "refs": [{"time": int, "text": str}]}。"""
    question = (question or "").strip()
    if not question:
        return {"answer": "请输入问题。", "refs": []}
    if not segments:
        return {"answer": "该视频没有可检索的文字稿（可能未开启或转写失败）。", "refs": []}

    scored = _score_segments(segments, question)
    if scored:
        top = scored[:8]
        top.sort(key=lambda x: x[1].get("start", 0))
    else:
        n = min(6, len(segments))
        if n > 1:
            idxs = sorted({int(i * (len(segments) - 1) / (n - 1)) for i in range(n)})
        else:
            idxs = [0]
        top = [(0, segments[i]) for i in idxs]

    ctx = "\n".join(f"[{int(s.get('start', 0))}s] {s.get('text', '')}" for _sc, s in top)
    prompt = (
        "你是课程助教。下面是视频某时段的语音转写片段（方括号内是秒数时间戳）。\n"
        "请用中文回答问题，尽量结合片段内容；若片段不足以回答请明确说明。\n"
        "回答中如需引用某个片段，用 <t>秒数</t> 标记（例如 <t>125</t>）。\n\n"
        f"视频片段：\n{ctx}\n\n"
        f"用户问题：{question}"
    )
    try:
        raw = _chat(provider_id, [
            {"role": "system", "content": "你只输出回答正文，不输出其他内容。"},
            {"role": "user", "content": prompt},
        ], temperature=0.3, user_id=user_id)
    except Exception as e:
        return {"answer": f"（AI 回答失败：{e}）", "refs": []}

    answer = (raw or "").strip()
    refs = []
    for m in re.finditer(r"<t>(\d+)</t>", answer):
        t = int(m.group(1))
        seg = next((s for s in segments if s.get("start", 0) <= t <= (s.get("end") or t + 60)), None)
        refs.append({"time": t, "text": (seg.get("text", "") if seg else "")[:120]})
    answer = re.sub(r"<t>(\d+)</t>", r"[\1]", answer)
    return {"answer": answer, "refs": refs}
