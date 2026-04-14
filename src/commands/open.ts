import { execFileSync } from 'node:child_process'
import { cccHome } from '../lib/paths.ts'
import type { CommandContext } from '../types.ts'

export function cmdOpen(_ctx: CommandContext): void {
  execFileSync('open', [cccHome()])
}
