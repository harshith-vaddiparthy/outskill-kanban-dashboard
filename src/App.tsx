import { useState, useEffect, useCallback } from 'react'
import { Toaster } from 'sonner'
import { AuthGate } from '@/components/AuthGate'
import { Shell } from '@/components/Shell'
import { Sidebar } from '@/components/Sidebar'
import { Board } from '@/components/Board'
import { ChatPanel } from '@/components/ChatPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/supabase'

function AppInner() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index')
    if (!error && data) {
      setTasks(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTasks()

    // Realtime subscription
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          loadTasks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTasks])

  return (
    <Shell
      sidebar={<Sidebar />}
      board={
        <Board
          tasks={tasks}
          loading={loading}
          onTasksChange={setTasks}
        />
      }
      chat={<ChatPanel onBoardRefresh={loadTasks} />}
      settings={<SettingsPanel />}
    />
  )
}

export function App() {
  return (
    <>
      <AuthGate>
        <AppInner />
      </AuthGate>
      <Toaster position="bottom-right" richColors />
    </>
  )
}

export default App
