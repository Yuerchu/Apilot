// Bounded reading of untrusted responses. A malicious openapi_url (e.g. from a
// share link that auto-loads) could otherwise return a multi-GB body and exhaust
// the tab's memory before parsing even starts.

export const MAX_SPEC_BYTES = 25 * 1024 * 1024 // 25 MB

class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response exceeds the maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))} MB`)
    this.name = "ResponseTooLargeError"
  }
}

/**
 * Read a Response body as text while enforcing a hard byte cap. Rejects early via
 * Content-Length when present, otherwise streams and aborts once the cap is hit.
 */
export async function readResponseTextCapped(
  response: Response,
  maxBytes: number = MAX_SPEC_BYTES,
): Promise<string> {
  const declared = response.headers.get("content-length")
  if (declared && Number(declared) > maxBytes) {
    throw new ResponseTooLargeError(maxBytes)
  }

  if (!response.body) {
    const text = await response.text()
    if (text.length > maxBytes) throw new ResponseTooLargeError(maxBytes)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel()
        throw new ResponseTooLargeError(maxBytes)
      }
      text += decoder.decode(value, { stream: true })
    }
  }
  text += decoder.decode()
  return text
}
