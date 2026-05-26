import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_ZONE_OVERRIDES } from './data/defaultZones'
import { JOYSTICK_ANGLES, THROTTLE_ANGLES } from './data/deviceProfiles'
import { parseBindingsXml } from './lib/bindings'
import {
  cloneHotspotOverrides,
  countHotspotZones,
  clearAngleHotspots,
  getHotspotMap,
  mergeHotspotOverrides,
  parseHotspotOverridesJson,
  readHotspotOverrides,
  removeHotspot,
  setHotspot,
  serializeHotspotOverrides,
  writeHotspotOverrides,
  type HotspotOverrides,
} from './lib/hotspots'
import type {
  AngleView,
  BindingRecord,
  ControlZone,
  DeviceKind,
  ParsedProfile,
} from './types'
import './App.css'

type DeviceAssignment = Record<number, DeviceKind>
type DrawPoint = { x: number; y: number }
type ZoneDataStatusTone = 'info' | 'error'

interface ZoneDataStatus {
  tone: ZoneDataStatusTone
  message: string
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
  const [hotspotOverrides, setHotspotOverrides] = useState<HotspotOverrides>(() => {
    const localOverrides = readHotspotOverrides()
    return mergeHotspotOverrides(DEFAULT_ZONE_OVERRIDES, localOverrides)
  })

  useEffect(() => {
    writeHotspotOverrides(hotspotOverrides)
  }, [hotspotOverrides])

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
  }

  const handleResetAngleZones = (deviceKind: DeviceKind, angleId: string) => {
    setHotspotOverrides((current) => clearAngleHotspots(current, deviceKind, angleId))
  }

  const handleExportZones = () => {
    const payload = serializeHotspotOverrides(hotspotOverrides)
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
      const importedOverrides = parseHotspotOverridesJson(fileText)
      setHotspotOverrides(mergeHotspotOverrides(DEFAULT_ZONE_OVERRIDES, importedOverrides))
      setZoneDataStatus({
        tone: 'info',
        message: `Imported ${countHotspotZones(importedOverrides)} zones from ${file.name}.`,
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
              onPlaceZone={handlePlaceZone}
              onRemoveZone={handleRemoveZone}
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
              onPlaceZone={handlePlaceZone}
              onRemoveZone={handleRemoveZone}
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
  onPlaceZone: (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    zone: ControlZone,
  ) => void
  onRemoveZone: (deviceKind: DeviceKind, angleId: string, controlKey: string) => void
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
  onPlaceZone,
  onRemoveZone,
  onResetAngleZones,
}: DevicePanelProps) {
  const selectedAngle = angles.find((angle) => angle.id === selectedAngleId) ?? angles[0]
  const overrideZones = getHotspotMap(hotspotOverrides, deviceKind, selectedAngle.id)
  const mergedZones = { ...selectedAngle.zoneDefaults, ...overrideZones }
  const [draftZone, setDraftZone] = useState<ControlZone | null>(null)
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
            {mappedControls.map((controlKey) => {
              const zone = mergedZones[controlKey]
              const controlBindings = bindingsByControl.get(controlKey) ?? []
              const actionLabels = uniqueActionLabels(controlBindings)

              return (
                <button
                  type="button"
                  className={`zone-hitbox ${controlKey === editControlKey ? 'is-selected' : ''}`}
                  key={controlKey}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditControlKeyChange(controlKey)
                  }}
                >
                  <span className="zone-label">{compactControlLabel(controlKey)}</span>
                  <span className="hotspot-tooltip">
                    <strong>{controlBindings[0]?.controlLabel ?? controlKey}</strong>
                    {actionLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
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
