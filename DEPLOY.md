# 服务器部署指南（Windows）

本工具是「本地/私有服务器」部署的 AI 视频解析站：视频不离开服务器，只把文字稿和关键帧发给所配置的 AI API。

## 一、环境要求

- Windows Server 2016+ / Win10+
- Python 3.11 或 3.12（64 位）
- Node.js 18+（只需构建前端一次，构建后可不再需要）
- ffmpeg（抽音频用，必须）
- 无需 GPU：无显卡也能跑，自动走 CPU int8 推理

## 二、安装步骤

### 1. 安装 ffmpeg（关键！）

方式 A（推荐）：把 ffmpeg 解压到固定目录，然后设置环境变量指定路径，不依赖系统 PATH，最稳：

```bat
setx FFMPEG_PATH "C:\ffmpeg\bin\ffmpeg.exe"
```

方式 B：用 winget 一键装并加入 PATH：

```bat
winget install ffmpeg
```

装完验证：`ffmpeg -version` 有输出即可。
代码读取顺序：环境变量 `FFMPEG_PATH` → 系统 PATH 里的 `ffmpeg`。

### 2. 准备代码与 Python 环境

```bat
git clone https://github.com/Chu-Xin-r/video-insight.git
cd video-insight\backend
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

### 3. 准备模型（CPU 服务器用 small 最合适）

faster-whisper 模型放在 `backend/models/faster-whisper-{型号}/` 下，
模型文件：`model.bin` + `config.json` + `tokenizer.json` + `vocabulary.txt`。

- 有外网：首次运行会自动从 HuggingFace 下载（国内可用镜像，见下方环境变量）
- 纯离线：在能联网的机器下载模型文件夹，用 scp 传到服务器对应目录

推荐 CPU 型号：`small`（约 460MB，速度/精度平衡）；内存充足可用 `medium`。

### 4. 配置 AI API（云端 API，无 GPU 也能用）

本机（开发机）的 `backend/data/providers.json` **不会**随 git 同步（已被 .gitignore 排除），
服务器上需要单独配置。两种方式：

方式 A：在网页「API 设置」页直接添加（浏览器操作，最简单）
方式 B：手动创建 `backend/data/providers.json`：

```json
{
  "my-provider": {
    "name": "我的中转",
    "base_url": "https://你的服务/v1",
    "api_key": "sk-xxxx",
    "model": "gpt-4o-mini",
    "vision": false
  },
  "my-vision": {
    "name": "视觉模型",
    "base_url": "https://你的服务/v1",
    "api_key": "sk-xxxx",
    "model": "grok-4.6",
    "vision": true
  }
}
```

Key 也可用环境变量 + `api_key_env` 字段（如 `"api_key_env": "MY_API_KEY"`），
代码会从环境变量或 `~/.dsh/.credentials.yaml` 读取，Key 不落盘。

### 5. 构建前端

```bat
cd ..\frontend
npm install
npm run build
```

构建产物在 `frontend/dist`，由后端 FastAPI 直接托管，无需单独部署前端服务。

### 6. 启动

```bat
cd ..\backend
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8892
```

浏览器访问 `http://服务器IP:8892`。

## 三、环境变量汇总

| 变量 | 作用 | 示例 |
|---|---|---|
| `FFMPEG_PATH` | ffmpeg.exe 绝对路径（推荐设置） | `C:\ffmpeg\bin\ffmpeg.exe` |
| `HF_ENDPOINT` | HuggingFace 镜像（国内服务器） | `https://hf-mirror.com` |
| `HF_HOME` | 模型缓存目录（可选） | `D:\models` |
| `MY_API_KEY` 等 | API Key（配合 providers.json 的 api_key_env） | `sk-xxx` |

## 四、其他注意事项

- 端口：默认 8892，改端口就改 uvicorn 的 `--port`，同时改 `frontend/vite.config.ts` 的代理（仅开发时需要）
- 防火墙：放行 8892（`netsh advfirewall firewall add rule name="VideoInsight" dir=in action=allow protocol=TCP localport=8892`）
- 磁盘：视频副本在 `backend/uploads`、任务在 `backend/tasks`，定期清理
- 后台运行：Windows 可用 `nssm` 把 uvicorn 注册成服务，或直接开着 cmd 窗口
- CPU 机器建议模型选 `small`，并注意内存（medium 约需 4-5GB）
