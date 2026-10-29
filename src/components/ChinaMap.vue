<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue' // 导入 Vue3 生命周期与响应式 API
import * as THREE from 'three' // 导入 Three.js 3D 渲染核心库
import { geoMercator } from 'd3-geo' // 导入 d3-geo 球面墨卡托投影方法
import chinaBoundary from '../assets/china.json' // 导入中国省级行政区划 GeoJSON 数据
import { provinceSubscribers } from '../data/networkDashboard'
import { provinceColorForCount } from '../data/provinceColor'

const props = withDefaults(defineProps<{ provinceValues?: Record<string, number>; provinceUnit?: string }>(), {
  provinceValues: () => Object.fromEntries(Object.entries(provinceSubscribers).map(([name, value]) => [name, value * 1000])),
  provinceUnit: '户',
})

// 经纬度坐标点：前两位为经纬度，后续可选高程等附加维度
type Position = [number, number, ...number[]]
// 单一多边形几何：坐标为环数组
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] }
// 多边形集合几何：坐标为多边形数组
type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: Position[][][] }
// 几何联合类型，兼容未知类型
type Geometry = PolygonGeometry | MultiPolygonGeometry
// 地理要素：包含属性与几何
type Feature = { type: 'Feature'; properties?: Record<string, unknown>; geometry: Geometry }
// 要素集合：GeoJSON 顶层结构
type FeatureCollection = { features: Feature[] }

const mountPoint = ref<HTMLDivElement>() // 挂载点 DOM 引用
const hoverInfo = ref<{ name: string; value: number; x: number; y: number } | null>(null)
const provinceMeshes: THREE.Mesh[] = []
let renderer: THREE.WebGLRenderer | undefined // WebGL 渲染器实例
let scene: THREE.Scene | undefined // 3D 场景实例
let observer: ResizeObserver | undefined // 容器尺寸监听器
let frame = 0 // requestAnimationFrame 句柄
let disposed = false // 组件是否已卸载标记，阻止卸载后渲染
let detachControls: (() => void) | undefined // 交互事件解绑函数
let detachHover: (() => void) | undefined
const mapWidth = 1000 // 地图内容设计宽度（世界坐标）
const mapHeight = 700 // 地图内容设计高度（世界坐标）

// 将 GeoJSON 断言为要素集合类型以便 TS 类型检查
const geo = chinaBoundary as unknown as FeatureCollection
const provinceFeatures = geo.features.filter(feature => Boolean(feature.properties?.name))
// 行政区 GeoJSON 含有大范围外海边界，按全国经纬度窗口固定投影，避免外海数据把主体缩到全球视野。
const projection = geoMercator().center([104, 36]).scale(820).translate([mapWidth / 2, mapHeight / 2])

// 将单个经纬度点投影为二维坐标
function projectPoint(point: [number, number]): THREE.Vector2 {
  const projected = projection(point) // 执行投影
  return new THREE.Vector2(projected?.[0] ?? 0, projected?.[1] ?? 0) // 返回 Vector2，失败时回退为 0
}

// 将坐标环转为 Three.js Shape（用于拉伸几何体）
function makeShape(ring: Position[]): THREE.Shape | undefined {
  if (ring.length < 3) return undefined // 少于三点无法构成多边形
  const points = ring.map(point => projectPoint([point[0], point[1]])) // 投影所有顶点
  const shape = new THREE.Shape() // 创建空形状
  shape.moveTo(points[0]!.x - mapWidth / 2, mapHeight / 2 - points[0]!.y) // 移动到起点（以地图中心为原点）
  for (const point of points.slice(1)) shape.lineTo(point.x - mapWidth / 2, mapHeight / 2 - point.y) // 依次连线， y 轴翻转为屏幕坐标系
  shape.closePath() // 闭合路径
  return shape // 返回构建好的形状
}

// 从要素中提取所有多边形坐标（统一 Polygon 与 MultiPolygon 结构）
function polygonsOf(feature: Feature): Position[][][] {
  const geometry = feature.geometry // 获取要素几何
  if (geometry.type === 'Polygon') return [geometry.coordinates] // Polygon 包装为单元素数组
  if (geometry.type === 'MultiPolygon') return geometry.coordinates // MultiPolygon 直接返回
  return [] // 其他类型返回空数组
}

// 用 Canvas 生成文字纹理精灵，作为省份名称标签（始终面向相机，不随 3D 透视变形）
function makeTextSprite(text: string, color = '#e7f5ff'): THREE.Sprite {
  const canvas = document.createElement('canvas') // 创建画布
  const ctx = canvas.getContext('2d')! // 取 2D 上下文
  const fontSize = 14 // 画布字号，后续按比例缩放到世界坐标
  const font = `600 ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.font = font // 设置字体以测量宽度
  const metrics = ctx.measureText(text) // 测量文字宽度
  canvas.width = Math.ceil(metrics.width) + 8 // 画布宽 = 文字宽 + 边距
  canvas.height = fontSize + 8 // 画布高 = 字号 + 边距
  ctx.font = font // 设置画布尺寸后需重设 font
  ctx.textBaseline = 'middle' // 垂直居中
  ctx.textAlign = 'center' // 水平居中
  // ctx.lineWidth = 4 // 描边宽度
  // ctx.strokeStyle = '#002342' // 深色描边，保证深色地图上可读
  // ctx.strokeText(text, canvas.width / 2, canvas.height / 2) // 先描边
  ctx.fillStyle = color // 填充亮色
  ctx.fillText(text, canvas.width / 2, canvas.height / 2) // 再填充
  const texture = new THREE.CanvasTexture(canvas) // 生成纹理
  texture.minFilter = THREE.LinearFilter // 纹理缩小过滤，避免马赛克
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }) // 精灵材质，不参与深度测试，始终显示
  const sprite = new THREE.Sprite(material) // 创建精灵
  const scale = 0.7 // 世界坐标缩放因子，兼顾清晰度与省名间距
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1) // 按画布比例缩放，保持文字宽高比
  return sprite
}

function provinceColor(name: string, values = props.provinceValues): string {
  return provinceColorForCount(values[name] ?? 0)
}

function addProvince(scene: THREE.Scene, feature: Feature, index: number) {
  const name = String(feature.properties?.name ?? '')
  const baseColor = provinceColor(name)
  for (const polygon of polygonsOf(feature)) { // 遍历该省份所有多边形
    const shape = makeShape(polygon[0]!) // 外环构造 Shape
    if (!shape) continue // 无效形状跳过
    // 创建带斜角的拉伸体几何，使省份呈现立体厚度
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 1.8, bevelThickness: 1.8, curveSegments: 2 })
    // PBR 标准材质：略带金属感与自发光，增强地图质感
    const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ color: baseColor, roughness: .68, metalness: .12, emissive: '#07162d', emissiveIntensity: .14 }))
    body.position.z = -18 // 下沉底面并保留顶部高度，让斜视角能看清省份侧壁
    body.userData.provinceName = name
    body.userData.subscribers = props.provinceValues[name] ?? 0
    provinceMeshes.push(body)
    scene.add(body) // 加入场景

    for (const ring of polygon) { // 遍历外环与可能存在的内环（县洞）
      const points = ring.map(point => { // 将环点转为三维点
        const projected = projectPoint([point[0]!, point[1]!]) // 投影
        return new THREE.Vector3(projected.x - mapWidth / 2, mapHeight / 2 - projected.y, 7) // 顶面高度 z=7
      })
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(points) // 由点集构造缓冲几何
      scene.add(new THREE.Line(outlineGeometry, new THREE.LineBasicMaterial({ color: '#67b8ff', transparent: true, opacity: .76 }))) // 添加蓝色半透明轮廓线
    }
  }

  // 为省份添加名称标签：优先用数据源 properties.centroid 官方行政中心，与省份主体走同一 projectPoint 投影，保证对齐
  // properties.centroid 格式为 [经度, 纬度]，由 china.json 提供，比 d3-geo 计算质心更权威准确
  const propsCentroid = feature.properties?.centroid as [number, number] | undefined
  if (propsCentroid && propsCentroid.length === 2) { // 有有效行政中心才添加标签
    const cp = projectPoint([propsCentroid[0], propsCentroid[1]]) // 投影行政中心到世界坐标，与省份主体同一投影路径
    const label = makeTextSprite(formatProvinceLabel(name)) // 使用简称缓解东部密集区域的重叠
    label.position.set(cp.x - mapWidth / 2, mapHeight / 2 - cp.y, 20) // z=20 高于主体顶面，避免被遮挡
    label.userData.isProvinceLabel = true // 标记为省份标签，供 mapRoot 重组时排除
    scene.add(label) // 添加标签到场景顶层
  }
}

function formatProvinceLabel(name: string): string {
  const shortNames: Record<string, string> = {
    内蒙古自治区: '内蒙古', 广西壮族自治区: '广西', 宁夏回族自治区: '宁夏', 新疆维吾尔自治区: '新疆',
    西藏自治区: '西藏', 香港特别行政区: '香港', 澳门特别行政区: '澳门', 台湾省: '台湾',
  }
  return shortNames[name] ?? name.replace(/[省市]$/, '')
}

function addRadar(scene: THREE.Scene) {
  // 雷达整体缩放因子：数值越小光圈越小（建议 0.4~0.6，1 为原始大小）
  const radarScale = 0.25
  // 三层同心雷达环的基础半径、透明度与颜色
  const rings = [[300, .38, '#258ee4'], [255, .22, '#1976ca'], [190, .16, '#43aaff']] as const
  for (const [radius, opacity, color] of rings) {
    const r = radius * radarScale // 应用缩放
    // 环宽保持 2 不变，避免缩放后线条过细看不清
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 1, r + 1, 160), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }))
    ring.position.z = -11 // 环下沉到地图背面，避免遮挡主体
    scene.add(ring)
  }
  // 扫描光束弧（与环使用同一缩放因子，保持比例协调）
  const arcInner = 330 * radarScale
  const arcOuter = 334 * radarScale
  const arc = new THREE.Mesh(new THREE.RingGeometry(arcInner, arcOuter, 160, 1, .42, 1.15), new THREE.MeshBasicMaterial({ color: '#5dbbff', transparent: true, opacity: .66, side: THREE.DoubleSide }))
  arc.position.z = -9 // 弧位置略高
  scene.add(arc)
}

type SubscriberPoint = { longitude: number; latitude: number; value: number }
const subscriberPoints: SubscriberPoint[] = [
  { longitude: 116.4, latitude: 39.9, value: 186 }, { longitude: 121.5, latitude: 31.2, value: 1600 },
  { longitude: 120.2, latitude: 30.3, value: 3280 }, { longitude: 113.3, latitude: 23.1, value: 5330 },
  { longitude: 104.1, latitude: 30.7, value: 2720 }, { longitude: 108.9, latitude: 34.3, value: 1420 },
  { longitude: 114.3, latitude: 30.6, value: 1930 }, { longitude: 118.8, latitude: 32.1, value: 4560 },
  { longitude: 117.2, latitude: 31.8, value: 1820 }, { longitude: 125.3, latitude: 43.9, value: 650 },
  { longitude: 126.6, latitude: 45.8, value: 720 }, { longitude: 87.6, latitude: 43.8, value: 480 },
  { longitude: 91.1, latitude: 29.7, value: 38 }, { longitude: 102.8, latitude: 24.9, value: 1060 },
  { longitude: 106.5, latitude: 29.6, value: 880 }, { longitude: 119.3, latitude: 26.1, value: 1450 },
  { longitude: 117, latitude: 36.7, value: 3880 }, { longitude: 113.6, latitude: 34.7, value: 2980 },
  { longitude: 108.3, latitude: 22.8, value: 1120 }, { longitude: 110.3, latitude: 20, value: 350 },
]

function addSubscriberPoints(scene: THREE.Scene) {
  for (const { longitude, latitude, value } of subscriberPoints) {
    const point = projectPoint([longitude, latitude])
    const x = point.x - mapWidth / 2
    const y = mapHeight / 2 - point.y
    const size = 2.6 + Math.min(value / 1800, 2)
    const marker = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), new THREE.MeshBasicMaterial({ color: '#8cf5ff' }))
    marker.position.set(x, y, 13)
    scene.add(marker)
    const halo = new THREE.Mesh(new THREE.RingGeometry(size + 1.5, size + 3.2, 28), new THREE.MeshBasicMaterial({ color: '#3acbfa', transparent: true, opacity: .72, side: THREE.DoubleSide }))
    halo.position.set(x, y, 11)
    scene.add(halo)
    const pulse = new THREE.MeshBasicMaterial({ color: '#49c9ff', transparent: true, opacity: .5, side: THREE.DoubleSide })
    const ripple = new THREE.Mesh(new THREE.RingGeometry(size + 5, size + 7, 32), pulse)
    ripple.position.set(x, y, 10)
    ripple.userData.pulse = (Math.random() + value / 10000) % 1
    ripple.userData.pulseSpeed = .6 + Math.min(value / 12000, .4)
    scene.add(ripple)
  }
}

function attachControls(element: HTMLDivElement, camera: THREE.OrthographicCamera) {
  let dragging = false // 是否正在拖动
  let lastX = 0 // 上次指针 x
  let lastY = 0 // 上次指针 y

  // 滚轮缩放：上下滚轮调整相机 zoom
  const onWheel = (event: WheelEvent) => {
    event.preventDefault() // 阻止页面滚动
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12 // 上滚放大，下滚缩小
    camera.zoom = Math.min(6, Math.max(.5, camera.zoom * factor)) // 限制缩放区间
    camera.updateProjectionMatrix() // 更新投影矩阵
  }

  // 指针按下：开始拖动并捕获指针
  const onDown = (event: PointerEvent) => {
    dragging = true // 进入拖动状态
    lastX = event.clientX // 记录起点 x
    lastY = event.clientY // 记录起点 y
    element.setPointerCapture?.(event.pointerId) // 捕获指针，保证移出元素仍可接收事件
  }

  // 指针移动：按位移平移相机
  const onMove = (event: PointerEvent) => {
    if (!dragging) return // 非拖动状态忽略
    const dx = event.clientX - lastX // x 位移
    const dy = event.clientY - lastY // y 位移
    lastX = event.clientX // 更新上次位置
    lastY = event.clientY
    const width = element.clientWidth // 容器宽
    const height = element.clientHeight // 容器高
    if (!width || !height) return // 容器尺寸为 0 则跳过
    const worldPerPxX = (camera.right - camera.left) / width // x 方向每像素对应的世界单位
    const worldPerPxY = (camera.top - camera.bottom) / height // y 方向每像素对应的世界单位
    camera.position.x -= dx * worldPerPxX // 反向移动相机实现地图跟随鼠标
    camera.position.y += dy * worldPerPxY // y 轴反向因为屏幕坐标与世界坐标 y 方向相反
  }

  // 指针抬起：结束拖动并释放捕获
  const onUp = (event: PointerEvent) => {
    dragging = false // 退出拖动状态
    element.releasePointerCapture?.(event.pointerId) // 释放指针捕获
  }

  // 绑定事件监听
  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointerleave', onUp)

  // 返回解绑函数，供卸载时调用
  return () => {
    element.removeEventListener('wheel', onWheel)
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointerleave', onUp)
  }
}

onMounted(() => {
  if (!mountPoint.value) return // 挂载点不存在则直接退出
  const element = mountPoint.value // 获取挂载 DOM
  provinceMeshes.length = 0
  const currentScene = new THREE.Scene() // 创建场景
  scene = currentScene
  currentScene.background = null // 背景透明，便于融合页面背景
  currentScene.fog = new THREE.Fog('#071727', 650, 1300) // 雾效增强深度感
  currentScene.add(new THREE.AmbientLight('#a4ccff', 1.28)) // 环境光，补充阴影面
  const keyLight = new THREE.DirectionalLight('#8ecaff', 2.25) // 主平行光
  keyLight.position.set(-220, 280, 420) // 主光位置
  currentScene.add(keyLight)
  const rimLight = new THREE.PointLight('#087eff', 560, 980) // 蓝色点光，突出边缘高光
  rimLight.position.set(240, -130, 110)
  currentScene.add(rimLight)
  addRadar(currentScene) // 添加雷达装饰
  provinceFeatures.forEach((feature, index) => addProvince(currentScene, feature, index)) // 遍历各省份构建立体体
  addSubscriberPoints(currentScene) // 使用模拟用户分布叠加签约用户站点

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }) // 创建高性能渲染器
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7)) // 限制像素比避免高分屏过载
  renderer.setClearColor(0x000000, 0) // 清除色透明
  renderer.outputColorSpace = THREE.SRGBColorSpace // 输出色彩空间
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 电影级色调映射
  renderer.toneMappingExposure = 1.12 // 曝光微调
  element.appendChild(renderer.domElement) // 将 canvas 挂入容器

  // 创建正交相机，保证地图等比无透视渲染
  const camera = new THREE.OrthographicCamera(-500, 500, 350, -350, .1, 1800)
  camera.position.set(0, -330, 780) // 轻微俯斜观察，展示省份挤出厚度与侧壁
  camera.lookAt(0, 0, 0) // 看向原点
  camera.zoom = 1 // 视野大小由容器比例计算，保证全国地图完整显示
  camera.updateProjectionMatrix() // 更新投影矩阵
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const onPointerMove = (event: PointerEvent) => {
    if (!renderer) return
    const rect = renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(provinceMeshes, false)[0]
    if (!hit) {
      hoverInfo.value = null
      return
    }
    const province = hit.object.userData.provinceName as string
    hoverInfo.value = {
      name: province,
      value: props.provinceValues[province] ?? 0,
      x: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - 220)),
      y: Math.max(8, Math.min(event.clientY + 14, window.innerHeight - 70)),
    }
  }
  const onPointerLeave = () => { hoverInfo.value = null }
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerleave', onPointerLeave)
  detachHover = () => {
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerleave', onPointerLeave)
  }
  const mapRoot = new THREE.Group() // 创建地图根组，便于统一变换
  // 先收集所有需迁移的对象（Mesh/Line/灯光），省份标签留在 scene 顶层不随旋转
  const toMove = currentScene.children.filter(child =>
    (child instanceof THREE.Mesh || child instanceof THREE.Line ||
     child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight ||
     child instanceof THREE.PointLight) &&
    !child.userData.isProvinceLabel // 排除省份标签，使其留在 scene 不随 rotation 偏移
  ) as THREE.Object3D[]
  // 逐个从 scene 移除并加入 mapRoot，保证所有省份主体都被迁移（不会被标签中断）
  for (const child of toMove) {
    currentScene.remove(child) // 从场景移除
    mapRoot.add(child) // 加入 mapRoot
  }
  currentScene.add(mapRoot) // 将 mapRoot 加入场景
  // 不设置 rotation：省份主体与标签同处投影平面，质心天然对齐，确保标签精准落在各省份中心

  // 计算视野范围，采用 object-fit: contain 逻辑保证地图填满容器且不裁切
  const resize = () => {
    const width = element.clientWidth // 容器宽
    const height = element.clientHeight // 容器高
    if (!width || !height || !renderer) return // 无效尺寸或渲染器则跳过
    const aspect = width / height // 容器宽高比
    const contentAspect = mapWidth / mapHeight // 地图内容宽高比
    let viewWidth: number
    let viewHeight: number
    if (aspect >= contentAspect) { // 容器更宽时以高度为基准
      viewHeight = mapHeight * 1.02 // 留出 2% 边距
      viewWidth = viewHeight * aspect
    } else { // 容器更高时以宽度为基准
      viewWidth = mapWidth * 1.02
      viewHeight = viewWidth / aspect
    }
    camera.left = -viewWidth / 2 // 更新相机左右上下边界
    camera.right = viewWidth / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix() // 更新投影
    renderer.setSize(width, height, false) // 调整 canvas 尺寸，不修改样式
    renderer.render(currentScene, camera) // 立即渲染一帧
  }
  observer = new ResizeObserver(resize) // 监听容器尺寸变化
  observer.observe(element) // 开始观察
  resize() // 首次手动调用
  // detachControls = attachControls(element, camera)//可拖拽缩放 // 绑定拖拽缩放交互

  // 主动画循环：驱动涟漪脉动并持续渲染
  const animate = (time: number) => {
    if (disposed || !renderer) return // 已卸载或无渲染器则停止
    const t = time * .001 // 转换为秒
    currentScene.traverse(object => { // 遍历场景所有对象
      if (object.userData.pulse !== undefined && object instanceof THREE.Mesh) { // 只处理带 pulse 标记的涟漪网格
        const speed = (object.userData.pulseSpeed as number | undefined) ?? .62 // 取动画速度
        const phase = (t * .62 * speed + object.userData.pulse) % 1 // 计算相位 0-1 循环
        const scale = 1 + phase * 2.7 // 计算缩放，随相位增大
        object.scale.setScalar(scale) // 应用缩放
        const material = object.material as THREE.MeshBasicMaterial // 取材质
        material.opacity = (1 - phase) * .68 // 透明度随相位衰减，形成涟漪渐隐
      }
    })
    renderer.render(currentScene, camera) // 渲染当前帧
    frame = requestAnimationFrame(animate) // 请求下一帧
  }
  frame = requestAnimationFrame(animate) // 启动循环
})

watch(() => props.provinceValues, values => {
  scene?.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.userData.provinceName) return
    const material = object.material as THREE.MeshStandardMaterial
    material.color.set(provinceColor(String(object.userData.provinceName), values))
  })
}, { deep: true })

// 组件卸载前清理资源，避免内存泄漏
onBeforeUnmount(() => {
  disposed = true // 标记已卸载，终止动画循环
  detachHover?.()
  cancelAnimationFrame(frame) // 取消动画帧
  observer?.disconnect() // 停止监听容器尺寸
  detachControls?.() // 解绑交互事件
  if (renderer) { // 释放渲染器资源
    renderer.dispose()
    renderer.domElement.remove() // 移除 canvas
  }
  scene?.traverse(object => { // 遍历释放所有几何与材质
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose() // 释放几何
      const materials = Array.isArray(object.material) ? object.material : [object.material] // 统一为数组
      materials.forEach(material => material.dispose()) // 释放各材质
    } else if (object instanceof THREE.Sprite) { // 精灵标签无几何，但需释放材质与纹理
      const material = object.material as THREE.SpriteMaterial
      material.map?.dispose() // 释放 Canvas 纹理
      material.dispose() // 释放材质
    }
  })
})
</script>

<template>
  <!-- 地图根容器，Three.js canvas 将挂载于此 -->
  <div ref="mountPoint" class="china-map" aria-label="Three.js 中国省级签约用户分布地图">
    <div class="map-key"><span><i class="subscriber-point"></i>签约用户分布</span><span>省份颜色按签约用户数分级</span></div>
  </div>
  <Teleport to="body">
    <div v-if="hoverInfo" class="province-tooltip" :style="{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }">
      <strong>{{ hoverInfo.name }}</strong>
      <span>签约用户 <b>{{ hoverInfo.value.toLocaleString() }} {{ props.provinceUnit }}</b></span>
    </div>
  </Teleport>
</template>

<style scoped>
/* 地图根容器：绝对定位填满父级，预留给顶部其他元素空间 */
.china-map {
  position: absolute;
  inset: 4% 0 0; /* 上边距 4%，左下右贴边 */
  width: 100%;
  height: 96%;
  z-index: 1
}

.province-tooltip {
  position: fixed;
  z-index: 10000;
  display: grid;
  gap: 5px;
  min-width: 156px;
  padding: 8px 10px;
  border: 1px solid rgba(70, 151, 255, .78);
  border-radius: 4px;
  background: rgba(5, 17, 36, .97);
  box-shadow: 0 0 14px rgba(37, 128, 232, .3);
  color: #fff;
  font-size: 1.5vh;
  pointer-events: none
}

.province-tooltip strong {
  color: #fff;
  font-weight: 700
}

.province-tooltip span {
  color: #d5e7fa
}

.province-tooltip b {
  margin-left: 4px;
  color: #fff;
  font-weight: 600
}

/* canvas 填满容器并去除块级默认间隙 */
.china-map :deep(canvas) {
  width: 100%;
  height: 100%;
  display: block
}

/* 省名文字标签样式（当前未启用） */
.map-label {
  position: absolute;
  z-index: 2;
  color: #e7f5ff;
  font-size: clamp(8px, .56vw, 11px); /* 响应式字号 */
  font-weight: 600;
  text-shadow: 0 1px 4px #002342, 0 0 8px #3b9be8; /* 描边发光提升可读性 */
  pointer-events: none; /* 不拦截交互 */
  white-space: nowrap
}

/* 各省标签的百分比定位 */
.label-north {
  left: 72%;
  top: 27%
}

.label-west {
  left: 13%;
  top: 48%
}

.label-east {
  left: 72%;
  top: 63%
}

.label-south {
  left: 59%;
  top: 83%
}

.label-center {
  left: 58%;
  top: 55%
}

.label-sichuan {
  left: 44%;
  top: 66%
}

.label-inner {
  left: 49%;
  top: 39%
}

.label-taiwan {
  left: 82%;
  top: 79%
}

/* 左下角图例容器 */
.map-key {
  position: absolute;
  z-index: 2;
  left: 0;
  bottom: 5vh;
  display: flex;
  flex-direction: column; /* 纵向排列图例条目 */
  gap: 8px;
  padding: 9px 12px;
  /* border: 1px solid rgba(234, 74, 48, .48); 橙红边框
  background: rgba(5, 20, 34, .78); 深色半透明背景 */
  color: #afc5d6;
  font-size: 10px
}

/* 图例条目不换行 */
.map-key span {
  white-space: nowrap
}

/* 图例颜色圆点 */
.map-key i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: #67e4f4;
  box-shadow: 0 0 8px #299dff /* 发光效果 */
}

.map-key i.subscriber-point { background: #67e4f4; box-shadow: 0 0 8px #2bbcff }

/* 窄屏适配：缩小标签与图例尺寸 */
@media(max-width:760px) {
  .map-label {
    font-size: 8px
  }

  .map-key {
    bottom: 8px;
    padding: 7px;
    font-size: 8px
  }

  .china-map {
    inset: 8% 0 0; /* 窄屏增大顶部预留 */
    height: 92%
  }
}
</style>
