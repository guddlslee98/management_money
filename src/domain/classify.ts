import type { ClassifyRule } from '../db/types'

/** 비교용 정규화: 소문자, 공백/특수문자 제거 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}<>«»"'`~!@#$%^&*_+=|\\/:;,.?-]/g, '')
}

interface Compiled {
  rule: ClassifyRule
  keywords: string[]
  maxLen: number
}

function compile(rules: ClassifyRule[]): Compiled[] {
  const out: Compiled[] = []
  for (const rule of rules) {
    const keywords = rule.pattern
      .split('|')
      .map((k) => normalizeText(k))
      .filter((k) => k.length > 0)
    if (!keywords.length) continue
    out.push({ rule, keywords, maxLen: Math.max(...keywords.map((k) => k.length)) })
  }
  // 우선순위 높은 순 → 더 긴(구체적) 키워드 순
  out.sort((a, b) => b.rule.priority - a.rule.priority || b.maxLen - a.maxLen)
  return out
}

export interface Classifier {
  /** 가맹점/메모 텍스트에 맞는 카테고리 id. 없으면 null */
  classify(...texts: Array<string | null | undefined>): string | null
  /** 어떤 규칙이 맞았는지까지 */
  match(...texts: Array<string | null | undefined>): { categoryId: string; rule: ClassifyRule } | null
}

export function createClassifier(rules: ClassifyRule[]): Classifier {
  const compiled = compile(rules)
  const match = (...texts: Array<string | null | undefined>) => {
    const hay = texts
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .map(normalizeText)
      .join(' ')
    if (!hay) return null
    // 우선순위가 높은 규칙이 이기고, 같은 우선순위면 실제로 매칭된 키워드가 더 긴(구체적인) 규칙이 이긴다.
    let best: { categoryId: string; rule: ClassifyRule; len: number } | null = null
    for (const c of compiled) {
      if (best && c.rule.priority < best.rule.priority) break // priority 내림차순 정렬이므로 더 볼 필요 없음
      for (const k of c.keywords) {
        if (k.length > (best?.len ?? 0) && hay.includes(k)) best = { categoryId: c.rule.categoryId, rule: c.rule, len: k.length }
      }
    }
    return best ? { categoryId: best.categoryId, rule: best.rule } : null
  }
  return { match, classify: (...texts) => match(...texts)?.categoryId ?? null }
}

/**
 * 사용자가 가져온 거래에 카테고리를 지정했을 때 학습할 규칙 패턴을 제안.
 * 지점명 토큰과 숫자만 있는 토큰을 제거해 재사용성을 높인다. 예: "스타벅스 강남역점" -> "스타벅스", "GS25 역삼2호점" -> "GS25"
 */
export function suggestPattern(payee: string): string | null {
  const cleaned = payee
    .replace(/\((.*?)\)/g, ' ')
    .replace(/(주식회사|㈜|주\)|유한회사)/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
  if (!cleaned) return null
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0)
  const isBranch = (t: string) => /(점|지점|호점|매장|본점|직영점)$/.test(t)
  const isNumeric = (t: string) => /^\d+$/.test(t)
  const useful = tokens.filter((t) => !isBranch(t) && !isNumeric(t))
  if (useful.length === 0) {
    // 전부 지점/숫자 토큰이면 첫 토큰을 그대로 (사용자가 편집 가능)
    const first = tokens.find((t) => !isNumeric(t))
    return first ?? null
  }
  const first = useful[0]
  if (first.length >= 2 || useful.length === 1) return first
  return `${first}${useful[1]}`
}
