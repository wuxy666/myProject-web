import request from '../utils/request'
import type { LoginForm, LoginRes, UserProfile } from '../types/auth'

/** 使用账号密码登录。 */
export function loginApi(form: LoginForm): Promise<LoginRes> {
  return request.post<LoginRes>('/api/auth/login', form, { skipAuth: true })
}

/** 获取当前用户资料。 */
export function getUserProfileApi(): Promise<UserProfile> {
  return request.get<UserProfile>('/api/auth/profile')
}

/** 通知后端结束当前会话。 */
export function logoutApi(): Promise<{ loggedOut: boolean; message: string }> {
  return request.post('/api/auth/logout', undefined, { silent: true })
}
