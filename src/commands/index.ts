import type { CommandHandler } from '../types.ts'
import { cmdHelp } from './help.ts'
import { cmdList } from './list.ts'
import { cmdLog } from './log.ts'
import { cmdSave } from './save.ts'
import { cmdStatus } from './status.ts'
import { cmdUpdate } from './update.ts'
import { cmdUse } from './use.ts'

export const commands = new Map<string, CommandHandler>([
  ['list', cmdList],
  ['status', cmdStatus],
  ['use', cmdUse],
  ['save', cmdSave],
  ['update', cmdUpdate],
  ['log', cmdLog],
  ['help', cmdHelp],
  ['--help', cmdHelp],
  ['-h', cmdHelp],
])
