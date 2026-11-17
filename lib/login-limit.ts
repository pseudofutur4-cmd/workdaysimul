// Local single-process throttle. A shared store is required for multiple servers.
const attempts = new Map<string, { count: number; expires: number }>();
export function consumeLoginAttempt(account: string, now = Date.now()) {
  for (const [key, value] of attempts)
    if (value.expires <= now) attempts.delete(key);
  const entry = attempts.get(account);
  if (entry) {
    if (entry.count >= 20) return false;
    entry.count++;
    return true;
  }
  if (attempts.size >= 10000) return false;
  attempts.set(account, { count: 1, expires: now + 60000 });
  return true;
}
