/** 브라우저 전용 부수효과 헬퍼 (테스트에서 vi.mock으로 대체) */

/** 텍스트를 파일로 내려받기 (Blob + <a download>) */
export function downloadTextFile(name: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** File.text()가 없는 구형 브라우저용 폴백 포함 */
export function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('파일을 읽을 수 없습니다'))
    r.readAsText(file)
  })
}

export function reloadApp(): void {
  window.location.reload()
}
