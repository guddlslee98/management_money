/**
 * 가져온 행의 원본 카테고리 이름(뱅크샐러드 대분류/소분류, 편한가계부 분류)을 우리 카테고리로 연결하고,
 * 없으면 거래처/메모 키워드 분류기(createClassifier)로 추천한다.
 */
import type { Category, CategoryKind, ClassifyRule } from '../../db/types'
import { createClassifier, normalizeText } from '../classify'
import type { ParsedRow } from './profiles'

/** 다른 앱의 카테고리 이름 → 우리 쪽에서 찾아볼 이름 후보 (앞이 우선) */
const ALIASES: Array<[string, string[]]> = [
  ['식비', ['식비', '외식', '음식']],
  ['외식', ['외식', '식비']],
  ['배달', ['배달', '식비']],
  ['카페', ['카페', '커피', '간식']],
  ['간식', ['간식', '카페', '식비']],
  ['커피', ['커피', '카페']],
  ['편의점', ['편의점', '마트']],
  ['마트', ['마트', '편의점', '장보기', '생활']],
  ['생활', ['생활', '생활용품', '마트']],
  ['교통', ['교통', '대중교통']],
  ['자동차', ['자동차', '주유', '교통']],
  ['주유', ['주유', '자동차', '교통']],
  ['택시', ['택시', '교통']],
  ['주거', ['주거', '월세', '관리비']],
  ['관리비', ['관리비', '주거', '공과금']],
  ['공과금', ['공과금', '주거']],
  ['통신', ['통신', '휴대폰']],
  ['쇼핑', ['쇼핑', '온라인쇼핑']],
  ['패션', ['패션', '의류', '쇼핑']],
  ['의류', ['의류', '패션', '쇼핑']],
  ['뷰티', ['뷰티', '미용']],
  ['미용', ['미용', '뷰티']],
  ['문화', ['문화', '여가', '취미']],
  ['여가', ['여가', '문화', '취미']],
  ['취미', ['취미', '문화', '여가']],
  ['여행', ['여행', '숙박', '문화']],
  ['의료', ['의료', '건강', '병원']],
  ['건강', ['건강', '의료', '운동']],
  ['병원', ['병원', '의료', '건강']],
  ['약국', ['약국', '의료', '건강']],
  ['교육', ['교육', '학원', '도서']],
  ['도서', ['도서', '교육', '문화']],
  ['구독', ['구독']],
  ['경조', ['경조', '경조사', '선물']],
  ['선물', ['선물', '경조']],
  ['술', ['술', '유흥', '회식']],
  ['유흥', ['유흥', '술']],
  ['보험', ['보험', '금융']],
  ['금융', ['금융', '이자', '보험']],
  ['세금', ['세금', '금융', '공과금']],
  ['급여', ['급여', '월급']],
  ['월급', ['월급', '급여']],
  ['용돈', ['용돈']],
  ['부수입', ['부수입', '기타수입', '기타']],
  ['이자', ['이자', '금융']],
  ['환급', ['환급', '기타수입']],
  ['기타', ['기타']],
]

/** normalizeText + 가운뎃점 제거: '카페·간식' == '카페/간식' == '카페 간식' */
const norm = (s: string) => normalizeText(s).replace(/[·ㆍ‧•]/g, '')

/** '기타', '일반', 빈 값처럼 대분류를 그대로 쓰라는 뜻의 소분류 이름 */
const GENERIC_MINORS = new Set(['기타', '일반', '기타지출', '기타수입', '미분류', 'etc', 'other', 'others'])

/**
 * 우리 카테고리 이름과 원본(뱅크샐러드·편한가계부) 이름을 비교해 id를 찾는다.
 * 대분류를 먼저 확정(정확 → 포함 → 별칭)하고, 소분류는 그 대분류의 자식 안에서만 찾는다.
 * '기타' 같은 일반 소분류나 빈 소분류는 대분류 자체를 쓴다.
 */
export function mapRawCategory(raw: { major?: string; minor?: string } | undefined, categories: Category[], kind: CategoryKind): string | null {
  if (!raw) return null
  const pool = categories.filter((c) => c.kind === kind && !c.isArchived)
  if (pool.length === 0) return null
  const major = norm(raw.major ?? '')
  const minor = norm(raw.minor ?? '')
  if (!major && !minor) return null
  const subs = pool.filter((c) => c.parentId !== null)
  const tops = pool.filter((c) => c.parentId === null)

  const exact = (n: string, list: Category[]) => list.find((c) => norm(c.name) === n)
  const contains = (n: string, list: Category[]) =>
    list.find((c) => {
      const cn = norm(c.name)
      return cn.length >= 2 && n.length >= 2 && (cn.includes(n) || n.includes(cn))
    })
  const viaAlias = (n: string, list: Category[]) => {
    for (const [key, candidates] of ALIASES) {
      if (!n.includes(norm(key))) continue
      for (const cand of candidates) {
        const cn = norm(cand)
        const hit = exact(cn, list) ?? contains(cn, list)
        if (hit) return hit
      }
    }
    return undefined
  }
  const resolve = (n: string, list: Category[]) => (n ? (exact(n, list) ?? contains(n, list) ?? viaAlias(n, list)) : undefined)

  const top = resolve(major, tops)
  if (top) {
    if (!minor || GENERIC_MINORS.has(minor)) return top.id
    const children = subs.filter((c) => c.parentId === top.id)
    const child = resolve(minor, children)
    return (child ?? top).id
  }
  // 대분류를 못 찾으면 소분류 이름으로 전체에서 시도 (일반 소분류는 제외), 마지막으로 대분류 이름을 소분류에서
  if (minor && !GENERIC_MINORS.has(minor)) {
    const hit = resolve(minor, subs) ?? resolve(minor, tops)
    if (hit) return hit.id
  }
  if (major) {
    const hit = resolve(major, subs)
    if (hit) return hit.id
  }
  return null
}

/**
 * 행마다 추천 카테고리 id. 이체는 null.
 * 원본 카테고리 → 키워드 규칙 순. 같은 입력은 캐시해 수천 행에서도 빠르다.
 */
export function suggestCategories(rows: ParsedRow[], categories: Category[], rules: ClassifyRule[]): (string | null)[] {
  const classifier = createClassifier(rules)
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]))
  const rawCache = new Map<string, string | null>()
  const textCache = new Map<string, string | null>()
  return rows.map((r) => {
    if (r.type === 'transfer') return null
    const kind: CategoryKind = r.type === 'income' ? 'income' : 'expense'
    if (r.rawCategory) {
      const key = `${kind}|${r.rawCategory.major}|${r.rawCategory.minor}`
      let id = rawCache.get(key)
      if (id === undefined) {
        id = mapRawCategory(r.rawCategory, categories, kind)
        rawCache.set(key, id)
      }
      if (id) return id
    }
    const tkey = `${kind}|${r.payee}|${r.memo}`
    let id = textCache.get(tkey)
    if (id === undefined) {
      const found = classifier.classify(r.payee, r.memo)
      id = found && kindOf.get(found) === kind ? found : null
      textCache.set(tkey, id)
    }
    return id
  })
}
