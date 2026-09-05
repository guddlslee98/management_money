import { describe, expect, it } from 'vitest'
import { fixtureFile } from './__fixtures__/load'
import { computeHashes, markDuplicates } from './dedupe'
import { decodeText, detectHeaderRow, ImportFileError, parseFile, sliceTable } from './parse'
import { applyMapping, detectProfile, getProfile, guessMapping, matchesAny, parseDateCell } from './profiles'

async function load(name: string) {
  const parsed = await parseFile(fixtureFile(name))
  const table = sliceTable(parsed.rows)
  const det = detectProfile(table.headers)
  const rows = applyMapping(table.body, det.profile.mapping(table.headers))
  return { parsed, table, det, rows }
}

function bytesOf(s: string): { name: string; arrayBuffer: () => Promise<ArrayBuffer> } {
  const b = new TextEncoder().encode(s)
  return { name: 'x', arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
}

describe('encoding detection', () => {
  it('decodes EUC-KR (CP949) files and reports the encoding', async () => {
    const f = fixtureFile('kb-bank.csv')
    const { text, encoding } = decodeText(await f.arrayBuffer())
    expect(encoding).toBe('euc-kr')
    expect(text).toContain('김밥천국 역삼점')
    expect(text).toContain('보낸분/받는분')
  })

  it('strips the UTF-8 BOM', async () => {
    const parsed = await parseFile(fixtureFile('toss.csv'))
    expect(parsed.encoding).toBe('utf-8')
    expect(parsed.rows[0][0]).toBe('토스뱅크 거래내역')
  })
})

describe('header detection', () => {
  it('skips preamble rows (account number, period)', async () => {
    const parsed = await parseFile(fixtureFile('toss.csv'))
    expect(detectHeaderRow(parsed.rows)).toBe(3)
    const table = sliceTable(parsed.rows)
    expect(table.headers).toEqual(['순번', '거래 일시', '적요', '거래 유형', '보낸분/받는분', '거래 금액', '거래 후 잔액', '메모'])
    expect(table.body).toHaveLength(6)
  })

  it('generates column names when no header row exists', () => {
    const t = sliceTable([
      ['2026-08-01', 'x', '1000'],
      ['2026-08-02', 'y', '2000'],
    ])
    expect(t.headerIndex).toBe(-1)
    expect(t.headers).toEqual(['열 1', '열 2', '열 3'])
    expect(t.body).toHaveLength(2)
  })
})

describe('toss csv (signed single amount + type column)', () => {
  it('detects the toss profile and maps rows', async () => {
    const { det, rows } = await load('toss.csv')
    expect(det.profile.id).toBe('toss')
    expect(det.confidence).toBeGreaterThan(0.8)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({ date: '2026-08-03', amount: 5500, type: 'expense', payee: '스타벅스 강남점', memo: '카페결제', errors: [] })
    expect(rows[1]).toMatchObject({ date: '2026-08-05', amount: 3500000, type: 'income', payee: '(주)테크컴퍼니', flow: 'in' })
    expect(rows[1].memo).toContain('8월 급여')
    // 카드대금 → 이체 (출금 방향)
    expect(rows[2]).toMatchObject({ type: 'transfer', flow: 'out', amount: 450000 })
    // '이자입금'은 입금 값 포함 → 수입
    expect(rows[3]).toMatchObject({ type: 'income', amount: 1230 })
  })

  it('dedupes identical in-file rows by ordinal and against existing hashes', async () => {
    const { rows } = await load('toss.csv')
    const hashes = computeHashes(rows)
    expect(new Set(hashes).size).toBe(6)
    expect(hashes[4]).not.toBe(hashes[5])
    const existing = new Set([hashes[0], hashes[4]])
    expect(markDuplicates(hashes, existing)).toEqual([true, false, false, false, true, false])
    // 같은 파일 재가져오기 → 같은 해시
    expect(computeHashes(rows)).toEqual(hashes)
  })
})

describe('KB국민은행 csv (EUC-KR, split 출금/입금 columns)', () => {
  it('detects kb-bank and maps outflow/inflow', async () => {
    const { parsed, det, rows } = await load('kb-bank.csv')
    expect(parsed.encoding).toBe('euc-kr')
    expect(det.profile.id).toBe('kb-bank')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ date: '2026-08-02', amount: 4500, type: 'expense', payee: '김밥천국 역삼점', memo: '체크카드', isRefund: false })
    expect(rows[1]).toMatchObject({ amount: 3500000, type: 'income', payee: '(주)테크컴퍼니', memo: '급여' })
    expect(rows[2]).toMatchObject({ type: 'transfer', flow: 'out', amount: 350000 })
    // 보낸분/받는분이 비면 적요를 거래처로
    expect(rows[4]).toMatchObject({ type: 'income', amount: 1200, payee: '이자' })
  })

  it('also recognises the 찾으신금액/맡기신금액 variant', () => {
    const headers = ['거래일시', '적요', '기재내용', '찾으신금액', '맡기신금액', '잔액', '거래점']
    const det = detectProfile(headers)
    expect(det.profile.id).toBe('kb-bank')
    const m = det.profile.mapping(headers)
    expect(m.amountMode).toBe('split')
    const rows = applyMapping([['2026.08.02 09:14', '체크카드', '스타벅스', '4,500', '0', '1,000', '강남']], m)
    expect(rows[0]).toMatchObject({ date: '2026-08-02', amount: 4500, type: 'expense', payee: '스타벅스' })
  })
})

describe('뱅크샐러드 xlsx', () => {
  it('picks the 가계부 내역 sheet, reads date cells and the 타입 column', async () => {
    const { parsed, det, rows } = await load('banksalad.xlsx')
    expect(parsed.kind).toBe('xlsx')
    expect(parsed.sheetName).toBe('가계부 내역')
    expect(det.profile.id).toBe('banksalad')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ date: '2026-08-01', amount: 6500, type: 'expense', payee: '김밥천국', rawCategory: { major: '식비', minor: '외식' } })
    expect(rows[2]).toMatchObject({ date: '2026-08-05', amount: 3200000, type: 'income', memo: '8월 급여', rawCategory: { major: '급여', minor: '' } })
    // 타입=이체, 금액 음수 → 이 계좌에서 나가는 이체
    expect(rows[3]).toMatchObject({ type: 'transfer', flow: 'out', amount: 450000 })
    expect(rows.every((r) => r.errors.length === 0)).toBe(true)
  })
})

describe('신한카드 csv (card: all expense, cancellations)', () => {
  it('maps card rows as expenses, marks cancelled rows as refunds, drops the 합계 row', async () => {
    const { det, rows } = await load('shinhan-card.csv')
    expect(det.profile.id).toBe('shinhan-card')
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.type === 'expense')).toBe(true)
    expect(rows[0]).toMatchObject({ date: '2026-08-01', amount: 5600, payee: '스타벅스 강남점', isRefund: false })
    expect(rows[0].memo).toContain('일시불')
    expect(rows[2]).toMatchObject({ amount: 35000, isRefund: true })
    expect(rows[3]).toMatchObject({ date: '2026-08-05', amount: 28000 })
  })
})

describe('generic negative-amount csv', () => {
  it('falls back to the generic profile with sign-based direction', async () => {
    const { det, rows } = await load('generic-negative.csv')
    expect(det.profile.id).toBe('generic')
    expect(rows[0]).toMatchObject({ type: 'expense', amount: 4500, payee: '스타벅스', memo: '아메리카노' })
    expect(rows[1]).toMatchObject({ type: 'income', amount: 2500000 })
    expect(rows[2]).toMatchObject({ type: 'transfer', amount: 300000, flow: 'out' })
    expect(rows[3]).toMatchObject({ type: 'expense', amount: 3200 })
  })

  it('treats positive amounts as expenses when the card rule is chosen', async () => {
    const { table } = await load('generic-negative.csv')
    const m = { ...guessMapping(table.headers), negativeIsExpense: false, cardDefaultsToExpense: true }
    const rows = applyMapping(table.body, m)
    expect(rows[1]).toMatchObject({ type: 'expense', amount: 2500000, isRefund: false })
    expect(rows[0]).toMatchObject({ type: 'expense', amount: 4500, isRefund: true })
  })
})

describe('profile detection from headers', () => {
  const cases: Array<[string, string[]]> = [
    ['tossbank', ['거래 일시', '적요', '거래 유형', '거래 기관', '계좌번호', '거래 금액', '거래 후 잔액', '메모']],
    ['kakaobank', ['', '거래일시', '구분', '거래금액', '거래 후 잔액', '거래구분', '내용', '메모']],
    ['shinhan-bank', ['거래일자', '거래시간', '적요', '출금(원)', '입금(원)', '내용', '잔액(원)', '거래점']],
    ['shinhan-bank', ['No', '전체선택', '거래일시', '적요', '입금액', '출금액', '내용', '잔액', '거래점명']],
    ['samsung-card', ['카드번호', '본인가족구분', '승인일자', '승인시각', '가맹점명', '승인금액(원)', '일시불할부구분', '할부개월', '승인번호', '취소여부']],
    ['hyundai-card', ['이용일', '카드번호', '가맹점명', '이용 금액', '부가세', '관계', '할부', '상태']],
    ['kb-card', ['이용일', '이용 시간', '이용카드명', '이용하신곳', '국내이용금액 (원)', '결제방법', '승인번호', '상태']],
    ['pyeonhan', ['날짜', '자산', '분류', '소분류', '내용', '금액', '수입/지출', '메모', '화폐']],
    ['banksalad', ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']],
  ]
  for (const [id, headers] of cases) {
    it(`detects ${id}`, () => {
      const det = detectProfile(headers)
      expect(det.profile.id).toBe(id)
      expect(det.confidence).toBeGreaterThanOrEqual(0.55)
    })
  }

  it('returns generic for unknown headers', () => {
    expect(detectProfile(['a', 'b', 'c']).profile.id).toBe('generic')
  })
})

describe('sign conventions per profile', () => {
  it('카카오뱅크: 구분 column decides direction for unsigned amounts', () => {
    const headers = ['', '거래일시', '구분', '거래금액', '거래 후 잔액', '거래구분', '내용', '메모']
    const m = getProfile('kakaobank').mapping(headers)
    const rows = applyMapping(
      [
        ['', '2026.03.05 10:53:12', '출금', '20,000', '440,000', '체크카드결제', '볼링클럽', '볼링 활동비'],
        ['', '2026.03.06 09:00:00', '입금', '1,500,000', '1,940,000', '이체', '홍길동', ''],
        ['', '2026.03.07 09:00:00', '출금', '-3,000', '1,937,000', '자동이체', '넷플릭스', ''],
      ],
      m,
    )
    expect(rows[0]).toMatchObject({ date: '2026-03-05', type: 'expense', amount: 20000, payee: '볼링클럽' })
    expect(rows[0].memo).toContain('체크카드결제')
    expect(rows[1]).toMatchObject({ type: 'income', amount: 1500000, payee: '홍길동' })
    expect(rows[2]).toMatchObject({ type: 'expense', amount: 3000 })
  })

  it('토스뱅크: negative 거래 금액 = 출금', () => {
    const headers = ['거래 일시', '적요', '거래 유형', '거래 기관', '계좌번호', '거래 금액', '거래 후 잔액', '메모']
    const m = getProfile('tossbank').mapping(headers)
    const rows = applyMapping(
      [
        ['2026.07.13 10:17:18', '스타벅스', '출금', '토스뱅크', '', '-9,000', '100,000', ''],
        ['2026.07.14 10:17:18', '홍길동', '입금', '카카오뱅크', '3333-01', '50,000', '150,000', '회비'],
      ],
      m,
    )
    expect(rows[0]).toMatchObject({ date: '2026-07-13', type: 'expense', amount: 9000, payee: '스타벅스' })
    expect(rows[1]).toMatchObject({ type: 'income', amount: 50000, payee: '홍길동' })
    expect(rows[1].memo).toContain('회비')
  })

  it('삼성카드: 취소여부 Y → refund, time column ignored', () => {
    const headers = ['카드번호', '본인가족구분', '승인일자', '승인시각', '가맹점명', '승인금액(원)', '일시불할부구분', '할부개월', '승인번호', '취소여부']
    const m = getProfile('samsung-card').mapping(headers)
    const rows = applyMapping(
      [
        ['1234-****', '본인', '2026.08.01', '12:01', '이마트', '45,000', '일시불', '', '1001', 'N'],
        ['1234-****', '본인', '2026.08.02', '12:01', '이마트', '45,000', '일시불', '', '1001', 'Y'],
      ],
      m,
    )
    expect(rows[0]).toMatchObject({ date: '2026-08-01', type: 'expense', amount: 45000, isRefund: false, payee: '이마트' })
    expect(rows[1]).toMatchObject({ isRefund: true })
  })

  it('편한가계부: 수입/지출 column with 이체', () => {
    const headers = ['날짜', '자산', '분류', '소분류', '내용', '금액', '수입/지출', '메모', '화폐']
    const m = getProfile('pyeonhan').mapping(headers)
    const rows = applyMapping(
      [
        ['2026-08-01', '신한카드', '식비', '외식', '김밥천국', '6,500', '지출', '', 'KRW'],
        ['2026-08-02', '급여통장', '급여', '', '회사', '3,000,000', '수입', '', 'KRW'],
        ['2026-08-03', '급여통장', '이체', '', '적금', '500,000', '이체', '', 'KRW'],
      ],
      m,
    )
    expect(rows[0]).toMatchObject({ type: 'expense', amount: 6500, rawCategory: { major: '식비', minor: '외식' } })
    expect(rows[1]).toMatchObject({ type: 'income', amount: 3000000 })
    expect(rows[2]).toMatchObject({ type: 'transfer', amount: 500000 })
  })
})

describe('error collection instead of throwing', () => {
  it('reports unparsable dates/amounts per row and skips empty rows', () => {
    const headers = ['날짜', '내용', '금액']
    const m = guessMapping(headers)
    const rows = applyMapping(
      [
        ['어제', '스타벅스', '-4,500'],
        ['2026-08-02', '이마트', 'abc'],
        ['', '', ''],
        ['2026-08-03', '', '-1,000'],
      ],
      m,
    )
    expect(rows).toHaveLength(3)
    expect(rows[0].errors[0]).toMatch(/날짜 인식 불가/)
    expect(rows[1].errors[0]).toMatch(/금액 인식 불가/)
    expect(rows[2].errors).toEqual([])
    expect(rows[2].payee).toBe('')
  })
})

describe('date and value helpers', () => {
  it('parses Korean, bracketed and serial dates', () => {
    expect(parseDateCell('2025년 1월 2일')).toBe('2025-01-02')
    expect(parseDateCell('[2026-01-02 12:00:00]')).toBe('2026-01-02')
    expect(parseDateCell('2026/02/15 14:30')).toBe('2026-02-15')
    expect(parseDateCell('25.12.22')).toBe('2025-12-22')
    expect(parseDateCell('46200')).toBe('2026-06-27')
    expect(parseDateCell('n/a')).toBeNull()
  })

  it('matches single-letter values exactly and longer values by inclusion', () => {
    expect(matchesAny('Y', ['Y', '취소'])).toBe(true)
    expect(matchesAny('N', ['Y', '취소'])).toBe(false)
    expect(matchesAny('부분취소', ['취소'])).toBe(true)
    expect(matchesAny('이자입금', ['입금'])).toBe(true)
  })
})

describe('other containers', () => {
  it('reads an HTML table disguised as .xls', async () => {
    const html = '<html><body><table><tr><td>이용일자</td><td>이용가맹점</td><td>이용금액</td></tr><tr><td>2026.08.01</td><td>스타벅스</td><td>4,500</td></tr></table></body></html>'
    const parsed = await parseFile(bytesOf(html))
    expect(parsed.kind).toBe('html')
    expect(parsed.rows[0]).toEqual(['이용일자', '이용가맹점', '이용금액'])
    const table = sliceTable(parsed.rows)
    const rows = applyMapping(table.body, guessMapping(table.headers))
    expect(rows[0]).toMatchObject({ date: '2026-08-01', amount: 4500, payee: '스타벅스' })
  })

  it('rejects password-protected workbooks with a clear error', async () => {
    const head = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    const mark = 'EncryptedPackage'
    const bytes = new Uint8Array(512 + mark.length * 2)
    head.forEach((b, i) => (bytes[i] = b))
    for (let i = 0; i < mark.length; i++) bytes[512 + i * 2] = mark.charCodeAt(i)
    const file = { name: 'secret.xlsx', arrayBuffer: async () => bytes.buffer as ArrayBuffer }
    await expect(parseFile(file)).rejects.toMatchObject({ name: 'ImportFileError', code: 'encrypted' })
    const err = await parseFile(file).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ImportFileError)
  })
})
