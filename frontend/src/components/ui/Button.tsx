import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const variants = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-700 border border-red-200 font-medium rounded-lg hover:bg-red-100 transition-all duration-200 disabled:opacity-40',
}

const sizes = {
  sm: 'text-sm !px-4 !py-2 !rounded-lg',
  md: '',
  lg: 'text-base !px-8 !py-4 !rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, children, className = '', disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
