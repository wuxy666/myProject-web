import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '../types/auth'

/** 请求级扩展配置。 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean
    silent?: boolean
  }
  export interface InternalAxiosRequestConfig {
    skipAuth?: boolean
    silent?: boolean
  }
}

const SUCCESS_CODE = 200
const service = axios.create({
  // 接口完整路径以 /api/auth 开头，默认使用当前站点作为 API 主机。
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

/** 401 时清空 Pinia 与持久化令牌，并回到登录页。 */
async function clearSessionAndRedirect(): Promise<void> {
  const [{ useUserStore }, { pinia }] = await Promise.all([
    import('../stores/user'),
    import('../stores'),
  ])
  useUserStore(pinia).clearSession()
  const { default: router } = await import('../router')
  if (router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
}

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // token 的读写统一由 user store 管理；此处只为请求添加认证头。
  const token = localStorage.getItem('accessToken')
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
  return config
})

service.interceptors.response.use(
  (response) => {
    const result = response.data as ApiResponse<unknown>
    if (result && typeof result.code === 'number') {
      if (result.code !== SUCCESS_CODE) {
        const message = result.msg || '请求失败'
        if (!response.config.silent) ElMessage.error(message)
        return Promise.reject(new Error(message))
      }
      return result.data
    }
    return response.data
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status
    const isLoginRequest = error.config?.url?.includes('/api/auth/login') ?? false
    const backendMessage = error.response?.data?.msg
    const message = backendMessage || (status === 401
      ? '登录状态已过期，请重新登录'
      : status === 403
        ? '没有访问权限'
        : status === 404
          ? '请求的资源不存在'
          : status && status >= 500
            ? '服务器暂时不可用，请稍后重试'
            : error.code === 'ECONNABORTED'
              ? '请求超时，请稍后重试'
              : '网络异常，请检查网络连接')

    // 登录接口的 401 是账号认证失败，保留页面并展示后端返回的具体原因。
    if (status === 401 && !isLoginRequest) await clearSessionAndRedirect()
    if (!error.config?.silent) ElMessage.error(message)
    return Promise.reject(new Error(message))
  },
)

/** 业务层统一使用该实例，响应拦截器已提取后端 data 字段。 */
const request = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get(url, config) as unknown as Promise<T>
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.post(url, data, config) as unknown as Promise<T>
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.put(url, data, config) as unknown as Promise<T>
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete(url, config) as unknown as Promise<T>
  },
}

export default request
