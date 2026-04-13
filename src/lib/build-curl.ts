export function buildCurl(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string | FormData,
  contentType?: string
): string {
  const parts: string[] = ['curl'];
  if (method !== 'GET') parts.push(`-X ${method}`);
  parts.push(`'${url}'`);
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === 'content-type' && contentType === 'multipart/form-data') continue;
    parts.push(`-H '${k}: ${v.replace(/'/g, "'\\''")}'`);
  }
  if (body && contentType === 'multipart/form-data' && body instanceof FormData) {
    for (const [k, v] of body.entries()) {
      if (v instanceof File) {
        parts.push(`-F '${k}=@${v.name.replace(/'/g, "'\\''")}'`);
      } else {
        parts.push(`-F '${k}=${String(v).replace(/'/g, "'\\''")}'`);
      }
    }
  } else if (body && typeof body === 'string') {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n  ');
}
