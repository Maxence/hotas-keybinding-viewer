import type { ControlZone, DeviceKind } from '../types'

const ZONES_STORAGE_KEY = 'hotas-viewer.zones.v2'
const LEGACY_HOTSPOTS_STORAGE_KEY = 'hotas-viewer.hotspots.v1'

type LegacyPoint = { x: number; y: number }
type LegacyOverrides = Record<string, Record<string, LegacyPoint>>

export type HotspotOverrides = Record<string, Record<string, ControlZone>>

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
