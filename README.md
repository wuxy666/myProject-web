# DataScope 数据可视化大屏

基于 Vue 3、Vite、TypeScript、Element Plus、ECharts 与 Three.js 构建的城市防汛监测大屏。地图使用本地省级 GeoJSON 边界生成三维省份轮廓、站点和预警效果。

认证模块对接 `src/components/接口文件.md` 定义的 `/api/auth/login`、`/api/auth/profile` 与 `/api/auth/logout`。如后端不与前端同源，请通过 `VITE_API_BASE_URL` 配置 API 主机地址（不要在该变量中重复填写 `/api` 路径）。

## 开始使用

```bash
npm install
npm run dev
```

认证所需依赖：`axios`、`pinia`、`vue-router`、`element-plus`。项目已有 ECharts 与 Element Plus 依赖。

登录成功后会保存 `accessToken`，获取 profile 后进入数据总览；登出请调用 `useUserStore().logout()`。受保护路由通过 `meta.requiresAuth` 标记，401 会自动清除登录状态并跳回登录页。

## 常用命令

- `npm run dev`：启动本地开发服务器
- `npm run type-check`：检查 TypeScript 与 Vue 类型
- `npm run build`：类型检查并构建生产版本
- `npm run preview`：预览生产构建

