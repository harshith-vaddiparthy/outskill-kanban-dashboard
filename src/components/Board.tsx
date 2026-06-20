import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { KanbanCard } from '@/components/KanbanCard'
import { TaskModal } from '@/components/TaskModal'
import { supabase, COLUMNS } from '@/lib/supabase'
import type { Task, ColumnStatus } from '@/lib/supabase'
import { toast } from 'sonner'

interface BoardProps {
  tasks: Task[]
  loading: boolean
  onTasksChange: (tasks: Task[]) => void
}

interface ColumnDropZoneProps {
  columnId: ColumnStatus
  children: React.ReactNode
}

function ColumnDropZone({ columnId, children }: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${columnId}` })
  return (
    <div
      ref={setNodeRef}
      className={[
        'flex flex-col gap-2 min-h-16 flex-1 rounded-lg transition-colors duration-150',
        isOver ? 'bg-accent/20 ring-1 ring-border' : '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function Board({ tasks, loading, onTasksChange }: BoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [newTaskColumn, setNewTaskColumn] = useState<ColumnStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function getColumnTasks(columnId: ColumnStatus) {
    return tasks
      .filter(t => t.column_status === columnId)
      .sort((a, b) => a.order_index - b.order_index)
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find(t => t.id === activeId)
    if (!activeTask) return

    // Determine target column
    let targetColumn: ColumnStatus
    if (overId.startsWith('col-')) {
      targetColumn = overId.slice(4) as ColumnStatus
    } else {
      const overTask = tasks.find(t => t.id === overId)
      if (!overTask) return
      targetColumn = overTask.column_status
    }

    const sourceColumn = activeTask.column_status
    const sourceItems = getColumnTasks(sourceColumn)
    const targetItems = getColumnTasks(targetColumn)

    let updatedTasks = [...tasks]

    if (sourceColumn === targetColumn) {
      // Reorder within column
      const oldIndex = sourceItems.findIndex(t => t.id === activeId)
      const newIndex = overId.startsWith('col-')
        ? sourceItems.length - 1
        : sourceItems.findIndex(t => t.id === overId)

      if (oldIndex === newIndex) return

      const reordered = arrayMove(sourceItems, oldIndex, newIndex)
      const updates: Promise<void>[] = []

      reordered.forEach((task, idx) => {
        const prev = updatedTasks.find(t => t.id === task.id)
        if (prev) {
          updatedTasks = updatedTasks.map(t =>
            t.id === task.id ? { ...t, order_index: idx } : t
          )
          updates.push(
            supabase.from('tasks').update({ order_index: idx }).eq('id', task.id).then(() => {}) as Promise<void>
          )
        }
      })

      onTasksChange(updatedTasks)
      await Promise.all(updates)
    } else {
      // Move to different column
      const overIndex = overId.startsWith('col-')
        ? targetItems.length
        : targetItems.findIndex(t => t.id === overId)

      // Update the active task's column and position
      updatedTasks = updatedTasks.map(t =>
        t.id === activeId
          ? { ...t, column_status: targetColumn, order_index: overIndex }
          : t
      )

      // Shift items in target column
      const newTargetItems = getColumnTasks(targetColumn).filter(t => t.id !== activeId)
      newTargetItems.splice(overIndex, 0, { ...activeTask, column_status: targetColumn })

      const updates: Promise<void>[] = []
      newTargetItems.forEach((task, idx) => {
        updatedTasks = updatedTasks.map(t =>
          t.id === task.id ? { ...t, order_index: idx, column_status: targetColumn } : t
        )
        updates.push(
          supabase.from('tasks').update({ order_index: idx, column_status: targetColumn }).eq('id', task.id).then(() => {}) as Promise<void>
        )
      })

      onTasksChange(updatedTasks)
      await Promise.all(updates)
      toast.success(`Moved "${activeTask.title}" to ${COLUMNS.find(c => c.id === targetColumn)?.label}`)
    }
  }

  function openNewTask(col: ColumnStatus) {
    setEditingTask(undefined)
    setNewTaskColumn(col)
    setModalOpen(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setNewTaskColumn(null)
    setModalOpen(true)
  }

  async function handleSaveTask(data: Partial<Task>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingTask) {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editingTask.id)
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      onTasksChange(tasks.map(t => t.id === editingTask.id ? updated : t))
      toast.success('Task updated')
    } else {
      const colTasks = getColumnTasks(data.column_status ?? 'backlog')
      const { data: created, error } = await supabase
        .from('tasks')
        .insert({
          ...data,
          order_index: colTasks.length,
          user_id: user.id,
        })
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      onTasksChange([...tasks, created])
      toast.success('Task created')
    }
  }

  async function handleDeleteTask() {
    if (!editingTask) return
    const { error } = await supabase.from('tasks').delete().eq('id', editingTask.id)
    if (error) { toast.error(error.message); return }
    onTasksChange(tasks.filter(t => t.id !== editingTask.id))
    toast.success('Task deleted')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-3 p-4" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.id)
            return (
              <div
                key={col.id}
                className="flex flex-col flex-shrink-0 w-64 rounded-xl bg-muted/40 border border-border"
                style={{ minHeight: 0 }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
                      {col.label}
                    </span>
                    <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-medium w-4 h-4 shrink-0">
                      {colTasks.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openNewTask(col.id)}
                    title="Add task"
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2">
                  <SortableContext
                    items={colTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ColumnDropZone columnId={col.id}>
                      {colTasks.map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onClick={() => openEditTask(task)}
                        />
                      ))}
                    </ColumnDropZone>
                  </SortableContext>
                </div>

                {/* Add task button at bottom */}
                <div className="p-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-foreground text-xs h-7"
                    onClick={() => openNewTask(col.id)}
                  >
                    <Plus className="size-3 mr-1.5" />
                    Add task
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <KanbanCard
              task={activeTask}
              onClick={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          defaultColumn={newTaskColumn ?? 'backlog'}
          onSave={handleSaveTask}
          onDelete={editingTask ? handleDeleteTask : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
