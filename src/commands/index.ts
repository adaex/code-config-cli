import type { CommandHandler } from '../types.ts'
import { cmdBackup } from './backup.ts'
import { cmdHelp } from './help.ts'
import { cmdProxy } from './proxy.ts'
import { cmdUpdate } from './update.ts'

export const commands = new Map<string, CommandHandler>([
  ['proxy', cmdProxy],
  ['backup', cmdBackup],
  ['update', cmdUpdate],
  ['help', cmdHelp],
  ['--help', cmdHelp],
  ['-h', cmdHelp],
])
