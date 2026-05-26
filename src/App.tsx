import type { ChangeEvent, MouseEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { JOYSTICK_ANGLES, THROTTLE_ANGLES } from './data/deviceProfiles'
import { parseBindingsXml } from './lib/bindings'
import {
  clearAngleHotspots,
  getHotspotMap,
  readHotspotOverrides,
  removeHotspot,
  setHotspot,
  writeHotspotOverrides,
  type HotspotOverrides,
} from './lib/hotspots'
import type {
  AngleView,
  BindingRecord,
  DeviceKind,
  HotspotPoint,
  ParsedProfile,
} from './types'
import './App.css'

type DeviceAssignment = Record<number, DeviceKind>

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
  const [hotspotOverrides, setHotspotOverrides] = useState<HotspotOverrides>(() =>
    readHotspotOverrides(),
  )

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

  const handlePlaceHotspot = (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    point: HotspotPoint,
  ) => {
    setHotspotOverrides((current) => setHotspot(current, deviceKind, angleId, controlKey, point))
  }

  const handleRemoveHotspot = (deviceKind: DeviceKind, angleId: string, controlKey: string) => {
    setHotspotOverrides((current) =>
      removeHotspot(current, deviceKind, angleId, controlKey),
    )
  }

  const handleResetAngleHotspots = (deviceKind: DeviceKind, angleId: string) => {
    setHotspotOverrides((current) => clearAngleHotspots(current, deviceKind, angleId))
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="kicker">HOTAS Keybinding Viewer</p>
        <h1>XML Binding to Visual HOTAS Map</h1>
        <p className="intro">
          Import a Star Citizen XML profile, assign each detected `js` device as throttle or
          joystick, then inspect mapped actions directly on device images.
        </p>
      </header>

      <section className="panel upload-panel">
        <label className="field-label" htmlFor="xmlFile">
          XML Binding File
        </label>
        <div className="import-row">
          <input
            id="xmlFile"
            type="file"
            accept=".xml,text/xml"
            onChange={handleXmlImport}
          />
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
                {editorEnabled ? 'Disable hotspot editor' : 'Enable hotspot editor'}
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
              onPlaceHotspot={handlePlaceHotspot}
              onRemoveHotspot={handleRemoveHotspot}
              onResetAngleHotspots={handleResetAngleHotspots}
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
              onPlaceHotspot={handlePlaceHotspot}
              onRemoveHotspot={handleRemoveHotspot}
              onResetAngleHotspots={handleResetAngleHotspots}
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
  onPlaceHotspot: (
    deviceKind: DeviceKind,
    angleId: string,
    controlKey: string,
    point: HotspotPoint,
  ) => void
  onRemoveHotspot: (deviceKind: DeviceKind, angleId: string, controlKey: string) => void
  onResetAngleHotspots: (deviceKind: DeviceKind, angleId: string) => void
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
  onPlaceHotspot,
  onRemoveHotspot,
  onResetAngleHotspots,
}: DevicePanelProps) {
  const selectedAngle = angles.find((angle) => angle.id === selectedAngleId) ?? angles[0]
  const overrideHotspots = getHotspotMap(hotspotOverrides, deviceKind, selectedAngle.id)
  const mergedHotspots = { ...selectedAngle.hotspotDefaults, ...overrideHotspots }

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

  const mappedControls = controls.filter((controlKey) => mergedHotspots[controlKey] !== undefined)
  const unmappedControls = controls.filter((controlKey) => mergedHotspots[controlKey] === undefined)

  const handleImageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!editorEnabled || !editControlKey) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onPlaceHotspot(deviceKind, selectedAngle.id, editControlKey, {
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
    })
  }

  return (
    <article className="panel device-panel">
      <div className="panel-heading">
        <h2>
          {title}{' '}
          <span className="device-chip">{joystickId ? `js${joystickId}` : 'Not assigned'}</span>
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
            onClick={handleImageClick}
            role={editorEnabled ? 'button' : undefined}
            tabIndex={editorEnabled ? 0 : -1}
          >
            <img src={selectedAngle.imagePath} alt={`${title} ${selectedAngle.label}`} />
            {mappedControls.map((controlKey) => {
              const point = mergedHotspots[controlKey]
              const controlBindings = bindingsByControl.get(controlKey) ?? []
              const actionLabels = uniqueActionLabels(controlBindings)
              return (
                <button
                  type="button"
                  className={`hotspot ${controlKey === editControlKey ? 'is-selected' : ''}`}
                  key={controlKey}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (editorEnabled) {
                      onEditControlKeyChange(controlKey)
                    }
                  }}
                >
                  <span className="hotspot-dot" />
                  <span className="hotspot-caption">{compactControlLabel(controlKey)}</span>
                  <span className="hotspot-tooltip">
                    <strong>{controlBindings[0]?.controlLabel ?? controlKey}</strong>
                    {actionLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="binding-summary">
            <p>
              <strong>{mappedControls.length}</strong> mapped controls
            </p>
            <p>
              <strong>{unmappedControls.length}</strong> controls without hotspot on this angle
            </p>
          </div>

          <div className="list-wrap">
            <h3>Control List</h3>
            <div className="control-list">
              {controls.map((controlKey) => {
                const controlBindings = bindingsByControl.get(controlKey) ?? []
                const boundActions = uniqueActionLabels(controlBindings)
                const hasHotspot = mergedHotspots[controlKey] !== undefined

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
                    <span className={`status-dot ${hasHotspot ? 'ok' : 'todo'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {editorEnabled && (
            <div className="editor-bar">
              <p>
                Editor mode: select a control above, then click on the image to place its hotspot.
              </p>
              <div className="editor-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onResetAngleHotspots(deviceKind, selectedAngle.id)}
                >
                  Reset this angle placements
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!editControlKey}
                  onClick={() => {
                    if (editControlKey) {
                      onRemoveHotspot(deviceKind, selectedAngle.id, editControlKey)
                    }
                  }}
                >
                  Remove selected control hotspot
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default App
