// 引入createApp用于创建应用
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 引入根组件
import App from './App.vue'
// 创建应用并挂载
createApp(App).use(ElementPlus).mount('#app')
