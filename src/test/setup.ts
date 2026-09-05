import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// globals:false 이므로 Testing Library의 자동 cleanup을 직접 등록한다
afterEach(() => cleanup())

// 병렬 워커·CI 부하에서 findBy*/waitFor 가 1초 안에 못 끝나는 플레이크 방지
configure({ asyncUtilTimeout: 8000 })
