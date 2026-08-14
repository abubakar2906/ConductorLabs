'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WaitlistFormProps {
  className?: string
  inputId?: string
  buttonText?: string
  placeholder?: string
}

export function WaitlistForm({
  className,
  inputId = 'waitlist-email',
  buttonText = 'Join Waitlist',
  placeholder = 'Enter your work email...',
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
        setMessage(data.message || "You're on the list!")
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.message || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setMessage('Could not connect to server. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground',
          className
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-background">
          <Check className="size-3 stroke-[3]" />
        </span>
        <p className="font-mono text-xs text-foreground">{message}</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-md', className)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            id={inputId}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            placeholder={placeholder}
            disabled={status === 'loading'}
            required
            aria-label="Email address for waitlist"
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <Button
          type="submit"
          disabled={status === 'loading'}
          className="shrink-0 font-mono text-xs uppercase tracking-wider"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Joining...</span>
            </>
          ) : (
            <>
              <span>{buttonText}</span>
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </form>
      {status === 'error' && (
        <p className="mt-2 font-mono text-xs text-destructive">{message}</p>
      )}
    </div>
  )
}
