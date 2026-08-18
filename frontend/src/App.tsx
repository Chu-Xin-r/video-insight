import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Home from './pages/Home';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { SettingsIcon, FilmIcon, TrashIcon, UserIcon } from './components/Icons';
import { api, Task, UserInfo, getToken, setToken } from './lib/api';

type View = 'home' | 'detail' | 'settings';

const EASE = [0.4, 0, 0.2, 1] as const;

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-[#D8C4A8]',
  running: 'bg-[#C4785A] animate-pulse',
  done: 'bg-[#6E9678]',
  failed: 'bg-[#A85B4E]',
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [taskId, setTaskId] = useState<string>('');
  const [health, setHealth] = useState<{ cuda: boolean; default_model: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 登录态初始化
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthChecked(true); return; }
    api.me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // 401 事件 → 登出
  useEffect(() => {
    const h = () => { setUser(null); setView('home'); };
    window.addEventListener('vi:unauthorized', h);
    return () => window.removeEventListener('vi:unauthorized', h);
  }, []);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = () => api.tasks().then(setTasks).catch(() => {});
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [user]);

  const openTask = (id: string) => { setTaskId(id); setView('detail'); };

  const doDelete = async (id: string) => {
    if (!window.confirm('确定删除这条分析记录吗？视频副本与关键帧将一并清理。')) return;
    try {
      await api.deleteTask(id);
      setTasks((ts) => ts.filter((t) => t.id !== id));
      if (taskId === id) setView('home');
    } catch { /* ignore */ }
  };

  const doLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    setView('home');
  };

  const navCls = (active: boolean) =>
    'w-full px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all duration-300 flex items-center gap-2.5 ' +
    (active
      ? 'text-[#C4785A] bg-[rgba(196,120,90,0.1)]'
      : 'text-[#8C8C8C] hover:text-[#2C2C2C] hover:bg-[#F1EAE0]');

  // 登录检查
  if (!authChecked) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-[#FAF7F2]'>
        <span className='badge-oat'>正在载入…</span>
      </div>
    );
  }
  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setView('home'); }} />;
  }

  return (
    <div className='min-h-screen md:flex'>
      {/* ===== 左侧边栏（桌面端） ===== */}
      <aside className='hidden md:flex md:flex-col w-[296px] shrink-0 h-screen sticky top-0 bg-[#FBF8F3] border-r border-[#EDE8E0] p-6 overflow-y-auto'>
        <motion.button
          onClick={() => setView('home')}
          className='flex items-center gap-3 group mb-6'
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <span className='w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(196,120,90,0.35)]'>
            <FilmIcon size={21} />
          </span>
          <div className='text-left'>
            <h1 className='text-[16px] font-semibold text-[#2C2C2C] tracking-[-0.02em] leading-tight'>视频洞察 <span className='text-[#C4785A] font-semibold'>VideoInsight</span></h1>
            <p className='text-[11px] text-[#8C8C8C] mt-0.5'>AI 课程解析 · 本地部署</p>
          </div>
        </motion.button>

        {health && (
          <span className='badge-oat self-start mb-5'>
            {health.cuda ? 'GPU 加速' : 'CPU 推理'} · {health.default_model}
          </span>
        )}

        <nav className='space-y-1.5 mb-7'>
          <button onClick={() => setView('home')} className={navCls(view === 'home')}>
            <span className='w-2 h-2 rounded-full bg-[#C4785A] shrink-0' /> 分析
          </button>
          <button onClick={() => setView('settings')} className={navCls(view === 'settings')}>
            <SettingsIcon size={15} /> API 设置
          </button>
        </nav>

        <div className='flex items-center justify-between mb-3'>
          <p className='eyebrow !mb-0'>课程记录</p>
          <span className='text-[11px] text-[#B8B2A8]'>{tasks.length} 条</span>
        </div>
        <div className='space-y-2 flex-1 min-h-0'>
          {tasks.length === 0 ? (
            <p className='text-[12px] text-[#B8B2A8] py-6 text-center'>暂无记录，上传视频开始</p>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => openTask(t.id)}
                className={
                  'group rounded-[12px] px-3.5 py-3 cursor-pointer transition-all duration-300 border ' +
                  (view === 'detail' && taskId === t.id
                    ? 'bg-[rgba(196,120,90,0.07)] border-[rgba(196,120,90,0.28)]'
                    : 'bg-white/60 border-[#EDE8E0] hover:border-[rgba(196,120,90,0.32)] hover:shadow-[0_2px_10px_rgba(139,119,101,0.06)]')
                }
              >
                <div className='flex items-center gap-2 mb-1'>
                  <span className={'w-1.5 h-1.5 rounded-full shrink-0 ' + (STATUS_DOT[t.status] || STATUS_DOT.pending)} />
                  <span className='text-[11px] text-[#B8B2A8] truncate'>{t.created_at}</span>
                  <span className='ml-auto text-[10px] shrink-0'>
                    {t.status === 'done' && <span className='text-[#6E9678]'>完成</span>}
                    {t.status === 'running' && <span className='text-[#C4785A]'>分析中</span>}
                    {t.status === 'failed' && <span className='text-[#A85B4E]'>失败</span>}
                    {t.status === 'pending' && <span className='text-[#B8A089]'>排队</span>}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-1'>
                  <p className='text-[13px] font-medium text-[#2C2C2C] truncate'>{t.filename}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); doDelete(t.id); }}
                    title='删除记录'
                    className='opacity-0 group-hover:opacity-100 p-1.5 rounded-[8px] text-[#C8B8A8] hover:text-[#A85B4E] hover:bg-[rgba(180,90,80,0.08)] transition-all duration-300 shrink-0'
                  ><TrashIcon size={14} /></button>
                </div>
                {t.status === 'done' && t.result?.summary && (
                  <p className='text-[12px] text-[#C4785A] truncate mt-0.5'>{t.result.summary.title}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* 当前账号 */}
        <div className='mt-4 pt-4 border-t border-[#EDE8E0] flex items-center justify-between'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='w-8 h-8 rounded-[10px] bg-[#F1EAE0] text-[#C4785A] flex items-center justify-center shrink-0'>
              <UserIcon size={15} />
            </span>
            <div className='min-w-0'>
              <p className='text-[13px] font-medium text-[#2C2C2C] truncate'>{user.username}</p>
              <p className='text-[10px] text-[#B8B2A8]'>{user.is_admin ? '管理员' : '普通账号'}</p>
            </div>
          </div>
          <button
            onClick={doLogout}
            className='text-[11px] text-[#8C8C8C] hover:text-[#A85B4E] px-2 py-1 rounded-[8px] hover:bg-[rgba(180,90,80,0.06)] transition-all duration-300 shrink-0'
          >退出</button>
        </div>
      </aside>

      {/* ===== 右侧主区 ===== */}
      <div className='flex-1 min-w-0 flex flex-col'>
        {/* 移动端顶栏 */}
        <header className='md:hidden sticky top-0 z-10 backdrop-blur-md bg-[rgba(250,247,242,0.85)] border-b border-[#EDE8E0]'>
          <div className='px-4 py-3 flex items-center justify-between'>
            <button onClick={() => setView('home')} className='flex items-center gap-2'>
              <span className='w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white'>
                <FilmIcon size={17} />
              </span>
              <span className='font-semibold text-[15px] text-[#2C2C2C]'>视频洞察</span>
            </button>
            <div className='flex items-center gap-1.5'>
              <button onClick={() => setView('settings')} className={navCls(view === 'settings') + ' !w-auto'}>
                <SettingsIcon size={15} /> API
              </button>
              <button
                onClick={doLogout}
                title='退出登录'
                className='p-2 rounded-[10px] text-[#8C8C8C] hover:text-[#A85B4E] hover:bg-[rgba(180,90,80,0.06)] transition-all duration-300'
              >退出</button>
            </div>
          </div>
        </header>

        <main className={'flex-1 w-full mx-auto px-5 md:px-10 py-8 md:py-12 ' + (view === 'detail' ? 'max-w-7xl' : 'max-w-5xl')}>
          {view === 'home' && <Home onOpenTask={openTask} />}
          {view === 'detail' && <TaskDetail taskId={taskId} onBack={() => setView('home')} />}
          {view === 'settings' && <Settings />}
        </main>

        <footer className='text-center text-[12px] text-[#B8B2A8] py-8 tracking-[0.02em]'>
          本地部署 · 视频文件不离开服务器 · 仅文字稿与关键帧发送至所配置的 AI API
        </footer>
      </div>
    </div>
  );
}
