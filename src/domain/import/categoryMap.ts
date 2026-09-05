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

/** 우리 카테고리 이름과 원본 이름을 비교해 id를 찾는다. 소분류 우선 → 대분류 → 포함 → 별칭 */
export function mapRawCategory(raw: { major?: string; minor?: string } | undefined, categories: Category[], kind: CategoryKind): string | null {
  if (!raw) return null
  const pool = categories.filter((c) => c.kind === kind && !c.isArchived)
  if (pool.length === 0) return null
  const names = [raw.minor ?? '', raw.major ?? ''].map(norm).filter((n) => n.length > 0)
  if (names.length === 0) return null
  const subs = pool.filter((c) => c.parentId !== null)
  const tops = pool.filter((c) => c.parentId === null)

  const exact = (n: string, list: Category[]) => list.find((c) => norm(c.name) === n)
  for (const n of names) {
    const hit = exact(n, subs) ?? exact(n, tops)
    if (hit) return hit.id
  }
  const contains = (n: string, list: Category[]) =>
    list.find((c) => {
      const cn = norm(c.name)
      return cn.length >= 2 && n.length >= 2 && (cn.includes(n) || n.includes(cn))
    })
  for (const n of names) {
    const hit = contains(n, subs) ?? contains(n, tops)
    if (hit) return hit.id
  }
  for (const n of names) {
    for (const [key, candidates] of ALIASES) {
      if (!n.includes(norm(key))) continue
      for (const cand of candidates) {
        const cn = norm(cand)
        const hit = exact(cn, subs) ?? exact(cn, tops) ?? contains(cn, subs) ?? contains(cn, tops)
        if (hit) return hit.id
      }
    }
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
