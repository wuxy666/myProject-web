/** 登录表单字段。 */
export interface LoginForm {
  username: string
  password: string
}

/** POST /api/auth/login 返回的 data 字段。 */
export interface LoginRes {
  accessToken: string
  tokenType: string
  expiresIn: string
}

/** GET /api/auth/profile 返回的当前用户资料。 */
export interface UserProfile {
  id: number | string
  username: string
  nickname?: string
  status?: string
  lastLoginTime?: string | null
  [key: string]: unknown
}

/** 后端统一响应结构。 */
export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}
