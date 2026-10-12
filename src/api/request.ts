import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  msg: string
}

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface DoRequestOptions {
  url: string
  method?: RequestMethod
  params?: Record<string, unknown>
  data?: unknown
  config?: AxiosRequestConfig
  silent?: boolean
}

interface CustomRequestConfig extends AxiosRequestConfig {
  silent?: boolean
}

const SUCCESS_CODE = 0

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data
    if (res.code === SUCCESS_CODE) {
      return response
    }
    const config = response.config as CustomRequestConfig
    if (!config.silent) {
      ElMessage.error(res.msg || '请求失败')
    }
    return Promise.reject(new Error(res.msg || '请求失败'))
  },
  (error: AxiosError<ApiResponse>) => {
    const config = (error.config ?? {}) as CustomRequestConfig
    let msg = '网络异常，请稍后重试'

    if (error.response) {
      switch (error.response.status) {
        case 401:
          msg = '登录状态已过期，请重新登录'
          localStorage.removeItem('token')
          break
        case 403:
          msg = '没有访问权限'
          break
        case 404:
          msg = '请求的资源不存在'
          break
        case 500:
          msg = '服务器内部错误'
          break
        default:
          msg = error.response.data?.msg || `请求出错（${error.response.status}）`
      }
    } else if (error.code === 'ECONNABORTED') {
      msg = '请求超时，请稍后重试'
    }

    if (!config.silent) {
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  },
)

export async function doRequest<T = unknown>(options: DoRequestOptions): Promise<T> {
  const { url, method = 'GET', params, data, config, silent } = options

  const response = await service.request<ApiResponse<T>>({
    url,
    method,
    params,
    data,
    silent,
    ...config,
  } as CustomRequestConfig)

  return response.data.data
}

export default service