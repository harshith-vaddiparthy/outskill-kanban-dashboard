import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface AuthGateProps {
  children: React.ReactNode
}

const SHARED_PASSWORD = 'flowboard'

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(SHARED_PASSWORD)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      // Try sign-in first; if it fails with "Invalid login credentials", auto-sign-up
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          // Auto-create account
          const { error: signUpError } = await supabase.auth.signUp({ email, password })
          if (signUpError) {
            setAuthError(signUpError.message)
          } else {
            // Sign up succeeded — now sign in
            const { error: secondTry } = await supabase.auth.signInWithPassword({ email, password })
            if (secondTry) setAuthError(secondTry.message)
          }
        } else {
          setAuthError(signInError.message)
        }
      }
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">FlowBoard</CardTitle>
            <CardDescription>
              Enter any email and password to enter your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use any password. New accounts are created automatically.
                </p>
              </div>
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
              <Button type="submit" disabled={authLoading} className="w-full">
                {authLoading ? <Spinner className="mr-2 size-4" /> : null}
                Enter Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
