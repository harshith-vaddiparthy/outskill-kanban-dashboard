import { useState, useCallback } from 'react'
import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Sun, Moon, LogOut, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'
import { supabase } from '@/lib/supabase'

interface ShellProps {
  sidebar: React.ReactNode
  board: React.ReactNode
  chat: React.ReactNode
  settings: React.ReactNode
}

function usePanelState(key: string, defaultValue: boolean) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(key)
    return stored !== null ? stored === 'true' : defaultValue
  })

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem(key, String(next))
      return next
    })
  }, [key])

  return [open, toggle] as const
}

export function Shell({ sidebar, board, chat, settings }: ShellProps) {
  const [sidebarOpen, toggleSidebar] = usePanelState('flowboard_sidebar', true)
  const [chatOpen, toggleChat] = usePanelState('flowboard_chat', true)
  const [showSettings, setShowSettings] = useState(false)
  const { theme, setTheme } = useTheme()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3 z-20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <span className="text-sm font-semibold tracking-tight text-foreground select-none">FlowBoard</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(s => !s)}
            title="Settings"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleChat}
            title={chatOpen ? 'Close AI chat' : 'Open AI chat'}
          >
            {chatOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={[
            'shrink-0 border-r border-border bg-sidebar overflow-hidden',
            'transition-[width] duration-250 ease-in-out',
            sidebarOpen ? 'w-52' : 'w-0',
          ].join(' ')}
        >
          <div className="w-52 h-full overflow-hidden">
            {sidebar}
          </div>
        </aside>

        {/* Center Board */}
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          {showSettings ? settings : board}
        </main>

        {/* Right Chat Panel */}
        <aside
          className={[
            'shrink-0 border-l border-border bg-background overflow-hidden',
            'transition-[width] duration-250 ease-in-out',
            chatOpen ? 'w-80' : 'w-0',
          ].join(' ')}
        >
          <div className="w-80 h-full overflow-hidden">
            {chat}
          </div>
        </aside>
      </div>
    </div>
  )
}
