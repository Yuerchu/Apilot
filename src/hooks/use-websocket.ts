import { useState, useCallback, useRef, useEffect } from "react"

export type WsStatus = "disconnected" | "connecting" | "connected" | "error"

export interface WsMessage {
  id: string
  direction: "sent" | "received"
  timestamp: number
  body: string
  parsed: unknown | null
  messageType?: string | undefined
}

const MAX_MESSAGES = 500

export function useWebSocket() {
  const [status, setStatus] = useState<WsStatus>("disconnected")
  const [messages, setMessages] = useState<WsMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const addMessage = useCallback((msg: WsMessage) => {
    setMessages(prev => {
      const next = [...prev, msg]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
  }, [])

  const connect = useCallback((url: string) => {
    // Close existing
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus("connecting")
    setError(null)

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus("connected")
        setError(null)
      }

      ws.onmessage = (event) => {
        const body = typeof event.data === "string" ? event.data : "[binary]"
        let parsed: unknown | null = null
        let messageType: string | undefined
        try {
          parsed = JSON.parse(body)
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, unknown>
            if (typeof obj.type === "string") messageType = obj.type
            else if (typeof obj.action === "string") messageType = obj.action
          }
        } catch {
          // not JSON
        }
        addMessage({
          id: crypto.randomUUID(),
          direction: "received",
          timestamp: Date.now(),
          body,
          parsed,
          messageType,
        })
      }

      ws.onerror = () => {
        setError("WebSocket connection error")
        setStatus("error")
      }

      ws.onclose = (event) => {
        setStatus("disconnected")
        if (event.code !== 1000 && event.code !== 1005) {
          setError(`Closed: ${event.code}${event.reason ? ` — ${event.reason}` : ""}`)
        }
        wsRef.current = null
      }
    } catch (e) {
      setError((e as Error).message)
      setStatus("error")
    }
  }, [addMessage])

  const disconnect = useCallback((code?: number, reason?: string) => {
    if (wsRef.current) {
      wsRef.current.close(code ?? 1000, reason)
      wsRef.current = null
    }
    setStatus("disconnected")
  }, [])

  const send = useCallback((data: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false

    wsRef.current.send(data)

    let parsed: unknown | null = null
    let messageType: string | undefined
    try {
      parsed = JSON.parse(data)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>
        if (typeof obj.type === "string") messageType = obj.type
        else if (typeof obj.action === "string") messageType = obj.action
      }
    } catch {
      // not JSON
    }

    addMessage({
      id: crypto.randomUUID(),
      direction: "sent",
      timestamp: Date.now(),
      body: data,
      parsed,
      messageType,
    })
    return true
  }, [addMessage])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000)
        wsRef.current = null
      }
    }
  }, [])

  return {
    status,
    messages,
    error,
    connect,
    disconnect,
    send,
    clearMessages,
  }
}
