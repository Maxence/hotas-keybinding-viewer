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

export interface ControlZone {
  x: number
  y: number
  width: number
  height: number
}

export type DirectionTag = 'center' | 'up' | 'down' | 'left' | 'right'

export interface AngleView {
  id: string
  label: string
  imagePath: string
  zoneDefaults: Record<string, ControlZone>
}
