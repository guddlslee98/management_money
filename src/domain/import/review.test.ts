import { utils, write } from 'xlsx'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../../data/default-categories'
import { mapRawCategory } from './categoryMap'
import { decodeText, detectHeaderRow, parseFile } from './parse'
import { applyMapping, guessMapping } from './profiles'

const top = (name: string) => DEFAULT_CATEGORIES.find((c) => c.kind === 'expense' && c.parentId === null && c.name === name)!

describe('review regressions: import', () => {
  it('treats a generic card statement (positive amounts, 가맹점명) as expenses', () => {
    const headers = ['승인일', '가맹점명', '승인금액']
    const m = guessMapping(headers)
    expect(m.cardDefaultsToExpense).toBe(true)
    const rows = applyMapping([['2026.08.02', '이마트', '45,000']], m)
    expect(rows[0]).toMatchObject({ type: 'expense', amount: 45_000, payee: '이마트' })
    // 은행 거래내역(입금/출금 분리)은 그대로
    const bank = guessMapping(['거래일시', '적요', '출금액', '입금액', '잔액'])
    expect(bank.amountMode).toBe('split')
  })

  it('maps 뱅크샐러드 categories major-first and treats 기타/blank minors as the major', () => {
    const cats = DEFAULT_CATEGORIES
    expect(mapRawCategory({ major: '교통', minor: '기타' }, cats, 'expense')).toBe(top('교통·자동차').id)
    expect(mapRawCategory({ major: '식비', minor: '' }, cats, 'expense')).toBe(top('식비').id)
    const cafe = mapRawCategory({ major: '카페/간식', minor: '커피' }, cats, 'expense')
    expect(cafe).not.toBeNull()
    const cafeCat = cats.find((c) => c.id === cafe)!
    expect(cafeCat.parentId === top('카페·간식').id || cafeCat.id === top('카페·간식').id).toBe(true)
    // 대분류 이름이 소분류 이름의 일부여도 대분류를 우선한다 (예: '교통' vs 소분류 '대중교통')
    expect(mapRawCategory({ major: '교통' }, cats, 'expense')).toBe(top('교통·자동차').id)
  })

  it('skips a query-condition preamble row when detecting the header', () => {
    const rows = [
      ['거래구분', '전체', '입출금구분', '전체', '정렬', '최신순'],
      ['거래일시', '적요', '출금액', '입금액'],
      ['2026-09-01 10:00', '스타벅스', '4,500', ''],
    ]
    expect(detectHeaderRow(rows)).toBe(1)
  })

  it('keeps UTF-8 when a single invalid byte is present instead of falling back to EUC-KR', () => {
    const good = new TextEncoder().encode('날짜,내용,금액\n2026-09-01,스타벅스 강남점,4500\n')
    const bytes = new Uint8Array(good.length + 1)
    bytes.set(good, 0)
    bytes[good.length] = 0xff // 잘못된 바이트 하나
    const { text, encoding } = decodeText(bytes.buffer)
    expect(encoding).toBe('utf-8')
    expect(text).toContain('스타벅스 강남점')
  })

  it('picks the sheet with a transaction header over a larger summary sheet', async () => {
    const wb = utils.book_new()
    const summary = Array.from({ length: 30 }, (_, i) => [`항목 ${i}`, `${i * 1000}`])
    utils.book_append_sheet(wb, utils.aoa_to_sheet(summary), '뱅샐현황')
    const ledger = [
      ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모'],
      ['2026-09-01', '10:00:00', '지출', '식비', '카페', '스타벅스', '-4500', 'KRW', '신용카드', ''],
    ]
    utils.book_append_sheet(wb, utils.aoa_to_sheet(ledger), '가계부 내역')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const parsed = await parseFile({ name: 'banksalad.xlsx', arrayBuffer: async () => buf })
    expect(parsed.sheetName).toBe('가계부 내역')
  })
})
