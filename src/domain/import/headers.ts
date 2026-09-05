/** 헤더 비교용 정규화: 소문자, 공백/밑줄 제거 ('거래 일시' == '거래일시') */
export const normalizeHeader = (h: string): string => h.toLowerCase().replace(/[\s_]/g, '')
