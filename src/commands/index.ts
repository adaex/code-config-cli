import type { CommandHandler } from '../types.ts'
import { cmdBackup } from './backup.ts'
import { cmdHelp } from './help.ts'
import { cmdOpen } from './open.ts'
import { cmdProxy } from './proxy.ts'
import { cmdUpdate } from './update.ts'

export const commands = new Map<string, CommandHandler>([
  ['proxy', cmdProxy],
  ['backup', cmdBackup],
  ['open', cmdOpen],
  ['update', cmdUpdate],
  ['help', cmdHelp],
  ['--help', cmdHelp],
  ['-h', cmdHelp],
])
