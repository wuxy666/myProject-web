export const serviceMetrics = [
  { label: '会话建立成功率', value: 99.73, tone: 'blue' },
  { label: 'EPS fallback 流程成功率', value: 99.6, tone: 'blue' },
  { label: '寻呼成功率', value: 95.94, tone: 'blue' },
  { label: 'HTTP 消息发送成功率', value: 98.82, tone: 'blue' },
  { label: 'AMF 注册成功率', value: 99.98, tone: 'orange' },
  { label: 'NF 发现请求成功率', value: 99.99, tone: 'orange' },
  { label: 'AMF 鉴权成功率', value: 99.51, tone: 'orange' },
  { label: 'AUSF 鉴权成功率', value: 96.66, tone: 'orange' },
] as const

export const ticketGroups = [
  { label: '故障工单', total: 18, tone: 'red', statuses: [{ label: '待受理', value: 4 }, { label: '处理中', value: 8 }, { label: '已闭环', value: 6 }] },
  { label: '隐患工单', total: 12, tone: 'orange', statuses: [{ label: '待整改', value: 3 }, { label: '整改中', value: 5 }, { label: '已消除', value: 4 }] },
] as const

export const healthScore = 95.28
export const provinceHealth = [
  { name: '浙江', value: 98.58 }, { name: '甘肃', value: 97.67 }, { name: '河南', value: 97.61 }, { name: '陕西', value: 97.57 },
  { name: '江苏', value: 97.23 }, { name: '吉林', value: 97.22 }, { name: '河北', value: 97.13 }, { name: '西藏', value: 97.06 },
]

export const subscriberTotal = 45_975_518
export const provinceSubscribers: Record<string, number> = {
  北京市: 186, 天津市: 142, 河北省: 1780, 山西省: 830, 内蒙古自治区: 540, 辽宁省: 1330, 吉林省: 650, 黑龙江省: 720,
  上海市: 1600, 江苏省: 4560, 浙江省: 3280, 安徽省: 1820, 福建省: 1450, 江西省: 1190, 山东省: 3880, 河南省: 2980,
  湖北省: 1930, 湖南省: 1760, 广东省: 5330, 广西壮族自治区: 1120, 海南省: 350, 重庆市: 880, 四川省: 2720, 贵州省: 910,
  云南省: 1060, 西藏自治区: 38, 陕西省: 1420, 甘肃省: 540, 青海省: 90, 宁夏回族自治区: 220, 新疆维吾尔自治区: 480,
  台湾省: 1200, 香港特别行政区: 890, 澳门特别行政区: 70,
}

export const changeOperations = {
  total: 153,
  ranges: {
    past: { label: '过去 7 天', success: 105, cancelled: 3, rolledBack: 0, unfinished: 45 },
    future: { label: '未来 7 天', success: 28, cancelled: 2, rolledBack: 1, unfinished: 16 },
  },
} as const

export const capacityStatus = {
  total: 217,
  normal: 180,
  exceeded: 37,
} as const

export const networkScaleTabs = {
  elements: {
    label: '网元', total: 428,
    items: [{ name: 'AMF', value: 48 }, { name: 'SMF', value: 52 }, { name: 'PCF', value: 34 }, { name: 'LNRF', value: 22 }, { name: 'UDM', value: 38 }, { name: 'SCP', value: 29 }, { name: 'CG', value: 41 }, { name: 'NSSF', value: 18 }, { name: 'UPF', value: 86 }, { name: 'BSF', value: 24 }],
  },
  devices: {
    label: '数通设备', total: 1268,
    items: [{ name: '核心路由器', value: 86 }, { name: '汇聚交换机', value: 324 }, { name: '接入交换机', value: 712 }, { name: '防火墙', value: 146 }],
  },
  servers: {
    label: '虚机/服务器', total: 3856,
    items: [{ name: '虚拟机', value: 2840 }, { name: '物理服务器', value: 612 }, { name: '容器实例', value: 404 }],
  },
} as const

export const splitRatio = {
  national: 70.84,
  provinces: [
    { name: '浙', value: 75.94 }, { name: '苏', value: 75.2 }, { name: '粤', value: 75.16 }, { name: '川', value: 74.93 },
    { name: '鄂', value: 74.68 }, { name: '鲁', value: 74.43 }, { name: '京', value: 74.3 }, { name: '沪', value: 74.19 },
  ],
}

export const capabilityTabs = {
  interface: {
    label: '接口', total: '411.83W', unit: '次',
    items: [{ name: '用户认证', value: 274.53 }, { name: '号码查询', value: 36.3 }, { name: '位置服务', value: 32.19 }, { name: '消息推送', value: 28.74 }, { name: '策略订阅', value: 14.96 }, { name: '业务开通', value: 6.94 }, { name: '状态通知', value: 6.2 }],
  },
  system: {
    label: '系统', total: '286.42W', unit: '次',
    items: [{ name: '业务支撑', value: 124.5 }, { name: '用户中心', value: 83.2 }, { name: '网络编排', value: 31.48 }, { name: '运维平台', value: 22.14 }, { name: '认证中心', value: 14.88 }, { name: '消息中心', value: 6.52 }, { name: '其他系统', value: 3.7 }],
  },
} as const
