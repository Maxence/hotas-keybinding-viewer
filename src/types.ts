export type DeviceKind = 'none' | 'throttle' | 'joystick'

export interface BindingRecord {
  actionMap: string
  actionMapLabel: string
  actionName: string
  actionLabel: string
  inputRaw: string
  joystickId: number
  controlKey: string
  controlLabel: string
}

export interface ParsedProfile {
  profileName: string
  joystickIds: number[]
  bindings: BindingRecord[]
}

export interface HotspotPoint {
  x: number
  y: number
}

export interface AngleView {
  id: string
  label: string
  imagePath: string
  hotspotDefaults: Record<string, HotspotPoint>
}
