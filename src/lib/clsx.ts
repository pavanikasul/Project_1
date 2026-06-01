export default function clsx(...args: any[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    const t = typeof arg;
    if (t === 'string' || t === 'number') {
      parts.push(String(arg));
    } else if (Array.isArray(arg)) {
      parts.push(arg.filter(Boolean).map(String).join(' '));
    } else if (t === 'object') {
      for (const key of Object.keys(arg)) {
        if ((arg as any)[key]) parts.push(key);
      }
    }
  }
  return parts.join(' ').trim();
}
