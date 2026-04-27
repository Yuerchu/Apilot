export interface WsSnippetTarget {
  id: string
  label: string
  lang: string
}

export const WS_SNIPPET_TARGETS: WsSnippetTarget[] = [
  { id: "js-native", label: "JavaScript (WebSocket)", lang: "javascript" },
  { id: "js-ws", label: "Node.js (ws)", lang: "javascript" },
  { id: "python-websockets", label: "Python (websockets)", lang: "python" },
  { id: "python-ws-client", label: "Python (websocket-client)", lang: "python" },
  { id: "go-gorilla", label: "Go (gorilla/websocket)", lang: "go" },
  { id: "curl-ws", label: "curl (--ws)", lang: "shell" },
]

export function buildWsSnippet(
  url: string,
  headers: Record<string, string>,
  sampleMessage?: string,
  targetId: string = "js-native",
): string {
  const target = WS_SNIPPET_TARGETS.find(t => t.id === targetId) ?? WS_SNIPPET_TARGETS[0]!
  const msgStr = sampleMessage ? formatJson(sampleMessage) : '{"type":"ping"}'

  switch (target.id) {
    case "js-native": return jsNative(url, headers, msgStr)
    case "js-ws": return jsWs(url, headers, msgStr)
    case "python-websockets": return pythonWebsockets(url, headers, msgStr)
    case "python-ws-client": return pythonWsClient(url, headers, msgStr)
    case "go-gorilla": return goGorilla(url, headers, msgStr)
    case "curl-ws": return curlWs(url, headers, msgStr)
    default: return jsNative(url, headers, msgStr)
  }
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function headerEntries(headers: Record<string, string>): Array<[string, string]> {
  return Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type")
}

function jsNative(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  // Browser WebSocket doesn't support custom headers, note this
  let code = `const ws = new WebSocket(${JSON.stringify(url)});\n\n`
  if (h.length > 0) {
    code += `// Note: Browser WebSocket API does not support custom headers.\n`
    code += `// Pass auth via URL query parameters instead.\n\n`
  }
  code += `ws.onopen = () => {\n`
  code += `  console.log("Connected");\n`
  code += `  ws.send(JSON.stringify(${msg}));\n`
  code += `};\n\n`
  code += `ws.onmessage = (event) => {\n`
  code += `  console.log("Received:", JSON.parse(event.data));\n`
  code += `};\n\n`
  code += `ws.onerror = (error) => {\n`
  code += `  console.error("Error:", error);\n`
  code += `};\n\n`
  code += `ws.onclose = (event) => {\n`
  code += `  console.log("Closed:", event.code, event.reason);\n`
  code += `};`
  return code
}

function jsWs(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  let code = `import WebSocket from "ws";\n\n`
  if (h.length > 0) {
    code += `const ws = new WebSocket(${JSON.stringify(url)}, {\n`
    code += `  headers: {\n`
    for (const [k, v] of h) {
      code += `    ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`
    }
    code += `  },\n`
    code += `});\n\n`
  } else {
    code += `const ws = new WebSocket(${JSON.stringify(url)});\n\n`
  }
  code += `ws.on("open", () => {\n`
  code += `  console.log("Connected");\n`
  code += `  ws.send(JSON.stringify(${msg}));\n`
  code += `});\n\n`
  code += `ws.on("message", (data) => {\n`
  code += `  console.log("Received:", JSON.parse(data.toString()));\n`
  code += `});\n\n`
  code += `ws.on("close", (code, reason) => {\n`
  code += `  console.log("Closed:", code, reason.toString());\n`
  code += `});`
  return code
}

function pythonWebsockets(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  let code = `import asyncio\nimport json\nimport websockets\n\n`
  code += `async def main():\n`
  if (h.length > 0) {
    code += `    headers = {\n`
    for (const [k, v] of h) {
      code += `        ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`
    }
    code += `    }\n`
    code += `    async with websockets.connect(${JSON.stringify(url)}, extra_headers=headers) as ws:\n`
  } else {
    code += `    async with websockets.connect(${JSON.stringify(url)}) as ws:\n`
  }
  code += `        await ws.send(json.dumps(${msg}))\n`
  code += `        response = await ws.recv()\n`
  code += `        print("Received:", json.loads(response))\n\n`
  code += `asyncio.run(main())`
  return code
}

function pythonWsClient(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  let code = `import json\nimport websocket\n\n`
  code += `def on_message(ws, message):\n`
  code += `    print("Received:", json.loads(message))\n\n`
  code += `def on_open(ws):\n`
  code += `    ws.send(json.dumps(${msg}))\n\n`
  code += `def on_close(ws, code, reason):\n`
  code += `    print("Closed:", code, reason)\n\n`
  code += `ws = websocket.WebSocketApp(\n`
  code += `    ${JSON.stringify(url)},\n`
  if (h.length > 0) {
    code += `    header={\n`
    for (const [k, v] of h) {
      code += `        ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`
    }
    code += `    },\n`
  }
  code += `    on_message=on_message,\n`
  code += `    on_open=on_open,\n`
  code += `    on_close=on_close,\n`
  code += `)\n`
  code += `ws.run_forever()`
  return code
}

function goGorilla(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  let code = `package main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"log"\n\t"net/http"\n\n\t"github.com/gorilla/websocket"\n)\n\n`
  code += `func main() {\n`
  if (h.length > 0) {
    code += `\theader := http.Header{\n`
    for (const [k, v] of h) {
      code += `\t\t${JSON.stringify(k)}: {${JSON.stringify(v)}},\n`
    }
    code += `\t}\n`
    code += `\tc, _, err := websocket.DefaultDialer.Dial(${JSON.stringify(url)}, header)\n`
  } else {
    code += `\tc, _, err := websocket.DefaultDialer.Dial(${JSON.stringify(url)}, nil)\n`
  }
  code += `\tif err != nil {\n\t\tlog.Fatal("dial:", err)\n\t}\n`
  code += `\tdefer c.Close()\n\n`
  code += `\tmsg, _ := json.Marshal(${msg})\n`
  code += `\tc.WriteMessage(websocket.TextMessage, msg)\n\n`
  code += `\t_, resp, err := c.ReadMessage()\n`
  code += `\tif err != nil {\n\t\tlog.Fatal("read:", err)\n\t}\n`
  code += `\tfmt.Println("Received:", string(resp))\n`
  code += `}`
  return code
}

function curlWs(url: string, headers: Record<string, string>, msg: string): string {
  const h = headerEntries(headers)
  const singleLineMsg = msg.replace(/\n\s*/g, "")
  let code = `curl --include \\\n`
  code += `  --no-buffer \\\n`
  code += `  --header "Connection: Upgrade" \\\n`
  code += `  --header "Upgrade: websocket" \\\n`
  code += `  --header "Sec-WebSocket-Version: 13" \\\n`
  code += `  --header "Sec-WebSocket-Key: $(openssl rand -base64 16)" \\\n`
  for (const [k, v] of h) {
    code += `  --header ${JSON.stringify(`${k}: ${v}`)} \\\n`
  }
  code += `  ${JSON.stringify(url.replace(/^ws/, "http"))}\n\n`
  code += `# Send message (requires wscat or websocat):\n`
  code += `# echo '${singleLineMsg}' | websocat ${JSON.stringify(url)}`
  return code
}
