import { useEffect, useRef } from 'react'
import type { ConversationMessage } from './types'

interface MessageListProps {
  messages: ConversationMessage[]
  currentTranscript: string
  error: string | null
}

export function MessageList({ messages, currentTranscript, error }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentTranscript])

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {messages.map((message, index) => {
        if (message.role === 'user') {
          return (
            <div
              key={index}
              className="flex flex-col items-end self-end max-w-[90%]"
            >
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tr-sm mb-1.5 border border-gray-200 shadow-sm">
                <p className="m-0 font-medium text-[15px] text-gray-900">
                  {message.content}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(message.timestamp).toLocaleTimeString('ko-KR')}
              </span>
            </div>
          )
        } else {
          return (
            <div
              key={index}
              className="flex flex-col items-start max-w-[90%]"
            >
              <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm">
                <p className="mb-3 font-medium leading-relaxed text-[15px] text-gray-900">
                  {message.content}
                </p>
              </div>
            </div>
          )
        }
      })}

      {/* Current Transcript (during recognition) */}
      {currentTranscript && (
        <div className="flex flex-col items-end self-end max-w-[90%] opacity-70">
          <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-tr-sm mb-1.5 border border-gray-200 border-dashed">
            <p className="m-0 font-medium text-[15px] text-gray-600">
              {currentTranscript}...
            </p>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
