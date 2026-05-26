import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_DIRECTION_OVERRIDES } from './data/defaultZoneDirections'
import { DEFAULT_ZONE_OVERRIDES } from './data/defaultZones'
import { JOYSTICK_ANGLES, THROTTLE_ANGLES } from './data/deviceProfiles'
import { parseBindingsXml } from './lib/bindings'
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

  const controls = useMemo(
    () =>
      Array.from(bindingsByControl.keys()).sort((a, b) =>
        compactControlLabel(a).localeCompare(compactControlLabel(b), 'en'),
      ),
    [bindingsByControl],
  )

  const mappedControls = controls.filter((controlKey) => mergedZones[controlKey] !== undefined)
  const unmappedControls = controls.filter((controlKey) => mergedZones[controlKey] === undefined)

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
    () => buildZoneGroups(mappedControls, mergedZones),
    [mappedControls, mergedZones],
  )
  const effectiveLinkTargetControlKey =
    linkCandidates.includes(linkTargetControlKey) ?
      linkTargetControlKey
    : (linkCandidates[0] ?? '')

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

      {joystickId ? (
        <>
          <div
            className={`device-canvas ${editorEnabled ? 'editor-active' : ''}`}
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
            {zoneGroups.map((group) => {
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
                        ? bindingsByControl.get(group.controlKeys[0])?.[0]?.controlLabel ??
                          group.controlKeys[0]
                        : `${group.controlKeys.length} linked controls`}
                    </strong>
                    {group.controlKeys.map((controlKey) => {
                      const controlBindings = bindingsByControl.get(controlKey) ?? []
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
              {controls.map((controlKey) => {
                const controlBindings = bindingsByControl.get(controlKey) ?? []
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
                      <strong>{controlBindings[0]?.controlLabel ?? controlKey}</strong>
                      <small>{boundActions.join(' • ')}</small>
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
                        <option value="auto">Auto from control name</option>
                        <option value="center">Center</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
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
                            {bindingsByControl.get(controlKey)?.[0]?.controlLabel ?? controlKey}
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
                        <option value="auto">Auto</option>
                        <option value="center">Center</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
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

  const ordered: DirectionTag[] = ['center', 'up', 'down', 'left', 'right']
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
