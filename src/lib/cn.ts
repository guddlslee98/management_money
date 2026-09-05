/** 클래스명 합치기 (falsy 제거) */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
