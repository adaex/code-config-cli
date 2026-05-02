export interface ModelEntry {
  modelName: string
  apiBase: string
}

export function parseModelList(yaml: string): ModelEntry[] {
  const lines = yaml.split('\n')
  const results: ModelEntry[] = []
  let inModelList = false
  let current: Partial<ModelEntry> | null = null
  let inLitellmParams = false

  for (const line of lines) {
    if (/^model_list:\s*$/.test(line)) {
      inModelList = true
      continue
    }

    if (inModelList && line.length > 0 && !line.startsWith(' ')) {
      if (current?.modelName && current.apiBase) results.push(current as ModelEntry)
      current = null
      break
    }

    if (!inModelList) continue

    const itemMatch = line.match(/^\s{2}- model_name:\s*(.+)/)
    if (itemMatch) {
      if (current?.modelName && current.apiBase) results.push(current as ModelEntry)
      current = { modelName: itemMatch[1]!.trim() }
      inLitellmParams = false
      continue
    }

    if (current && /^\s{4}litellm_params:\s*$/.test(line)) {
      inLitellmParams = true
      continue
    }

    if (current && inLitellmParams) {
      const baseMatch = line.match(/^\s{6}api_base:\s*(.+)/)
      if (baseMatch) {
        current.apiBase = baseMatch[1]!.trim()
        continue
      }
    }

    if (inLitellmParams && /^\s{4}\S/.test(line) && !/^\s{4}litellm_params/.test(line)) {
      inLitellmParams = false
    }
  }

  if (current?.modelName && current.apiBase) results.push(current as ModelEntry)
  return results
}
