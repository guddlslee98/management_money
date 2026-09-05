import { settingsRepo } from '../../db/repo'
import { fnv1a } from '../../domain/import/hash'
import { normalizeHeader } from '../../domain/import/headers'
import { emptyMapping, type ColumnMapping, type ProfileId } from '../../domain/import/profiles'

export interface SavedMapping {
  headers: string[]
  mapping: ColumnMapping
  savedAt: string
}

const signature = (headers: string[]) => headers.map(normalizeHeader).join('|')

/** 설정 키. 일반 프로필은 헤더 조합마다 따로 저장한다 */
export function mappingKey(profileId: ProfileId, headers: string[]): string {
  return profileId === 'generic' ? `import.mapping.generic.${fnv1a(signature(headers))}` : `import.mapping.${profileId}`
}

/** 같은 헤더 구성으로 저장해 둔 매핑이 있으면 돌려준다 */
export async function loadSavedMapping(profileId: ProfileId, headers: string[]): Promise<ColumnMapping | null> {
  const saved = await settingsRepo.get<SavedMapping | null>(mappingKey(profileId, headers), null)
  if (!saved || !Array.isArray(saved.headers) || signature(saved.headers) !== signature(headers)) return null
  return { ...emptyMapping(), ...saved.mapping }
}

export function saveMapping(profileId: ProfileId, headers: string[], mapping: ColumnMapping): Promise<unknown> {
  const value: SavedMapping = { headers, mapping, savedAt: new Date().toISOString() }
  return settingsRepo.set(mappingKey(profileId, headers), value)
}
