import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  onBoardRefresh: () => void
}

export function ChatPanel({ onBoardRefresh }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your AI assistant for FlowBoard. I can create, move, update, and delete tasks for you. Just tell me what you need — for example:\n\n• \"Create a high-priority task called 'Fix login bug' in In Progress\"\n• \"Move all Done tasks older than 7 days to Cancelled\"\n• \"Show me all urgent tasks\"\n\nWhat would you like to do?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setError(null)

    const history = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error ?? `Request failed: ${response.status}`)
      }

      // Stream the response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMsgId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'text') {
                  assistantContent += parsed.content
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMsgId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  )
                } else if (parsed.type === 'tool_result') {
                  // Board changed, refresh
                  onBoardRefresh()
                }
              } catch {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }

      onBoardRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setError(msg)
      setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.content !== ''))
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
          <Bot className="size-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold text-foreground">AI Assistant</span>
        <div className="ml-auto">
          {isLoading && <Loader2 className="size-3.5 text-muted-foreground animate-spin" />}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full mt-0.5 ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {msg.role === 'user'
                ? <User className="size-3" />
                : <Bot className="size-3" />
              }
            </div>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted text-foreground rounded-tl-sm'
              } ${msg.content === '' ? 'animate-pulse' : ''}`}
            >
              {msg.content === '' ? (
                <span className="inline-flex gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to manage your board..."
            className="flex-1 min-h-[40px] max-h-32 resize-none text-sm py-2"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="shrink-0 rounded-full size-9"
            title="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}
