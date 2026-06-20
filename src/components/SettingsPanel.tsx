import { useState, useEffect } from 'react'
import { Key, Cpu, Palette, Trash2, Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import type { Settings } from '@/lib/supabase'
import { toast } from 'sonner'
import { useTheme } from '@/components/theme-provider'

const MODELS = ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini']

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savingModel, setSavingModel] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const { data } = await supabase.from('settings').select().single()
    if (data) {
      setSettings(data)
      setModel(data.model)
    }
  }

  async function saveApiKey() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSavingKey(true)
    try {
      // Call edge function to securely store the API key
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-api-key`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ apiKey }),
        }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save API key')
      }
      toast.success('API key saved securely')
      setApiKey('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSavingKey(false)
    }
  }

  async function saveModel(newModel: string) {
    setModel(newModel)
    setSavingModel(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      if (settings) {
        await supabase.from('settings').update({ model: newModel }).eq('id', settings.id)
      } else {
        await supabase.from('settings').insert({ user_id: user.id, model: newModel, theme })
      }
      toast.success('Model updated')
      await loadSettings()
    } catch {
      toast.error('Failed to save model')
    } finally {
      setSavingModel(false)
    }
  }

  async function resetBoard() {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 5000)
      return
    }
    setResetting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('tasks').delete().eq('user_id', user.id)
      toast.success('All board data deleted')
      setConfirmReset(false)
    } catch {
      toast.error('Failed to reset board')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your FlowBoard workspace</p>
        </div>

        {/* AI Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Cpu className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">AI Configuration</h2>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key">OpenAI API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button onClick={saveApiKey} disabled={savingKey || !apiKey.trim()} size="sm">
                {savingKey ? 'Saving...' : (
                  <><Key className="size-3.5 mr-1.5" />Save</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored securely server-side. Never displayed back once saved.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>AI Model</Label>
            <Select value={model} onValueChange={saveModel} disabled={savingModel}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Palette className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Dark Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle between light and dark theme</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-destructive/30 pb-2">
            <Trash2 className="size-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Reset Board Data</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently delete all tasks. This cannot be undone.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetBoard}
              disabled={resetting}
            >
              {confirmReset ? (
                <><Check className="size-3.5 mr-1.5" />Confirm</>
              ) : (
                'Reset All'
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
