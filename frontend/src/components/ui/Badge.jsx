import React from 'react'

export function Badge({ children, variant = 'neutral', dot = false, className = '' }) {
  const variantStyles = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    primary: 'bg-blue-50 text-blue-700 border-blue-200/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/60',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/60',
    outline: 'bg-transparent text-zinc-600 border-zinc-200',
  }

  const dotColors = {
    neutral: 'bg-zinc-400',
    primary: 'bg-blue-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    outline: 'bg-zinc-400',
  }

  const selectedStyle = variantStyles[variant] || variantStyles.neutral
  const dotColor = dotColors[variant] || dotColors.neutral

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border tracking-tight ${selectedStyle} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  )
}
