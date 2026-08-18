import { useState } from 'react';
import { motion } from 'framer-motion';
import { FilmIcon, LockIcon, UserIcon } from '../components/Icons';
import { api, setToken, UserInfo } from '../lib/api';

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Login({ onLogin }: { onLogin: (u: UserInfo) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!username.trim() || !password) { setErr('请输入用户名和密码'); return; }
    if (mode === 'register' && password !== confirm) { setErr('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.register(username.trim(), password);
        setMode('login');
        setErr('');
        setPassword('');
        setConfirm('');
      } else {
        const r = await api.login(username.trim(), password);
        setToken(r.token);
        onLogin(r.user);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-[12px] bg-white/70 border border-[#E8E2D9] text-[14px] text-[#2C2C2C] placeholder-[#B8B2A8] outline-none focus:border-[#C4785A] focus:ring-2 focus:ring-[rgba(196,120,90,0.15)] transition-all duration-300';

  return (
    <div className='min-h-screen flex items-center justify-center px-5 bg-[#FAF7F2] relative overflow-hidden'>
      {/* 装饰 */}
      <div className='absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[rgba(196,120,90,0.08)] blur-2xl' />
      <div className='absolute -bottom-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-[rgba(184,160,137,0.1)] blur-3xl' />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className='relative w-full max-w-[400px]'
      >
        <div className='flex flex-col items-center mb-8'>
          <motion.span
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3, ease: EASE }}
            className='w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#C4785A] to-[#B8A089] flex items-center justify-center text-white shadow-[0_8px_24px_rgba(196,120,90,0.35)]'
          >
            <FilmIcon size={28} />
          </motion.span>
          <h1 className='mt-4 text-[22px] font-semibold text-[#2C2C2C] tracking-[-0.02em]'>
            视频洞察 <span className='text-[#C4785A]'>VideoInsight</span>
          </h1>
          <p className='mt-1 text-[13px] text-[#8C8C8C]'>AI 课程解析 · 多账号独立配置</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
          className='bg-white/70 backdrop-blur border border-[#EDE8E0] rounded-[20px] p-7 shadow-[0_16px_40px_rgba(139,119,101,0.08)]'
        >
          <div className='flex rounded-[12px] bg-[#F1EAE0] p-1 mb-6'>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(''); }}
                className={
                  'flex-1 py-2 rounded-[9px] text-[13px] font-medium transition-all duration-300 ' +
                  (mode === m ? 'bg-white text-[#C4785A] shadow-sm' : 'text-[#8C8C8C] hover:text-[#2C2C2C]')
                }
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className='space-y-4'>
            <div className='relative'>
              <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8B2A8]'><UserIcon size={16} /></span>
              <input
                className={inputCls + ' pl-10'}
                placeholder='用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className='relative'>
              <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8B2A8]'><LockIcon size={16} /></span>
              <input
                className={inputCls + ' pl-10'}
                type='password'
                placeholder='密码'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {mode === 'register' && (
              <div className='relative'>
                <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8B2A8]'><LockIcon size={16} /></span>
                <input
                  className={inputCls + ' pl-10'}
                  type='password'
                  placeholder='确认密码'
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            )}

            {err && <p className='text-[12px] text-[#A85B4E]'>{err}</p>}

            <motion.button
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              disabled={busy}
              className='w-full py-3 rounded-[12px] bg-gradient-to-r from-[#C4785A] to-[#B07255] text-white text-[14px] font-medium shadow-[0_6px_18px_rgba(196,120,90,0.3)] disabled:opacity-60 transition-all duration-300'
            >
              {busy ? '请稍候…' : mode === 'login' ? '登录' : '创建账号'}
            </motion.button>
          </form>

          {mode === 'login' && (
            <p className='mt-5 text-center text-[12px] text-[#8C8C8C]'>
              还没有账号？<button onClick={() => setMode('register')} className='text-[#C4785A] font-medium hover:underline'>注册一个</button>
            </p>
          )}
          {mode === 'register' && (
            <p className='mt-4 text-[11px] text-[#B8B2A8] text-center leading-relaxed'>
              首个注册的账号将成为管理员，自动继承服务器已配置的 API
            </p>
          )}
        </motion.div>

        <p className='mt-6 text-center text-[11px] text-[#B8B2A8]'>本地部署 · 视频文件不离开服务器</p>
      </motion.div>
    </div>
  );
}
