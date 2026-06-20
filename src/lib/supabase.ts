import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ColumnStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  description: string | null
  column_status: ColumnStatus
  priority: TaskPriority
  tags: string[]
  due_date: string | null
  order_index: number
  created_at: string
  updated_at: string
  user_id: string
}

export interface Settings {
  id: string
  user_id: string
  model: string
  theme: string
  created_at: string
  updated_at: string
}

export const COLUMNS: { id: ColumnStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  medium: { label: 'Medium', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  high: { label: 'High', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  urgent: { label: 'Urgent', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}
