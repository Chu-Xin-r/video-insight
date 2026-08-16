import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Task, fmtTime } from '../lib/api';
import { DocIcon, ImageIcon, ClockIcon, SparkleIcon, ChevronDownIcon, CloseIcon, LayersIcon } from '../components/Icons';

const EASE = [0.4, 0, 0.2, 1] as const;

interface Props { taskId: string; onBack: () => void }

export default function TaskDetail({ taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [imgErr, setImgErr] = useState<Record<number, boolean>>({});

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
    return () => { alive = false; };
  }, [taskId]);

  if (!task) {
    return (
      <div className='flex items-center justify-center py-40'>
        <span className='w-7 h-7 border-2 border-[#C4785A]/25 border-t-[#C4785A] rounded-full animate-spin' />
      </div>
    );
  }

  const r = task.result;
  const st = task.status;

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

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className='card p-7'
      >
        <div className='flex items-center gap-4'>
          <span className='w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(196,120,90,0.3)]'>
            <DocIcon size={20} />
          </span>
          <div className='min-w-0'>
            <h1 className='text-[19px] font-semibold text-[#2C2C2C] tracking-[-0.01em] truncate'>{task.filename}</h1>
            <p className='text-xs text-[#8C8C8C] mt-1'>
              {task.created_at}
              {task.status === 'done' && r && ' · ' + fmtTime(r.duration || 0) + ' · ' + (r.language || '') + ' · ' + (r.device || '') + ' · ' + (r.model || '')}
            </p>
          </div>
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
        </div>
      )}

      {st === 'done' && r?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className='space-y-6'
        >
          {/* 摘要 */}
          <div className='card p-8'>
            <div className='flex items-start justify-between gap-4 flex-wrap'>
              <div>
                <p className='eyebrow mb-3'>Summary</p>
                <h2 className='text-[26px] font-semibold text-warm tracking-[-0.02em] mb-5 leading-snug'>{r.summary.title}</h2>
              </div>
              <div className='flex gap-2 shrink-0 pt-1'>
                <a href={'/api/tasks/' + taskId + '/export/text'} className='btn-outline !py-2 !px-4 !text-[13px]'>文字稿</a>
                <a href={'/api/tasks/' + taskId + '/export/report'} className='btn-outline !py-2 !px-4 !text-[13px]'>报告</a>
                <a href={'/api/tasks/' + taskId + '/export/zip'} className='btn-primary !py-2 !px-4 !text-[13px]'>打包下载</a>
              </div>
            </div>
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

          {/* 章节 */}
          {r.summary.chapters && r.summary.chapters.length > 0 && (
            <div className='card p-8'>
              <p className='eyebrow mb-3'>Chapters</p>
              <h3 className='h-section text-[#2C2C2C] mb-7 flex items-center gap-2'>
                <LayersIcon size={19} className='text-[#C4785A]' /> 章节脉络
              </h3>
              <div className='relative pl-6 border-l border-[#E8D5C4] space-y-6'>
                {r.summary.chapters.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
                    className='relative'
                  >
                    <span className='absolute -left-[29px] top-1 chapter-dot' />
                    <div className='flex flex-wrap items-center gap-2.5 mb-1.5'>
                      <span className='font-medium text-[#2C2C2C]'>{c.title}</span>
                      <span className='badge-oat'>{fmtTime(c.start)}</span>
                    </div>
                    {c.points && c.points.length > 0 && (
                      <ul className='space-y-1.5 text-sm text-[#3D3D3D]'>
                        {c.points.map((pt, j) => <li key={j} className='flex gap-2'><span className='text-[#C4785A]/70 mt-0.5'>·</span>{pt}</li>)}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 帧图 */}
          {r.frames && r.frames.length > 0 && (
            <div className='card p-8'>
              <p className='eyebrow mb-3'>Visual Frames</p>
              <h3 className='h-section text-[#2C2C2C] mb-7 flex items-center gap-2'>
                <ImageIcon size={19} className='text-[#C4785A]' /> 关键画面
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
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
                        className='w-full aspect-video object-cover transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.02]'
                        onError={() => setImgErr((p) => ({ ...p, [i]: true }))}
                      />
                    ) : (
                      <div className='w-full aspect-video flex items-center justify-center text-[#C8B8A8]'><ImageIcon size={26} /></div>
                    )}
                    <figcaption className='p-4'>
                      <span className='badge-oat'><ClockIcon size={11} /> {fmtTime(f.time)}</span>
                      <p className='text-[13.5px] text-[#3D3D3D] mt-2.5 leading-relaxed'>{f.context || f.description}</p>
                    </figcaption>
                  </motion.figure>
                ))}
              </div>
            </div>
          )}

          {/* 文字稿 */}
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
                    <div className='px-8 pb-8 space-y-2 max-h-[480px] overflow-y-auto'>
                      {r.segments && r.segments.map((s, i) => (
                        <div key={i} className='flex gap-3 text-sm'>
                          <span className='text-[#C4785A]/70 text-xs mt-0.5 shrink-0'>{fmtTime(s.start)}</span>
                          <span className='text-[#3D3D3D]/85'>{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}