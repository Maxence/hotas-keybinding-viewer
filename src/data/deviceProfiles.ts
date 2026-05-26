import type { AngleView } from '../types'

const withBase = (path: string): string => `${import.meta.env.BASE_URL}${path}`

export const THROTTLE_ANGLES: AngleView[] = [
  {
    id: 'front',
    label: 'Front',
    imagePath: withBase('assets/devices/throttle/throttle-front.png'),
    zoneDefaults: {},
  },
  {
    id: 'angled',
    label: 'Angled',
    imagePath: withBase('assets/devices/throttle/throttle-angled.png'),
    zoneDefaults: {},
  },
  {
    id: 'multi-angle',
    label: 'Top + Side Pack',
    imagePath: withBase('assets/devices/throttle/throttle-multi-angle.png'),
    zoneDefaults: {},
  },
]

export const JOYSTICK_ANGLES: AngleView[] = [
  {
    id: 'front',
    label: 'Front',
    imagePath: withBase('assets/devices/joystick/joystick-front.png'),
    zoneDefaults: {},
  },
  {
    id: 'angled',
    label: 'Angled',
    imagePath: withBase('assets/devices/joystick/joystick-angled.png'),
    zoneDefaults: {},
  },
  {
    id: 'base-top',
    label: 'Base Top',
    imagePath: withBase('assets/devices/joystick/joystick-base-top.png'),
    zoneDefaults: {},
  },
  {
    id: 'grip-closeup',
    label: 'Grip Close-Up',
    imagePath: withBase('assets/devices/joystick/joystick-grip-closeup.png'),
    zoneDefaults: {},
  },
]
