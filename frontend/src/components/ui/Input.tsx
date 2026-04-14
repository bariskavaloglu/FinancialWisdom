import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        className={`input ${error ? 'border-red-400 focus:border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ children, required, ...props }: LabelProps) {
  return (
    <label className="label" {...props}>
      {children}
      {required && <span className="text-stone-900 ml-0.5">*</span>}
    </label>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}

export function FormField({ label, error, required, htmlFor, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
