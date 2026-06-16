// Tipos compartidos entre el API route y los componentes del chat

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  response: string;
  usage: {
    questions_today: number;
    daily_limit: number;
  };
}

export interface ChatErrorResponse {
  error: string;
  limit?: number;
  retry_after?: number;
}

export type ChatErrorType = 'timeout' | 'rate_limit' | 'circuit_open' | 'network' | 'unknown';
