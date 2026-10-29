export interface NetworkDashboardStatus {
  status: 'normal' | 'warning' | 'critical' | 'unknown'
  label: string
  updatedAt?: string
}

export interface ServiceMetricItem {
  key: string
  name: string
  value: number
  unit: string
  status: 'normal' | 'warning' | 'critical' | 'unknown'
}
export interface ServiceMetricsResponse { items: ServiceMetricItem[]; updatedAt?: string }

export interface TicketStatus { key: string; name: string; count: number }
export interface TicketGroup { key: string; name: string; total: number; statuses: TicketStatus[] }
export interface TicketSummaryResponse { groups: TicketGroup[]; updatedAt?: string }

export interface HealthProvince { adcode: string; name: string; score: number; rank: number; level?: string }
export interface HealthResponse {
  nationalScore: number
  nationalLevel: string
  unit: string
  provinces: HealthProvince[]
  updatedAt?: string
}

export interface SubscriberProvince { adcode: string; name: string; value: number; unit: string }
export interface SubscriberPoint { id: string; name: string; longitude: number; latitude: number; value: number }
export interface SubscriberResponse {
  total: number
  unit: string
  date: string
  provinces: SubscriberProvince[]
  points?: SubscriberPoint[]
  updatedAt?: string
}

export type ChangeWindow = 'past7d' | 'next7d'
export interface ChangeSummaryResponse {
  window: ChangeWindow
  label: string
  total: number
  success: number
  cancelled: number
  rolledBack: number
  unfinished: number
  updatedAt?: string
}

export interface CapacityResponse {
  total: number
  normal: number
  exceeded: number
  unit: string
  updatedAt?: string
}

export type ScaleCategory = 'element' | 'device' | 'server'
export interface NetworkScaleResponse {
  category: ScaleCategory
  total: number
  unit: string
  items: Array<{ key: string; name: string; count: number; added: number }>
  changeFromPreviousDay: number
  updatedAt?: string
}

export interface SplitRatioResponse {
  date: string
  national: number
  unit: string
  provinces: Array<{ adcode: string; name: string; value: number }>
  updatedAt?: string
}

export type CapabilityCategory = 'interface' | 'system'
export interface CapabilityResponse {
  category: CapabilityCategory
  total: number
  unit: string
  items: Array<{ key: string; name: string; count: number }>
  updatedAt?: string
}
