/** @deprecated 新接口请直接从 src/utils/request 导入默认 request 实例。 */
export { default } from '../utils/request'

import request from '../utils/request'
import type { AxiosRequestConfig } from 'axios'

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export interface DoRequestOptions {
  url: string
  method?: RequestMethod
  params?: Record<string, unknown>
  data?: unknown
  config?: AxiosRequestConfig
  silent?: boolean
}

/** 兼容已有调用，底层仍复用统一的 Axios 实例与拦截器。 */
export function doRequest<T = unknown>(options: DoRequestOptions): Promise<T> {
  const { url, method = 'GET', params, data, config, silent } = options
  const requestConfig = { ...config, params, silent }
  switch (method) {
    case 'POST': return request.post<T>(url, data, requestConfig)
    case 'PUT': return request.put<T>(url, data, requestConfig)
    case 'DELETE': return request.delete<T>(url, requestConfig)
    case 'PATCH': return request.post<T>(url, data, { ...requestConfig, method: 'PATCH' })
    default: return request.get<T>(url, requestConfig)
  }
}
