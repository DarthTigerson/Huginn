export interface MobileDevice {
  id: string
  label: string
  width: number
  height: number
  pixelRatio: number
}

export const MOBILE_DEVICES: MobileDevice[] = [
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, pixelRatio: 2 },
  { id: 'iphone-13-mini', label: 'iPhone 13 mini', width: 375, height: 812, pixelRatio: 3 },
  { id: 'iphone-14', label: 'iPhone 14', width: 390, height: 844, pixelRatio: 3 },
  { id: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', width: 430, height: 932, pixelRatio: 3 },
  { id: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', width: 440, height: 956, pixelRatio: 3 },
]

export const DEFAULT_MOBILE_DEVICE_ID = MOBILE_DEVICES[2].id

export function getMobileDevice(id: string | undefined): MobileDevice {
  return MOBILE_DEVICES.find((d) => d.id === id) ?? MOBILE_DEVICES[2]
}
