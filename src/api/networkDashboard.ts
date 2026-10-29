import request from '../utils/request'
import type {
  CapabilityCategory,
  CapabilityResponse,
  CapacityResponse,
  ChangeSummaryResponse,
  ChangeWindow,
  HealthResponse,
  NetworkDashboardStatus,
  NetworkScaleResponse,
  ScaleCategory,
  ServiceMetricsResponse,
  SplitRatioResponse,
  SubscriberResponse,
  TicketSummaryResponse,
} from '../types/networkDashboard'

const base = '/api/dashboard/network'
const silent = { silent: true }

export const getNetworkStatus = () => request.get<NetworkDashboardStatus>(`${base}/status`, silent)
export const getServiceMetrics = () => request.get<ServiceMetricsResponse>(`${base}/service-metrics`, silent)
export const getTicketSummary = () => request.get<TicketSummaryResponse>(`${base}/tickets/summary`, silent)
export const getHealthProvinces = () => request.get<HealthResponse>(`${base}/health/provinces`, { ...silent, params: { limit: 8, order: 'desc' } })
export const getSubscriberProvinces = () => request.get<SubscriberResponse>(`${base}/subscribers/provinces`, silent)
export const getChangeSummary = (window: ChangeWindow) => request.get<ChangeSummaryResponse>(`${base}/changes/summary`, { ...silent, params: { window } })
export const getCapacitySummary = () => request.get<CapacityResponse>(`${base}/capacity/summary`, silent)
export const getNetworkScale = (category: ScaleCategory) => request.get<NetworkScaleResponse>(`${base}/scale`, { ...silent, params: { category } })
export const getSplitRatio = () => request.get<SplitRatioResponse>(`${base}/split-ratio`, silent)
export const getCapabilityUsage = (category: CapabilityCategory) => request.get<CapabilityResponse>(`${base}/capabilities`, { ...silent, params: { category } })
