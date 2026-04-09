'use strict'

// fzf 风格的子序列匹配：query 的每个字符按顺序出现在 candidate 中即为匹配
// 例如：fuzzyMatch('s2c', 'seed-2-0-code') → true
function fuzzyMatch(query, candidate) {
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  let qi = 0
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) qi++
  }
  return qi === q.length
}

function filterConfigs(query, configNames) {
  return configNames.filter((name) => fuzzyMatch(query, name))
}

module.exports = { fuzzyMatch, filterConfigs }
