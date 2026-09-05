import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const base =
  'w-full h-11 rounded-xl border border-border bg-surface px-3 text-base text-text placeholder:text-muted/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60'

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-muted mb-1">
      {children}
      {hint && <span className="ml-1 font-normal">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, 'appearance-none pr-8 bg-no-repeat bg-[right_0.75rem_center]', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'h-auto min-h-20 py-2', className)} {...rest} />
}

export function Field({ label, htmlFor, hint, error, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-expense">{error}</p>}
    </div>
  )
}
