import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { CalendarDays, GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Task } from '@/lib/supabase'
import { PRIORITY_CONFIG } from '@/lib/supabase'

interface KanbanCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
}

export function KanbanCard({ task, onClick, isDragging }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const priorityCfg = PRIORITY_CONFIG[task.priority]
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.column_status !== 'done' && task.column_status !== 'cancelled'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group relative rounded-lg border border-border bg-card p-3 shadow-sm cursor-pointer select-none',
        'hover:border-border/80 hover:shadow-md transition-all duration-150',
        isDragging ? 'shadow-xl scale-105 rotate-1' : '',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="size-3 text-muted-foreground" />
      </div>

      <div className="pl-3">
        {/* Priority badge + title */}
        <div className="flex items-start gap-2 mb-2">
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] px-1.5 py-0 h-5 font-medium border ${priorityCfg.color}`}
          >
            {priorityCfg.label}
          </Badge>
        </div>

        <p className="text-sm font-medium text-card-foreground leading-snug line-clamp-2 mb-2">
          {task.title}
        </p>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Due date */}
        {task.due_date && (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
            <CalendarDays className="size-3" />
            <span>{format(new Date(task.due_date + 'T00:00:00'), 'MMM d')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
