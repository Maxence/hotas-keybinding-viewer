import type { DeviceKind, HotspotPoint } from '../types'

const HOTSPOTS_STORAGE_KEY = 'hotas-viewer.hotspots.v1'

export type HotspotOverrides = Record<string, Record<string, HotspotPoint>>

function storageKey(deviceKind: DeviceKind, angleId: string): string {
  return `${deviceKind}:${angleId}`
}

export function readHotspotOverrides(): HotspotOverrides {
  try {
    const raw = window.localStorage.getItem(HOTSPOTS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as HotspotOverrides
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed
  } catch {
    return {}
  }
}

export function writeHotspotOverrides(overrides: HotspotOverrides): void {
  window.localStorage.setItem(HOTSPOTS_STORAGE_KEY, JSON.stringify(overrides))
}

export function getHotspotMap(
  overrides: HotspotOverrides,
  deviceKind: DeviceKind,
  angleId: string,
): Record<string, HotspotPoint> {
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
  point: HotspotPoint,
): HotspotOverrides {
  if (deviceKind === 'none') {
    return overrides
  }

  const mapKey = storageKey(deviceKind, angleId)
  return {
    ...overrides,
    [mapKey]: {
      ...(overrides[mapKey] ?? {}),
      [controlKey]: point,
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
