import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../wsl', () => ({
  getWslHome: vi.fn(() => '\\\\wsl.localhost\\Ubuntu\\home\\dev'),
  toWindowsWslPath: (path: string, distro: string) =>
    `\\\\wsl.localhost\\${distro}${path.split('/').join(String.fromCharCode(92))}`
}))
import { resolveOpenCodeNativeChatDbPath } from './opencode-sqlite-transcript'

let dataHome = ''

beforeEach(() => {
  dataHome = mkdtempSync(join(tmpdir(), 'orca-opencode-native-chat-data-'))
  vi.stubEnv('XDG_DATA_HOME', dataHome)
  vi.stubEnv('OPENCODE_DB', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataHome, { recursive: true, force: true })
})

describe('resolveOpenCodeNativeChatDbPath', () => {
  it('defaults to the legacy DB when no known database exists', () => {
    expect(resolveOpenCodeNativeChatDbPath()).toBe(join(dataHome, 'opencode', 'opencode.db'))
  })

  it('selects the current OpenCode database filename when present', () => {
    const dataDirectory = join(dataHome, 'opencode')
    mkdirSync(dataDirectory, { recursive: true })
    const currentPath = join(dataDirectory, 'opencode-next.db')
    writeFileSync(currentPath, '')

    expect(resolveOpenCodeNativeChatDbPath()).toBe(currentPath)
  })
  it('prefers the canonical database when sibling copies also exist', () => {
    const dataDirectory = join(dataHome, 'opencode')
    mkdirSync(dataDirectory, { recursive: true })
    const canonicalPath = join(dataDirectory, 'opencode.db')
    const nextPath = join(dataDirectory, 'opencode-next.db')
    writeFileSync(canonicalPath, '')
    writeFileSync(nextPath, '')

    expect(resolveOpenCodeNativeChatDbPath()).toBe(canonicalPath)
  })

  it('skips a directory and selects the next regular database file', () => {
    const dataDirectory = join(dataHome, 'opencode')
    mkdirSync(join(dataDirectory, 'opencode.db'), { recursive: true })
    const nextPath = join(dataDirectory, 'opencode-next.db')
    writeFileSync(nextPath, '')

    expect(resolveOpenCodeNativeChatDbPath()).toBe(nextPath)
  })

  it('keeps an absolute OPENCODE_DB path unchanged', () => {
    const absolutePath = join(dataHome, 'absolute.db')
    writeFileSync(absolutePath, '')
    vi.stubEnv('OPENCODE_DB', absolutePath)

    expect(resolveOpenCodeNativeChatDbPath()).toBe(absolutePath)
  })

  it('returns no live database for OPENCODE_DB memory mode', () => {
    vi.stubEnv('OPENCODE_DB', ':memory:')

    expect(resolveOpenCodeNativeChatDbPath()).toBeNull()
  })

  it('rejects an OPENCODE_DB directory instead of opening it', () => {
    const dataDirectory = join(dataHome, 'opencode')
    const directoryPath = join(dataDirectory, 'profile')
    mkdirSync(directoryPath, { recursive: true })
    vi.stubEnv('OPENCODE_DB', 'profile')

    expect(resolveOpenCodeNativeChatDbPath()).toBeNull()
  })


  it('maps the local WSL default database to the owning distro UNC path', () => {
    vi.stubEnv('XDG_DATA_HOME', '')
    expect(resolveOpenCodeNativeChatDbPath(undefined, 'Ubuntu')).toBe(
      '\\\\wsl.localhost\\Ubuntu\\home\\dev\\.local\\share\\opencode\\opencode.db'
    )
  })

  it('maps a configured WSL database path to the owning distro UNC path', () => {
    vi.stubEnv('OPENCODE_DB', '/home/dev/.cache/opencode-custom.db')
    expect(resolveOpenCodeNativeChatDbPath(undefined, 'Ubuntu')).toBe(
      '\\\\wsl.localhost\\Ubuntu\\home\\dev\\.cache\\opencode-custom.db'
    )
  })
  it('resolves a relative OPENCODE_DB under the host data directory', () => {
    vi.stubEnv('OPENCODE_DB', 'profiles/opencode-custom.db')
    expect(resolveOpenCodeNativeChatDbPath()).toBe(
      join(dataHome, 'opencode', 'profiles/opencode-custom.db')
    )
  })

  it('honors an explicit internal override before the host environment', () => {
    vi.stubEnv('OPENCODE_DB', '/host/profile/opencode-custom.db')
    expect(resolveOpenCodeNativeChatDbPath('/tmp/db/db.sqlite')).toBe('/tmp/db/db.sqlite')
  })
})
