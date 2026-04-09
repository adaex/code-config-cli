'use strict'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'

function info(msg) {
  console.log(`${CYAN}◆${RESET} ${msg}`)
}
function warn(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`)
}
function error(msg) {
  console.error(`${RED}✗${RESET} ${msg}`)
}
function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}
function dim(msg) {
  console.log(`  ${DIM}${msg}${RESET}`)
}
function dryRun(msg) {
  console.log(`  ${DIM}→ ${msg}${RESET}`)
}
function dot() {
  process.stdout.write('.')
}

// 步骤标题：普通颜色，轻量前缀
function step(msg) {
  console.log(`\n${msg}`)
}

module.exports = {
  info,
  warn,
  error,
  success,
  dim,
  dryRun,
  step,
  dot,
  RESET,
  BOLD,
  DIM,
  GREEN,
  YELLOW,
  RED,
  CYAN,
}
