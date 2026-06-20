import { LayoutDashboard, Archive, BookOpen } from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Board', active: true },
  { icon: BookOpen, label: 'Backlog' },
  { icon: Archive, label: 'Archive' },
]

export function Sidebar() {
  return (
    <nav className="flex flex-col gap-1 p-2 pt-4">
      {navItems.map(({ icon: Icon, label, active }) => (
        <button
          key={label}
          className={[
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full text-left',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          ].join(' ')}
        >
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
