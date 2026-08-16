import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadZone from '../components/UploadZone';
import { api, Task, ProvidersResp } from '../lib/api';
import { FilmIcon, TrashIcon, CheckIcon, CloseIcon, SparkleIcon } from '../components/Icons';

const EASE = [0.4, 0, 0.2, 1] as const;

interface Props { onOpenTask: (id: string) => void }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '排队中', cls: 'badge-oat' },
  running: { label: '分析中', cls: 'badge' },
  done: { label: '已完成', cls: 'bg-[rgba(110,150,120,0.12)] text-[#4F7A5E] text-[12px] px-3 py-1 rounded-full font-medium' },
  failed: { label: '失败', cls: 'bg-[rgba(180,90,80,0.12)] text-[#A85B4E] text-[12px] px-3 py-1 rounded-full font-medium' },
};

export default function Home({ onOpenTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [providers, setProviders] = useState<ProvidersResp | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setTasks(await api.tasks()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    api.providers().then(setProviders).catch(() => {});
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const doDelete = async (id: string) => {
    if (!window.confirm('确定删除这条分析记录吗？视频副本与关键帧将一并清理。')) return;
    try {
      await api.deleteTask(id);
      flash('ok', '已删除');
      refresh();
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  return (
    <div>
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={'fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl card flex items-center gap-2 text-sm ' + (msg.type === 'ok' ? 'text-[#4F7A5E]' : 'text-[#A85B4E]')}
          >
            {msg.type === 'ok' ? <CheckIcon size={16} /> : <CloseIcon size={16} />}
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className='text-center pt-6 pb-14'
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          className='eyebrow mb-4'
        >AI Video Insight</motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.14 }}
          className='h-display text-[#2C2C2C] mb-4'
        >
          看懂每一个视频<span className='text-warm'>，只花一分钟</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
          className='body-text max-w-xl mx-auto'
        >
          自动转写 · AI 总结 · 章节脉络 · 关键画面识别，把视频变成一份可翻阅的笔记
        </motion.p>
      </motion.section>

      <UploadZone providers={providers} onUploaded={() => { flash('ok', '已提交，正在后台解析'); refresh(); }} onError={(m) => flash('err', m)} />

      {/* 记录列表 */}
      <section className='pt-20 md:pt-24'>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          className='flex items-end justify-between mb-8'
        >
          <div>
            <p className='eyebrow mb-2'>History</p>
            <h3 className='h-section text-[#2C2C2C] flex items-center gap-2.5'>
              <FilmIcon size={20} className='text-[#C4785A]' /> 分析记录
            </h3>
          </div>
          <button onClick={refresh} className='btn-ghost'>刷新</button>
        </motion.div>

        {tasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.16 }}
            className='card p-16 text-center'
          >
            <SparkleIcon size={30} className='text-[#C8B8A8] mx-auto mb-4' />
            <p className='text-[#8C8C8C]'>还没有分析记录，上传一个视频开始吧</p>
          </motion.div>
        ) : (
          <div className='space-y-4'>
            <AnimatePresence initial={false}>
              {tasks.map((t, i) => {
                const meta = STATUS_META[t.status] || STATUS_META.pending;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
                    className='card card-hover p-6'
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <button onClick={() => onOpenTask(t.id)} className='flex-1 text-left min-w-0'>
                        <div className='flex items-center gap-2.5 mb-1.5 flex-wrap'>
                          <span className={meta.cls}>{meta.label}</span>
                          <span className='text-xs text-[#B8B2A8]'>{t.created_at}</span>
                        </div>
                        <p className='font-medium text-[#2C2C2C] truncate'>{t.filename}</p>
                        {t.status === 'done' && t.result?.summary && (
                          <p className='text-sm text-[#8C8C8C] mt-1 truncate'>
                            <span className='font-semibold text-[#C4785A]'>{t.result.summary.title}</span>
                          </p>
                        )}
                      </button>
                      <button
                        onClick={() => doDelete(t.id)}
                        title='删除记录'
                        className='p-2.5 rounded-[10px] text-[#C8B8A8] hover:text-[#A85B4E] hover:bg-[rgba(180,90,80,0.08)] transition-all duration-300 shrink-0'
                      >
                        <TrashIcon size={17} />
                      </button>
                    </div>
                    {(t.status === 'running' || t.status === 'pending') && (
                      <div className='mt-4'>
                        <div className='h-1 rounded-full bg-[#F0EAE1] overflow-hidden'>
                          <motion.div
                            className='h-full rounded-full bg-gradient-to-r from-[#C4785A] to-[#D8A48F]'
                            animate={{ width: t.progress + '%' }}
                            transition={{ duration: 0.8, ease: EASE }}
                          />
                        </div>
                        <p className='text-xs text-[#8C8C8C] mt-2'>{t.stage} · {t.progress}%</p>
                      </div>
                    )}
                    {t.status === 'failed' && t.error && (
                      <p className='text-xs text-[#A85B4E] mt-2'>{(t.error as string).slice(0, 120)}</p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}