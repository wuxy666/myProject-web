import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { loginApi, getUserProfileApi, logoutApi } from '../api/auth'
import type { LoginForm, UserProfile } from '../types/auth'

const TOKEN_KEY = 'accessToken'

export const useUserStore = defineStore('user', {
  state: () => ({
    accessToken: localStorage.getItem(TOKEN_KEY) || '',
    userInfo: null as UserProfile | null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.accessToken),
  },
  actions: {
    /** 保存令牌并拉取当前用户资料。 */
    async login(form: LoginForm): Promise<void> {
      const result = await loginApi(form)
      this.accessToken = result.accessToken
      localStorage.setItem(TOKEN_KEY, result.accessToken)
      try {
        await this.getUserProfile()
      } catch (error) {
        this.clearSession()
        throw error
      }
    },
    /** 获取并保存登录用户资料。 */
    async getUserProfile(): Promise<UserProfile> {
      const profile = await getUserProfileApi()
      this.userInfo = profile
      return profile
    },
    /** 清除 Pinia 和持久化登录信息，亦供 401 拦截器调用。 */
    clearSession(): void {
      this.accessToken = ''
      this.userInfo = null
      localStorage.removeItem(TOKEN_KEY)
    },
    /** 无论后端登出成功与否，都清理本地状态并返回登录页。 */
    async logout(): Promise<void> {
      try {
        if (this.accessToken) await logoutApi()
      } catch {
        ElMessage.warning('登出请求未能完成，已清除本地登录状态')
      } finally {
        this.clearSession()
        const { default: router } = await import('../router')
        if (router.currentRoute.value.name !== 'login') {
          await router.replace({ name: 'login' })
        }
      }
    },
  },
})
