/**
 * 가져오기 1단계: 파일 → 문자열 표(rows).
 * CSV/TXT는 PapaParse, XLS/XLSX는 SheetJS, "엑셀"이라고 내려주지만 실제로는 HTML 표인 .xls는 DOMParser로 읽는다.
 * 순수 함수(브라우저·Node 공용). 인코딩은 UTF-8(BOM) → UTF-8(fatal) → EUC-KR 순으로 시도한다.
 */
import Papa from 'papaparse'
import { read, utils, type WorkBook, type WorkSheet } from 'xlsx'
import { dateKeyOf } from '../dates'
import { normalizeHeader } from './headers'

export { normalizeHeader }

export type Encoding = 'utf-8' | 'utf-16' | 'euc-kr' | 'binary'
export type FileKind = 'csv' | 'xlsx' | 'xls' | 'html'

export interface FileLike {
  name: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface ParsedFile {
  kind: FileKind
  sheetName?: string
  rows: string[][]
  encoding: Encoding
}

export type ImportErrorCode = 'encrypted' | 'empty' | 'unsupported' | 'parse'

export class ImportFileError extends Error {
  code: ImportErrorCode
  constructor(code: ImportErrorCode, message: string) {
    super(message)
    this.name = 'ImportFileError'
    this.code = code
  }
}

export const ENCRYPTED_MESSAGE =
  '비밀번호로 보호된 엑셀 파일은 브라우저에서 읽을 수 없습니다. 엑셀에서 열어 비밀번호 없이 "다른 이름으로 저장"한 뒤 다시 선택하세요.'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** BOM 제거 + UTF-8 우선, 실패 시 EUC-KR(CP949)로 디코딩 */
export function decodeText(buf: ArrayBuffer): { text: string; encoding: Encoding } {
  const bytes = new Uint8Array(buf)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16' }
    } catch {
      /* 아래 폴백 */
    }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    // 잘못된 바이트 하나 때문에 파일 전체를 EUC-KR로 읽어 깨지지 않도록, 두 방식으로 읽어 치환 문자(U+FFFD)가 적은 쪽을 택한다
    const utf8 = new TextDecoder('utf-8').decode(bytes)
    const euckr = new TextDecoder('euc-kr').decode(bytes)
    const bad = (t: string) => (t.match(/\uFFFD/g) ?? []).length
    const hangul = (t: string) => (t.match(/[가-힣]/g) ?? []).length
    const u = bad(utf8)
    const e = bad(euckr)
    if (u < e || (u === e && hangul(utf8) >= hangul(euckr))) return { text: utf8, encoding: 'utf-8' }
    return { text: euckr, encoding: 'euc-kr' }
  }
}

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
const isCfb = (b: Uint8Array) =>
  b.length > 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out[i * 2] = c & 0xff
    out[i * 2 + 1] = c >> 8
  }
  return out
}

function containsBytes(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

const ENCRYPTED_MARK = utf16le('EncryptedPackage')

/** 비밀번호 보호(암호화된 OOXML)는 CFB 컨테이너 안에 EncryptedPackage 스트림이 있다 */
export function isEncryptedWorkbook(bytes: Uint8Array): boolean {
  return isCfb(bytes) && containsBytes(bytes, ENCRYPTED_MARK)
}

/** 셀 값을 문자열로. 날짜 셀은 YYYY-MM-DD[ HH:MM:SS], 시간만 있는 셀은 HH:MM:SS */
export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    const hh = v.getHours()
    const mm = v.getMinutes()
    const ss = v.getSeconds()
    const time = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
    if (v.getFullYear() < 1901) return time
    return hh || mm || ss ? `${dateKeyOf(v)} ${time}` : dateKeyOf(v)
  }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v).replace(/\s+/g, ' ').trim()
}

function sheetRows(ws: WorkSheet): string[][] {
  const aoa = utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: false })
  return aoa.map((r) => r.map(cellToString))
}

/** 거래 시트 점수: 헤더 행이 있고 날짜·금액 그룹을 모두 갖추면 높게, 같으면 행 수가 많은 쪽 */
function sheetScore(rows: string[][]): number {
  const h = detectHeaderRow(rows)
  if (h < 0) return 0
  const groups = headerGroupCount(rows[h])
  const hasDate = rows[h].some((c) => HEADER_GROUPS[0].some((k) => normalizeHeader(c).includes(k)))
  return groups * 10 + (hasDate ? 10 : 0)
}

function pickSheet(wb: WorkBook): { sheetName: string; rows: string[][] } {
  let best: { sheetName: string; rows: string[][]; score: number } | null = null
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws) continue
    const rows = sheetRows(ws).filter((r) => r.some((c) => c !== ''))
    const score = sheetScore(rows)
    // 요약 시트('뱅샐현황', '해외이용내역' 등)보다 거래 헤더가 뚜렷한 시트를 고른다
    if (!best || score > best.score || (score === best.score && rows.length > best.rows.length)) best = { sheetName: name, rows, score }
  }
  if (!best) throw new ImportFileError('empty', '시트가 없는 파일입니다')
  return { sheetName: best.sheetName, rows: best.rows }
}

function parseWorkbook(bytes: Uint8Array, kind: 'xlsx' | 'xls'): ParsedFile {
  let wb: WorkBook
  try {
    wb = read(bytes, { type: 'array', cellDates: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|encrypt/i.test(msg)) throw new ImportFileError('encrypted', ENCRYPTED_MESSAGE)
    throw new ImportFileError('parse', `엑셀 파일을 읽지 못했습니다: ${msg}`)
  }
  const { sheetName, rows } = pickSheet(wb)
  return { kind, sheetName, rows, encoding: 'binary' }
}

/** 구분자 추정: 앞부분 줄에서 한 줄에 가장 많이 나타나는 구분자 */
export function guessDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).slice(0, 60)
  const candidates = [',', '\t', ';', '|']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    let max = 0
    for (const line of lines) {
      let n = 0
      for (let i = 0; i < line.length; i++) if (line[i] === d) n++
      if (n > max) max = n
    }
    if (max > bestCount) {
      best = d
      bestCount = max
    }
  }
  return best
}

export function parseCsvText(text: string): string[][] {
  const res = Papa.parse<string[]>(text, { delimiter: guessDelimiter(text), skipEmptyLines: 'greedy' })
  return res.data.map((r) => r.map((c) => (c ?? '').toString().replace(/\s+/g, ' ').trim()))
}

/** HTML 표(.xls로 위장한 명세서 등). 행이 가장 많은 table을 고른다 */
export function parseHtmlText(text: string): { rows: string[][]; sheetName?: string } {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))
    let best: HTMLTableElement | null = null
    for (const t of tables) if (!best || t.rows.length > best.rows.length) best = t
    if (best) {
      const rows = Array.from(best.rows).map((tr) => Array.from(tr.cells).map((td) => cellToString(td.textContent ?? '')))
      return { rows }
    }
  }
  // DOMParser가 없는 환경: SheetJS의 HTML 파서
  const wb = read(text, { type: 'string', cellDates: true })
  const { sheetName, rows } = pickSheet(wb)
  return { rows, sheetName }
}

export async function parseFile(file: FileLike): Promise<ParsedFile> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bytes.length === 0) throw new ImportFileError('empty', '빈 파일입니다')
  if (isZip(bytes)) return parseWorkbook(bytes, 'xlsx')
  if (isCfb(bytes)) {
    if (isEncryptedWorkbook(bytes)) throw new ImportFileError('encrypted', ENCRYPTED_MESSAGE)
    return parseWorkbook(bytes, 'xls')
  }
  const { text, encoding } = decodeText(buf)
  if (/<\s*table[\s>]/i.test(text) || /^\s*<(!doctype|html)/i.test(text)) {
    const { rows, sheetName } = parseHtmlText(text)
    return { kind: 'html', rows, sheetName, encoding }
  }
  const rows = parseCsvText(text)
  if (rows.length === 0) throw new ImportFileError('empty', '읽을 수 있는 행이 없습니다')
  return { kind: 'csv', rows, encoding }
}

/** 헤더 판별용 키워드 그룹: 서로 다른 그룹이 2개 이상 걸리면 헤더 행 */
const HEADER_GROUPS: string[][] = [
  ['날짜', '일시', '일자', '거래일', '이용일', '승인일', '사용일', '결제일', 'date'],
  ['금액', '출금', '입금', '찾으신', '맡기신', '지급', 'amount'],
  ['내용', '적요', '가맹점', '거래처', '내역', '이용하신곳', '사용처', '보낸분', '받는분', '상대', '기재', '상호', '메모', 'merchant', 'description', 'payee', 'memo', 'note'],
  ['타입', '구분', '유형', 'type'],
]

function headerGroupCount(row: string[]): number {
  const cells = row.map(normalizeHeader).filter(Boolean)
  let n = 0
  for (const g of HEADER_GROUPS) if (cells.some((c) => g.some((k) => c.includes(k)))) n++
  return n
}

/** 헤더 행 인덱스. 앞부분(계좌정보 등)을 건너뛴다. 없으면 -1 */
export function detectHeaderRow(rows: string[][], maxScan = 40): number {
  const limit = Math.min(rows.length, maxScan)
  const hasDate = (row: string[]) => row.some((c) => HEADER_GROUPS[0].some((k) => normalizeHeader(c).includes(k)))
  // 1차: 날짜 열이 있는 헤더 행(조회 조건 행 '거래구분·입출금구분·정렬' 같은 머리말을 건너뛴다), 2차: 그룹 2개 이상
  for (const requireDate of [true, false]) {
    for (const minCells of [3, 2]) {
      for (let i = 0; i < limit; i++) {
        const row = rows[i]
        const filled = row.filter((c) => c.trim() !== '').length
        if (filled < minCells) continue
        if (headerGroupCount(row) >= 2 && (!requireDate || hasDate(row))) return i
      }
    }
  }
  return -1
}

export interface Table {
  headers: string[]
  body: string[][]
  headerIndex: number
}

/** 헤더 행과 본문을 분리. 헤더가 없으면 '열 1..n'을 만든다. 빈 행 제거 */
export function sliceTable(rows: string[][], headerIndex = detectHeaderRow(rows)): Table {
  const bodyRaw = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows
  const body = bodyRaw.filter((r) => r.some((c) => c.trim() !== ''))
  const width = Math.max(headerIndex >= 0 ? rows[headerIndex].length : 0, ...body.map((r) => r.length), 0)
  const headers: string[] = []
  for (let i = 0; i < width; i++) {
    const h = headerIndex >= 0 ? (rows[headerIndex][i] ?? '').replace(/\s+/g, ' ').trim() : ''
    headers.push(h || `열 ${i + 1}`)
  }
  return { headers, body, headerIndex }
}
