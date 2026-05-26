import type { ControlZone, DeviceKind, DirectionTag } from '../types'

const ZONES_STORAGE_KEY = 'hotas-viewer.zones.v2'
const DIRECTION_STORAGE_KEY = 'hotas-viewer.zone-directions.v1'
const LEGACY_HOTSPOTS_STORAGE_KEY = 'hotas-viewer.hotspots.v1'
const ZONES_EXPORT_SCHEMA = 'hotas-zone-data'
const ZONES_EXPORT_VERSION = 2

type LegacyPoint = { x: number; y: number }
type LegacyOverrides = Record<string, Record<string, LegacyPoint>>

export type HotspotOverrides = Record<string, Record<string, ControlZone>>
export type DirectionOverrides = Record<string, Record<string, DirectionTag>>
export interface HotspotExportPayload {
  schema: string
  version: number
  overrides: HotspotOverrides
  directionOverrides: DirectionOverrides
}

function storageKey(deviceKind: DeviceKind, angleId: string): string {
  return `${deviceKind}:${angleId}`
}

export function readHotspotOverrides(): HotspotOverrides {
  try {
    const raw = window.localStorage.getItem(ZONES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as HotspotOverrides
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_HOTSPOTS_STORAGE_KEY)
    if (!legacyRaw) {
      return {}
    }

    const legacyParsed = JSON.parse(legacyRaw) as LegacyOverrides
    return migrateLegacyHotspots(legacyParsed)
  } catch {
    return {}
  }
}

export function writeHotspotOverrides(overrides: HotspotOverrides): void {
  window.localStorage.setItem(ZONES_STORAGE_KEY, JSON.stringify(overrides))
}

export function readDirectionOverrides(): DirectionOverrides {
  try {
    const raw = window.localStorage.getItem(DIRECTION_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    return sanitizeDirectionOverrides(parsed)
  } catch {
    return {}
  }
}

export function writeDirectionOverrides(overrides: DirectionOverrides): void {
  window.localStorage.setItem(DIRECTION_STORAGE_KEY, JSON.stringify(overrides))
}

export function mergeHotspotOverrides(
  base: HotspotOverrides,
  overrides: HotspotOverrides,
): HotspotOverrides {
  const next: HotspotOverrides = {}

  for (const [mapKey, controls] of Object.entries(base)) {
    next[mapKey] = { ...controls }
  }

  for (const [mapKey, controls] of Object.entries(overrides)) {
    next[mapKey] = {
      ...(next[mapKey] ?? {}),
      ...controls,
    }
  }

  return next
}

export function cloneHotspotOverrides(overrides: HotspotOverrides): HotspotOverrides {
  const next: HotspotOverrides = {}
  for (const [mapKey, controls] of Object.entries(overrides)) {
    next[mapKey] = { ...controls }
  }
  return next
}

export function mergeDirectionOverrides(
  base: DirectionOverrides,
  overrides: DirectionOverrides,
): DirectionOverrides {
  const next: DirectionOverrides = {}

  for (const [mapKey, controls] of Object.entries(base)) {
    next[mapKey] = { ...controls }
  }

  for (const [mapKey, controls] of Object.entries(overrides)) {
    next[mapKey] = {
      ...(next[mapKey] ?? {}),
      ...controls,
    }
  }

  return next
}

export function cloneDirectionOverrides(overrides: DirectionOverrides): DirectionOverrides {
  const next: DirectionOverrides = {}
  for (const [mapKey, controls] of Object.entries(overrides)) {
    next[mapKey] = { ...controls }
  }
  return next
}

export function countHotspotZones(overrides: HotspotOverrides): number {
  let total = 0
  for (const controls of Object.values(overrides)) {
    total += Object.keys(controls).length
  }
  return total
}

export function serializeZoneData(
  overrides: HotspotOverrides,
  directionOverrides: DirectionOverrides,
): string {
  const payload: HotspotExportPayload = {
    schema: ZONES_EXPORT_SCHEMA,
    version: ZONES_EXPORT_VERSION,
    overrides,
    directionOverrides,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseZoneDataJson(raw: string): {
  overrides: HotspotOverrides
  directionOverrides: DirectionOverrides
} {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid JSON format: expected an object.')
  }

  const candidateOverrides = 'overrides' in parsed ? parsed.overrides : parsed
  const candidateDirections = 'directionOverrides' in parsed ? parsed.directionOverrides : {}

  return {
    overrides: sanitizeHotspotOverrides(candidateOverrides),
    directionOverrides: sanitizeDirectionOverrides(candidateDirections),
  }
}

export function getHotspotMap(
  overrides: HotspotOverrides,
  deviceKind: DeviceKind,
  angleId: string,
): Record<string, ControlZone> {
  if (deviceKind === 'none') {
    return {}
  }

  return overrides[storageKey(deviceKind, angleId)] ?? {}
}

export function setHotspot(
  overrides: HotspotOverrides,
  deviceKind: DeviceKind,
  angleId: string,
  controlKey: string,
  zone: ControlZone,
): HotspotOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  return {
    ...overrides,
    [mapKey]: {
      ...(overrides[mapKey] ?? {}),
      [controlKey]: zone,
    },
  }
}

export function removeHotspot(
  overrides: HotspotOverrides,
  deviceKind: DeviceKind,
  angleId: string,
  controlKey: string,
): HotspotOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  const currentMap = { ...(overrides[mapKey] ?? {}) }
  delete currentMap[controlKey]

  return {
    ...overrides,
    [mapKey]: currentMap,
  }
}

export function clearAngleHotspots(
  overrides: HotspotOverrides,
  deviceKind: DeviceKind,
  angleId: string,
): HotspotOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  return {
    ...overrides,
    [mapKey]: {},
  }
}

export function getDirectionMap(
  overrides: DirectionOverrides,
  deviceKind: DeviceKind,
  angleId: string,
): Record<string, DirectionTag> {
  if (deviceKind === 'none') {
    return {}
  }

  return overrides[storageKey(deviceKind, angleId)] ?? {}
}

export function setDirection(
  overrides: DirectionOverrides,
  deviceKind: DeviceKind,
  angleId: string,
  controlKey: string,
  direction: DirectionTag,
): DirectionOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  return {
    ...overrides,
    [mapKey]: {
      ...(overrides[mapKey] ?? {}),
      [controlKey]: direction,
    },
  }
}

export function removeDirection(
  overrides: DirectionOverrides,
  deviceKind: DeviceKind,
  angleId: string,
  controlKey: string,
): DirectionOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  const currentMap = { ...(overrides[mapKey] ?? {}) }
  delete currentMap[controlKey]

  return {
    ...overrides,
    [mapKey]: currentMap,
  }
}

export function clearAngleDirections(
  overrides: DirectionOverrides,
  deviceKind: DeviceKind,
  angleId: string,
): DirectionOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  return {
    ...overrides,
    [mapKey]: {},
  }
}

function migrateLegacyHotspots(legacy: LegacyOverrides): HotspotOverrides {
  const next: HotspotOverrides = {}
  for (const [angleKey, controls] of Object.entries(legacy ?? {})) {
    next[angleKey] = {}
    for (const [controlKey, point] of Object.entries(controls ?? {})) {
      next[angleKey][controlKey] = {
        x: clamp(point.x - 2.4, 0, 100),
        y: clamp(point.y - 2.4, 0, 100),
        width: 4.8,
        height: 4.8,
      }
    }
  }
  return next
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function sanitizeHotspotOverrides(raw: unknown): HotspotOverrides {
  if (!isRecord(raw)) {
    throw new Error('Invalid overrides payload.')
  }

  const next: HotspotOverrides = {}
  for (const [mapKey, controls] of Object.entries(raw)) {
    if (!isRecord(controls)) {
      continue
    }

    next[mapKey] = {}
    for (const [controlKey, maybeZone] of Object.entries(controls)) {
      if (!isRecord(maybeZone)) {
        continue
      }

      const x = toFiniteNumber(maybeZone.x)
      const y = toFiniteNumber(maybeZone.y)
      const width = toFiniteNumber(maybeZone.width)
      const height = toFiniteNumber(maybeZone.height)
      if (x === null || y === null || width === null || height === null) {
        continue
      }

      next[mapKey][controlKey] = {
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        width: clamp(width, 0, 100),
        height: clamp(height, 0, 100),
      }
    }
  }

  return next
}

function sanitizeDirectionOverrides(raw: unknown): DirectionOverrides {
  if (!isRecord(raw)) {
    return {}
  }

  const next: DirectionOverrides = {}
  for (const [mapKey, controls] of Object.entries(raw)) {
    if (!isRecord(controls)) {
      continue
    }

    next[mapKey] = {}
    for (const [controlKey, value] of Object.entries(controls)) {
      if (!isDirectionTag(value)) {
        continue
      }
      next[mapKey][controlKey] = value
    }
  }

  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null
  }
  if (!Number.isFinite(value)) {
    return null
  }
  return value
}

function isDirectionTag(value: unknown): value is DirectionTag {
  return (
    value === 'center' ||
    value === 'up' ||
    value === 'down' ||
    value === 'left' ||
    value === 'right'
  )
}
