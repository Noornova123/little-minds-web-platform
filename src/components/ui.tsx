import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'sage' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

const variantMap: Record<Variant, string> = {
  primary: 'lm-btn-primary',
  sage: 'lm-btn-sage',
  ghost: 'lm-btn-ghost',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button className={`lm-btn ${variantMap[variant]} ${sizeMap[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`lm-card ${className}`} style={style}>{children}</div>;
}

export function Input({ label, className = '', ...rest }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="lm-label block mb-1.5">{label}</span>}
      <input className={`lm-input ${className}`} {...rest} />
    </label>
  );
}

export function Textarea({ label, className = '', ...rest }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label && <span className="lm-label block mb-1.5">{label}</span>}
      <textarea className={`lm-input ${className}`} {...rest} />
    </label>
  );
}

export function Select({ label, className = '', children, ...rest }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && <span className="lm-label block mb-1.5">{label}</span>}
      <select className={`lm-input ${className}`} {...rest}>{children}</select>
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--ink-soft)]">
      <div className="w-8 h-8 rounded-full border-3 border-[var(--cream-deep)] border-t-[var(--terracotta)] animate-spin" style={{ borderWidth: '3px' }} />
      {label && <p className="text-sm font-semibold">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-3 text-[var(--ink-soft)] opacity-60">{icon}</div>}
      <p className="font-bold text-[var(--ink)]">{title}</p>
      {hint && <p className="text-sm text-[var(--ink-soft)] mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'focus' | 'brain' | 'behaviour' | 'success' | 'warning' | 'error' }) {
  const toneMap = {
    neutral: 'bg-[var(--cream-deep)] text-[var(--ink-soft)]',
    focus: 'bg-[#f4f4f5] text-[var(--terracotta)]',
    brain: 'bg-[#f4f4f5] text-[#3a5d8f]',
    behaviour: 'bg-[#f4f4f5] text-[var(--sage-deep)]',
    success: 'bg-[#f4f4f5] text-[var(--sage-deep)]',
    warning: 'bg-[#f4f4f5] text-[var(--amber)]',
    error: 'bg-[#fef2f2] text-[#dc2626]',
  };
  return <span className={`lm-chip ${toneMap[tone]}`}>{children}</span>;
}
