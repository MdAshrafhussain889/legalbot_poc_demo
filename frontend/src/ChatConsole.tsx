import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, Lock, FileText, Send, Sparkles, 
  Paperclip, Loader2, CheckCircle2, ShieldAlert
} from 'lucide-react'
import { useAuth } from './AuthContext'
<<<<<<< HEAD
=======
import { API_BASE_URL } from './api'
>>>>>>> main

type Message = {
  id: string
  type: 'user' | 'ai'
  text: string
  responseId?: string
}

function storageKey(userId: string) {
  return `chat_console_messages_${userId}`
}

function loadMessages(userId: string): Message[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function formatMessageTime(id: string) {
  const ts = Number(id.replace('msg-', ''))
  if (!Number.isFinite(ts)) return ''
  return new Date(ts)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\b(am|pm)\b/g, (match) => match.toUpperCase())
}

export function ChatConsole() {
  const { token, user } = useAuth()
  const userId = user?.id ?? 'anonymous'
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(userId))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(loadMessages(userId))
  }, [userId])

  useEffect(() => {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(messages))
  }, [messages, userId])

  // Always scroll to bottom when messages or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError('')
    setIsLoading(true)

    const userMsgId = `msg-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        type: 'user',
        text: userMessage,
      },
    ])

    try {
<<<<<<< HEAD
      const response = await fetch('http://localhost:8000/api/chat', {
=======
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
>>>>>>> main
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          policy_id: 'general_assistant_v1',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get response')
      }

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          type: 'ai',
          text: data.reply,
          responseId: data.response_id,
        },
      ])
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    // The outermost container maintains a strict height, preventing the page from scrolling
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">

      {/* 1. Header (Fixed at top) */}
      <header className="flex w-full shrink-0 items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Secure Audit Console</h2>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] sm:text-xs font-medium text-slate-500">
              <Lock className="h-3 w-3 hidden sm:block" />
              <span className="hidden sm:inline">End-to-end encrypted</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 hidden sm:block"></span>
              <span>Model: General_Assistant_v1</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-[#C8A96A]/30 bg-[#fdfaf3] px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-[#9E7A3B]">
            <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">Audit Logging Active</span>
            <span className="sm:hidden">Active</span>
          </span>
        </div>
      </header>

      {/* 2. Scrollable Messages Area (Takes up remaining space) */}
      <div className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col space-y-5">

          {messages.length === 0 && !error && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex w-full flex-col items-center justify-center text-center py-20"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <ShieldCheck className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Start a Secure Conversation</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Every AI interaction is automatically verified, audited, and protected with cryptographic integrity.
              </p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const messageTime = formatMessageTime(message.id)

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {message.type === 'user' ? (
                    // Compact, rounded user bubble
                    <div className="relative w-fit max-w-[85%] md:max-w-[70%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-white shadow-sm">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {message.text}
                      </p>
                      {messageTime && (
                        <span className="mt-1 block text-right text-[10px] font-medium text-blue-100 opacity-80">
                          {messageTime}
                        </span>
                      )}
                    </div>
                  ) : (
                    // Compact AI Message Card
                    <div className="group relative flex w-full max-w-[90%] md:max-w-[70%] flex-col overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">

                      {/* Compact Metadata Strip */}
                      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-500">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-700">AI Assistant</span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1 font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          Verified
                        </span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="hidden sm:inline font-mono">
                          ID: {message.responseId?.slice(0, 8)}
                        </span>
                        {messageTime && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>{messageTime}</span>
                          </>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
                          {message.text}
                        </p>
                      </div>

                      {/* Hover Export Action */}
                      {message.responseId && (
                        <div className="absolute right-2 top-1.5 hidden opacity-0 transition-opacity group-hover:flex group-hover:opacity-100 items-center">
                          <Link
                            to={`/certificate/${message.responseId}`}
                            className="flex items-center gap-1.5 rounded bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm border border-slate-200 transition-all hover:border-slate-300 hover:text-slate-900"
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            View Audit
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-fit max-w-[70%] items-center gap-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
              <span className="text-sm font-medium text-slate-600">Verifying policies & generating response...</span>
            </motion.div>
          )}

          {/* Invisible div to scroll to */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {error && (
        <div className="flex w-full shrink-0 items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-medium text-red-600">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* 3. Input Area (Permanently Fixed at Bottom) */}
      <div className="w-full shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4 lg:p-6 z-10">
        <div className="mx-auto max-w-4xl relative">
          <div className="relative flex w-full items-end gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 shadow-sm transition-colors focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
            <button className="mb-1 ml-1 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Message the secure AI assistant..."
              className="max-h-32 sm:max-h-48 min-h-[40px] sm:min-h-[44px] w-full resize-none bg-transparent py-2 sm:py-2.5 text-sm sm:text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
              rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="mb-1 mr-1 flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[10px] sm:text-xs text-slate-400">Protected by SHA-256 Integrity Hash</span>
            <span className="hidden sm:inline-block text-[10px] sm:text-xs font-medium text-slate-400">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-slate-500">Shift</kbd> + <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-slate-500">Enter</kbd> for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}