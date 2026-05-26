import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_DIRECTION_OVERRIDES } from './data/defaultZoneDirections'
import { DEFAULT_ZONE_OVERRIDES } from './data/defaultZones'
import { JOYSTICK_ANGLES, THROTTLE_ANGLES } from './data/deviceProfiles'
import { formatControlLabel, parseBindingsXml } from './lib/bindings'
import {
  clearAngleDirections,
  cloneDirectionOverrides,
  cloneHotspotOverrides,
  countHotspotZones,
  clearAngleHotspots,
  getDirectionMap,
  getHotspotMap,
  mergeDirectionOverrides,
  mergeHotspotOverrides,
  parseZoneDataJson,
  readDirectionOverrides,
  readHotspotOverrides,
  removeDirection,
  removeHotspot,
  serializeZoneData,
  setDirection,
  setHotspot,
  writeDirectionOverrides,
  writeHotspotOverrides,
  type DirectionOverrides,
  type HotspotOverrides,
} from './lib/hotspots'
import type {
  AngleView,
  BindingRecord,
  ControlZone,
  DeviceKind,
  DirectionTag,
  ParsedProfile,
} from './types'
import './App.css'

type DeviceAssignment = Record<number, DeviceKind>
type DrawPoint = { x: number; y: number }
type ZoneDataStatusTone = 'info' | 'error'
type DirectionPickerValue = 'auto' | DirectionTag

interface ZoneDataStatus {
  tone: ZoneDataStatusTone
  message: string
}

interface RenderZoneGroup {
  key: string
  zone: ControlZone
  controlKeys: string[]
}

interface PreviewCallout {
  key: string
  side: 'left' | 'right' | 'top' | 'bottom'
  left: number
  top: number
  width: number
  height: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  title: string
  lines: string[]
  selectionKey: string
  isSelected: boolean
}

interface ActionFilterFamily {
  family: string
  maps: string[]
}

const AXIS_TOKENS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'u', 'v']
const DIRECTION_SEQUENCE: DirectionPickerValue[] = ['auto', 'left', 'up', 'right', 'down', 'center']

function App() {
  const [xmlFileName, setXmlFileName] = useState<string>('')
  const [parseError, setParseError] = useState<string>('')
  const [profile, setProfile] = useState<ParsedProfile | null>(null)
  const [assignments, setAssignments] = useState<DeviceAssignment>({})
  const [throttleAngleId, setThrottleAngleId] = useState<string>(THROTTLE_ANGLES[0].id)
  const [joystickAngleId, setJoystickAngleId] = useState<string>(JOYSTICK_ANGLES[0].id)
  const [editorEnabled, setEditorEnabled] = useState<boolean>(false)
  const [throttleEditControlKey, setThrottleEditControlKey] = useState<string>('')
  const [joystickEditControlKey, setJoystickEditControlKey] = useState<string>('')
  const [zoneDataStatus, setZoneDataStatus] = useState<ZoneDataStatus | null>(null)
  const [directionOverrides, setDirectionOverrides] = useState<DirectionOverrides>(() => {
    const localDirections = readDirectionOverrides()
    return mergeDirectionOverrides(DEFAULT_DIRECTION_OVERRIDES, localDirections)
  })
  const [hotspotOverrides, setHotspotOverrides] = useState<HotspotOverrides>(() => {
    const localOverrides = readHotspotOverrides()
    return mergeHotspotOverrides(DEFAULT_ZONE_OVERRIDES, localOverrides)
  })

  useEffect(() => {
    writeHotspotOverrides(hotspotOverrides)
  }, [hotspotOverrides])

  useEffect(() => {
    writeDirectionOverrides(directionOverrides)
  }, [directionOverrides])

  const bindingsByJoystick = useMemo(() => {
    const map = new Map<number, BindingRecord[]>()
    if (!profile) {
      return map
    }

    for (const binding of profile.bindings) {
      const list = map.get(binding.joystickId) ?? []
      list.push(binding)
      map.set(binding.joystickId, list)
    }

    return map
  }, [profile])

  const throttleJoystickId = useMemo(
    () => getAssignedJoystickId(assignments, 'throttle'),
    [assignments],
  )
  const joystickJoystickId = useMemo(
    () => getAssignedJoystickId(assignments, 'joystick'),
    [assignments],
  )

  const throttleBindings = throttleJoystickId
    ? bindingsByJoystick.get(throttleJoystickId) ?? []
    : []
  const joystickBindings = joystickJoystickId
    ? bindingsByJoystick.get(joystickJoystickId) ?? []
    : []

  const handleXmlImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setXmlFileName(file.name)

    try {
      const xmlText = await file.text()
      const parsedProfile = parseBindingsXml(xmlText)
      setProfile(parsedProfile)
      setAssignments(buildDefaultAssignments(parsedProfile.joystickIds))
      setParseError('')
      setThrottleEditControlKey('')
      setJoystickEditControlKey('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse this XML file.'
      setParseError(message)
      setProfile(null)
      setAssignments({})
    }
  }

  const handleAssignmentChange = (joystickId: number, nextKind: DeviceKind) => {
    setAssignments((current) => {
      const nextAssignments = { ...current }

      if (nextKind !== 'none') {
        for (const [key, value] of Object.entries(nextAssignments)) {
          if (Number(key) !== joystickId && value === nextKind) {
            nextAssignments[Number(key)] = 'none'
          }
        }
      }

      nextAssignments[joystickId] = nextKind
      return nextAssignments
    })
  }

  const handlePlaceZone = (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    zone: ControlZone,
  ) => {
    setHotspotOverrides((current) => setHotspot(current, deviceKind, angleId, controlKey, zone))
  }

  const handleRemoveZone = (deviceKind: DeviceKind, angleId: string, controlKey: string) => {
    setHotspotOverrides((current) => removeHotspot(current, deviceKind, angleId, controlKey))
    setDirectionOverrides((current) => removeDirection(current, deviceKind, angleId, controlKey))
  }

  const handleSetDirection = (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    direction: DirectionTag,
  ) => {
    setDirectionOverrides((current) => setDirection(current, deviceKind, angleId, controlKey, direction))
  }

  const handleRemoveDirection = (deviceKind: DeviceKind, angleId: string, controlKey: string) => {
    setDirectionOverrides((current) => removeDirection(current, deviceKind, angleId, controlKey))
  }

  const handleResetAngleZones = (deviceKind: DeviceKind, angleId: string) => {
    setHotspotOverrides((current) => clearAngleHotspots(current, deviceKind, angleId))
    setDirectionOverrides((current) => clearAngleDirections(current, deviceKind, angleId))
  }

  const handleExportZones = () => {
    const payload = serializeZoneData(hotspotOverrides, directionOverrides)
    const blob = new Blob([payload], { type: 'application/json' })
    const exportUrl = URL.createObjectURL(blob)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const filename = `hotas-zones-${timestamp}.json`
    const link = document.createElement('a')
    link.href = exportUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(exportUrl)

    setZoneDataStatus({
      tone: 'info',
      message: `Exported ${countHotspotZones(hotspotOverrides)} zones to ${filename}.`,
    })
  }

  const handleImportZones = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const fileText = await file.text()
      const imported = parseZoneDataJson(fileText)
      setHotspotOverrides(mergeHotspotOverrides(DEFAULT_ZONE_OVERRIDES, imported.overrides))
      setDirectionOverrides(
        mergeDirectionOverrides(DEFAULT_DIRECTION_OVERRIDES, imported.directionOverrides),
      )
      setZoneDataStatus({
        tone: 'info',
        message: `Imported ${countHotspotZones(imported.overrides)} zones from ${file.name}.`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not import this zones JSON file.'
      setZoneDataStatus({
        tone: 'error',
        message,
      })
    } finally {
      event.target.value = ''
    }
  }

  const handleResetLocalZones = () => {
    setHotspotOverrides(cloneHotspotOverrides(DEFAULT_ZONE_OVERRIDES))
    setDirectionOverrides(cloneDirectionOverrides(DEFAULT_DIRECTION_OVERRIDES))
    setZoneDataStatus({
      tone: 'info',
      message: 'Local edits cleared. Only bundled default zones are active now.',
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="kicker">HOTAS Keybinding Viewer</p>
        <h1>XML Binding to Visual HOTAS Map</h1>
        <p className="intro">
          Import a Star Citizen XML profile, assign each detected `js` device as throttle or
          joystick, then map bindings on each image angle with the zone editor.
        </p>
      </header>

      <section className="panel upload-panel">
        <label className="field-label" htmlFor="xmlFile">
          XML Binding File
        </label>
        <div className="import-row">
          <input id="xmlFile" type="file" accept=".xml,text/xml" onChange={handleXmlImport} />
          <span className="file-chip">{xmlFileName || 'No file loaded yet'}</span>
        </div>
        {parseError && <p className="error-message">{parseError}</p>}
      </section>

      {profile && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Profile & Device Assignment</h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setEditorEnabled((current) => !current)}
              >
                {editorEnabled ? 'Disable zone editor' : 'Enable zone editor'}
              </button>
            </div>
            <p className="meta-line">
              Profile: <strong>{profile.profileName}</strong> | Parsed bindings:{' '}
              <strong>{profile.bindings.length}</strong>
            </p>
            <div className="assignment-grid">
              {profile.joystickIds.map((joystickId) => (
                <label className="assignment-card" key={joystickId}>
                  <span className="assignment-title">js{joystickId}</span>
                  <select
                    value={assignments[joystickId] ?? 'none'}
                    onChange={(event) =>
                      handleAssignmentChange(joystickId, event.target.value as DeviceKind)
                    }
                  >
                    <option value="none">Not displayed</option>
                    <option value="throttle">Throttle</option>
                    <option value="joystick">Joystick</option>
                  </select>
                  <span className="assignment-count">
                    {bindingsByJoystick.get(joystickId)?.length ?? 0} bindings
                  </span>
                </label>
              ))}
            </div>

            <div className="zone-data-bar">
              <p>
                Zone data: <strong>{countHotspotZones(hotspotOverrides)}</strong> saved zones
              </p>
              <div className="zone-data-actions">
                <button type="button" className="ghost-button" onClick={handleExportZones}>
                  Export zones JSON
                </button>
                <label className="ghost-button file-import-button">
                  Import zones JSON
                  <input type="file" accept="application/json,.json" onChange={handleImportZones} />
                </label>
                <button type="button" className="ghost-button" onClick={handleResetLocalZones}>
                  Reset local zones
                </button>
              </div>
              {zoneDataStatus && (
                <p className={`zone-data-status ${zoneDataStatus.tone}`}>{zoneDataStatus.message}</p>
              )}
            </div>
          </section>

          <section className="layout-grid">
            <DevicePanel
              title="Throttle"
              deviceKind="throttle"
              joystickId={throttleJoystickId}
              bindings={throttleBindings}
              angles={THROTTLE_ANGLES}
              selectedAngleId={throttleAngleId}
              onAngleChange={setThrottleAngleId}
              editorEnabled={editorEnabled}
              editControlKey={throttleEditControlKey}
              onEditControlKeyChange={setThrottleEditControlKey}
              hotspotOverrides={hotspotOverrides}
              directionOverrides={directionOverrides}
              onPlaceZone={handlePlaceZone}
              onRemoveZone={handleRemoveZone}
              onSetDirection={handleSetDirection}
              onRemoveDirection={handleRemoveDirection}
              onResetAngleZones={handleResetAngleZones}
            />
            <DevicePanel
              title="Joystick"
              deviceKind="joystick"
              joystickId={joystickJoystickId}
              bindings={joystickBindings}
              angles={JOYSTICK_ANGLES}
              selectedAngleId={joystickAngleId}
              onAngleChange={setJoystickAngleId}
              editorEnabled={editorEnabled}
              editControlKey={joystickEditControlKey}
              onEditControlKeyChange={setJoystickEditControlKey}
              hotspotOverrides={hotspotOverrides}
              directionOverrides={directionOverrides}
              onPlaceZone={handlePlaceZone}
              onRemoveZone={handleRemoveZone}
              onSetDirection={handleSetDirection}
              onRemoveDirection={handleRemoveDirection}
              onResetAngleZones={handleResetAngleZones}
            />
          </section>
        </>
      )}

      {!profile && (
        <section className="panel empty-panel">
          <h2>Ready</h2>
          <p>
            Start by importing an XML file from the game, then assign `js1`, `js2`, `js3` as
            throttle or joystick.
          </p>
        </section>
      )}
    </main>
  )
}

interface DevicePanelProps {
  title: string
  deviceKind: Extract<DeviceKind, 'throttle' | 'joystick'>
  joystickId: number | undefined
  bindings: BindingRecord[]
  angles: AngleView[]
  selectedAngleId: string
  onAngleChange: (angleId: string) => void
  editorEnabled: boolean
  editControlKey: string
  onEditControlKeyChange: (controlKey: string) => void
  hotspotOverrides: HotspotOverrides
  directionOverrides: DirectionOverrides
  onPlaceZone: (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    zone: ControlZone,
  ) => void
  onRemoveZone: (deviceKind: DeviceKind, angleId: string, controlKey: string) => void
  onSetDirection: (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    direction: DirectionTag,
  ) => void
  onRemoveDirection: (deviceKind: DeviceKind, angleId: string, controlKey: string) => void
  onResetAngleZones: (deviceKind: DeviceKind, angleId: string) => void
}

function DevicePanel({
  title,
  deviceKind,
  joystickId,
  bindings,
  angles,
  selectedAngleId,
  onAngleChange,
  editorEnabled,
  editControlKey,
  onEditControlKeyChange,
  hotspotOverrides,
  directionOverrides,
  onPlaceZone,
  onRemoveZone,
  onSetDirection,
  onRemoveDirection,
  onResetAngleZones,
}: DevicePanelProps) {
  const selectedAngle = angles.find((angle) => angle.id === selectedAngleId) ?? angles[0]
  const overrideZones = getHotspotMap(hotspotOverrides, deviceKind, selectedAngle.id)
  const overrideDirections = getDirectionMap(directionOverrides, deviceKind, selectedAngle.id)
  const mergedZones = useMemo(
    () => ({ ...selectedAngle.zoneDefaults, ...overrideZones }),
    [selectedAngle.zoneDefaults, overrideZones],
  )
  const [draftZone, setDraftZone] = useState<ControlZone | null>(null)
  const [linkTargetControlKey, setLinkTargetControlKey] = useState<string>('')
  const [linkDirectionValue, setLinkDirectionValue] = useState<DirectionPickerValue>('auto')
  const [selectedActionFilters, setSelectedActionFilters] = useState<string[]>([])
  const [filterMenuOpen, setFilterMenuOpen] = useState<boolean>(false)
  const dragStartRef = useRef<DrawPoint | null>(null)
  const drawingControlKeyRef = useRef<string>('')

  const bindingsByControl = useMemo(() => {
    const map = new Map<string, BindingRecord[]>()
    for (const binding of bindings) {
      const list = map.get(binding.controlKey) ?? []
      list.push(binding)
      map.set(binding.controlKey, list)
    }
    return map
  }, [bindings])

  const actionFilterFamilies = useMemo(
    () => buildActionFilterFamilies(bindings),
    [bindings],
  )

  const availableFilterKeys = useMemo(() => {
    const keys: string[] = []
    for (const family of actionFilterFamilies) {
      keys.push(makeFamilyFilterKey(family.family))
      for (const mapLabel of family.maps) {
        keys.push(makeMapFilterKey(mapLabel))
      }
    }
    return keys
  }, [actionFilterFamilies])

  const selectedFilterSet = useMemo(() => {
    const available = new Set(availableFilterKeys)
    return new Set(selectedActionFilters.filter((filterKey) => available.has(filterKey)))
  }, [selectedActionFilters, availableFilterKeys])

  const previewBindingsByControl = useMemo(() => {
    const map = new Map<string, BindingRecord[]>()
    for (const binding of bindings) {
      if (!matchesPreviewFilter(binding, selectedFilterSet)) {
        continue
      }

      const list = map.get(binding.controlKey) ?? []
      list.push(binding)
      map.set(binding.controlKey, list)
    }
    return map
  }, [bindings, selectedFilterSet])

  const controls = useMemo(() => {
    const controlKeys = new Set<string>([...bindingsByControl.keys(), ...Object.keys(mergedZones)])
    if (editorEnabled) {
      const expanded = buildEditorControlCatalog(Array.from(controlKeys))
      for (const controlKey of expanded) {
        controlKeys.add(controlKey)
      }
    }

    return Array.from(controlKeys).sort((a, b) =>
      compactControlLabel(a).localeCompare(compactControlLabel(b), 'en'),
    )
  }, [bindingsByControl, mergedZones, editorEnabled])

  const mappedControls = controls.filter((controlKey) => mergedZones[controlKey] !== undefined)
  const unmappedControls = controls.filter((controlKey) => mergedZones[controlKey] === undefined)

  const visibleControls = editorEnabled
    ? controls
    : controls.filter((controlKey) => {
        if (!mergedZones[controlKey]) {
          return false
        }
        return (previewBindingsByControl.get(controlKey) ?? []).length > 0
      })

  const activeControlKey = editControlKey || controls[0] || ''
  const activeZone = activeControlKey ? mergedZones[activeControlKey] : undefined
  const activeDirectionValue: DirectionPickerValue = activeControlKey
    ? (overrideDirections[activeControlKey] ?? 'auto')
    : 'auto'

  const linkedControlsForActive = useMemo(
    () =>
      controls.filter((controlKey) => {
        const zone = mergedZones[controlKey]
        return zonesEqual(zone, activeZone)
      }),
    [controls, mergedZones, activeZone],
  )

  const linkCandidates = useMemo(
    () =>
      controls.filter(
        (controlKey) =>
          controlKey !== activeControlKey && !zonesEqual(mergedZones[controlKey], activeZone),
      ),
    [controls, activeControlKey, mergedZones, activeZone],
  )

  const zoneGroups = useMemo(
    () => buildZoneGroups(visibleControls.filter((controlKey) => !!mergedZones[controlKey]), mergedZones),
    [visibleControls, mergedZones],
  )
  const listControls = editorEnabled ? controls : visibleControls
  const effectiveLinkTargetControlKey =
    linkCandidates.includes(linkTargetControlKey) ?
      linkTargetControlKey
    : (linkCandidates[0] ?? '')

  const toggleActionFilter = (filterKey: string) => {
    setSelectedActionFilters((current) =>
      current.includes(filterKey) ?
        current.filter((key) => key !== filterKey)
      : [...current, filterKey],
    )
  }

  const clearActionFilters = () => {
    setSelectedActionFilters([])
  }

  const beginDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editorEnabled || event.button !== 0) {
      return
    }

    event.preventDefault()
    if (!activeControlKey) {
      return
    }

    if (!editControlKey) {
      onEditControlKeyChange(activeControlKey)
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    drawingControlKeyRef.current = activeControlKey

    const point = pointFromMouse(event.currentTarget, event.clientX, event.clientY)
    dragStartRef.current = point
    setDraftZone({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })
  }

  const updateDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return
    }

    event.preventDefault()
    const point = pointFromMouse(event.currentTarget, event.clientX, event.clientY)
    setDraftZone(zoneFromPoints(dragStartRef.current, point))
  }

  const finishDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return
    }

    event.preventDefault()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const startPoint = dragStartRef.current
    const point = pointFromMouse(event.currentTarget, event.clientX, event.clientY)
    const zone = zoneFromPoints(startPoint, point)
    dragStartRef.current = null
    setDraftZone(null)
    const controlToSave = drawingControlKeyRef.current || activeControlKey
    drawingControlKeyRef.current = ''

    if (!controlToSave) {
      return
    }

    if (zone.width < 0.9 || zone.height < 0.9) {
      return
    }

    onPlaceZone(deviceKind, selectedAngle.id, controlToSave, zone)
  }

  const handleSelectedDirectionChange = (nextValue: DirectionPickerValue) => {
    if (!activeControlKey) {
      return
    }

    if (nextValue === 'auto') {
      onRemoveDirection(deviceKind, selectedAngle.id, activeControlKey)
      return
    }

    onSetDirection(deviceKind, selectedAngle.id, activeControlKey, nextValue)
  }

  const handleLinkToActiveZone = () => {
    if (!activeZone || !activeControlKey || !effectiveLinkTargetControlKey) {
      return
    }

    onPlaceZone(deviceKind, selectedAngle.id, effectiveLinkTargetControlKey, activeZone)
    if (linkDirectionValue === 'auto') {
      onRemoveDirection(deviceKind, selectedAngle.id, effectiveLinkTargetControlKey)
      return
    }

    onSetDirection(deviceKind, selectedAngle.id, effectiveLinkTargetControlKey, linkDirectionValue)
  }

  const displayBindingsByControl = editorEnabled ? bindingsByControl : previewBindingsByControl
  const previewCallouts = useMemo(
    () => buildPreviewCallouts(zoneGroups, displayBindingsByControl, overrideDirections, editControlKey),
    [zoneGroups, displayBindingsByControl, overrideDirections, editControlKey],
  )

  return (
    <article className="panel device-panel">
      <div className="panel-heading">
        <h2>
          {title} <span className="device-chip">{joystickId ? `js${joystickId}` : 'Not assigned'}</span>
        </h2>
        <label className="angle-select-label">
          Angle
          <select value={selectedAngle.id} onChange={(event) => onAngleChange(event.target.value)}>
            {angles.map((angle) => (
              <option value={angle.id} key={angle.id}>
                {angle.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!editorEnabled && (
        <>
          <div className="preview-filter-bar">
            <button
              type="button"
              className={`ghost-button filter-menu-button ${filterMenuOpen ? 'is-open' : ''}`}
              onClick={() => setFilterMenuOpen((current) => !current)}
              disabled={actionFilterFamilies.length === 0}
            >
              Preview modes:{' '}
              {selectedFilterSet.size === 0 ? 'All' : `${selectedFilterSet.size} selected`}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={clearActionFilters}
              disabled={selectedFilterSet.size === 0}
            >
              Clear modes
            </button>
          </div>
          {filterMenuOpen && (
            <div className="preview-filter-menu">
              {actionFilterFamilies.map((family) => {
                const familyKey = makeFamilyFilterKey(family.family)
                return (
                  <div className="filter-family" key={family.family}>
                    <label
                      className={`filter-check ${selectedFilterSet.has(familyKey) ? 'is-checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFilterSet.has(familyKey)}
                        onChange={() => toggleActionFilter(familyKey)}
                      />
                      <span>{family.family}</span>
                    </label>
                    <div className="filter-map-list">
                      {family.maps.map((mapLabel) => {
                        const mapKey = makeMapFilterKey(mapLabel)
                        return (
                          <label
                            className={`filter-check map ${selectedFilterSet.has(mapKey) ? 'is-checked' : ''}`}
                            key={mapLabel}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFilterSet.has(mapKey)}
                              onChange={() => toggleActionFilter(mapKey)}
                            />
                            <span>{mapLabel}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {actionFilterFamilies.length === 0 && (
                <p className="empty-message">No binding modes found.</p>
              )}
            </div>
          )}
        </>
      )}

      {joystickId ? (
        <>
          <div
            className={`device-canvas ${editorEnabled ? 'editor-active' : 'preview-active'}`}
            onPointerDown={beginDraw}
            onPointerMove={updateDraw}
            onPointerUp={finishDraw}
            onPointerCancel={finishDraw}
            onPointerLeave={(event) => {
              if (dragStartRef.current) {
                finishDraw(event)
              }
            }}
            onDragStart={(event) => {
              event.preventDefault()
            }}
            role={editorEnabled ? 'button' : undefined}
            tabIndex={editorEnabled ? 0 : -1}
          >
            <img
              src={selectedAngle.imagePath}
              alt={`${title} ${selectedAngle.label}`}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
            />
            {editorEnabled &&
              zoneGroups.map((group) => {
                const selectionKey = group.controlKeys.includes(editControlKey)
                  ? editControlKey
                  : group.controlKeys[0]
                const isSelected = editControlKey ? group.controlKeys.includes(editControlKey) : false

                return (
                  <button
                    type="button"
                    className={`zone-hitbox ${isSelected ? 'is-selected' : ''}`}
                    key={group.key}
                    style={{
                      left: `${group.zone.x}%`,
                      top: `${group.zone.y}%`,
                      width: `${group.zone.width}%`,
                      height: `${group.zone.height}%`,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditControlKeyChange(selectionKey)
                    }}
                  >
                    <span className="zone-label">
                      {group.controlKeys.length === 1
                        ? compactControlLabel(group.controlKeys[0])
                        : buildGroupDirectionLabel(group.controlKeys, overrideDirections)}
                    </span>
                    <span className="hotspot-tooltip">
                      <strong>
                        {group.controlKeys.length === 1
                          ? displayBindingsByControl.get(group.controlKeys[0])?.[0]?.controlLabel ??
                            formatControlLabel(group.controlKeys[0])
                          : `${group.controlKeys.length} linked controls`}
                      </strong>
                      {group.controlKeys.map((controlKey) => {
                        const controlBindings = displayBindingsByControl.get(controlKey) ?? []
                        const actionLabels = uniqueActionLabels(controlBindings)
                        const direction = resolveDirection(controlKey, overrideDirections)
                        const directionPrefix = direction
                          ? `${directionTagLabel(direction)} • `
                          : ''

                        return (
                          <span key={controlKey}>
                            {directionPrefix}
                            {controlBindings[0]?.controlLabel ?? controlKey}
                            {actionLabels.length > 0 ? ` — ${actionLabels.join(' | ')}` : ''}
                          </span>
                        )
                      })}
                    </span>
                  </button>
                )
              })}
            {!editorEnabled && previewCallouts.length > 0 && (
              <>
                <svg className="callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {previewCallouts.map((callout) => (
                    <line
                      key={`line-${callout.key}`}
                      x1={callout.sourceX}
                      y1={callout.sourceY}
                      x2={callout.targetX}
                      y2={callout.targetY}
                    />
                  ))}
                </svg>
                {previewCallouts.map((callout) => (
                  <button
                    type="button"
                    key={callout.key}
                    className={`callout-card side-${callout.side} ${callout.isSelected ? 'is-selected' : ''}`}
                    style={{
                      left: `${callout.left}%`,
                      top: `${callout.top}%`,
                      width: `${callout.width}%`,
                      height: `${callout.height}%`,
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditControlKeyChange(callout.selectionKey)
                    }}
                  >
                    <strong>{callout.title}</strong>
                    {callout.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </button>
                ))}
              </>
            )}
            {draftZone && (
              <div
                className="zone-draft"
                style={{
                  left: `${draftZone.x}%`,
                  top: `${draftZone.y}%`,
                  width: `${draftZone.width}%`,
                  height: `${draftZone.height}%`,
                }}
              />
            )}
          </div>

          <div className="binding-summary">
            <p>
              <strong>{mappedControls.length}</strong> controls with zone
            </p>
            <p>
              <strong>{zoneGroups.length}</strong> distinct zones on this angle
            </p>
            <p>
              <strong>{unmappedControls.length}</strong> controls without zone on this angle
            </p>
          </div>

          <div className="list-wrap">
            <h3>Control List</h3>
            <div className="control-list">
              {listControls.map((controlKey) => {
                const controlBindings =
                  (editorEnabled ? bindingsByControl : previewBindingsByControl).get(controlKey) ??
                  []
                const boundActions = uniqueActionLabels(controlBindings)
                const hasZone = mergedZones[controlKey] !== undefined

                return (
                  <button
                    type="button"
                    className={`control-pill ${editControlKey === controlKey ? 'is-selected' : ''}`}
                    key={controlKey}
                    onClick={() => onEditControlKeyChange(controlKey)}
                  >
                    <span className="left">
                      <strong>{controlBindings[0]?.controlLabel ?? formatControlLabel(controlKey)}</strong>
                      <small>
                        {boundActions.length > 0 ? boundActions.join(' • ') : 'No binding in current XML'}
                      </small>
                    </span>
                    <span className={`status-dot ${hasZone ? 'ok' : 'todo'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {editorEnabled && (
            <div className="editor-bar">
              <p>
                Zone editor: select a control in the list, then click + drag on image to draw a
                rectangle zone.
              </p>
              {!editControlKey && <p className="editor-warning">No control selected yet.</p>}
              {!!activeControlKey && (
                <div className="multi-zone-tools">
                  <div className="tool-row">
                    <label className="tool-label">
                      Selected control direction
                      <select
                        value={activeDirectionValue}
                        onChange={(event) =>
                          handleSelectedDirectionChange(event.target.value as DirectionPickerValue)
                        }
                      >
                        {DIRECTION_SEQUENCE.map((direction) => (
                          <option value={direction} key={direction}>
                            {directionPickerLabel(direction)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="tool-hint">
                      Resolved:{' '}
                      <strong>
                        {resolveDirection(activeControlKey, overrideDirections)
                          ? directionTagLabel(resolveDirection(activeControlKey, overrideDirections)!)
                          : 'None'}
                      </strong>
                    </span>
                  </div>

                  <div className="tool-row">
                    <label className="tool-label">
                      Link another control to this same zone
                      <select
                        value={effectiveLinkTargetControlKey}
                        onChange={(event) => setLinkTargetControlKey(event.target.value)}
                        disabled={!activeZone || linkCandidates.length === 0}
                      >
                        {linkCandidates.length === 0 && <option value="">No controls available</option>}
                        {linkCandidates.map((controlKey) => (
                          <option key={controlKey} value={controlKey}>
                            {bindingsByControl.get(controlKey)?.[0]?.controlLabel ??
                              formatControlLabel(controlKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="tool-label">
                      Linked control direction
                      <select
                        value={linkDirectionValue}
                        onChange={(event) =>
                          setLinkDirectionValue(event.target.value as DirectionPickerValue)
                        }
                      >
                        {DIRECTION_SEQUENCE.map((direction) => (
                          <option value={direction} key={direction}>
                            {direction === 'auto' ? 'Auto for linked control' : directionTagLabel(direction)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!activeZone || !effectiveLinkTargetControlKey}
                      onClick={handleLinkToActiveZone}
                    >
                      Link control to zone
                    </button>
                  </div>

                  <p className="tool-hint">
                    Shared controls on selected zone:{' '}
                    <strong>
                      {linkedControlsForActive.length > 0
                        ? linkedControlsForActive
                            .map((controlKey) => {
                              const direction = resolveDirection(controlKey, overrideDirections)
                              const suffix = direction ? ` (${directionTagLabel(direction)})` : ''
                              return `${compactControlLabel(controlKey)}${suffix}`
                            })
                            .join(', ')
                        : 'None'}
                    </strong>
                  </p>
                </div>
              )}
              <div className="editor-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onResetAngleZones(deviceKind, selectedAngle.id)}
                >
                  Clear all zones on this angle
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!editControlKey}
                  onClick={() => {
                    if (editControlKey) {
                      onRemoveZone(deviceKind, selectedAngle.id, editControlKey)
                    }
                  }}
                >
                  Remove selected control zone
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="empty-message">
          Assign one `js` device to {title.toLowerCase()} to display this panel.
        </p>
      )}
    </article>
  )
}

function buildZoneGroups(
  mappedControls: string[],
  mergedZones: Record<string, ControlZone>,
): RenderZoneGroup[] {
  const byZone = new Map<string, RenderZoneGroup>()

  for (const controlKey of mappedControls) {
    const zone = mergedZones[controlKey]
    if (!zone) {
      continue
    }

    const key = `${zone.x.toFixed(4)}:${zone.y.toFixed(4)}:${zone.width.toFixed(4)}:${zone.height.toFixed(4)}`
    const existing = byZone.get(key)
    if (existing) {
      existing.controlKeys.push(controlKey)
      continue
    }

    byZone.set(key, {
      key,
      zone,
      controlKeys: [controlKey],
    })
  }

  return Array.from(byZone.values())
}

function zonesEqual(a: ControlZone | undefined, b: ControlZone | undefined): boolean {
  if (!a || !b) {
    return false
  }
  return (
    Math.abs(a.x - b.x) < 0.0001 &&
    Math.abs(a.y - b.y) < 0.0001 &&
    Math.abs(a.width - b.width) < 0.0001 &&
    Math.abs(a.height - b.height) < 0.0001
  )
}

function resolveDirection(
  controlKey: string,
  overrides: Record<string, DirectionTag>,
): DirectionTag | null {
  return overrides[controlKey] ?? inferDirectionFromControlKey(controlKey)
}

function inferDirectionFromControlKey(controlKey: string): DirectionTag | null {
  if (/_(up)$/i.test(controlKey)) {
    return 'up'
  }
  if (/_(down)$/i.test(controlKey)) {
    return 'down'
  }
  if (/_(left)$/i.test(controlKey)) {
    return 'left'
  }
  if (/_(right)$/i.test(controlKey)) {
    return 'right'
  }
  return null
}

function directionTagLabel(tag: DirectionTag): string {
  if (tag === 'center') {
    return 'Center'
  }
  if (tag === 'up') {
    return 'Up'
  }
  if (tag === 'down') {
    return 'Down'
  }
  if (tag === 'left') {
    return 'Left'
  }
  return 'Right'
}

function directionShort(tag: DirectionTag): string {
  if (tag === 'center') {
    return 'C'
  }
  if (tag === 'up') {
    return 'U'
  }
  if (tag === 'down') {
    return 'D'
  }
  if (tag === 'left') {
    return 'L'
  }
  return 'R'
}

function buildGroupDirectionLabel(
  controlKeys: string[],
  overrides: Record<string, DirectionTag>,
): string {
  if (controlKeys.length === 1) {
    return compactControlLabel(controlKeys[0])
  }

  const ordered: DirectionTag[] = ['left', 'up', 'right', 'down', 'center']
  const tagSet = new Set<DirectionTag>()

  for (const controlKey of controlKeys) {
    const direction = resolveDirection(controlKey, overrides)
    if (direction) {
      tagSet.add(direction)
    }
  }

  const summary = ordered.filter((tag) => tagSet.has(tag)).map(directionShort)
  if (summary.length === 0) {
    return `${controlKeys.length} keys`
  }
  return summary.join('/')
}

function buildPreviewCallouts(
  zoneGroups: RenderZoneGroup[],
  bindingsByControl: Map<string, BindingRecord[]>,
  directionOverrides: Record<string, DirectionTag>,
  editControlKey: string,
): PreviewCallout[] {
  const sideWidth = 26
  const topWidth = 20
  const sideHeight = 9
  const topHeight = 8.5

  const provisional = zoneGroups.map((group) => {
    const sourceX = clamp(group.zone.x + group.zone.width / 2, 0, 100)
    const sourceY = clamp(group.zone.y + group.zone.height / 2, 0, 100)
    const side = pickCalloutSide(sourceX, sourceY)
    const selectionKey = group.controlKeys.includes(editControlKey) ? editControlKey : group.controlKeys[0]
    const isSelected = editControlKey ? group.controlKeys.includes(editControlKey) : false
    const title =
      group.controlKeys.length === 1 ?
        bindingsByControl.get(group.controlKeys[0])?.[0]?.controlLabel ??
        formatControlLabel(group.controlKeys[0])
      : `${buildGroupDirectionLabel(group.controlKeys, directionOverrides)} • ${group.controlKeys.length} controls`

    const lines = group.controlKeys
      .slice()
      .sort((a, b) =>
        directionSortRank(resolveDirection(a, directionOverrides)).localeCompare(
          directionSortRank(resolveDirection(b, directionOverrides)),
          'en',
        ),
      )
      .map((controlKey) => {
        const direction = resolveDirection(controlKey, directionOverrides)
        const directionText = direction ? `${directionTagLabel(direction)} • ` : ''
        const bindings = bindingsByControl.get(controlKey) ?? []
        const actions = summarizeActions(uniqueActionLabels(bindings), 2)
        const label = bindings[0]?.controlLabel ?? formatControlLabel(controlKey)
        return `${directionText}${label}${actions ? ` — ${actions}` : ''}`
      })
      .slice(0, 4)

    return {
      key: group.key,
      side,
      sourceX,
      sourceY,
      width: side === 'top' || side === 'bottom' ? topWidth : sideWidth,
      height: side === 'top' || side === 'bottom' ? topHeight : sideHeight,
      left: 0,
      top: 0,
      targetX: 0,
      targetY: 0,
      title,
      lines,
      selectionKey,
      isSelected,
    }
  })

  resizeCalloutsForSide(provisional, 'left', { available: 88, preferred: sideHeight, min: 5.4, kind: 'height' })
  resizeCalloutsForSide(provisional, 'right', { available: 88, preferred: sideHeight, min: 5.4, kind: 'height' })
  resizeCalloutsForSide(provisional, 'top', { available: 92, preferred: topWidth, min: 12, kind: 'width' })
  resizeCalloutsForSide(provisional, 'bottom', { available: 92, preferred: topWidth, min: 12, kind: 'width' })

  placeCalloutsOnSide(provisional, 'left', { axisStart: 6, axisEnd: 94, fixedCoord: 1, axis: 'y' })
  placeCalloutsOnSide(provisional, 'right', { axisStart: 6, axisEnd: 94, fixedCoord: 73, axis: 'y' })
  placeCalloutsOnSide(provisional, 'top', { axisStart: 4, axisEnd: 96, fixedCoord: 1, axis: 'x' })
  placeCalloutsOnSide(provisional, 'bottom', { axisStart: 4, axisEnd: 96, fixedCoord: 90, axis: 'x' })

  return provisional
}

function resizeCalloutsForSide(
  callouts: PreviewCallout[],
  side: PreviewCallout['side'],
  config: { available: number; preferred: number; min: number; kind: 'width' | 'height' },
): void {
  const onSide = callouts.filter((callout) => callout.side === side)
  if (onSide.length === 0) {
    return
  }

  const maxByCount = config.available / onSide.length - 0.8
  const finalSize = clamp(Math.min(config.preferred, maxByCount), config.min, config.preferred)
  for (const callout of onSide) {
    if (config.kind === 'width') {
      callout.width = finalSize
      continue
    }
    callout.height = finalSize
  }
}

function placeCalloutsOnSide(
  callouts: PreviewCallout[],
  side: PreviewCallout['side'],
  config: { axisStart: number; axisEnd: number; fixedCoord: number; axis: 'x' | 'y' },
): void {
  const onSide = callouts.filter((callout) => callout.side === side)
  if (onSide.length === 0) {
    return
  }

  const sorted = onSide.sort((a, b) =>
    config.axis === 'y' ? a.sourceY - b.sourceY : a.sourceX - b.sourceX,
  )
  const centers = distributeCenters(sorted.length, config.axisStart, config.axisEnd)

  sorted.forEach((callout, index) => {
    if (config.axis === 'y') {
      callout.left = config.fixedCoord
      callout.top = clamp(centers[index] - callout.height / 2, 1, 100 - callout.height - 1)
      if (side === 'left') {
        callout.targetX = callout.left + callout.width
      } else {
        callout.targetX = callout.left
      }
      callout.targetY = callout.top + callout.height / 2
      return
    }

    callout.top = config.fixedCoord
    callout.left = clamp(centers[index] - callout.width / 2, 1, 100 - callout.width - 1)
    if (side === 'top') {
      callout.targetY = callout.top + callout.height
    } else {
      callout.targetY = callout.top
    }
    callout.targetX = callout.left + callout.width / 2
  })
}

function distributeCenters(count: number, start: number, end: number): number[] {
  if (count <= 1) {
    return [(start + end) / 2]
  }

  const gap = (end - start) / (count + 1)
  const centers: number[] = []
  for (let index = 0; index < count; index += 1) {
    centers.push(start + gap * (index + 1))
  }
  return centers
}

function pickCalloutSide(x: number, y: number): PreviewCallout['side'] {
  if (y <= 17) {
    return 'top'
  }
  if (y >= 86) {
    return 'bottom'
  }
  if (x <= 50) {
    return 'left'
  }
  return 'right'
}

function summarizeActions(actions: string[], max: number): string {
  if (actions.length === 0) {
    return ''
  }

  if (actions.length <= max) {
    return actions.join(' | ')
  }

  const displayed = actions.slice(0, max).join(' | ')
  return `${displayed} (+${actions.length - max})`
}

function directionSortRank(direction: DirectionTag | null): string {
  if (direction === 'left') {
    return '1'
  }
  if (direction === 'up') {
    return '2'
  }
  if (direction === 'right') {
    return '3'
  }
  if (direction === 'down') {
    return '4'
  }
  if (direction === 'center') {
    return '5'
  }
  return '9'
}

function directionPickerLabel(direction: DirectionPickerValue): string {
  if (direction === 'auto') {
    return 'Auto from control name'
  }
  return directionTagLabel(direction)
}

function buildEditorControlCatalog(existingControls: string[]): string[] {
  const controls = new Set(existingControls)
  let maxButton = 32
  let maxSlider = 2
  let maxHat = 1
  let maxPov = 1

  for (const controlKey of controls) {
    const buttonMatch = /^button(\d+)$/i.exec(controlKey)
    if (buttonMatch) {
      maxButton = Math.max(maxButton, Number.parseInt(buttonMatch[1], 10))
      continue
    }

    const sliderMatch = /^slider(\d+)$/i.exec(controlKey)
    if (sliderMatch) {
      maxSlider = Math.max(maxSlider, Number.parseInt(sliderMatch[1], 10))
      continue
    }

    const hatMatch = /^hat(\d+)_(up|down|left|right)$/i.exec(controlKey)
    if (hatMatch) {
      maxHat = Math.max(maxHat, Number.parseInt(hatMatch[1], 10))
      continue
    }

    const povMatch = /^pov(\d+)_(up|down|left|right)$/i.exec(controlKey)
    if (povMatch) {
      maxPov = Math.max(maxPov, Number.parseInt(povMatch[1], 10))
    }
  }

  for (let index = 1; index <= maxButton; index += 1) {
    controls.add(`button${index}`)
  }

  for (const axis of AXIS_TOKENS) {
    controls.add(axis)
  }

  for (let index = 1; index <= maxSlider; index += 1) {
    controls.add(`slider${index}`)
  }

  for (let index = 1; index <= maxHat; index += 1) {
    controls.add(`hat${index}_left`)
    controls.add(`hat${index}_up`)
    controls.add(`hat${index}_right`)
    controls.add(`hat${index}_down`)
  }

  for (let index = 1; index <= maxPov; index += 1) {
    controls.add(`pov${index}_left`)
    controls.add(`pov${index}_up`)
    controls.add(`pov${index}_right`)
    controls.add(`pov${index}_down`)
  }

  return Array.from(controls)
}

function buildActionFilterFamilies(bindings: BindingRecord[]): ActionFilterFamily[] {
  const byFamily = new Map<string, Set<string>>()
  for (const binding of bindings) {
    const family = extractActionFamily(binding.actionMapLabel)
    const existing = byFamily.get(family) ?? new Set<string>()
    existing.add(binding.actionMapLabel)
    byFamily.set(family, existing)
  }

  return Array.from(byFamily.entries())
    .map(([family, maps]) => ({
      family,
      maps: Array.from(maps).sort((a, b) => a.localeCompare(b, 'en')),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, 'en'))
}

function extractActionFamily(actionMapLabel: string): string {
  const trimmed = actionMapLabel.trim()
  if (!trimmed) {
    return 'Other'
  }

  const firstSpace = trimmed.indexOf(' ')
  if (firstSpace === -1) {
    return trimmed
  }
  return trimmed.slice(0, firstSpace)
}

function makeFamilyFilterKey(family: string): string {
  return `family:${family}`
}

function makeMapFilterKey(mapLabel: string): string {
  return `map:${mapLabel}`
}

function matchesPreviewFilter(binding: BindingRecord, selectedFilters: Set<string>): boolean {
  if (selectedFilters.size === 0) {
    return true
  }

  const familyKey = makeFamilyFilterKey(extractActionFamily(binding.actionMapLabel))
  const mapKey = makeMapFilterKey(binding.actionMapLabel)
  return selectedFilters.has(familyKey) || selectedFilters.has(mapKey)
}

function buildDefaultAssignments(joystickIds: number[]): DeviceAssignment {
  const nextAssignments: DeviceAssignment = {}
  joystickIds.forEach((joystickId, index) => {
    if (index === 0) {
      nextAssignments[joystickId] = 'throttle'
      return
    }
    if (index === 1) {
      nextAssignments[joystickId] = 'joystick'
      return
    }
    nextAssignments[joystickId] = 'none'
  })
  return nextAssignments
}

function getAssignedJoystickId(
  assignments: DeviceAssignment,
  kind: Extract<DeviceKind, 'throttle' | 'joystick'>,
): number | undefined {
  const match = Object.entries(assignments).find(([, value]) => value === kind)
  if (!match) {
    return undefined
  }

  return Number(match[0])
}

function uniqueActionLabels(bindings: BindingRecord[]): string[] {
  const labels = bindings.map((binding) => `${binding.actionMapLabel}: ${binding.actionLabel}`)
  return Array.from(new Set(labels))
}

function compactControlLabel(controlKey: string): string {
  const buttonMatch = /^button(\d+)$/.exec(controlKey)
  if (buttonMatch) {
    return `B${buttonMatch[1]}`
  }

  const sliderMatch = /^slider(\d+)$/.exec(controlKey)
  if (sliderMatch) {
    return `S${sliderMatch[1]}`
  }

  if (/^[a-z]+$/.test(controlKey)) {
    return controlKey.toUpperCase()
  }

  return controlKey.toUpperCase()
}

function pointFromMouse(
  target: HTMLDivElement,
  clientX: number,
  clientY: number,
): DrawPoint {
  const rect = target.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  }
}

function zoneFromPoints(a: DrawPoint, b: DrawPoint): ControlZone {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x, b.x)
  const bottom = Math.max(a.y, b.y)

  return {
    x: clamp(left, 0, 100),
    y: clamp(top, 0, 100),
    width: clamp(right - left, 0, 100),
    height: clamp(bottom - top, 0, 100),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default App
