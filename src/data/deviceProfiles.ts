import type { AngleView } from '../types'

export const THROTTLE_ANGLES: AngleView[] = [
  {
    id: 'main',
    label: 'Main Cutout',
    imagePath: '/assets/devices/throttle/throttle-main.png',
    hotspotDefaults: {
      slider1: { x: 27, y: 47 },
      button1: { x: 78, y: 53 },
      button2: { x: 73, y: 48 },
      button3: { x: 75, y: 58 },
      button4: { x: 76, y: 65 },
      x: { x: 18, y: 75 },
      y: { x: 39, y: 75 },
      z: { x: 11, y: 27 },
    },
  },
  {
    id: 'top',
    label: 'Top Reference',
    imagePath: '/assets/devices/throttle/throttle-angle-top.webp',
    hotspotDefaults: {},
  },
]

export const JOYSTICK_ANGLES: AngleView[] = [
  {
    id: 'main',
    label: 'Main Cutout',
    imagePath: '/assets/devices/joystick/joystick-main.png',
    hotspotDefaults: {
      x: { x: 53, y: 59 },
      y: { x: 53, y: 53 },
      z: { x: 73, y: 66 },
      button1: { x: 46, y: 24 },
      button2: { x: 45, y: 22 },
      button3: { x: 63, y: 24 },
      button4: { x: 63, y: 22 },
      button5: { x: 40, y: 61 },
      button6: { x: 47, y: 61 },
      button7: { x: 40, y: 65 },
      button8: { x: 47, y: 65 },
      button12: { x: 75, y: 61 },
      button14: { x: 70, y: 59 },
      button15: { x: 77, y: 59 },
      slider1: { x: 55, y: 71 },
      rx: { x: 35, y: 66 },
      ry: { x: 71, y: 68 },
    },
  },
  {
    id: 'base-top',
    label: 'Base Top Reference',
    imagePath: '/assets/devices/joystick/joystick-angle-base-top.webp',
    hotspotDefaults: {
      button5: { x: 30, y: 47 },
      button6: { x: 37, y: 47 },
      button7: { x: 30, y: 55 },
      button8: { x: 37, y: 55 },
      button12: { x: 71, y: 37 },
      button14: { x: 64, y: 37 },
      button15: { x: 64, y: 30 },
      slider1: { x: 49, y: 74 },
    },
  },
  {
    id: 'grip',
    label: 'Grip Reference',
    imagePath: '/assets/devices/joystick/joystick-angle-grip.webp',
    hotspotDefaults: {},
  },
]
