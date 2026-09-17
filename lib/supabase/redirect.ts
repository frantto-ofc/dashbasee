// Only application destinations can be used after authentication.
export function safeNextPath(value: string | null): string {
  return value === "/update-password" ? value : "/";
}
