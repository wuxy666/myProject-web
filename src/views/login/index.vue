<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { DataAnalysis, Lock, User } from '@element-plus/icons-vue'
import { useUserStore } from '../../stores/user'
import type { LoginForm } from '../../types/auth'

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive<LoginForm>({ username: '', password: '' })
const rules: FormRules<LoginForm> = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

async function submitLogin(): Promise<void> {
  if (!formRef.value || loading.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login({ username: form.username.trim(), password: form.password })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch {
    // 请求拦截器已用 ElMessage 展示后端 msg 或统一网络错误提示。
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
    <header class="brand">
      <div class="brand-icon"><el-icon><DataAnalysis /></el-icon></div>
      <div><strong>数见 DataScope</strong><span>INSIGHT PLATFORM</span></div>
    </header>

    <section class="login-layout">
      <div class="intro">
        <div class="eyebrow"><i></i> BUSINESS INTELLIGENCE</div>
        <h1>让每一份数据<br />都看得见价值<span>。</span></h1>
        <p>连接业务与洞察，用清晰的数据视角<br />开启高效的每一天。</p>
        <div class="orbit-art" aria-hidden="true"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="orbit-center"><el-icon><DataAnalysis /></el-icon></div><i></i><b></b></div>
        <div class="intro-caption">DATA THAT MOVES YOU FORWARD <span></span></div>
      </div>

      <section class="login-card" aria-labelledby="login-title">
        <div class="card-icon"><el-icon><Lock /></el-icon></div>
        <div class="card-eyebrow">欢迎回来</div>
        <h2 id="login-title">登录你的账户</h2>
        <p class="description">输入账号信息以继续使用数据平台</p>

        <el-form ref="formRef" :model="form" :rules="rules" class="login-form" @submit.prevent="submitLogin">
          <el-form-item prop="username" label="账号">
            <el-input v-model="form.username" size="large" placeholder="请输入账号" autocomplete="username" clearable>
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password" label="密码">
            <el-input v-model="form.password" size="large" type="password" placeholder="请输入密码" autocomplete="current-password" show-password @keyup.enter="submitLogin">
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-button class="submit-button" type="primary" size="large" :loading="loading" @click="submitLogin">
            {{ loading ? '正在登录…' : '登 录' }}<span v-if="!loading" class="arrow">→</span>
          </el-button>
        </el-form>
        <div class="card-footer"><i></i> 安全加密连接 <span>仅限授权用户访问</span></div>
      </section>
    </section>
    <footer class="page-footer"><span>© 2026 DataScope Analytics</span><span>SECURE DATA · CLEAR INSIGHT</span></footer>
  </main>
</template>

<style scoped>
.login-page{--cyan:#6de2eb;position:relative;display:flex;min-height:100vh;flex-direction:column;overflow:hidden;padding:30px clamp(24px,7vw,112px) 20px;background:radial-gradient(ellipse at 24% 55%,rgba(29,85,111,.19),transparent 35%),radial-gradient(ellipse at 87% 12%,rgba(37,77,105,.13),transparent 31%),#0a111d;color:#edf3fa}.brand{z-index:1;display:flex;align-items:center;gap:11px}.brand-icon{display:grid;width:37px;height:37px;place-items:center;border:1px solid rgba(103,232,249,.19);border-radius:11px;background:linear-gradient(145deg,#164b5e,#15344b);color:#67e8f9;font-size:19px}.brand strong,.brand span{display:block}.brand strong{font:700 14px 'Manrope','Microsoft YaHei',sans-serif}.brand span{margin-top:3px;color:#718198;font:600 8px 'DM Sans',sans-serif;letter-spacing:1.5px}.login-layout{display:grid;width:min(100%,1050px);flex:1;grid-template-columns:minmax(0,1fr) minmax(360px,430px);align-items:center;gap:clamp(35px,9vw,130px);margin:0 auto;padding:24px 0}.intro{position:relative;min-height:415px;padding-top:38px}.eyebrow{display:flex;align-items:center;gap:8px;color:#8091a8;font-size:9px;font-weight:600;letter-spacing:1.8px}.eyebrow i{width:6px;height:6px;border-radius:50%;background:#67e8f9;box-shadow:0 0 10px #67e8f9}.intro h1{margin:24px 0 16px;color:#eff4fa;font:700 clamp(34px,4vw,51px)/1.35 'Manrope','Microsoft YaHei',sans-serif;letter-spacing:-1.7px}.intro h1 span{color:#6de2eb}.intro>p{margin:0;color:#8d9bb0;font-size:13px;line-height:2}.orbit-art{position:absolute;right:2%;bottom:22px;width:220px;height:180px;opacity:.75}.orbit{position:absolute;left:50%;top:50%;border:1px solid rgba(103,232,249,.15);border-radius:50%;transform:translate(-50%,-50%) rotate(-26deg)}.orbit-a{width:210px;height:98px}.orbit-b{width:170px;height:70px;transform:translate(-50%,-50%) rotate(35deg)}.orbit-center{position:absolute;left:50%;top:50%;display:grid;width:64px;height:64px;place-items:center;border:1px solid rgba(103,232,249,.3);border-radius:19px;background:linear-gradient(145deg,rgba(28,92,112,.57),rgba(21,39,58,.78));color:#78e5ec;font-size:27px;box-shadow:0 0 42px rgba(34,211,238,.14);transform:translate(-50%,-50%) rotate(-8deg)}.orbit-art>i,.orbit-art>b{position:absolute;width:5px;height:5px;border-radius:50%;background:#75e5eb;box-shadow:0 0 12px #67e8f9}.orbit-art>i{top:18px;left:42px}.orbit-art>b{right:15px;top:77px;width:4px;height:4px}.intro-caption{position:absolute;right:0;bottom:0;left:0;display:flex;align-items:center;gap:10px;color:#607188;font-size:8px;letter-spacing:1.6px}.intro-caption span{height:1px;flex:1;background:linear-gradient(90deg,rgba(103,232,249,.2),transparent)}.login-card{position:relative;padding:37px 37px 23px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:linear-gradient(145deg,rgba(20,32,48,.96),rgba(15,25,39,.97));box-shadow:0 24px 80px rgba(0,0,0,.23),inset 0 1px rgba(255,255,255,.025)}.card-icon{display:grid;width:35px;height:35px;place-items:center;border:1px solid rgba(103,232,249,.16);border-radius:10px;background:rgba(103,232,249,.08);color:#73dce7;font-size:16px}.card-eyebrow{margin-top:22px;color:#72d5df;font-size:10px;font-weight:600;letter-spacing:1px}.login-card h2{margin:7px 0 6px;color:#f0f4f9;font:700 22px 'Manrope','Microsoft YaHei',sans-serif}.description{margin:0;color:#8593a8;font-size:10px}.login-form{margin-top:26px}.login-form :deep(.el-form-item){margin-bottom:18px}.login-form :deep(.el-form-item__label){height:auto;padding:0 0 7px;color:#b7c3d2;font-size:10px;line-height:1.4}.login-form :deep(.el-input__wrapper){min-height:42px;border:1px solid rgba(148,163,184,.14);border-radius:7px;background:#0f1a29;box-shadow:none;padding:1px 12px;transition:border-color .2s,box-shadow .2s}.login-form :deep(.el-input__wrapper:hover),.login-form :deep(.el-input__wrapper.is-focus){border-color:rgba(103,232,249,.46);box-shadow:0 0 0 3px rgba(103,232,249,.06)}.login-form :deep(.el-input__inner){color:#e4edf7;font-size:11px}.login-form :deep(.el-input__inner::placeholder){color:#596a80}.login-form :deep(.el-input__prefix-inner){color:#71849b;font-size:14px}.submit-button{position:relative;width:100%;height:43px;margin-top:4px;border:0;border-radius:7px;background:linear-gradient(100deg,#38b8c4,#47c6d0);color:#07212a;font-size:11px;font-weight:700;letter-spacing:2px;box-shadow:0 7px 20px rgba(34,211,238,.12);transition:filter .2s,transform .2s}.submit-button:hover{background:linear-gradient(100deg,#53cbd4,#68dce3);color:#06212a;filter:brightness(1.04);transform:translateY(-1px)}.arrow{position:absolute;right:15px;font-size:17px;font-weight:400;letter-spacing:0}.card-footer{display:flex;align-items:center;gap:6px;margin-top:20px;color:#75869b;font-size:9px}.card-footer i{width:5px;height:5px;border-radius:50%;background:#42d7aa}.card-footer span{margin-left:auto;color:#5d6c80}.page-footer{display:flex;justify-content:space-between;color:#5f6e83;font-size:8px;letter-spacing:.35px}.page-footer span:last-child{letter-spacing:1px}.ambient{position:absolute;pointer-events:none;border-radius:50%;filter:blur(80px);opacity:.12}.ambient-one{top:37%;left:18%;width:180px;height:180px;background:#1ba8ba}.ambient-two{right:14%;bottom:12%;width:150px;height:150px;background:#4b69db}@media(max-width:850px){.login-page{padding:22px 26px 16px}.login-layout{grid-template-columns:minmax(0,1fr) minmax(330px,390px);gap:30px}.intro h1{font-size:36px}.orbit-art{right:-10%;transform:scale(.8);transform-origin:right bottom}}@media(max-width:680px){.login-page{padding:18px 18px 14px}.login-layout{display:flex;justify-content:center;padding:35px 0}.intro{display:none}.login-card{width:min(100%,420px);padding:30px 25px 20px}.page-footer span:last-child{display:none}}@media(max-height:620px) and (min-width:681px){.login-page{padding-top:17px;padding-bottom:12px}.login-layout{padding:12px 0}.intro{min-height:350px;padding-top:20px}.intro h1{margin-top:17px;font-size:42px}.orbit-art{bottom:5px}.login-card{padding-top:27px;padding-bottom:18px}.card-eyebrow{margin-top:15px}.login-form{margin-top:18px}.login-form :deep(.el-form-item){margin-bottom:12px}.card-footer{margin-top:13px}}
</style>
