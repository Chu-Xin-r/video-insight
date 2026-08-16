import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Provider, ProvidersResp } from '../lib/api';
import { SettingsIcon, TrashIcon, CheckIcon, CloseIcon, ImageIcon, ChevronDownIcon, UploadIcon } from '../components/Icons';

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Settings() {
  const [data, setData] = useState<ProvidersResp | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: '', name: '', base_url: '', api_key: '', model: '', vision: false,
  });

  const load = () => api.providers().then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const doTest = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.testProvider(id);
      flash('ok', '连接成功：' + r.reply.slice(0, 60));
    } catch (e) {
      flash('err', (e as Error).message);
    } finally {
      setTesting(null);
    }
  };

  const doDelete = async (id: string) => {
    if (!window.confirm('确定删除该 API 配置吗？')) return;
    try {
      await api.deleteProvider(id);
      flash('ok', '已删除');
      load();
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  const doSave = async () => {
    if (!form.id || !form.name || !form.base_url || !form.model) {
      return flash('err', '请填写完整（标识 / 名称 / 地址 / 模型）');
    }
    try {
      await api.saveProvider({ ...form, id: form.id.trim(), name: form.name.trim() });
      flash('ok', '已保存');
      setAddOpen(false);
      setForm({ id: '', name: '', base_url: '', api_key: '', model: '', vision: false });
      load();
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  const plist = data ? Object.values(data.providers) : [];

  return (
    <div className='max-w-3xl mx-auto'>
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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className='card p-8 md:p-10'
      >
        <p className='eyebrow mb-3'>AI Providers</p>
        <h2 className='h-section text-[#2C2C2C] flex items-center gap-2.5 mb-2'>
          <SettingsIcon size={21} className='text-[#C4785A]' /> AI 模型配置
        </h2>
        <p className='body-text text-sm mb-9'>支持任意 OpenAI 兼容接口 · Key 仅保存在服务器本地，不对外泄露</p>

        <div className='space-y-4'>
          {plist.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }}
              className='card card-hover p-5 flex items-center justify-between gap-4'
            >
              <div className='min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-[#2C2C2C]'>{p.name}</span>
                  {p.builtin && <span className='badge'>预置</span>}
                  {p.vision && <span className='badge'><ImageIcon size={11} /> 视觉</span>}
                </div>
                <p className='text-xs text-[#8C8C8C] mt-1.5 truncate'>{p.model} · {p.base_url}</p>
                <p className='text-[11px] text-[#B8B2A8] mt-0.5'>Key: {p.api_key_hint || '未设置'}</p>
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                <button
                  onClick={() => doTest(p.id)}
                  disabled={testing === p.id}
                  className='px-4 py-2 rounded-[10px] text-[13px] font-medium text-white bg-[#C4785A] hover:bg-[#B26A4E] shadow-[0_2px_10px_rgba(196,120,90,0.25)] transition-all duration-300 disabled:opacity-50'
                >
                  {testing === p.id ? '测试中…' : '测试连接'}
                </button>
                {!p.builtin && (
                  <button
                    onClick={() => doDelete(p.id)}
                    className='p-2 rounded-[10px] text-[#C8B8A8] hover:text-[#A85B4E] hover:bg-[rgba(180,90,80,0.08)] transition-all duration-300'
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {plist.length === 0 && <p className='text-sm text-[#8C8C8C] text-center py-8'>暂无配置</p>}
        </div>

        {/* 折叠添加表单 */}
        <div className='mt-8 rounded-[16px] overflow-hidden bg-[#F7F3EC]'>
          <button
            onClick={() => setAddOpen(!addOpen)}
            className='w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F1EAE0] transition-colors duration-300'
          >
            <span className='flex items-center gap-2.5 font-medium text-[#2C2C2C]'>
              <UploadIcon size={16} className='text-[#C4785A]' /> 添加自定义 API
            </span>
            <motion.span animate={{ rotate: addOpen ? 180 : 0 }} transition={{ duration: 0.35, ease: EASE }} className='text-[#B8A089]'>
              <ChevronDownIcon size={17} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {addOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className='overflow-hidden'
              >
                <div className='px-6 pb-6 space-y-5'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4'>
                    <label className='block'><span className='text-[13px] text-[#8C8C8C] block mb-1'>标识（唯一，如 my-api）</span><input className='input-line' value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder='my-api' /></label>
                    <label className='block'><span className='text-[13px] text-[#8C8C8C] block mb-1'>显示名称</span><input className='input-line' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='我的模型' /></label>
                    <label className='block sm:col-span-2'><span className='text-[13px] text-[#8C8C8C] block mb-1'>接口地址（OpenAI 兼容 Base URL）</span><input className='input-line' value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder='https://api.example.com/v1' /></label>
                    <label className='block'><span className='text-[13px] text-[#8C8C8C] block mb-1'>API Key</span><input type='password' className='input-line' value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder='sk-...' /></label>
                    <label className='block'><span className='text-[13px] text-[#8C8C8C] block mb-1'>模型名</span><input className='input-line' value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder='gpt-4o' /></label>
                  </div>
                  <div className='flex items-center gap-3'>
                    <button
                      onClick={() => setForm({ ...form, vision: !form.vision })}
                      className={'relative w-[46px] h-6 rounded-full transition-colors duration-300 ' + (form.vision ? 'bg-[#C4785A]' : 'bg-[#E8E2D9]')}
                    >
                      <motion.span
                        animate={{ left: form.vision ? 22 : 3 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className='absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)]'
                      />
                    </button>
                    <span className='text-sm text-[#3D3D3D]'>支持图片输入（多模态，用于画面理解）</span>
                  </div>
                  <div className='flex gap-3 pt-1'>
                    <motion.button
                      onClick={doSave}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className='btn-primary flex-1 flex items-center justify-center gap-2'
                    >
                      <CheckIcon size={16} /> 保存配置
                    </motion.button>
                    <button onClick={() => setAddOpen(false)} className='btn-outline'>取消</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}