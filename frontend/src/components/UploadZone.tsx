import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UploadIcon, SparkleIcon, LayersIcon, ImageIcon, PlayIcon, LinkIcon } from './Icons';
import Accordion from './Accordion';
import { api, ProvidersResp, Task, UserSettings } from '../lib/api';

const STYLES: [string, string][] = [
  ['detailed', '详细笔记'],
  ['minimal', '精简摘要'],
  ['academic', '学术风格'],
  ['tutorial', '教程风格'],
  ['xiaohongshu', '小红书风格'],
  ['meeting_minutes', '会议纪要'],
  ['business', '商业风格'],
  ['task_oriented', '任务导向'],
];

interface Props {
  providers: ProvidersResp | null;
  onUploaded: (t: Task) => void;
  onError: (msg: string) => void;
}

const EASE = [0.4, 0, 0.2, 1] as const;

export default function UploadZone({ providers, onUploaded, onError }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [modelSize, setModelSize] = useState('auto');
  const [style, setStyle] = useState('detailed');
  const [vision, setVision] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [visionProviderId, setVisionProviderId] = useState('');

  // 记住的设置（图片推理开关 / 模型 / 风格）
  useEffect(() => {
    api.getSettings().then(({ settings }) => {
      if (settings.model_size) setModelSize(settings.model_size);
      if (settings.summary_style) setStyle(settings.summary_style);
      if (settings.video_understanding !== undefined) setVision(Boolean(settings.video_understanding));
      setProviderId(settings.provider_id || '');
      setVisionProviderId(settings.vision_provider_id || '');
    }).catch(() => {});
  }, []);

  const plist = providers ? Object.values(providers.providers) : [];
  const visionProviders = plist.filter((p) => p.vision);
  const effProviderId = providerId || (plist[0] ? plist[0].id : '');
  const effVisionProviderId = visionProviderId || (visionProviders[0] ? visionProviders[0].id : '');

  // providers 变化后，若保存的 id 不存在则回退
  useEffect(() => {
    if (!providers) return;
    if (providerId && !plist.some((p) => p.id === providerId)) setProviderId('');
    if (visionProviderId && !visionProviders.some((p) => p.id === visionProviderId)) setVisionProviderId('');
  }, [providers]);

  const pick = useCallback((f: File) => {
    if (f && /.(mp4|mkv|mov|avi|flv|wmv|webm|m4v|ts)$/i.test(f.name)) setFile(f);
    else onError('不支持的视频格式，支持 mp4 / mkv / mov / avi / flv / wmv / webm');
  }, [onError]);

  const savePrefs = () => {
    api.saveSettings({
      model_size: modelSize === 'auto' ? '' : modelSize,
      video_understanding: vision,
      provider_id: effProviderId,
      vision_provider_id: vision ? effVisionProviderId : '',
      summary_style: style,
    } as UserSettings).catch(() => {});
  };

  const doUpload = async () => {
    if (mode === 'url') {
      if (!url.trim()) return onError('请先粘贴视频链接');
      if (!/^https?:\/\//i.test(url.trim())) return onError('链接需以 http:// 或 https:// 开头');
      setUploading(true);
      try {
        const t = await api.upload(null, {
          model_size: modelSize === 'auto' ? '' : modelSize,
          video_understanding: vision,
          provider_id: effProviderId,
          vision_provider_id: vision ? effVisionProviderId : '',
          summary_style: style,
          video_url: url.trim(),
        });
        savePrefs();
        onUploaded(t);
      } catch (e) {
        onError((e as Error).message);
      } finally {
        setUploading(false);
      }
      return;
    }
    if (!file) return onError('请先选择视频文件');
    setUploading(true);
    try {
      const t = await api.upload(file, {
        model_size: modelSize === 'auto' ? '' : modelSize,
        video_understanding: vision,
        provider_id: effProviderId,
        vision_provider_id: vision ? effVisionProviderId : '',
        summary_style: style,
      });
      savePrefs();
      onUploaded(t);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const tabCls = (active: boolean) =>
    'flex-1 py-2 rounded-[9px] text-[13px] font-medium transition-all duration-300 ' +
    (active ? 'bg-white text-[#C4785A] shadow-sm' : 'text-[#8C8C8C] hover:text-[#2C2C2C]');

  return (
    <div className='space-y-8'>
      {/* 来源切换 + 上传区 */}
      <div>
        <div className='flex rounded-[12px] bg-[#F1EAE0] p-1 mb-4 max-w-[320px]'>
          <button onClick={() => setMode('file')} className={tabCls(mode === 'file')}>
            <span className='inline-flex items-center gap-1.5'><UploadIcon size={14} /> 本地上传</span>
          </button>
          <button onClick={() => setMode('url')} className={tabCls(mode === 'url')}>
            <span className='inline-flex items-center gap-1.5'><LinkIcon size={14} /> 视频链接</span>
          </button>
        </div>

        {mode === 'file' ? (
          <motion.div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); }}
            animate={{ scale: dragging ? 1.008 : 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={'upload-card p-10 md:p-12 text-center cursor-pointer ' + (dragging ? 'dragging' : '')}
          >
            <input ref={inputRef} type='file' accept='.mp4,.mkv,.mov,.avi,.flv,.wmv,.webm,.m4v,.ts' hidden
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className='w-16 h-16 mx-auto mb-5 rounded-[20px] bg-gradient-to-br from-[#C4785A] to-[#D8A48F] flex items-center justify-center text-white shadow-[0_10px_30px_rgba(196,120,90,0.35)]'
            >
              <UploadIcon size={28} />
            </motion.div>
            <p className='eyebrow mb-3'>Upload Video</p>
            {file ? (
              <div>
                <p className='text-[19px] font-semibold text-[#2C2C2C] tracking-[-0.01em]'>{file.name}</p>
                <p className='text-sm text-[#8C8C8C] mt-1.5'>{((file.size) / 1024 / 1024).toFixed(1)} MB · 点击可重新选择</p>
              </div>
            ) : (
              <div>
                <p className='text-[20px] font-semibold text-[#2C2C2C] tracking-[-0.01em]'>拖拽视频到这里，或点击选择文件</p>
                <p className='text-sm text-[#8C8C8C] mt-2'>支持 mp4 / mkv / mov / avi 等常见格式 · 视频在本地处理</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className='upload-card p-10 md:p-12 text-center'
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className='w-16 h-16 mx-auto mb-5 rounded-[20px] bg-gradient-to-br from-[#B8A089] to-[#C9B49A] flex items-center justify-center text-white shadow-[0_10px_30px_rgba(184,160,137,0.35)]'
            >
              <LinkIcon size={28} />
            </motion.div>
            <p className='eyebrow mb-3'>Online Video</p>
            <input
              className='w-full max-w-xl mx-auto block px-4 py-3 rounded-[12px] bg-white/80 border border-[#E8E2D9] text-[14px] text-[#2C2C2C] placeholder-[#B8B2A8] outline-none focus:border-[#C4785A] focus:ring-2 focus:ring-[rgba(196,120,90,0.15)] transition-all duration-300'
              placeholder='粘贴视频链接，如 http://cxauo.site:8889/view/…/039 5.1.3 树的性质.mp4'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className='text-sm text-[#8C8C8C] mt-4'>
              支持服务器视频库链接（自动匹配本地文件，秒级开始）与任意 http(s) 视频直链（下载后分析）
            </p>
          </motion.div>
        )}
      </div>

      {/* 折叠参数 */}
      <div className='space-y-5'>
        <Accordion title='识别模型' icon={<LayersIcon size={18} />} badge={modelSize === 'auto' ? '自动' : modelSize}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <label className='block'>
              <span className='text-[13px] text-[#8C8C8C] block mb-2'>Whisper 模型（auto 按 CPU/GPU 自动选择）</span>
              <select className='select-line' value={modelSize} onChange={(e) => setModelSize(e.target.value)}>
                <option value='auto'>auto（自动）</option>
                {providers?.model_sizes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <p className='text-[13px] text-[#B8B2A8] flex items-end pb-2'>GPU 默认 large/medium · 纯 CPU 默认 small，速度与准确率的平衡</p>
          </div>
        </Accordion>

        <Accordion title='总结设置' icon={<SparkleIcon size={18} />} badge={style}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <label className='block'>
              <span className='text-[13px] text-[#8C8C8C] block mb-2'>总结风格</span>
              <select className='select-line' value={style} onChange={(e) => setStyle(e.target.value)}>
                {STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className='block'>
              <span className='text-[13px] text-[#8C8C8C] block mb-2'>总结模型</span>
              <select className='select-line' value={effProviderId} onChange={(e) => setProviderId(e.target.value)}>
                {plist.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.model}</option>)}
              </select>
            </label>
          </div>
        </Accordion>

        <Accordion title='画面理解' icon={<ImageIcon size={18} />} badge={vision ? '已开启' : '关闭'}>
          <div className='space-y-5'>
            <div className='flex items-center gap-4'>
              <button
                onClick={() => setVision(!vision)}
                className={'relative w-[46px] h-6 rounded-full transition-colors duration-300 ' + (vision ? 'bg-[#C4785A]' : 'bg-[#E8E2D9]')}
              >
                <motion.span
                  animate={{ left: vision ? 22 : 3 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className='absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)]'
                />
              </button>
              <span className='text-sm text-[#3D3D3D]'>{vision ? '已开启：按字幕时间戳定位关键帧' : '识别 PPT / 图表 / 代码 / 屏幕内容并配图'}</span>
            </div>
            <label className='block'>
              <span className='text-[13px] text-[#8C8C8C] block mb-2'>视觉模型（需支持图片输入）</span>
              <select className='select-line' value={effVisionProviderId} onChange={(e) => setVisionProviderId(e.target.value)} disabled={!vision}>
                {visionProviders.length ? visionProviders.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.model}</option>) : <option value=''>（无视觉模型，请到 API 设置添加）</option>}
              </select>
            </label>
          </div>
        </Accordion>
      </div>

      {/* 开始按钮 */}
      <div className='flex justify-center pt-2'>
        <motion.button
          onClick={doUpload}
          disabled={uploading || (mode === 'file' ? !file : !url.trim())}
          whileHover={!uploading && (mode === 'file' ? !!file : !!url.trim()) ? { scale: 1.02 } : {}}
          whileTap={!uploading && (mode === 'file' ? !!file : !!url.trim()) ? { scale: 0.98 } : {}}
          transition={{ duration: 0.3, ease: EASE }}
          className='btn-primary flex items-center gap-2 min-w-[220px] justify-center'
        >
          {uploading ? <span className='inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin' /> : <PlayIcon size={17} />}
          {uploading ? '正在提交…' : mode === 'url' ? '开始解析链接视频' : '开始解析视频'}
        </motion.button>
      </div>
    </div>
  );
}
