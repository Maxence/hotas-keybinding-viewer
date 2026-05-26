import type { BindingRecord, ParsedProfile } from '../types'

const ACRONYMS = new Set(['ifcs', 'vtol', 'hud', 'esp', 'qml', 'scm', 'mfd'])

const CATEGORY_WORD_OVERRIDES: Record<string, string> = {
  seat: 'Seat',
  general: 'General',
  spaceship: 'Spaceship',
  movement: 'Movement',
  defensive: 'Defensive',
  offensive: 'Offensive',
  mining: 'Mining',
  salvage: 'Salvage',
}

export function parseBindingsXml(xmlText: string): ParsedProfile {
  const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid XML file.')
  }

  const root = xmlDoc.querySelector('ActionMaps')
  if (!root) {
    throw new Error('Could not find <ActionMaps> root node.')
  }

  const profileName = root.getAttribute('profileName')?.trim() || 'Unnamed profile'
  const records: BindingRecord[] = []
  const joystickIdsFromOptions = readJoystickIdsFromOptions(root)
  const actionMaps = Array.from(root.getElementsByTagName('actionmap'))

  for (const actionMapNode of actionMaps) {
    const actionMapName = actionMapNode.getAttribute('name')?.trim() || 'unknown_category'
    const actionMapLabel = formatCategoryLabel(actionMapName)

    const actionNodes = Array.from(actionMapNode.children).filter(
      (node): node is Element => node.tagName.toLowerCase() === 'action',
    )

    for (const actionNode of actionNodes) {
      const actionName = actionNode.getAttribute('name')?.trim() || 'unknown_action'
      const actionLabel = formatActionLabel(actionName)

      const rebindNodes = Array.from(actionNode.children).filter(
        (node): node is Element => node.tagName.toLowerCase() === 'rebind',
      )

      for (const rebindNode of rebindNodes) {
        const inputRaw = rebindNode.getAttribute('input')?.trim() || ''
        const parsedInput = parseJoystickInput(inputRaw)
        if (!parsedInput) {
          continue
        }

        records.push({
          actionMap: actionMapName,
          actionMapLabel,
          actionName,
          actionLabel,
          inputRaw,
          joystickId: parsedInput.joystickId,
          controlKey: parsedInput.controlKey,
          controlLabel: formatControlLabel(parsedInput.controlKey),
        })
      }
    }
  }

  const joystickIds = Array.from(
    new Set([...joystickIdsFromOptions, ...records.map((record) => record.joystickId)]),
  ).sort((a, b) => a - b)

  return {
    profileName,
    joystickIds,
    bindings: records,
  }
}

function readJoystickIdsFromOptions(root: Element): number[] {
  const optionsNodes = Array.from(root.getElementsByTagName('options'))
  const ids: number[] = []

  for (const node of optionsNodes) {
    const type = node.getAttribute('type')?.trim().toLowerCase()
    if (type !== 'joystick') {
      continue
    }

    const instanceRaw = node.getAttribute('instance')?.trim() ?? ''
    const parsed = Number.parseInt(instanceRaw, 10)
    if (!Number.isNaN(parsed)) {
      ids.push(parsed)
    }
  }

  return ids
}

function parseJoystickInput(inputRaw: string): { joystickId: number; controlKey: string } | null {
  const trimmed = inputRaw.trim()
  const match = /^js(\d+)_(.+)$/i.exec(trimmed)
  if (!match) {
    return null
  }

  const joystickId = Number.parseInt(match[1], 10)
  if (Number.isNaN(joystickId)) {
    return null
  }

  const tail = match[2].replace(/\s+/g, '').toLowerCase()
  if (!tail) {
    return null
  }

  const controlCandidate = tail.includes('+') ? tail.split('+').at(-1) ?? '' : tail
  const controlKey = normalizeControlKey(controlCandidate)
  if (!controlKey) {
    return null
  }

  return {
    joystickId,
    controlKey,
  }
}

function normalizeControlKey(rawControl: string): string {
  const lower = rawControl.trim().toLowerCase()
  if (!lower) {
    return ''
  }

  const buttonMatch = /^button(\d+)$/.exec(lower)
  if (buttonMatch) {
    return `button${buttonMatch[1]}`
  }

  const sliderMatch = /^slider(\d+)$/.exec(lower)
  if (sliderMatch) {
    return `slider${sliderMatch[1]}`
  }

  const axisTokens = new Set(['x', 'y', 'z', 'rx', 'ry', 'rz', 'u', 'v'])
  if (axisTokens.has(lower)) {
    return lower
  }

  if (/^pov\d+_(up|down|left|right)$/.test(lower)) {
    return lower
  }

  if (/^hat\d+_(up|down|left|right)$/.test(lower)) {
    return lower
  }

  return lower
}

function titleToken(token: string): string {
  if (ACRONYMS.has(token)) {
    return token.toUpperCase()
  }

  return token.charAt(0).toUpperCase() + token.slice(1)
}

function formatCategoryLabel(raw: string): string {
  return raw
    .split('_')
    .map((token) => CATEGORY_WORD_OVERRIDES[token] ?? titleToken(token))
    .join(' ')
}

function formatActionLabel(raw: string): string {
  return raw
    .replace(/^v_/, '')
    .split('_')
    .map((token) => {
      if (token === 'abs') {
        return 'Axis'
      }
      return titleToken(token)
    })
    .join(' ')
}

export function formatControlLabel(controlKey: string): string {
  const buttonMatch = /^button(\d+)$/.exec(controlKey)
  if (buttonMatch) {
    return `Button ${buttonMatch[1]}`
  }

  const sliderMatch = /^slider(\d+)$/.exec(controlKey)
  if (sliderMatch) {
    return `Slider ${sliderMatch[1]}`
  }

  if (/^[a-z]+$/.test(controlKey)) {
    return `Axis ${controlKey.toUpperCase()}`
  }

  const hatOrPov = /^((?:hat|pov)\d+)_(up|down|left|right)$/.exec(controlKey)
  if (hatOrPov) {
    return `${hatOrPov[1].toUpperCase()} ${hatOrPov[2].toUpperCase()}`
  }

  return controlKey
}
