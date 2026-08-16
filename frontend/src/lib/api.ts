export interface Segment { start: number; end: number; text: string }
export interface Chapter { title: string; start: number; end: number; points: string[] }
export interface SummaryResult { title: string; summary: string; chapters: Chapter[]; keywords: string[] }
export interface FrameInfo { time: number; context: string; image: string; description: string }
export interface TaskResult {
  text: string;
  segments: Segment[];
  language?: string;
  duration?: number;
  device?: string;
  model?: string;
  summary: SummaryResult;
  frames: FrameInfo[];
  options?: Record<string, unknown>;
}
export interface Task {
  id: string;
  filename: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: number;
  stage: string;
  error?: string | null;
  result?: TaskResult | null;
  created_at: string;
}
export interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key?: string | null;
  api_key_hint: string;
  model: string;
  vision: boolean;
  builtin: boolean;
}
export interface ProvidersResp {
  providers: Record<string, Provider>;
  model_sizes: string[];
}

const BASE = '';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, init);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.detail || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string; cuda: boolean; default_model: string }>('/api/health'),
  upload: (file: File, opts: {
    model_size: string; video_understanding: boolean; provider_id: string;
    vision_provider_id: string; summary_style: string;
  }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('model_size', opts.model_size);
    fd.append('video_understanding', String(opts.video_understanding));
    fd.append('provider_id', opts.provider_id);
    fd.append('vision_provider_id', opts.vision_provider_id);
    fd.append('summary_style', opts.summary_style);
    return req<Task>('/api/upload', { method: 'POST', body: fd });
  },
  task: (id: string) => req<Task>(`/api/tasks/${id}`),
  tasks: () => req<Task[]>('/api/tasks'),
  deleteTask: (id: string) => req<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  providers: () => req<ProvidersResp>('/api/providers'),
  saveProvider: (p: { id: string; name: string; base_url: string; api_key: string; model: string; vision: boolean }) =>
    req<Provider>('/api/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }),
  deleteProvider: (id: string) => req<{ ok: boolean }>(`/api/providers/${id}`, { method: 'DELETE' }),
  testProvider: (id: string) => req<{ ok: boolean; reply: string }>(`/api/providers/${id}/test`, { method: 'POST' }),
  taskFile: (taskId: string, name: string) => `${BASE}/api/task_files/${taskId}/${name}`,
};

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
               : `${m}:${String(ss).padStart(2, '0')}`;
}