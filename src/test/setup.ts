import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// globals:false 이므로 Testing Library의 자동 cleanup을 직접 등록한다
afterEach(() => cleanup())
