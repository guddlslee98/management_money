import { formatNumber, parseAmount } from '../../domain/money'

/** 자릿수 상한: 이보다 길면 잘라낸다 (정수 정밀도 보호) */
const MAX_DIGITS = 15

/**
 * 금액 입력칸의 원시 문자열을 정리한다.
 * - 숫자만 남기고(쉼표·원·₩·공백 등 제거) 정수로 해석한다. 음수/소수는 허용하지 않는다.
 * - display: 천단위 구분자가 들어간 표시용 문자열, value: 정수 원. 숫자가 없으면 { '', null }
 */
export function formatAmountInput(raw: string): { display: string; value: number | null } {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS)
  if (!digits) return { display: '', value: null }
  const value = parseAmount(digits)
  if (value === null) return { display: '', value: null }
  return { display: formatNumber(value), value }
}
