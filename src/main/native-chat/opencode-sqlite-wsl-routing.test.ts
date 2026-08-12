import { describe, expect, it, vi } from 'vitest'
import type * as OpenCodeSqliteTranscript from './opencode-sqlite-transcript'

const mocks = vi.hoisted(() => ({
  resolveDbPath: vi.fn(() => '\\\\wsl.localhost\\Ubuntu\\home\\dev\\.local\\share\\opencode\\opencode.db'),
  readTranscript: vi.fn(async () => ({ messages: [], hasMore: false, beforeOffset: 0 })),
  subscribeTranscript: vi.fn(() => ({ unsubscribe: vi.fn(), watching: true }))
}))

vi.mock('./opencode-sqlite-transcript', async () => {
  const actual = await vi.importActual<typeof OpenCodeSqliteTranscript>(
    './opencode-sqlite-transcript'
  )
  return {
    ...actual,
    resolveOpenCodeNativeChatDbPath: mocks.resolveDbPath,
    readOpenCodeNativeChatTranscriptTail: mocks.readTranscript
  }
})

vi.mock('./opencode-sqlite-live', () => ({
  subscribeOpenCodeNativeChatTranscript: mocks.subscribeTranscript
}))

import { readNativeChatTranscriptTail } from './transcript-tail-reader'
import { subscribeNativeChatTranscript } from './transcript-watch'

describe('OpenCode WSL database routing', () => {
  it('routes reads through the owning distro path', async () => {
    const result = await readNativeChatTranscriptTail({
      agent: 'opencode',
      sessionId: 'ses-wsl',
      openCodeDbPath: '/home/dev/.local/share/opencode/opencode.db',
      openCodeWslDistro: 'Ubuntu',
      limit: 20
    })

    expect(result).toEqual({ messages: [], hasMore: false, beforeOffset: 0 })
    expect(mocks.resolveDbPath).toHaveBeenCalledWith(
      '/home/dev/.local/share/opencode/opencode.db',
      'Ubuntu'
    )
    expect(mocks.readTranscript).toHaveBeenCalledWith({
      dbPath: '\\\\wsl.localhost\\Ubuntu\\home\\dev\\.local\\share\\opencode\\opencode.db',
      sessionId: 'ses-wsl',
      limit: 20,
      beforeOffset: undefined,
      signal: undefined
    })
  })

  it('routes subscriptions through the owning distro path', async () => {
    const subscription = await subscribeNativeChatTranscript({
      agent: 'opencode',
      sessionId: 'ses-wsl',
      openCodeDbPath: '/home/dev/.local/share/opencode/opencode.db',
      openCodeWslDistro: 'Ubuntu',
      onAppend: vi.fn()
    })

    expect(subscription.watching).toBe(true)
    expect(mocks.resolveDbPath).toHaveBeenCalledWith(
      '/home/dev/.local/share/opencode/opencode.db',
      'Ubuntu'
    )
    expect(mocks.subscribeTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        dbPath: '\\\\wsl.localhost\\Ubuntu\\home\\dev\\.local\\share\\opencode\\opencode.db',
        sessionId: 'ses-wsl'
      })
    )
  })
})
