// PLACEHOLDER — 기본 카테고리/분류 규칙 데이터는 별도 작업으로 채워진다.
import type { Category, ClassifyRule } from '../db/types'
export const DEFAULT_CATEGORIES: Category[] = []
export const DEFAULT_RULES: Array<Pick<ClassifyRule, 'pattern' | 'categoryId' | 'priority'>> = []
