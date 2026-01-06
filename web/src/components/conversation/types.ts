export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type SessionState = 'disconnected' | 'listening' | 'processing' | 'speaking'
