<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Cpu, Grid, Monitor } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import {
  getCapacitySummary, getCapabilityUsage, getChangeSummary, getHealthProvinces,
  getNetworkScale, getNetworkStatus, getServiceMetrics, getSplitRatio,
  getSubscriberProvinces, getTicketSummary,
} from '../api/networkDashboard'
import { useUserStore } from '../stores/user'
import BoardPanel from './BoardPanel.vue'
import MetricGauge from './MetricGauge.vue'
import ChinaMap from './ChinaMap.vue'
import { provinceColorBands } from '../data/provinceColor'
import {
  capacityStatus as mockCapacity, capabilityTabs as mockCapabilities, changeOperations as mockChanges,
  healthScore as mockHealthScore, networkScaleTabs as mockScale, provinceHealth as mockProvinceHealth,
  provinceSubscribers, serviceMetrics as mockServices, splitRatio as mockSplit, subscriberTotal as mockSubscriberTotal,
  ticketGroups as mockTickets,
} from '../data/networkDashboard'
import type {
  CapabilityCategory, CapabilityResponse, CapacityResponse, ChangeSummaryResponse, ChangeWindow,
  HealthResponse, NetworkDashboardStatus, NetworkScaleResponse, ScaleCategory,
  ServiceMetricItem, SplitRatioResponse, SubscriberResponse, TicketSummaryResponse,
} from '../types/networkDashboard'

type RangeKey = 'past' | 'future'
type ScaleKey = 'elements' | 'devices' | 'servers'
type CapabilityKey = CapabilityCategory
type OperationCounts = Pick<ChangeSummaryResponse, 'success' | 'cancelled' | 'rolledBack' | 'unfinished'>
type ScaleView = { label: string; total: number; change: number; items: Array<{ name: string; count: number; added: number }> }
type CapabilityView = { total: number; items: Array<{ name: string; count: number }> }
type TicketView = { key: string; name: string; total: number; tone: 'red' | 'orange'; statuses: Array<{ key: string; name: string; count: number }> }

const userStore = useUserStore()
const healthChart = ref<HTMLDivElement>()
const changeChart = ref<HTMLDivElement>()
const capacityChart = ref<HTMLDivElement>()
const splitChart = ref<HTMLDivElement>()
const capabilityChart = ref<HTMLDivElement>()
const activeRange = ref<RangeKey>('past')
const activeScale = ref<ScaleKey>('elements')
const activeCapability = ref<CapabilityKey>('interface')
const now = ref(new Date())
const charts: ECharts[] = []
let resizeObserver: ResizeObserver | undefined
let clockTimer = 0
let refreshTimer = 0
let refreshInProgress = false
let warnedUnavailable = false
const dateText = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now.value))
const timeText = computed(() => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now.value))

const serviceKeys = ['session_setup', 'eps_fallback', 'paging', 'http_message', 'amf_registration', 'nf_discovery', 'amf_authentication', 'ausf_authentication']
const serviceRows = ref<ServiceMetricItem[]>(mockServices.map((item, index) => ({ key: serviceKeys[index]!, name: item.label, value: item.value, unit: '%', status: 'normal' })))
const ticketRows = ref<TicketView[]>(mockTickets.map(group => ({ key: group.tone === 'red' ? 'fault' : 'risk', name: group.label, total: group.total, tone: group.tone, statuses: group.statuses.map(status => ({ key: status.label, name: status.label, count: status.value })) })))
const nationalHealth = ref(mockHealthScore)
const healthRows = ref(mockProvinceHealth.map((item, index) => ({ adcode: '', name: item.name, score: item.value, rank: index + 1 })))
const subscriberData = ref<SubscriberResponse>({ total: mockSubscriberTotal, unit: '户', date: '', provinces: Object.entries(provinceSubscribers).map(([name, value]) => ({ adcode: '', name, value: value * 1000, unit: '户' })) })
const changeRows = ref<Record<RangeKey, OperationCounts>>({ past: mockChanges.ranges.past, future: mockChanges.ranges.future })
const capacityData = ref<CapacityResponse>({ ...mockCapacity, unit: '个' })
const scaleRows = ref<Record<ScaleKey, ScaleView>>({
  elements: { label: mockScale.elements.label, total: mockScale.elements.total, change: 12, items: mockScale.elements.items.map(item => ({ name: item.name, count: item.value, added: 1 })) },
  devices: { label: mockScale.devices.label, total: mockScale.devices.total, change: 12, items: mockScale.devices.items.map(item => ({ name: item.name, count: item.value, added: 1 })) },
  servers: { label: mockScale.servers.label, total: mockScale.servers.total, change: 12, items: mockScale.servers.items.map(item => ({ name: item.name, count: item.value, added: 1 })) },
})
const splitData = ref<SplitRatioResponse>({ date: '', national: mockSplit.national, unit: '%', provinces: mockSplit.provinces.map((item, index) => ({ adcode: '', name: item.name, value: item.value })) })
const capabilityRows = ref<Record<CapabilityKey, CapabilityView>>({
  interface: { total: 4118300, items: mockCapabilities.interface.items.map(item => ({ name: item.name, count: item.value * 10000 })) },
  system: { total: 2864200, items: mockCapabilities.system.items.map(item => ({ name: item.name, count: item.value * 10000 })) },
})
const statusData = ref<NetworkDashboardStatus>({ status: 'normal', label: '核心网运行正常' })
const provinceValueMap = computed(() => Object.fromEntries(subscriberData.value.provinces.map(item => [item.name, item.value])))
const currentOperations = computed(() => changeRows.value[activeRange.value])
const currentScale = computed(() => scaleRows.value[activeScale.value])
const currentCapability = computed(() => capabilityRows.value[activeCapability.value])
const operationSegments = computed(() => [
  { name: '操作成功', value: currentOperations.value.success, color: '#13c9d6' },
  { name: '操作取消', value: currentOperations.value.cancelled, color: '#4995f5' },
  { name: '操作倒回', value: currentOperations.value.rolledBack, color: '#ff9b45' },
  { name: '打点未完成', value: currentOperations.value.unfinished, color: '#df5a70' },
])
// ECharts 文字也使用视口高度单位；resize 时会重新应用图表配置。
const viewportFontSize = () => window.innerHeight * 0.015
const baseAxis = { axisLabel: { color: '#91afd2', fontSize: viewportFontSize() }, axisLine: { lineStyle: { color: 'rgba(105,151,203,.32)' } }, axisTick: { show: false } }
const gridLine = { lineStyle: { color: 'rgba(100,146,194,.17)', type: 'dashed' as const } }
const tooltipStyle = {
  // 把 HTML 提示层挂到 body，避免被图表容器和面板的 overflow:hidden 裁切。
  appendTo: 'body',
  renderMode: 'html' as const,
  confine: false,
  z: 10000,
  backgroundColor: 'rgba(5, 17, 36, .97)',
  borderColor: 'rgba(70, 151, 255, .78)',
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: '#fff', fontSize: viewportFontSize() },
  extraCssText: 'border-radius: 4px; box-shadow: 0 0 14px rgba(37, 128, 232, .3);',
}
const formatWan = (value: number) => `${(value / 10000).toFixed(2)}W`
const deviceScaleIcons = [Connection, Connection, Grid, Cpu]
const serverScaleIcons = [Monitor, Cpu, Grid]
function scaleIconAt(index: number) {
  const icons = activeScale.value === 'devices' ? deviceScaleIcons : serverScaleIcons
  return icons[index % icons.length]!
}

function healthOption(): EChartsOption {
  return {
    tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 8, top: 22, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: healthRows.value.map(item => item.name), ...baseAxis },
    yAxis: { type: 'value', min: 94, max: 100, splitNumber: 3, axisLabel: { color: '#7694b8', fontSize: viewportFontSize(), formatter: '{value}%' }, splitLine: gridLine },
    series: [{ type: 'bar', data: healthRows.value.map(item => item.score), barWidth: '45%', itemStyle: { borderRadius: [3, 3, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#43d4f2' }, { offset: 1, color: '#2876ec' }]) }, label: { show: true, position: 'top', color: '#b9dcff', fontSize: viewportFontSize(), formatter: '{c}%' } }],
  }
}
function changeOption(): EChartsOption {
  return {
    tooltip: { ...tooltipStyle, trigger: 'item' },
    series: [{ type: 'pie', radius: ['55%', '78%'], center: ['50%', '50%'], label: { show: false }, itemStyle: { borderWidth: 2, borderColor: '#0c1c38' }, data: operationSegments.value.map(item => ({ name: item.name, value: item.value, itemStyle: { color: item.color } })) }],
    graphic: [{ type: 'text', left: 'center', top: '39%', style: { text: String(currentOperations.value.success), fill: '#e6f4ff', fontSize: viewportFontSize(), fontWeight: 700, textAlign: 'center' } }, { type: 'text', left: 'center', top: '57%', style: { text: '总操作', fill: '#8da9ca', fontSize: viewportFontSize(), textAlign: 'center' } }],
  } as EChartsOption
}
function capacityOption(): EChartsOption {
  const total = capacityData.value.total
  return {
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number; percent?: number }
        return `${item.name ?? ''}<br/>数量：${Number(item.value ?? 0).toLocaleString()}${capacityData.value.unit}<br/>占比：${Number(item.percent ?? 0)}%`
      },
    },
    series: [{
      type: 'pie',
      radius: ['56%', '79%'],
      center: ['50%', '51%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { scale: true, scaleSize: 5 },
      itemStyle: { borderWidth: 2, borderColor: '#0c1c38', borderRadius: 3 },
      data: [
        { name: '容量正常', value: capacityData.value.normal, itemStyle: { color: '#42d9ee' } },
        { name: '容量超限', value: capacityData.value.exceeded, itemStyle: { color: '#f05b91' } },
      ],
    }],
    graphic: [
      { type: 'text', left: 'center', top: '39%', style: { text: total.toLocaleString(), fill: '#e6f4ff', fontSize: viewportFontSize(), fontWeight: 700, textAlign: 'center' } },
      { type: 'text', left: 'center', top: '57%', style: { text: '容量总量', fill: '#8da9ca', fontSize: viewportFontSize(), textAlign: 'center' } },
    ],
  } as EChartsOption
}
function splitOption(): EChartsOption {
  return {
    tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 6, right: 6, top: 23, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: splitData.value.provinces.map(item => item.name), ...baseAxis },
    yAxis: { type: 'value', min: 65, max: 80, splitNumber: 3, axisLabel: { color: '#7694b8', fontSize: viewportFontSize(), formatter: '{value}%' }, splitLine: gridLine },
    series: [{ type: 'bar', data: splitData.value.provinces.map(item => item.value), barWidth: '46%', itemStyle: { borderRadius: [3, 3, 0, 0], color: '#3aa8fb' }, label: { show: true, position: 'top', color: '#b9dcff', fontSize: viewportFontSize(), formatter: '{c}%' } }],
  }
}
function capabilityOption(): EChartsOption {
  return {
    tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: unknown) => {
      const item = Array.isArray(params) ? params[0] as { name?: string; value?: number } : params as { name?: string; value?: number }
      return `${item.name ?? ''}<br/>调用量：${Number(item.value ?? 0).toFixed(2)}W`
    } },
    grid: { left: 7, right: 7, top: 10, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: currentCapability.value.items.map(item => item.name), ...baseAxis, axisLabel: { ...baseAxis.axisLabel, fontSize: viewportFontSize(), interval: 0, rotate: 22 } },
    yAxis: { type: 'value', show: false, splitLine: gridLine },
    series: [{ type: 'bar', data: currentCapability.value.items.map((item, index) => ({ value: item.count / 10000, itemStyle: { color: index === 0 ? '#27c5e9' : '#327cdb' } })), barWidth: '52%', itemStyle: { borderRadius: [3, 3, 0, 0] }, label: { show: true, position: 'top', color: '#9cc6f2', fontSize: viewportFontSize(), formatter: '{c}W' } }],
  }
}
function initCharts() {
  if (!healthChart.value || !changeChart.value || !capacityChart.value || !splitChart.value || !capabilityChart.value) return
  const health = echarts.init(healthChart.value)
  const change = echarts.init(changeChart.value)
  const split = echarts.init(splitChart.value)
  const capability = echarts.init(capabilityChart.value)
  const capacity = echarts.init(capacityChart.value)
  charts.push(health, change, split, capability, capacity)
  health.setOption(healthOption())
  change.setOption(changeOption())
  split.setOption(splitOption())
  capability.setOption(capabilityOption())
  capacity.setOption(capacityOption())
  resizeObserver = new ResizeObserver(() => {
    charts.forEach(chart => chart.resize())
    health.setOption(healthOption())
    change.setOption(changeOption())
    split.setOption(splitOption())
    capability.setOption(capabilityOption())
    capacity.setOption(capacityOption())
  })
  ;[healthChart.value, changeChart.value, capacityChart.value, splitChart.value, capabilityChart.value].forEach(el => resizeObserver?.observe(el!))
}
function updateHealthChart() { charts[0]?.setOption(healthOption(), true) }
function updateOperationChart() { charts[1]?.setOption(changeOption(), true) }
function updateSplitChart() { charts[2]?.setOption(splitOption(), true) }
function updateCapabilityChart() { charts[3]?.setOption(capabilityOption(), true) }

function acceptServices(data: Awaited<ReturnType<typeof getServiceMetrics>>) { serviceRows.value = data.items }
function acceptTickets(data: TicketSummaryResponse) {
  ticketRows.value = data.groups.map(group => ({ ...group, tone: group.key === 'fault' ? 'red' : 'orange' }))
}
function acceptHealth(data: HealthResponse) { nationalHealth.value = data.nationalScore; healthRows.value = data.provinces }
function acceptSubscribers(data: SubscriberResponse) { subscriberData.value = data }
function acceptChanges(range: RangeKey, data: ChangeSummaryResponse) {
  changeRows.value[range] = { success: data.success, cancelled: data.cancelled, rolledBack: data.rolledBack, unfinished: data.unfinished }
  if (range === activeRange.value) updateOperationChart()
}
function acceptCapacity(data: CapacityResponse) { capacityData.value = data; charts[4]?.setOption(capacityOption(), true) }
function acceptScale(key: ScaleKey, data: NetworkScaleResponse) {
  scaleRows.value[key] = { label: mockScale[key].label, total: data.total, change: data.changeFromPreviousDay, items: data.items.map(item => ({ name: item.name, count: item.count, added: item.added })) }
}
function acceptSplit(data: SplitRatioResponse) { splitData.value = data; updateSplitChart() }
function acceptCapability(key: CapabilityKey, data: CapabilityResponse) {
  capabilityRows.value[key] = { total: data.total, items: data.items.map(item => ({ name: item.name, count: item.count })) }
  if (key === activeCapability.value) updateCapabilityChart()
}
async function selectRange(range: RangeKey) {
  activeRange.value = range
  const windowKey: ChangeWindow = range === 'past' ? 'past7d' : 'next7d'
  try { acceptChanges(range, await getChangeSummary(windowKey)) } catch { /* keep last valid data */ }
}
async function selectScale(key: ScaleKey) {
  activeScale.value = key
  const category: ScaleCategory = key === 'elements' ? 'element' : key === 'devices' ? 'device' : 'server'
  try { acceptScale(key, await getNetworkScale(category)) } catch { /* keep last valid data */ }
}
async function selectCapability(key: CapabilityKey) {
  activeCapability.value = key
  try { acceptCapability(key, await getCapabilityUsage(key)) } catch { /* keep last valid data */ }
}
async function refreshDashboard() {
  if (refreshInProgress) return
  refreshInProgress = true
  const failures: string[] = []
  const run = async <T,>(task: Promise<T>, accept: (data: T) => void, label: string) => {
    try { accept(await task) } catch { failures.push(label) }
  }
  const requestedScale = activeScale.value
  const requestedScaleCategory: ScaleCategory = requestedScale === 'elements' ? 'element' : requestedScale === 'devices' ? 'device' : 'server'
  const requestedCapability = activeCapability.value
  try {
    await Promise.all([
      run(getNetworkStatus(), data => { statusData.value = data }, '运行状态'),
      run(getServiceMetrics(), acceptServices, '网络运行情况'),
      run(getTicketSummary(), acceptTickets, '工单'),
      run(getHealthProvinces(), data => { acceptHealth(data); updateHealthChart() }, '网络健康度'),
      run(getSubscriberProvinces(), acceptSubscribers, '签约用户地图'),
      run(getChangeSummary('past7d'), data => acceptChanges('past', data), '过去七天变更'),
      run(getChangeSummary('next7d'), data => acceptChanges('future', data), '未来七天变更'),
      run(getCapacitySummary(), acceptCapacity, '容量'),
      run(getNetworkScale(requestedScaleCategory), data => acceptScale(requestedScale, data), '网络规模'),
      run(getSplitRatio(), acceptSplit, '分流比'),
      run(getCapabilityUsage(requestedCapability), data => acceptCapability(requestedCapability, data), '云网能力开放'),
    ])
    if (failures.length && !warnedUnavailable) {
      ElMessage.warning(`部分大屏接口暂不可用，页面保留演示或上次有效数据：${failures.join('、')}`)
      warnedUnavailable = true
    } else if (!failures.length) {
      warnedUnavailable = false
    }
  } finally {
    refreshInProgress = false
  }
}
function logout() { void userStore.logout() }
onMounted(() => {
  initCharts()
  void refreshDashboard()
  clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)
  refreshTimer = window.setInterval(() => { void refreshDashboard() }, 30000)
})
onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  window.clearInterval(refreshTimer)
  resizeObserver?.disconnect()
  charts.forEach(chart => chart.dispose())
})
</script>
<template>
  <main class="network-screen">
    <header class="screen-header">
      <div class="brand-line"><span class="brand-icon">▰</span>
        <h1>网络运行情况监控大屏</h1><span class="brand-divider"></span>
        <!-- <span class="brand-subtitle">NETWORK OPERATIONS
          CENTER</span> -->
      </div>
      <div class="header-status"><span class="online-dot" :class="'status-' + statusData.status"></span><span>{{ statusData.label }}</span><b>{{ dateText }}　{{ timeText
          }}</b><button @click="logout">退出</button></div>
    </header>
    <section class="dashboard-grid">
      <aside class="left-column">
        <BoardPanel title="网络运行情况" subtitle="关键业务成功率">
          <div class="service-grid">
            <MetricGauge v-for="(metric, index) in serviceRows" :key="metric.key" :label="metric.name"
              :value="metric.value" :tone="index < 4 ? 'blue' : 'orange'" />
          </div>
        </BoardPanel>
        <BoardPanel title="工单" subtitle="当前待办与闭环状态">
          <div class="ticket-grid">
            <article v-for="group in ticketRows" :key="group.key" class="ticket-group"
              :class="'ticket-' + group.tone">
              <div class="ticket-summary"><strong>{{ group.name }}</strong><b>{{ String(group.total).padStart(2, '0')
                  }}<small>单</small></b></div>
              <div class="ticket-statuses">
                <div v-for="status in group.statuses" :key="status.key"><span>{{ status.name }}</span><b>{{
                    status.count }}</b></div>
              </div>
            </article>
          </div>
        </BoardPanel>
        <BoardPanel title="网络健康度评测" subtitle="全国及省份综合评分">
          <div class="health-summary"><span>全国健康度</span><strong>{{ nationalHealth }}<small>%</small></strong><i>良好</i>
          </div>
          <div ref="healthChart" class="chart health-chart"></div>
        </BoardPanel>
      </aside>
      <section class="center-column">
        <BoardPanel title="签约用户数" :subtitle="subscriberData.total.toLocaleString() + ' 户 · 省级分布'" class="map-panel">
          <div class="map-legend">
            <span v-for="band in provinceColorBands" :key="band.min">
              <i :style="{ background: band.color }"></i>{{ band.label }}{{ subscriberData.unit }}
            </span>
          </div>
          <ChinaMap :province-values="provinceValueMap" :province-unit="subscriberData.unit" />
          <div class="map-total"><small>全国签约用户</small><strong>{{ subscriberData.total.toLocaleString() }}</strong><em>{{ subscriberData.unit }}</em>
          </div>
        </BoardPanel>
        <div class="center-bottom">
          <BoardPanel title="变更操作" subtitle="7 日窗口"><template #tools>
              <div class="segmented-control"><button :class="{ active: activeRange === 'past' }"
                  @click="selectRange('past')">过去7天</button><button
                  :class="{ active: activeRange === 'future' }"
                  @click="selectRange('future')">未来7天</button></div>
            </template>
            <div class="change-content">
              <div class="change-chart-block">
                <div class="change-total">共有操作：<b>{{ currentOperations.success + currentOperations.cancelled +
                  currentOperations.rolledBack + currentOperations.unfinished }}</b></div>
                <div ref="changeChart" class="chart change-chart"></div>
              </div>
              <div class="operation-legend">
                <div v-for="item in operationSegments" :key="item.name"><i
                    :style="{ background: item.color }"></i><span>{{
                    item.name }}</span><b>{{ item.value }}</b></div>
              </div>
            </div>
          </BoardPanel>
          <BoardPanel title="容量" subtitle="">
            <div class="capacity-head"><span>容量监控整体网元数量：</span><b>{{ capacityData.total }}{{ capacityData.unit }}</b></div>
            <div class="capacity-content">
              <div ref="capacityChart" class="chart capacity-chart"></div>
              <div class="capacity-legend">
                <div><i class="capacity-normal-dot"></i><span>容量正常</span><b>{{ capacityData.normal.toLocaleString() }}</b></div>
                <div><i class="capacity-exceeded-dot"></i><span>容量超限</span><b>{{ capacityData.exceeded.toLocaleString() }}</b></div>
              </div>
            </div>
          </BoardPanel>
        </div>
      </section>
      <aside class="right-column">
        <BoardPanel title="网络规模" subtitle=""><template #tools>
            <div class="tab-strip"><button v-for="(tab, key) in mockScale" :key="key"
                :class="{ active: activeScale === key }" @click="selectScale(key)">{{ tab.label }}</button></div>
          </template>
          <div class="scale-total">当前分类数量：<strong>{{ currentScale.total.toLocaleString() }}</strong><span>较昨日
              <b>+{{ currentScale.change }}</b></span></div>
          <div :class="['scale-grid', { 'scale-grid--cards': activeScale !== 'elements' }]">
            <article v-for="(item, index) in currentScale.items" :key="item.name"
              :class="['scale-item', { 'scale-item-card': activeScale !== 'elements' }]">
              <template v-if="activeScale !== 'elements'">
                <span class="scale-device-icon"><el-icon><component :is="scaleIconAt(index)" /></el-icon></span>
                <div class="scale-card-copy">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.count.toLocaleString() }} <b>新增 +{{ item.added }}</b></small>
                </div>
                <i class="scale-card-glint"></i>
              </template>
              <template v-else>
                <span class="scale-bubble">{{ item.name.slice(0, 4) }}</span>
                <div><strong>{{ item.count.toLocaleString() }}</strong><small>新增 <b>+{{ item.added }}</b></small></div>
              </template>
            </article>
          </div>
        </BoardPanel>
        <BoardPanel title="分流比" subtitle="全国及省级数据">
          <div class="split-summary"><span>全国分流比：<strong>{{ splitData.national }}%</strong></span><span>统计日期：{{ splitData.date || dateText }}</span></div>
          <div ref="splitChart" class="chart split-chart"></div>
        </BoardPanel>
        <BoardPanel title="云网能力开放" subtitle=""><template #tools>
            <div class="segmented-control"><button :class="{ active: activeCapability === 'interface' }"
                @click="selectCapability('interface')">接口</button><button
                :class="{ active: activeCapability === 'system' }"
                @click="selectCapability('system')">系统</button></div>
          </template>
          <div class="capability-total">调用总数：<strong>{{ formatWan(currentCapability.total) }}</strong><small>次</small><span class="capability-live"><i></i>实时</span></div>
          <div ref="capabilityChart" class="chart capability-chart"></div>
        </BoardPanel>
      </aside>
    </section>
  </main>
</template>
<style scoped>
.network-screen {
  display: grid;
  width: 100%;
  height: 100vh;
  min-height: 560px;
  grid-template-rows: max(56px, 5.6vh) minmax(0, 1fr);
  gap: 8px;
  overflow: hidden;
  padding: 5px 7px 8px;
  background: radial-gradient(ellipse at 49% 45%, rgba(22, 77, 157, .2), transparent 44%), linear-gradient(115deg, #071226, #0a1730 48%, #071226);
  color: #dcecff;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  font-size: 1.5vh
}

/* 全页面统一跟随视口高度缩放；大标题和面板标题使用指定比例。 */
.network-screen :deep(*) {
  font-size: 1.5vh !important
}

.network-screen .brand-line h1 {
  font-size: 4vh !important
}

.network-screen :deep(.heading-copy strong),
.network-screen :deep(h2) {
  font-size: 2.4vh !important
}

.screen-header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border: 1px solid rgba(57, 115, 197, .37);
  background: linear-gradient(90deg, rgba(17, 43, 86, .88), rgba(8, 25, 55, .7));
  box-shadow: 0 0 16px rgba(35, 110, 224, .09)
}

.brand-line,
.header-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px
}

.brand-icon {
  color: #53cfff;
  font-size: 19px;
  text-shadow: 0 0 9px #268fff
}

.brand-line h1 {
  margin: 0;
  color: #f1f7ff;
  font-size: clamp(14px, 1.05vw, 21px);
  letter-spacing: .1em;
  text-shadow: 0 0 12px rgba(69, 144, 255, .42)
}

.brand-divider {
  height: 17px;
  border-left: 1px solid rgba(130, 168, 215, .35)
}

.brand-subtitle {
  color: #7395c1;
  font-size: 8px;
  letter-spacing: .18em
}

.header-status {
  font-size: 10px;
  color: #9bb4d3
}

.header-status b {
  padding-left: 12px;
  color: #cbdcf0;
  font-variant-numeric: tabular-nums;
  font-weight: 500
}

.header-status button {
  border: 1px solid rgba(95, 147, 209, .28);
  border-radius: 4px;
  background: rgba(18, 45, 84, .55);
  color: #adc5e2;
  padding: 4px 8px;
  font-size: 9px;
  cursor: pointer
}

.online-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: #32dda9;
  box-shadow: 0 0 8px #32dda9
}

.online-dot.status-warning {
  background: #ffb347;
  box-shadow: 0 0 8px #ffb347
}

.online-dot.status-critical {
  background: #ff5f68;
  box-shadow: 0 0 8px #ff5f68
}

.online-dot.status-unknown {
  background: #7d92ad;
  box-shadow: 0 0 6px #7d92ad
}

.dashboard-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(274px, 1.08fr) minmax(500px, 2.2fr) minmax(274px, 1.08fr);
  gap: 8px
}

.left-column,
.right-column,
.center-column {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 8px
}

.left-column {
  grid-template-rows: minmax(0, 1.2fr) minmax(0, .78fr) minmax(0, .82fr)
}

.center-column {
  grid-template-rows: minmax(0, 1.2fr) minmax(0, .78fr) minmax(0, .82fr)
}

.right-column {
  grid-template-rows: minmax(0, 1.2fr) minmax(0, .78fr) minmax(0, .82fr)
}

.center-bottom {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px
}

:deep(.board-panel) {
  height: 100%
}

:deep(.panel-content) {
  padding: 7px 8px 8px
}

:deep(.heading-copy strong) {
  font-size: 2.4vh
}

.service-grid {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 3px 2px;
  padding: 1px 0
}

.ticket-grid {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 1fr 1fr;
  gap: 7px
}

.ticket-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 6px 7px;
  border: 1px solid rgba(64, 119, 182, .22);
  background: linear-gradient(145deg, rgba(20, 41, 75, .76), rgba(9, 24, 50, .6))
}

.ticket-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px
}

.ticket-summary strong {
  font-size: clamp(9px, .65vw, 12px);
  color: #d6e8ff
}

.ticket-summary>b {
  color: #ff7470;
  font-size: 19px;
  font-style: italic;
  text-shadow: 0 0 8px rgba(252, 81, 80, .45)
}

.ticket-orange .ticket-summary>b {
  color: #ffac58
}

.ticket-summary small {
  margin-left: 3px;
  color: #91aacc;
  font-size: 8px;
  font-style: normal
}

.ticket-statuses {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
  margin-top: 5px
}

.ticket-statuses div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #8da6c8;
  font-size: 8px
}

.ticket-statuses b {
  color: #d4e4f8;
  font-size: 9px
}

.ticket-statuses div:first-child b {
  color: #ff8a72
}

.health-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9bb5d6;
  font-size: 9px
}

.health-summary strong {
  margin-left: auto;
  color: #4ed7f4;
  font: 700 19px/1 Arial, sans-serif;
  text-shadow: 0 0 9px rgba(43, 194, 242, .35)
}

.health-summary strong small {
  font-size: 10px
}

.health-summary i {
  padding: 2px 5px;
  border: 1px solid rgba(54, 214, 168, .35);
  border-radius: 8px;
  color: #54d5ae;
  font-size: 8px;
  font-style: normal
}

.chart {
  width: 100%;
  min-width: 0;
  min-height: 0
}

.health-chart {
  flex: 1
}

.map-panel {
  position: relative;
  grid-row: 1 / span 2
}

.center-bottom {
  grid-row: 3
}

.map-panel :deep(.panel-content) {
  position: relative;
  padding: 0
}

.map-panel :deep(.china-map) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%
}

.map-legend {
  position: absolute;
  z-index: 3;
  bottom: 1.5vh;
  left: 1.5vh;
  display: flex;
  gap: 7px;
  color: #a8c6e9;
  font-size: 8px
}

.map-legend i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 3px;
  border-radius: 50%
}

.map-total {
  position: absolute;
  z-index: 3;
  left: 12px;
  /* bottom: 9px; */
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 9px;
  border-left: 2px solid #41c9ed;
  background: rgba(8, 22, 47, .79);
  box-shadow: 0 2px 10px rgba(0, 0, 0, .18)
}

.map-total small {
  color: #93b1d3;
  font-size: 8px
}

.map-total strong {
  color: #e4f2ff;
  font: 700 14px/1 Arial, sans-serif;
  letter-spacing: .06em
}

.map-total em {
  color: #49c9ed;
  font-size: 8px;
  font-style: normal
}

.segmented-control,
.tab-strip {
  display: flex;
  align-items: center;
  gap: 2px
}

.segmented-control button,
.tab-strip button {
  padding: 3px 5px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: rgba(8, 26, 56, .55);
  color: #8ca9cd;
  font-size: 8px;
  white-space: nowrap;
  cursor: pointer
}

.segmented-control button.active,
.tab-strip button.active {
  border-color: rgba(68, 151, 241, .56);
  background: linear-gradient(180deg, rgba(46, 123, 225, .7), rgba(22, 72, 151, .7));
  color: #e9f5ff;
  box-shadow: 0 0 8px rgba(48, 134, 245, .17)
}

.change-content {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 1.04fr .96fr;
  align-items: center;
  gap: 4px
}

.change-chart-block {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column
}

.change-total {
  padding-left: 3px;
  color: #91add0;
  font-size: 8px;
  white-space: nowrap
}

.change-total b {
  color: #e0f0ff;
  font-size: 11px
}

.change-chart {
  min-height: 0;
  flex: 1
}

.operation-legend {
  display: grid;
  gap: 7px;
  padding: 3px 2px
}

.operation-legend div {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: 5px;
  color: #aac0dc;
  font-size: clamp(8px, .55vw, 10px);
  white-space: nowrap
}

.operation-legend i {
  width: 7px;
  height: 7px;
  border-radius: 2px
}

.operation-legend b {
  color: #e0eefb;
  font-size: 9px
}

.capacity-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 4px;
  /* border-bottom: 1px solid rgba(82, 132, 188, .2); */
  color: #9cb6d4;
  font-size: 8px
}

.capacity-head b {
  color: #40d9f4;
  font-size: 10px;
  text-shadow: 0 0 8px rgba(64, 217, 244, .5)
}

.capacity-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 0;
  flex: 1;
  padding: 4px 5px 2px
}

.capacity-chart {
  height: 100%;
  min-height: 0;
  flex: 1 1 0;
  width: 0
}

.capacity-legend {
  display: grid;
  flex: 0 0 42%;
  gap: 12px;
  min-width: 0
}

.capacity-legend>div {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  color: #c5daf4;
  white-space: nowrap
}

.capacity-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor
}

.capacity-normal-dot {
  color: #42d9ee;
  background: #42d9ee
}

.capacity-exceeded-dot {
  color: #f05b91;
  background: #f05b91
}

.capacity-legend b {
  color: #f0f6ff;
  font-variant-numeric: tabular-nums
}

.scale-total {
  display: flex;
  align-items: center;
  color: #91add0;
  font-size: 8px
}

.scale-total>strong {
  margin-left: 4px;
  color: #e0f0ff;
  font-size: 11px
}

.scale-total>span {
  margin-left: auto;
  color: #7f9aba
}

.scale-total>span b {
  color: #ffad65;
  font-size: 9px
}

.scale-grid {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  align-content: stretch;
  gap: 4px 7px;
  margin-top: 5px
}

.scale-grid--cards {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: clamp(5px, .65vh, 9px);
  margin-top: 7px
}

.scale-item-card {
  position: relative;
  overflow: hidden;
  gap: clamp(7px, .7vw, 12px);
  padding: clamp(6px, .8vh, 11px) clamp(7px, .7vw, 12px);
  border: 1px solid rgba(69, 151, 255, .7);
  border-radius: 5px;
  background: linear-gradient(112deg, rgba(30, 83, 168, .9), rgba(11, 39, 100, .96) 58%, rgba(8, 27, 70, .98));
  box-shadow: inset 0 0 17px rgba(42, 133, 255, .28), 0 0 10px rgba(25, 102, 226, .18)
}

.scale-item-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: linear-gradient(180deg, #8cecff, #378dff 70%, transparent);
  content: ''
}

.scale-device-icon {
  z-index: 1;
  display: grid;
  width: clamp(28px, 3.2vh, 42px);
  height: clamp(28px, 3.2vh, 42px);
  flex: none;
  place-items: center;
  border: 1px solid rgba(154, 233, 255, .8);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #8feeff, #2389ca 52%, #1456a7);
  box-shadow: 0 0 11px rgba(61, 202, 255, .55), inset 0 0 8px rgba(231, 251, 255, .36);
  color: #ecfbff;
  font-size: 1.6vh
}

.scale-card-copy {
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: clamp(3px, .4vh, 6px)
}

.scale-card-copy strong,
.scale-card-copy small {
  overflow: hidden;
  color: #e7f4ff;
  text-overflow: ellipsis;
  white-space: nowrap
}

.scale-card-copy strong {
  font-weight: 650;
  text-shadow: 0 0 8px rgba(112, 184, 255, .3)
}

.scale-card-copy small {
  color: #b4d6ff;
  font-variant-numeric: tabular-nums
}

.scale-card-copy small b {
  margin-left: 5px;
  color: #73e5c2;
  font-weight: 600
}

.scale-card-glint {
  position: absolute;
  top: -30%;
  right: -18%;
  width: 45%;
  height: 160%;
  background: linear-gradient(110deg, transparent, rgba(108, 196, 255, .08), transparent);
  transform: rotate(12deg)
}

.scale-item {
  display: flex;
  min-width: 0;
  max-height: 12vh;
  align-items: center;
  gap: 5px
}

.scale-bubble {
  display: grid;
  width: clamp(27px, 2.3vw, 40px);
  aspect-ratio: 1;
  flex: none;
  place-items: center;
  border: 1px solid rgba(93, 177, 255, .46);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #397dde, #133a79 72%);
  box-shadow: 0 0 12px rgba(63, 137, 255, .37);
  color: #e7f4ff;
  font-size: clamp(8px, .55vw, 11px);
  font-weight: 700
}

.scale-item>div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px
}

.scale-item strong {
  color: #d7eaff;
  font: 700 clamp(9px, .66vw, 13px)/1 Arial, sans-serif
}

.scale-item small {
  color: #91aaca;
  font-size: 7px;
  white-space: nowrap
}

.scale-item small b {
  color: #ffae60;
  font-weight: 600
}

.split-summary,
.capability-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #9cb7d7;
  font-size: 8px
}

.split-summary strong {
  color: #dff2ff;
  font-size: 13px;
  text-shadow: 0 0 8px rgba(52, 153, 255, .42)
}

.split-chart {
  flex: 1
}

.capability-total {
  justify-content: flex-start;
  gap: 4px
}

.capability-total strong {
  color: #54d6f5;
  font-size: 13px;
  text-shadow: 0 0 7px rgba(51, 192, 238, .28)
}

.capability-total small {
  color: #89a6ca;
  font-size: 8px
}

.capability-live {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: #79a0cc
}

.capability-live i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4cdaaf;
  box-shadow: 0 0 6px #4cdaaf
}

.capability-chart {
  flex: 1
}

@media(max-width:1120px) {
  .dashboard-grid {
    grid-template-columns: minmax(230px, 1fr) minmax(390px, 1.8fr) minmax(230px, 1fr);
    gap: 6px
  }

  .left-column,
  .right-column,
  .center-column,
  .center-bottom {
    gap: 6px
  }

  .network-screen {
    padding-right: 5px;
    padding-left: 5px
  }

  .brand-subtitle {
    display: none
  }

  .scale-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr))
  }

  .ticket-statuses {
    grid-template-columns: 1fr 1fr
  }
}

@media(max-width:820px) {
  .network-screen {
    height: auto;
    min-height: 100vh;
    grid-template-rows: max(56px, 5.6vh) auto;
    overflow: visible
  }

  .screen-header {
    gap: 8px
  }

  .header-status>span:nth-child(2),
  .header-status b {
    display: none
  }

  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto
  }

  .center-column {
    grid-row: 1;
    grid-template-rows: minmax(360px, 58vh) auto
  }

  .map-panel,
  .center-bottom {
    grid-row: auto
  }

  .left-column,
  .right-column {
    grid-template-rows: auto
  }

  .left-column>:deep(.board-panel) {
    min-height: 175px
  }

  .right-column>:deep(.board-panel) {
    min-height: 165px
  }

  .center-bottom {
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: 150px
  }

  .dashboard-grid {
    gap: 8px
  }

  .service-grid {
    min-height: 130px
  }

  .health-chart {
    height: 115px;
    flex: none
  }

  .map-panel {
    min-height: 390px
  }

  .scale-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr))
  }
}

@media(max-width:520px) {
  .network-screen {
    min-width: 340px;
    padding: 5px
  }

  .screen-header {
    padding: 0 6px
  }

  .brand-line {
    gap: 6px
  }

  .brand-line h1 {
    font-size: 13px;
    letter-spacing: .04em
  }

  .header-status {
    gap: 5px
  }

  .header-status .online-dot {
    display: none
  }

  .center-bottom {
    grid-template-columns: 1fr;
    grid-auto-rows: 155px
  }

  .left-column>:deep(.board-panel) {
    min-height: 180px
  }

  .right-column>:deep(.board-panel) {
    min-height: 170px
  }

  .service-grid {
    gap: 4px 1px
  }

  .metric-gauge>span {
    font-size: 8px
  }

  .map-panel {
    min-height: 360px
  }

  .map-total {
    bottom: 7px
  }

  .scale-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr))
  }

  .health-chart {
    height: 130px
  }
}
</style>
