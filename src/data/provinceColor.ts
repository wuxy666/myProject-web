/** 省份签约用户数分级；地图填色和图例统一使用这份配置。 */
export interface ProvinceColorBand {
  min: number
  max?: number
  label: string
  color: string
}

export const provinceColorBands: ProvinceColorBand[] = [
  { min: 0, max: 900_000, label: '0–<90万', color: '#1a718c' },
  { min: 900_000, max: 1_800_000, label: '90–<180万', color: '#238f8c' },
  { min: 1_800_000, max: 3_500_000, label: '180–<350万', color: '#3189a5' },
  { min: 3_500_000, label: '≥350万', color: '#8c8055' },
]

export function provinceColorForCount(count: number): string {
  const band = provinceColorBands.find(({ min, max }) => count >= min && (max === undefined || count < max))
  return (band ?? provinceColorBands[0]!).color
}
