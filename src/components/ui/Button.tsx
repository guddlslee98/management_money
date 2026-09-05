import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:opacity-90 disabled:opacity-50',
  secondary: 'bg-surface-2 text-text border border-border hover:bg-border/60 disabled:opacity-50',
  ghost: 'bg-transparent text-text hover:bg-surface-2 disabled:opacity-50',
  danger: 'bg-expense text-white hover:opacity-90 disabled:opacity-50',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
}

export function Button({ variant = 'primary', size = 'md', full, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition active:scale-[0.98] select-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}
