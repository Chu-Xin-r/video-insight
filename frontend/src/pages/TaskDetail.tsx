import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Task, fmtTime } from '../lib/api';
import { DocIcon, ImageIcon, ClockIcon, SparkleIcon, ChevronDownIcon, CloseIcon, LayersIcon, PlayIcon } from '../components/Icons';

const EASE = [0.4, 0, 0.2, 1] as const;

interface Props { taskId: string; onBack: () => void }

export default function TaskDetail({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [imgErr, setImgErr] = useState<Record<number, boolean>>({});
  const [lightbox, setLightbox] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [askQ, setAskQ] = useState('');
  const [askRes, setAskRes] = useState<{ answer: string; refs: { time: number; text: string }[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [activeSeg, setActiveSeg] = useState(-1);
  const segRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeSegRef = useRef(-1);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const t = await api.task(taskId);
        if (!alive) return;
        setTask(t);
        if (t.status === 'running' || t.status === 'pending') setTimeout(poll, 2000);
      } catch { /* ignore */ }
    };
    poll();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => { alive = false; window.removeEventListener('keydown', onKey); };
  }, [taskId]);

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Math.max(0, t);
      v.play().catch(() => {});
      // 移动端：滚动回播放器，保证跳转可见
      if (window.innerWidth < 768) {
        v.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // 视频播放 → 文字稿/章节联动高亮 + 自动滚动
  const onVideoTime = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurTime(t);
    const segs = (task?.result?.segments || []);
    let idx = -1;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (t >= (s.start || 0) && t < (s.end ?? t + 120)) { idx = i; break; }
    }
    if (idx !== -1 && idx !== activeSegRef.current) {
      activeSegRef.current = idx;
      setActiveSeg(idx);
      segRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const doRetry = async () => {
    if (!window.confirm('重新分析该视频？将复用已下载的视频重新跑一遍。')) return;
    setRetrying(true);
    try {
      const t = await api.retry(taskId);
      setTask(t);
    } catch (e) {
      alert((e as Error).message);
    } finally { setRetrying(false); }
  };

  const doAsk = async () => {
    if (!askQ.trim()) return;
    setAsking(true);
    setAskRes(null);
    try {
      const r = await api.ask(taskId, askQ.trim());
      setAskRes(r);
    } catch (e) {
      alert((e as Error).message);
    } finally { setAsking(false); }
  };

  if (!task) {
    return (
      <div className='flex items-center justify-center py-40'>
        <span className='w-7 h-7 border-2 border-[#C4785A]/25 border-t-[#C4785A] rounded-full animate-spin' />
      </div>
    );
  }

  const r = task.result;
  const st = task.status;
  const chapters = r?.summary?.chapters || [];
  const segs = r?.segments || [];
  const activeCh = chapters.findIndex((c, i) => {
    const nextStart = i + 1 < chapters.length ? (chapters[i + 1].start ?? Infinity) : Infinity;
    return curTime >= (c.start ?? 0) && curTime < nextStart;
  });

  return (
    <div className='space-y-6'>
      <motion.button
        onClick={onBack}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className='btn-ghost flex items-center gap-1 pl-0'
      >
        <ChevronDownIcon size={16} className='rotate-90' /> 返回列表
      </motion.button>

      {/* 标题信息（全宽） */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className='card p-6 md:p-7'
      >
        <div className='flex items-center gap-4'>
          <span className='w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(196,120,90,0.3)]'>
            <DocIcon size={20} />
          </span>
          <div className='min-w-0 flex-1'>
            <h1 className='text-[19px] font-semibold text-[#2C2C2C] tracking-[-0.01em] truncate'>{task.filename}</h1>
            <p className='text-xs text-[#8C8C8C] mt-1'>
              {task.created_at}
              {task.status === 'done' && r && ' · ' + fmtTime(r.duration || 0) + ' · ' + (r.language || '') + ' · ' + (r.device || '') + ' · ' + (r.model || '')}
            </p>
          </div>
          {st === 'done' && r && (
            <div className='flex gap-2 shrink-0'>
              <a href={api.exportUrl(taskId, 'text')} className='btn-outline !py-2 !px-4 !text-[13px]'>文字稿</a>
              <a href={api.exportUrl(taskId, 'report')} className='btn-outline !py-2 !px-4 !text-[13px]'>报告</a>
              <a href={api.exportUrl(taskId, 'zip')} className='btn-primary !py-2 !px-4 !text-[13px]'>打包下载</a>
            </div>
          )}
        </div>
      </motion.div>

      {st === 'running' && (
        <div className='card p-14 text-center'>
          <div className='w-14 h-14 mx-auto mb-5 rounded-full border-2 border-[#C4785A]/20 border-t-[#C4785A] animate-spin' />
          <p className='text-[17px] font-medium text-[#2C2C2C]'>{task.stage || '处理中…'}</p>
          <p className='text-sm text-[#8C8C8C] mt-2'>请保持页面打开，完成后自动展示结果</p>
          <div className='mt-7 h-1.5 rounded-full bg-[#F0EAE1] overflow-hidden mx-auto max-w-md'>
            <motion.div
              className='h-full bg-gradient-to-r from-[#C4785A] to-[#D8A48F] rounded-full'
              animate={{ width: task.progress + '%' }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </div>
          <p className='text-sm text-[#C4785A] mt-2.5'>{task.progress}%</p>
        </div>
      )}

      {st === 'failed' && (
        <div className='card p-12 text-center'>
          <CloseIcon size={30} className='text-[#A85B4E] mx-auto mb-3' />
          <p className='font-medium text-[#2C2C2C]'>分析失败</p>
          <p className='text-sm text-[#A85B4E] mt-2 break-all'>{task.error}</p>
          <button
            onClick={doRetry}
            disabled={retrying}
            className='btn-primary mt-6 inline-flex items-center gap-2 disabled:opacity-60'
          >
            {retrying ? <span className='inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin' /> : <PlayIcon size={16} />}
            {retrying ? '正在重新分析…' : '重新分析（复用已下载视频）'}
          </button>
        </div>
      )}

      {st === 'done' && r?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className='md:flex md:items-start md:gap-6'
        >
          {/* ===== 左列：固定播放器 + 快速提问 ===== */}
          <div className='md:sticky md:top-0 md:w-[55%] md:shrink-0 md:max-h-[calc(100vh-1.5rem)] md:overflow-y-auto space-y-4'>
            <div className='card p-3 md:p-4'>
              <video
                ref={videoRef}
                src={api.videoUrl(taskId)}
                controls
                preload='metadata'
                onTimeUpdate={onVideoTime}
                className='w-full max-h-[64vh] rounded-[12px] bg-black'
              />
              <p className='text-[12px] text-[#B8B2A8] mt-2.5 text-center leading-relaxed'>
                点右侧章节 / 关键帧 / 文字稿时间 → 视频跳转播放；播放时文字稿自动跟随高亮
              </p>
            </div>

            {/* AI 快速提问（常驻左侧） */}
            {r.text && (
              <div className='card p-5'>
                <p className='eyebrow !mb-2'>Ask AI</p>
                <div className='flex gap-2'>
                  <input
                    value={askQ}
                    onChange={(e) => setAskQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') doAsk(); }}
                    placeholder='向本视频提问…'
                    className='flex-1 min-w-0 px-3.5 py-2.5 rounded-[10px] bg-white/80 border border-[#E8E2D9] text-[13.5px] text-[#2C2C2C] placeholder-[#B8B2A8] outline-none focus:border-[#C4785A] focus:ring-2 focus:ring-[rgba(196,120,90,0.15)] transition-all duration-300'
                  />
                  <motion.button
                    onClick={doAsk}
                    disabled={asking || !askQ.trim()}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className='btn-primary !px-5 !py-2.5 !text-[13.5px] disabled:opacity-50 shrink-0'
                  >
                    {asking ? <span className='inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin' /> : '提问'}
                  </motion.button>
                </div>
                {askRes && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className='mt-4'>
                    <p className='text-[13.5px] leading-relaxed text-[#3D3D3D] whitespace-pre-wrap'>{askRes.answer}</p>
                    {askRes.refs.length > 0 && (
                      <div className='mt-3 flex flex-wrap gap-1.5'>
                        {askRes.refs.map((rf, i) => (
                          <button
                            key={i}
                            onClick={() => seekTo(rf.time)}
                            title={rf.text}
                            className='badge-oat cursor-pointer hover:!bg-[#C4785A] hover:!text-white transition-all duration-300'
                          ><ClockIcon size={11} /> {fmtTime(rf.time)}</button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* ===== 右列：内容区 ===== */}
          <div className='flex-1 min-w-0 space-y-6 mt-6 md:mt-0'>
            {/* 摘要 */}
            <div className='card p-8'>
              <p className='eyebrow mb-3'>Summary</p>
              <h2 className='text-[26px] font-semibold text-warm tracking-[-0.02em] mb-5 leading-snug'>{r.summary.title}</h2>
              <p className='body-text'>{r.summary.summary}</p>
              {r.summary.keywords && r.summary.keywords.length > 0 && (
                <div className='flex flex-wrap gap-2 mt-6'>
                  {r.summary.keywords.map((k, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, ease: EASE, delay: 0.08 + i * 0.05 }}
                      className='badge'
                    >{k}</motion.span>
                  ))}
                </div>
              )}
            </div>

            {/* 章节（点击跳转 + 播放联动高亮） */}
            {chapters.length > 0 && (
              <div className='card p-8'>
                <p className='eyebrow mb-3'>Chapters</p>
                <h3 className='h-section text-[#2C2C2C] mb-7 flex items-center gap-2'>
                  <LayersIcon size={19} className='text-[#C4785A]' /> 章节脉络
                </h3>
                <div className='relative pl-6 border-l border-[#E8D5C4] space-y-6'>
                  {chapters.map((c, i) => {
                    const active = i === activeCh;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
                        className={'relative rounded-[12px] -mx-2 px-2 py-1.5 transition-all duration-300 cursor-pointer ' +
                          (active ? 'bg-[rgba(196,120,90,0.09)]' : 'hover:bg-[#FAF5EE]')}
                        onClick={() => seekTo(c.start)}
                      >
                        <span className={'absolute -left-[29px] top-3.5 transition-colors duration-300 ' + (active ? 'chapter-dot !bg-[#C4785A]' : 'chapter-dot')} />
                        <div className='flex flex-wrap items-center gap-2.5 mb-1.5'>
                          <span className={'font-medium ' + (active ? 'text-[#C4785A]' : 'text-[#2C2C2C]')}>{c.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); seekTo(c.start); }} className='badge-oat cursor-pointer hover:!bg-[#C4785A] hover:!text-white transition-all duration-300'>{fmtTime(c.start)}</button>
                        </div>
                        {c.points && c.points.length > 0 && (
                          <ul className='space-y-1.5 text-sm text-[#3D3D3D]'>
                            {c.points.map((pt, j) => <li key={j} className='flex gap-2'><span className='text-[#C4785A]/70 mt-0.5'>·</span>{pt}</li>)}
                          </ul>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 关键帧 */}
            {r.frames && r.frames.length > 0 && (
              <div className='card p-8'>
                <p className='eyebrow mb-3'>Visual Frames</p>
                <h3 className='h-section text-[#2C2C2C] mb-7 flex items-center gap-2'>
                  <ImageIcon size={19} className='text-[#C4785A]' /> 关键画面
                </h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                  {r.frames.map((f, i) => (
                    <motion.figure
                      key={i}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: EASE, delay: i * 0.07 }}
                      className='rounded-[16px] overflow-hidden bg-[#F7F3EC] shadow-[0_2px_12px_rgba(139,119,101,0.07)]'
                    >
                      {!imgErr[i] ? (
                        <img
                          src={api.taskFile(taskId, f.image)}
                          alt={'关键画面 ' + fmtTime(f.time)}
                          loading='lazy'
                          className='w-full aspect-video object-cover cursor-zoom-in transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.02]' onClick={() => setLightbox(i)}
                          onError={() => setImgErr((p) => ({ ...p, [i]: true }))}
                        />
                      ) : (
                        <div className='w-full aspect-video flex items-center justify-center text-[#C8B8A8]'><ImageIcon size={26} /></div>
                      )}
                      <figcaption className='p-4'>
                        <button onClick={() => seekTo(f.time)} className='badge-oat cursor-pointer hover:!bg-[#C4785A] hover:!text-white transition-all duration-300'><ClockIcon size={11} /> {fmtTime(f.time)}</button>
                        <p className='text-[13.5px] text-[#3D3D3D] mt-2.5 leading-relaxed'>{f.context || f.description}</p>
                      </figcaption>
                    </motion.figure>
                  ))}
                </div>
              </div>
            )}

            {/* 文字稿（播放联动高亮 + 自动滚动） */}
            {r.text && (
              <div className='card overflow-hidden'>
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className='w-full flex items-center justify-between px-8 py-5 hover:bg-[#FAF5EE] transition-colors duration-300'
                >
                  <span className='flex items-center gap-2.5 font-medium text-[#2C2C2C]'>
                    <SparkleIcon size={18} className='text-[#C4785A]' /> 完整文字稿（{r.text.length} 字）
                  </span>
                  <motion.span animate={{ rotate: showTranscript ? 180 : 0 }} transition={{ duration: 0.35, ease: EASE }} className='text-[#B8A089]'>
                    <ChevronDownIcon size={17} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {showTranscript && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className='overflow-hidden'
                    >
                      <div className='px-8 pb-8 space-y-1 max-h-[560px] overflow-y-auto'>
                        {segs.map((s, i) => {
                          const active = i === activeSeg;
                          return (
                            <div
                              key={i}
                              ref={(el) => { segRefs.current[i] = el; }}
                              onClick={() => seekTo(s.start)}
                              className={'flex gap-3 text-sm rounded-[10px] px-2 py-1.5 -mx-2 cursor-pointer transition-all duration-300 ' +
                                (active ? 'bg-[rgba(196,120,90,0.1)]' : 'hover:bg-[#FAF5EE]')}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); seekTo(s.start); }}
                                className={'text-xs mt-0.5 shrink-0 transition-colors duration-300 ' +
                                  (active ? 'text-[#C4785A] font-medium' : 'text-[#C4785A]/70 hover:text-[#C4785A]')}
                              >{fmtTime(s.start)}</button>
                              <span className={'text-[#3D3D3D]' + (active ? '/95' : '/85')}>{s.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 图片灯箱 */}
      <AnimatePresence>
        {lightbox !== null && r.frames[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className='fixed inset-0 z-50 bg-[rgba(28,24,20,0.82)] backdrop-blur-md flex items-center justify-center p-4 md:p-10'
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
              className='absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300'
              aria-label='关闭'
            ><CloseIcon size={20} /></button>
            {lightbox > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
                className='absolute left-3 md:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300'
                aria-label='上一张'
              ><ChevronDownIcon size={20} className='rotate-90' /></button>
            )}
            {lightbox < r.frames.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
                className='absolute right-3 md:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300'
                aria-label='下一张'
              ><ChevronDownIcon size={20} className='-rotate-90' /></button>
            )}
            <motion.figure
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 8, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className='max-w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={api.taskFile(taskId, r.frames[lightbox].image)}
                alt={'关键画面 ' + fmtTime(r.frames[lightbox].time)}
                className='max-w-[88vw] max-h-[76vh] rounded-[14px] shadow-2xl object-contain bg-[#141210]'
              />
              <figcaption className='mt-4 text-center space-y-1'>
                <span className='badge-oat inline-flex'><ClockIcon size={11} /> {fmtTime(r.frames[lightbox].time)} · {(lightbox + 1)}/{r.frames.length}</span>
                <p className='text-[13.5px] text-[#E8E2D9] max-w-2xl mx-auto leading-relaxed'>{r.frames[lightbox].context || r.frames[lightbox].description}</p>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
