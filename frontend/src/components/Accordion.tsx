import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from './Icons';

interface Props {
  title: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Accordion({ title, icon, badge, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className='card overflow-hidden'>
      <button
        onClick={() => setOpen(!open)}
        className='w-full flex items-center justify-between px-6 py-5 text-left transition-colors duration-300 hover:bg-[#FAF5EE]'
      >
        <span className='flex items-center gap-3'>
          {icon && <span className='text-[#C4785A]'>{icon}</span>}
          <span className='font-medium text-[#2C2C2C] text-[15px] tracking-[-0.01em]'>{title}</span>
          {badge && <span className='badge'>{badge}</span>}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className='text-[#B8A089]'
        >
          <ChevronDownIcon size={17} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className='overflow-hidden'
          >
            <div className='px-6 pb-6'>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}