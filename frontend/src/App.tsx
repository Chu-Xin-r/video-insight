import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Home from './pages/Home';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';
import { SettingsIcon, FilmIcon } from './components/Icons';

type View = 'home' | 'detail' | 'settings';

const EASE = [0.4, 0, 0.2, 1] as const;

export default function App() {
  const [view, setView] = useState<View>('home');
  const [taskId, setTaskId] = useState<string>('');
  const [health, setHealth] = useState<{ cuda: boolean; default_model: string } | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const openTask = (id: string) => { setTaskId(id); setView('detail'); };

  const navCls = (active: boolean) =>
    'px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ' +
    (active
      ? 'text-[#C4785A] bg-[rgba(196,120,90,0.1)]'
      : 'text-[#8C8C8C] hover:text-[#2C2C2C] hover:bg-[#F1EAE0]');

  return (
    <div className='min-h-screen'>
      <header className='sticky top-0 z-10 backdrop-blur-md bg-[rgba(250,247,242,0.82)] border-b border-[#EDE8E0]'>
        <div className='mx-auto max-w-6xl px-6 py-4 flex items-center justify-between'>
          <motion.button
            onClick={() => setView('home')}
            className='flex items-center gap-3 group'
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <span className='w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(196,120,90,0.35)]'>
              <FilmIcon size={21} />
            </span>
            <div className='text-left'>
              <h1 className='text-[17px] font-semibold text-[#2C2C2C] tracking-[-0.02em] leading-tight'>视频洞察 <span className='text-[#C4785A] font-semibold'>VideoInsight</span></h1>
              <p className='text-[11.5px] text-[#8C8C8C] tracking-[0.02em] mt-0.5'>AI 解析 · 摘要 / 章节 / 画面 / 文字稿</p>
            </div>
          </motion.button>
          <nav className='flex items-center gap-1'>
            {health && (
              <span className='badge-oat mr-2 hidden sm:inline-flex'>
                {health.cuda ? 'GPU 加速' : 'CPU 推理'} · {health.default_model}
              </span>
            )}
            <button onClick={() => setView('home')} className={navCls(view === 'home')}>分析</button>
            <button onClick={() => setView('settings')} className={navCls(view === 'settings')}>
              <SettingsIcon size={15} /> API 设置
            </button>
          </nav>
        </div>
      </header>
      <main className='mx-auto max-w-6xl px-6 py-12 md:py-16'>
        {view === 'home' && <Home onOpenTask={openTask} />}
        {view === 'detail' && <TaskDetail taskId={taskId} onBack={() => setView('home')} />}
        {view === 'settings' && <Settings />}
      </main>
      <footer className='text-center text-[12px] text-[#B8B2A8] py-10 tracking-[0.02em]'>
        本地部署 · 视频文件不离开服务器 · 仅文字稿与关键帧发送至所配置的 AI API
      </footer>
    </div>
  );
}