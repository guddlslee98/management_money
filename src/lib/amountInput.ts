import { formatNumber, parseAmount } from '../domain/money'

/** 예산·반복·계좌 폼에서 쓰는 금액 입력 헬퍼 (정수 원, 천단위 구분자) */
export function parseAmountInput(input: string, allowNegative = false): number | null {
  const s = input.trim()
  const negative = allowNegative && s.startsWith('-')
  const digits = s.replace(/\D/g, '').slice(0, 15)
  if (!digits) return null
  const n = Number(digits)
  return negative ? -n : n
}

/** 입력 중인 문자열을 천단위 구분자가 있는 형태로 정리. "3000a00" → "300,000" */
export function formatAmountInput(input: string, allowNegative = false): string {
  const n = parseAmountInput(input, allowNegative)
  if (n === null) return allowNegative && input.trim().startsWith('-') ? '-' : ''
  return formatNumber(n)
}

/** 저장된 금액을 입력 칸 문자열로. 0/null이면 빈 문자열(예산 없음) */
export function amountToInput(amount: number | null | undefined): string {
  return amount && amount !== 0 ? formatNumber(amount) : ''
}

/** 예산 화면에 나열할 지출 대분류: 보관되지 않은 것만, 정렬 순서대로 */
