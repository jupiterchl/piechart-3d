/* eslint-disable no-invalid-this */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { arc, pie } from 'd3-shape';
import { clamp, isFunction, debounce } from 'lodash-es';
import mitt from 'mitt';
import ResourceTracker from './libs/ResourceTracker';

// 色彩管理由 options.renderer.colorManagement 控制，在实例构造时设置，避免引入库时改动全局状态

const PREFIX = 'PIE';
const EVENTS = ['mousemove', 'click'];

/**
 * @description: 生成 HDR 夜空环境贴图，为 PBR 材质提供高光和环境反射
 * @param {*} renderer
 * @return {*}
 */
function createNightEnvironment(renderer) {
  // 环境贴图只需提供低频明暗，PMREM 会进一步模糊，低分辨率即可
  const width = 256;
  const height = 128;
  const data = new Float32Array(width * height * 4);
  const clamp = (v) => Math.max(0, v);

  for (let y = 0; y < height; y += 1) {
    // DataTexture 首行对应环境贴图底部，这里反转，保证天空在顶部
    const v = 1 - y / (height - 1);

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);

      // 夜空渐变（线性色值）
      let r;
      let g;
      let b;
      if (v < 0.5) {
        const t = v / 0.5;
        r = 0.004 + (0.02 - 0.004) * t;
        g = 0.006 + (0.035 - 0.006) * t;
        b = 0.012 + (0.06 - 0.012) * t;
      } else {
        const t = (v - 0.5) / 0.5;
        r = 0.03 + (0.002 - 0.03) * t;
        g = 0.04 + (0.003 - 0.04) * t;
        b = 0.06 + (0.005 - 0.06) * t;
      }

      // 地平线暖光
      const band = Math.exp(-((v - 0.56) ** 2) / 0.0025);
      r += band * 0.015;
      g += band * 0.01;
      b += band * 0.008;

      // 大面积冷色天光（低频光，磨砂表面也能形成明暗过渡）
      const gdx = Math.min(Math.abs(u - 0.72), 1 - Math.abs(u - 0.72)) * 2;
      const gdy = (v - 0.26) / 0.22;
      const glow = Math.exp(-(gdx * gdx) / 0.22 - gdy * gdy);
      r += glow * 0.6;
      g += glow * 0.55;
      b += glow * 0.5;

      // 大面积暖色地平线光
      const wgx = Math.min(Math.abs(u - 0.2), 1 - Math.abs(u - 0.2)) * 2;
      const wgy = (v - 0.48) / 0.24;
      const warmGlow = Math.exp(-(wgx * wgx) / 0.12 - wgy * wgy);
      r += warmGlow * 0.12;
      g += warmGlow * 0.06;
      b += warmGlow * 0.03;

      // 地面微弱反射光，让底部倒角能接住光
      const ground = Math.exp(-((v - 0.78) ** 2) / 0.02);
      r += ground * 0.12;
      g += ground * 0.1;
      b += ground * 0.08;

      // 月亮（高动态范围）
      const dx = Math.min(Math.abs(u - 0.72), 1 - Math.abs(u - 0.72)) * 2;
      const dy = v - 0.2;
      const moon = Math.exp(-(dx * dx + dy * dy) / 0.0022);
      r += moon * 14;
      g += moon * 15;
      b += moon * 16;

      // 冷色柔光带，形成大面积柔和反光
      const hx = Math.min(Math.abs(u - 0.28), 1 - Math.abs(u - 0.28)) * 2;
      const hy = v - 0.34;
      const strip = Math.exp(-(hx * hx) / 0.012 - (hy * hy) / 0.035);
      r += strip * 3.2;
      g += strip * 3.2;
      b += strip * 3.4;

      // 暖色轮廓光
      const wx = Math.min(Math.abs(u - 0.92), 1 - Math.abs(u - 0.92)) * 2;
      const wy = v - 0.42;
      const warm = Math.exp(-(wx * wx) / 0.005 - (wy * wy) / 0.06);
      r += warm * 1.5;
      g += warm * 0.75;
      b += warm * 0.3;

      const i = (y * width + x) * 4;
      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(texture);
  texture.dispose();

  return { pmrem, envRT };
}

/**
 * @description: 读取对象数组数据中的字段，key 支持字符串或函数
 * @param {*} item
 * @param {String|Function} key
 * @param {Number} index
 * @return {*}
 */
function resolveDataField(item, key, index) {
  if (typeof key === 'function') return key(item, index);

  if (item !== null && typeof item === 'object') return item[key];

  return item;
}

// 两套观感预设：legacy 逐项沿用 3.3.1 的渲染参数，modern 为 4.x 的新观感
const RENDERER_PRESETS = {
  legacy: {
    outputEncoding: 'linear',
    toneMapping: 'none',
    toneMappingExposure: 0.94,
    colorManagement: false,
    environment: false,
    material: 'phong',
    geometry: 'legacy',
  },
  modern: {
    outputEncoding: 'srgb',
    toneMapping: 'aces',
    toneMappingExposure: 0.94,
    colorManagement: true,
    environment: true,
    material: 'standard',
    geometry: 'current',
  },
};

// modern 预设配套的默认灯光强度
const MODERN_LIGHTS = [
  {
    type: 'AmbientLight',
    color: '#fff',
    intensity: 0.04,
  },
  {
    type: 'SpotLight',
    color: '#fff',
    intensity: 0.75,
    position: [10, 15, 10],
    angle: 0.07,
    penumbra: 1,
  },
];

const defaultOptions = {
  debug: false,

  data: [], // [5, 2, 3, 4] 或 [{ name: 'A', value: 5 }, ...]
  valueKey: 'value', // 对象数据取值字段，支持函数 (item, index) => number
  nameKey: 'name', // 对象数据名称字段，支持函数 (item, index) => string
  innerRadius: 0, // 0-100
  outerRadius: 100, // 0-100
  cornerRadius: 0, // 0-50 (outerRadius-innerRadius)/2
  padAngle: 0, // 0-0.1
  explode: 0, // 0-50，或按数据项配置的数组（以半径百分比计）
  height: 20, // 0-50
  scale: 1,

  viewport: [0, 2, 3],
  controls: false, // 是否开启视角控制，可传对象覆盖 OrbitControls 配置

  // 渲染观感：preset 为 'legacy' 时完全沿用 3.x 的渲染管线，'modern' 使用 4.x 观感。
  // 其余字段是对应预设的具体参数，可单独覆盖，见 README「renderer 配置」
  renderer: {
    preset: 'legacy', // 'legacy' | 'modern'
    outputEncoding: 'linear', // 'linear' | 'srgb'
    toneMapping: 'none', // 'none' | 'aces'
    toneMappingExposure: 0.94, // 仅 toneMapping 为 'aces' 时生效
    colorManagement: false, // three.js 色彩管理（全局设置，与 sRGB 输出搭配）
    environment: false, // 夜景环境贴图，仅 PBR 材质生效
    material: 'phong', // 'phong'（3.x）| 'standard'（PBR）
    geometry: 'legacy', // 'legacy'（3.x 的细分段数与倒角）| 'current'
  },
  colors: [
    '#3b82f6', // blue
    '#f43f5e', // rose
    '#f97316', // orange
    '#22c55e', // green
    '#eab308', // yellow
    '#06b6d4', // cyan
    '#d946ef', // fuschia
    '#8b5cf6', // violet
    '#84cc16', // lime
    '#6366f1', // indigo
  ],
  emptyColor: '#aaa',
  lights: [
    {
      type: 'AmbientLight',
      color: '#fff',
      intensity: 0.3,
    },
    {
      type: 'SpotLight',
      color: '#fff',
      intensity: 1,
      position: [5, 5, 5],
    },
  ],

  label: {
    show: false,
    position: 0.7,
    render: null,
  },
  centerLabel: {
    show: false, // 环形图中心内容（如合计值）
    render: null, // ({ total, visibleTotal, data }) => HTMLElement
  },
  enterAnimation: true, // 入场动画：false 关闭，数字为时长（秒）
  activeAnimation: null, // { duration: 0.25, heightScale: 2 }
  autoplay: false, // boolean|number 自动播放间隔时长

  on: null, // { mouseenter, mouseleave, active }
};

class Pie {
  constructor(el, options) {
    this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    this.options = { ...defaultOptions, ...options };

    // renderer 先取预设，再用传入的字段逐项覆盖；未传部分字段时不会丢失预设值
    const rendererOptions = (options && options.renderer) || {};
    const presetKey = rendererOptions.preset === 'modern' ? 'modern' : 'legacy';
    const preset = RENDERER_PRESETS[presetKey];
    this.options.renderer = { preset: presetKey, ...preset, ...rendererOptions };

    // 未显式传灯光时，按预设套用 3.x / 4.x 的默认灯光
    if (!options || !options.lights) {
      this.options.lights = presetKey === 'modern' ? MODERN_LIGHTS : defaultOptions.lights;
    }

    // 色彩管理是 three.js 的全局开关，需在创建颜色、灯光前设置
    THREE.ColorManagement.enabled = Boolean(this.options.renderer.colorManagement);

    // 检查定位
    const style = window.getComputedStyle(this.$el);
    if (style.position === 'static') {
      this.$el.style.position = 'relative';
    }

    // 初始化
    this.#init();
  }

  #emitter = mitt();
  #tracker = new ResourceTracker();

  #width = null;
  #height = null;
  #renderer = null;
  #scene = null;
  #camera = null;
  #controls = null;
  #raycaster = null;
  #domEvents = [];
  #pie = null;
  #isEmpty = false;
  #activeIndex = -1;
  #legends = [];
  #arcs = null;
  #labels = [];
  #makePieAnimate = null;
  #runtimeEvents = [];
  #debounceCompleteCb = null;
  #disposed = false;
  #labelDirty = true;
  #needsRender = true;
  #renderedOnce = false;
  #pendingStartMakePie = null;
  #resizeObserver = null;
  #resizeUnbind = null;
  #applyingView = false;
  #zoomRadiusTarget = null;
  #centerLabel = null;
  #centerLabelKey = null;

  #autoplay = {
    activeIndex: 0,
    interval: null,
    resumeTimeout: null,
  };

  /**
   * @description: 初始化
   * @return {*}
   */
  #init() {
    this.#initData();
    this.#initEvent();
    this.#initFrame();

    this.#buildPie();
  }

  /**
   * @description: 初始化数据
   * @return {*}
   */
  #initData() {
    if (this.$el) {
      this.#width = this.$el.clientWidth;
      this.#height = this.$el.clientHeight;
    } else {
      throw new Error('dom节点不存在');
    }

    const { data } = this.options;

    this.#legends = data.map(() => true);
  }

  /**
   * @description: 初始化事件
   * @return {*}
   */
  #initEvent() {
    const { on } = this.options;

    if (on) {
      Object.entries(on).forEach(([type, handler]) => {
        this.#emitter.on(type, handler);
      });
    }

    this.#emitter.on('mouseenter', ({ index }) => {
      this.#onMouseenter(index);
    });
    this.#emitter.on('mouseleave', () => {
      this.#onMouseleave();
    });

    this.#raycaster = new THREE.Raycaster();

    const handler = (e) => {
      const mouse = new THREE.Vector2();
      mouse.x = (e.offsetX / this.#width) * 2 - 1;
      mouse.y = -(e.offsetY / this.#height) * 2 + 1;
      this.#raycaster.setFromCamera(mouse, this.#camera);
      this.#emitter.emit(`${PREFIX}:${e.type}`, e);
    };

    EVENTS.forEach((type) => {
      this.$el.addEventListener(type, handler, false);

      const unbind = () => {
        this.$el.removeEventListener(type, handler, false);
      };
      this.#domEvents.push(unbind);
    });
  }

  /**
   * @description: 初始化界面
   * @return {*}
   */
  #initFrame() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(this.#width, this.#height);

    const { outputEncoding, toneMapping, toneMappingExposure } = this.options.renderer;
    renderer.outputEncoding = outputEncoding === 'srgb' ? THREE.sRGBEncoding : THREE.LinearEncoding;
    renderer.toneMapping = toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = toneMappingExposure;
    this.$el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0xf0f0f0);

    // 夜空环境贴图，为 PBR 材质提供高光与反射层次；3.x 观感不带环境贴图
    if (this.options.renderer.environment) {
      const { pmrem, envRT } = createNightEnvironment(renderer);
      scene.environment = envRT.texture;
      this.#tracker.add(pmrem);
      this.#tracker.add(envRT);
    }

    const camera = new THREE.PerspectiveCamera(50, this.ratio, 0.1, 100);
    camera.position.set(...this.options.viewport);
    camera.lookAt(0, 0, 0);

    const animation = () => {
      const controlsChanged = Boolean(this.#controls?.update());

      // 自定义平滑缩放：每帧逼近目标距离，避免滚轮逐档跳变
      this.#updateZoom();

      if (controlsChanged) {
        this.#labelDirty = true;
        this.#needsRender = true;
      }

      if (this.#labelDirty) {
        this.#labelDirty = false;
        this.#updateLabel();
      }

      if (this.#needsRender) {
        this.#needsRender = false;
        renderer.render(scene, camera);
        this.#renderedOnce = true;

        // 首帧渲染完成后再启动入场动画，避免初始化阻塞吃掉动画时长
        if (this.#pendingStartMakePie) {
          const start = this.#pendingStartMakePie;
          this.#pendingStartMakePie = null;
          start();
        }
      }
    };
    renderer.setAnimationLoop(animation);

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;

    this.#initResize();

    this.#buildAuxSystem();
    this.#buildLightSystem();
  }

  /**
   * @description: 监听容器尺寸变化，同步渲染尺寸与相机宽高比
   * @return {*}
   */
  #initResize() {
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => this.#resize();
      window.addEventListener('resize', onResize, false);

      this.#resizeUnbind = () => window.removeEventListener('resize', onResize, false);
      return;
    }

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this.$el);
  }

  /**
   * @description: 容器尺寸变化后重设渲染器与相机，并重算标签位置
   * @return {*}
   */
  #resize() {
    if (this.#disposed || !this.$el || !this.#renderer || !this.#camera) return;

    const width = this.$el.clientWidth;
    const height = this.$el.clientHeight;

    if (!width || !height || (width === this.#width && height === this.#height)) return;

    this.#width = width;
    this.#height = height;

    this.#renderer.setSize(width, height);
    this.#camera.aspect = this.ratio;
    this.#camera.updateProjectionMatrix();

    this.#needsRender = true;
    this.#labelDirty = true;
  }

  /**
   * @description: 构建辅助系统
   * @return {*}
   */
  #buildAuxSystem() {
    if (this.openDebug) {
      // 坐标轴
      const axisHelper = new THREE.AxesHelper(10);
      this.#scene.add(axisHelper);
      this.#tracker.add(axisHelper);

      // 网格
      const gridHelper = new THREE.GridHelper(100, 100);
      this.#scene.add(gridHelper);
      this.#tracker.add(gridHelper);
    }

    if (this.openDebug || this.options.controls) {
      // 控制器：拖拽旋转、滚轮缩放、右键平移
      const controls = new OrbitControls(this.#camera, this.#renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.rotateSpeed = 0.35;
      // 默认不允许转到水平面以下，避免看到饼图底部
      controls.maxPolarAngle = Math.PI / 2;
      // 默认关闭右键平移，避免把图表平移到视线下方
      controls.enablePan = false;

      if (this.options.controls && typeof this.options.controls === 'object') {
        Object.assign(controls, this.options.controls);
      }

      // 用户操作改变视角时派发事件，便于多个图表同步视角
      controls.addEventListener('change', () => {
        if (this.#applyingView || this.#disposed) return;
        this.#emitter.emit('viewchange', this.getView());
      });

      this.#controls = controls;
      this.#tracker.add(controls);

      // 在捕获阶段拦截滚轮，改用带过渡的自定义缩放；触屏双指缩放仍由 OrbitControls 处理
      const onWheel = (event) => this.#onWheelZoom(event);
      this.$el.addEventListener('wheel', onWheel, { capture: true, passive: false });
      this.#domEvents.push(() => {
        this.$el.removeEventListener('wheel', onWheel, true);
      });
    }
  }

  /**
   * @description: 记录滚轮缩放的目标距离
   * @param {WheelEvent} event
   * @return {*}
   */
  #onWheelZoom(event) {
    if (!this.#controls || !this.#controls.enableZoom || !this.#camera) return;

    const direction = Math.sign(event.deltaY);

    if (!direction) return;

    event.preventDefault();
    event.stopPropagation();

    const target = this.#controls.target;
    const currentRadius = this.#zoomRadiusTarget ?? this.#camera.position.distanceTo(target);
    const speed = Number.isFinite(this.#controls.zoomSpeed) ? this.#controls.zoomSpeed : 1;
    // 与 OrbitControls 一致：向上滚动（deltaY < 0）拉近
    const scale = Math.pow(0.95, -direction * speed);
    const min = Math.max(0.05, this.#controls.minDistance);
    const max = this.#controls.maxDistance;

    this.#zoomRadiusTarget = Math.min(max, Math.max(min, currentRadius * scale));
  }

  /**
   * @description: 平滑逼近滚轮缩放的目标距离
   * @return {*}
   */
  #updateZoom() {
    if (this.#zoomRadiusTarget === null || !this.#controls || !this.#camera) return;

    const target = this.#controls.target;
    const offset = new THREE.Vector3().subVectors(this.#camera.position, target);
    const radius = offset.length();

    if (!radius) {
      this.#zoomRadiusTarget = null;
      return;
    }

    const diff = this.#zoomRadiusTarget - radius;

    if (Math.abs(diff) < 0.002) {
      this.#zoomRadiusTarget = null;
      return;
    }

    const nextRadius = radius + diff * 0.25;

    this.#camera.position.copy(target).add(offset.setLength(nextRadius));
    this.#camera.lookAt(target);
    this.#camera.updateMatrixWorld();

    this.#labelDirty = true;
    this.#needsRender = true;
  }

  /**
   * @description: 构建灯光系统
   * @return {*}
   */
  #buildLightSystem() {
    const { lights } = this.options;

    lights.forEach((option) => {
      const { type, color, intensity, position, ...rest } = option;

      if (!THREE[type]) return;

      let light = new THREE[type](color, intensity);

      if (type !== 'AmbientLight' && position) {
        light.position.set(...position);
      }

      // 支持 angle、penumbra、distance、decay 等灯光属性
      Object.keys(rest).forEach((key) => {
        if (key in light) {
          light[key] = rest[key];
        }
      });

      if (this.openDebug) {
        const sphere = new THREE.SphereGeometry(0.1);
        light.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color })));
      }

      this.#scene.add(light);
      this.#tracker.add(light);
    });
  }

  /**
   * @description: 构建饼图
   * @return {*}
   */
  #buildPie() {
    const values = this.#getValues();

    let _data = values.length > 0 ? values.map((v, i) => (this.#checkAvailable(i) ? v : 0)) : [];
    this.#isEmpty = false;

    if (_data.length === 0 || _data.every((v) => v === 0)) {
      _data = [1];
      this.#isEmpty = true;
    }

    this.#makePie(_data, (arcs) => this.#genPie(arcs));
  }

  /**
   * @description: 将数字数组或对象数组统一转换为数值数组
   * @return {Array<Number>}
   */
  #getValues() {
    const { data, valueKey } = this.options;

    return (data || []).map((item, index) => {
      const value = Number(resolveDataField(item, valueKey, index));

      // 非数字、负数按 0 处理，避免 d3 生成异常角度
      return Number.isFinite(value) && value > 0 ? value : 0;
    });
  }

  /**
   * @description: 获取数据项名称
   * @param {Number} index
   * @return {*}
   */
  #getItemName(index) {
    const item = this.options.data?.[index];

    if (item === null || typeof item !== 'object') return undefined;

    const name = resolveDataField(item, this.options.nameKey, index);

    return name === undefined || name === null ? undefined : name;
  }

  /**
   * @description: 全部数据合计（包含图例隐藏项）
   * @return {Number}
   */
  #getTotal() {
    return this.#getValues().reduce((sum, value) => sum + value, 0);
  }

  /**
   * @description: 当前可见扇区合计
   * @return {Number}
   */
  #getVisibleTotal() {
    if (!this.#arcs) return 0;

    return this.#arcs.reduce((sum, arcData) => sum + (Number(arcData.value) || 0), 0);
  }

  /**
   * @description: 更新环形图中心内容（合计值等）
   * @return {*}
   */
  #updateCenterLabel() {
    const { centerLabel } = this.options;
    const enabled =
      centerLabel && centerLabel.show && isFunction(centerLabel.render) && !this.#isEmpty;

    if (!enabled) {
      if (this.#centerLabel) {
        this.#centerLabel.style.display = 'none';
      }

      return;
    }

    let el = this.#centerLabel;

    if (!el) {
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.display = 'none';
      el.style.transform = 'translate(-50%, -100%)';
      el.style.pointerEvents = 'none';
      // 高于标签的最大层级（99999），避免中心合计被标签遮挡
      el.style.zIndex = '100000';

      this.$el.appendChild(el);
      this.#centerLabel = el;
    }

    const total = this.#getTotal();
    const visibleTotal = this.#getVisibleTotal();
    const key = `${total}|${visibleTotal}|${this.options.data?.length ?? 0}`;

    if (this.#centerLabelKey !== key) {
      this.#centerLabelKey = key;

      const content = centerLabel.render({
        total,
        visibleTotal,
        data: this.options.data,
      });

      el.innerHTML = '';

      if (content) {
        if (typeof content === 'string') {
          el.textContent = content;
        } else {
          el.appendChild(content);
        }
      }
    }

    if (this.#camera) {
      this.#camera.updateMatrixWorld();

      // 与中心标签一致：实心饼图底部对齐顶面，环形图对齐孔底，避免文字压在饼体上
      const { height = 0, scale = 1, innerRadius = 0 } = this.options;
      const anchorY = innerRadius > 0 ? 0 : height * 0.01 * scale;
      const vector = new THREE.Vector3(0, anchorY, 0).project(this.#camera);

      el.style.left = ((1 + vector.x) * this.#width) / 2 + 'px';
      el.style.top = ((1 - vector.y) * this.#height) / 2 + 'px';
      el.style.display = 'flex';
    }
  }

  /**
   * @description: 制作饼图
   * @param {*} data
   * @param {*} update
   * @return {*}
   */
  #makePie(data, update) {
    const arcs = pie()
      .sortValues(() => 0) // 设置为不排序，默认降序
      .startAngle(() => Math.PI) // 设置起点为12点钟方向，默认6点钟方向
      .endAngle(() => -Math.PI)(data); // 设置方向为顺时针，默认逆时针

    let curArray = Array.from({ length: arcs.length }, () => 0);
    let endArray = arcs.map((v) => v.endAngle - v.startAngle);

    if (this.#arcs) {
      curArray = curArray.map((v, i) => {
        const arc = this.#arcs[i];
        return arc ? arc.endAngle - arc.startAngle : v;
      });
    }

    const onUpdate = () => {
      let curArcs = [];

      for (let i = 0, len = arcs.length; i < len; i++) {
        const arc = arcs[i];
        let startAngle;

        if (i === 0) {
          startAngle = arc.startAngle;
        } else {
          startAngle = curArcs[i - 1].endAngle;
        }

        const endAngle = startAngle + curArray[i];

        curArcs.push({ ...arc, startAngle, endAngle });
      }

      this.#arcs = curArcs;

      update(curArcs);
    };

    this.#stopMakePieAnimate();

    // 关闭入场动画时直接落到最终角度，避免每次改配置都重播
    if (this.options.enterAnimation === false) {
      curArray = endArray.slice();
      onUpdate();
      this.#needsRender = true;
      return;
    }

    const start = () => {
      if (this.#disposed) return;

      this.#makePieAnimate = gsap.to(curArray, {
        endArray,
        // 显式传 undefined 会被 gsap 当作 0，仅在配置为数字时传时长，否则用默认值
        ...(typeof this.options.enterAnimation === 'number' ? { duration: this.options.enterAnimation } : {}),
        onUpdate,
        onComplete: () => {
          this.#stopMakePieAnimate();
          this.#needsRender = true;
        },
      });
    };

    // 首帧渲染前主线程可能被初始化阻塞，此时启动动画会被“吞掉”一部分时长
    if (this.#renderedOnce) {
      start();
    } else {
      this.#pendingStartMakePie = start;
    }
  }

  /**
   * @description: 停止makePie动画
   * @return {*}
   */
  #stopMakePieAnimate() {
    if (this.#makePieAnimate) {
      this.#makePieAnimate.kill();
      this.#makePieAnimate = null;
    }
  }

  /**
   * @description: 生成饼图
   * @param {*} arcs
   * @return {*}
   */
  #genPie(arcs) {
    if (this.#disposed) return;

    const {
      innerRadius,
      outerRadius,
      cornerRadius,
      padAngle,
      height,
      scale,
      colors,
      emptyColor,
      renderer,
    } = this.options;
    // 空色板会导致取到 undefined 颜色，回退到默认色板
    const palette = Array.isArray(colors) && colors.length ? colors : defaultOptions.colors;
    const explode = Array.isArray(this.options.explode)
      ? this.options.explode
      : arcs.map(() => Number(this.options.explode) || 0);
    const group = new THREE.Group();
    const total = arcs.reduce((sum, arcData) => sum + (Number(arcData.value) || 0), 0);
    // 内外径相等会生成零面积环形，三角化开销极高且无意义，按实心饼处理
    const safeInnerRadius = innerRadius === outerRadius ? 0 : innerRadius;

    // 滑块/输入框可能把 0 处理成 1e-18 这类浮点误差，按阈值视为无间隔
    const safePadAngle = padAngle > 1e-4 ? padAngle : 0;
    // 倒角会让切片侧面向外鼓出 bevelSize，相邻切片两侧鼓出量之和为 2 * bevelSize，
    // 切缝小于该值时两个侧面会互相穿插，接缝处出现错色/闪烁，需关闭倒角
    const BEVEL_SIZE = 0.7;
    const padRadius = Math.sqrt(safeInnerRadius * safeInnerRadius + outerRadius * outerRadius);
    // d3 按 padRadius 把 padAngle 换算成固定线宽：相邻切边的实际间距为 2 * padRadius * sin(padAngle / 2)
    const seamGap = 2 * padRadius * Math.sin(safePadAngle / 2);
    const allowBevel = seamGap > BEVEL_SIZE * 2;
    const arcGenerator = arc()
      .innerRadius(safeInnerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(cornerRadius)
      .padAngle(safePadAngle);

    let shapePath = null;
    arcGenerator.context({
      moveTo(x, y) {
        shapePath.moveTo(x, y);
      },
      lineTo(x, y) {
        shapePath.currentPath.lineTo(x, y);
      },
      arc(...args) {
        shapePath.currentPath.absarc(...args);
      },
      closePath() {
        shapePath.currentPath.closePath();
      },
    });

    arcs.forEach((arcData, index) => {
      shapePath = new THREE.ShapePath();
      arcGenerator(arcData);

      const color = !this.#isEmpty ? palette[index % palette.length] : emptyColor;
      const offset = clamp(Number(explode[index]) || 0, 0, 50);
      const midAngle = (arcData.startAngle + arcData.endAngle) / 2;
      // 按扇区角度自适应曲线段数：整圆 256 段分辨率，半圆 128 段，兼顾平滑与构建开销
      const span = Math.abs(arcData.endAngle - arcData.startAngle);
      const adaptiveSegments = clamp(Math.ceil((span / (Math.PI * 2)) * 256), 24, 256);
      // 切片紧贴或间距过小时倒角会互相穿插，只有间隔足够或外爆时才开启
      const hasGap = allowBevel || offset > 0;
      // legacy 几何沿用 3.x 的细分段数与倒角参数，保证观感与旧版一致
      const extrudeSettings =
        renderer.geometry === 'legacy'
          ? {
              curveSegments: 64,
              steps: 2,
              depth: height,
              bevelEnabled: true,
              bevelThickness: 1,
              bevelSize: 1,
              bevelOffset: 0,
              bevelSegments: 3,
            }
          : {
              curveSegments: adaptiveSegments,
              steps: 2,
              depth: height,
              bevelEnabled: hasGap,
              bevelThickness: BEVEL_SIZE,
              bevelSize: BEVEL_SIZE,
              bevelOffset: 0,
              bevelSegments: 2,
            };
      const name = this.#getItemName(index);
      const labelKey = `${index}|${name ?? ''}|${arcData.value}|${total}|${color}`;

      shapePath.toShapes().forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.computeBoundingBox();
        const material =
          renderer.material === 'standard'
            ? new THREE.MeshStandardMaterial({
                color,
                roughness: 0.3,
                metalness: 0,
                envMapIntensity: 0.6,
              })
            : new THREE.MeshPhongMaterial({ color, wireframe: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh._index = index; // 标记序号
        mesh._color = color; // 标记颜色
        mesh._labelKey = labelKey; // 标签内容签名，避免每帧重建 DOM
        mesh._labelTop = geometry.boundingBox.max.z * 0.01 * scale; // 标签高度基准，随高度缩放

        if (offset) {
          // 沿扇区角平分线向外偏移
          mesh.position.set(Math.sin(midAngle) * offset, -Math.cos(midAngle) * offset, 0);
        }

        group.add(mesh);
      });
    });

    group.rotation.x -= Math.PI / 2;
    group.scale.set(...Array.from({ length: 3 }, () => 0.01 * scale));
    group.position.set(0, 0, 0);

    if (this.#pie) {
      this.#tracker.dispose(this.#pie);
    }
    this.#pie = group;

    this.#scene.add(group);
    this.#tracker.add(group);

    // 几何变化后按需重绘
    this.#needsRender = true;
    this.#labelDirty = true;

    if (!this.#debounceCompleteCb) {
      this.#debounceCompleteCb = debounce(() => {
        if (this.#disposed) return;

        this.#bindEvent();
        this.#startAutoplay();
      }, 200);
    }

    this.#debounceCompleteCb();
  }

  /**
   * @description: 绑定事件
   * @return {*}
   */
  #bindEvent() {
    const handlerFn = () => {
      let prevIndex = -1;

      return (e) => {
        const group = this.#pie;

        if (!group) return;

        const intersects = this.#raycaster.intersectObject(group);
        const mesh = group.children.find((v) => v === intersects[0]?.object);
        const index = mesh?._index ?? -1;

        if (e.type === 'mousemove') {
          if (index !== prevIndex) {
            // mouseleave
            if (prevIndex > -1) {
              this.#emitter.emit('mouseleave', this.#getEventParam(prevIndex));
            }

            // mouseenter
            if (index > -1) {
              this.#emitter.emit('mouseenter', this.#getEventParam(index));
            }

            prevIndex = index;
          }
        } else {
          this.#emitter.emit(e.type, this.#getEventParam(index));
        }
      };
    };

    if (this.#runtimeEvents.length) {
      this.#runtimeEvents.forEach((unbind) => {
        unbind();
      });
      this.#runtimeEvents = [];
    }

    EVENTS.forEach((type) => {
      const handler = handlerFn();
      this.#emitter.on(`${PREFIX}:${type}`, handler);

      const unbind = () => {
        this.#emitter.off(`${PREFIX}:${type}`, handler);
      };
      this.#runtimeEvents.push(unbind);
    });
  }

  /**
   * @description: 更新标签
   * @return {*}
   */
  #updateLabel() {
    const { innerRadius, outerRadius, height, label, explode, scale } = this.options;

    this.#updateCenterLabel();

    if (!label || !label.show || this.#isEmpty) {
      if (this.#labels.length > 0) {
        this.#labels.forEach((v) => {
          this.$el.removeChild(v);
        });
        this.#labels = [];
      }

      return;
    }

    this.#labels.forEach((v) => {
      v.style.display = 'none';
    });

    // 首帧渲染前 camera.matrixWorldInverse 仍是旧值，投影前先同步
    this.#camera.updateMatrixWorld();

    const labelPosition = label.position ?? 0.7;
    const isDonut = innerRadius > 0;
    const isCenter = labelPosition === 0;
    const explodeList = Array.isArray(explode) ? explode : [];

    this.#pie?.children.forEach((mesh) => {
      const index = mesh._index;
      let labelEl = this.#labels[index];

      if (!labelEl) {
        const node = document.createElement('div');
        node.style.position = 'absolute';
        node.style.top = '0px';
        node.style.left = '0px';
        node.style.display = 'none';
        node.style.transform = 'translate(-50%, -100%)';
        node.style.pointerEvents = 'none';

        this.$el.appendChild(node);

        labelEl = this.#labels[index] = node;
      }

      // 内容签名变化时才重建 DOM，避免每帧触发重排
      if (isFunction(label.render) && labelEl._key !== mesh._labelKey) {
        labelEl._key = mesh._labelKey;
        const el = label.render(this.#getEventParam(index));
        labelEl.innerHTML = '';
        if (el) labelEl.appendChild(el);
      }

      if (isCenter) {
        if (index === this.#activeIndex) {
          const vector = new THREE.Vector3(0, isDonut ? 0 : height / 100, 0);
          const position = vector.project(this.#camera);

          labelEl.style.display = 'flex';
          labelEl.style.top = ((1 - position.y) * this.#height) / 2 + 'px';
          labelEl.style.left = ((1 + position.x) * this.#width) / 2 + 'px';
        }
      } else {
        const { startAngle, endAngle } = this.#arcs[index];
        const theta = (startAngle + endAngle) / 2 - Math.PI / 2;
        const radius = outerRadius * 0.01 * scale;
        const explodeOffset =
          (clamp(Number(explodeList[index] ?? this.options.explode) || 0, 0, 50) * scale) / 100;
        const offset = labelPosition * radius + explodeOffset;
        const xOffset = Math.cos(theta) * offset;
        const zOffset = -Math.sin(theta) * offset;
        const vector = new THREE.Vector3(
          xOffset,
          (mesh._labelTop || 0) * mesh.scale.z,
          zOffset
        );
        const position = vector.project(this.#camera);

        labelEl.style.zIndex = index === this.#activeIndex ? 99999 : Math.floor((1 - position.y) * 10000);
        labelEl.style.top = ((1 - position.y) * this.#height) / 2 + 'px';
        labelEl.style.left = ((1 + position.x) * this.#width) / 2 + 'px';

        if (this.#checkAvailable(index)) {
          labelEl.style.display = 'flex';
        }
      }
    });
  }

  /**
   * @description: 开启自动播放
   * @return {*}
   */
  #startAutoplay() {
    const { autoplay } = this.options;

    this.#pauseAutoplay();

    if (!autoplay || this.#isEmpty) return;

    // 添加可用性校验
    let retryTimes = -1;
    const loopCb = () => {
      const index = this.#autoplay.activeIndex;
      const len = this.#pie.children.length;
      const nextMesh = this.#pie.children[index];

      this.#autoplay.activeIndex = (index + 1) % len;

      if (this.#checkAvailable(index)) {
        if (nextMesh) {
          this.#active(nextMesh._index);
        }
        retryTimes = -1;
      } else {
        if (retryTimes === -1) {
          retryTimes = len - 1;
        }
        if (retryTimes > 0) {
          retryTimes -= 1;
          loopCb();
        } else {
          retryTimes = -1;
        }
      }
    };

    // 定时轮询
    let delay = parseFloat(autoplay);
    delay = isNaN(delay) ? 3000 : clamp(delay * 1000, 1000, 10000);

    this.#autoplay.interval = setInterval(loopCb, delay);

    // 初始执行
    loopCb();
  }

  /**
   * @description: 暂停自动播放
   * @return {*}
   */
  #pauseAutoplay() {
    if (this.#autoplay.interval) {
      clearInterval(this.#autoplay.interval);
      this.#autoplay.interval = null;
    }

    if (this.#autoplay.resumeTimeout) {
      clearTimeout(this.#autoplay.resumeTimeout);
      this.#autoplay.resumeTimeout = null;
    }
  }

  /**
   * @description: 恢复自动播放
   * @return {*}
   */
  #resumeAutoplay() {
    this.#autoplay.resumeTimeout = setTimeout(() => {
      const index = this.#autoplay.activeIndex;
      const len = this.#pie.children.length;
      this.#autoplay.activeIndex = (index - 1 + len) % len;

      this.#startAutoplay();
    }, 200);
  }

  /**
   * @description: 停止自动播放
   * @return {*}
   */
  #stopAutoplay() {
    this.#pauseAutoplay();
    this.#autoplay.activeIndex = 0;
  }

  /**
   * @description: 监听mouseenter
   * @param {*} index
   * @return {*}
   */
  #onMouseenter(index) {
    this.#pauseAutoplay();
    this.#active(index);
  }

  /**
   * @description: 监听mouseleave
   * @return {*}
   */
  #onMouseleave() {
    this.#active(-1);
    this.#resumeAutoplay();
  }

  /**
   * @description: 激活饼图块
   * @param {*} index
   * @return {*}
   */
  #active(index) {
    if (this.#isEmpty) return;

    if (this.options.activeAnimation) {
      const { duration, heightScale } = this.options.activeAnimation;

      this.#pie?.children.forEach((mesh) => {
        if (!mesh._tw) {
          mesh._tw = gsap
            .to(mesh.scale, {
              z: heightScale,
              duration,
              ease: 'sine.out',
              onUpdate: () => {
                this.#needsRender = true;
                this.#labelDirty = true;
              },
            })
            .pause();
        }

        if (mesh._index === index) {
          mesh._tw.play();
        } else {
          mesh._tw.reverse();
        }
      });
    }

    this.#activeIndex = index;
    this.#needsRender = true;
    this.#labelDirty = true;

    if (index !== -1) {
      this.#emitter.emit('active', this.#getEventParam(index));
    }
  }

  /**
   * @description: 获取当前视角
   * @return {Object|null} { position: [x, y, z], target: [x, y, z] }
   */
  getView() {
    if (!this.#camera) return null;

    const target = this.#controls ? this.#controls.target : new THREE.Vector3();

    return {
      position: this.#camera.position.toArray(),
      target: target.toArray(),
    };
  }

  /**
   * @description: 设置视角，可用于多个图表同步
   * @param {Object} view { position: [x, y, z], target?: [x, y, z] }
   * @return {*}
   */
  setView(view) {
    if (this.#disposed || !this.#camera || !view || !Array.isArray(view.position)) return;

    const target = new THREE.Vector3(...(view.target || [0, 0, 0]));

    // 外部同步视角时取消本地未完成的平滑缩放
    this.#zoomRadiusTarget = null;
    this.#applyingView = true;
    this.#camera.position.set(...view.position);

    if (this.#controls) {
      this.#controls.target.copy(target);
    }

    this.#camera.lookAt(target);
    this.#camera.updateMatrixWorld();

    if (this.#controls) {
      this.#controls.update();
    }

    this.#applyingView = false;
    this.#labelDirty = true;
    this.#needsRender = true;
  }

  /**
   * @description: 设置图例选中项
   * @param {*} param
   * @return {*}
   */
  setLegendChecked(param) {
    if (this.#disposed) return;

    if (isFunction(param)) {
      this.#legends = param(this.#legends.slice());
    } else {
      this.#legends = param;
    }

    this.#stopAutoplay();
    this.#buildPie();
  }

  /**
   * @description: 检查可用性
   * @param {*} index
   * @return {*}
   */
  #checkAvailable(index) {
    return this.#legends[index];
  }

  /**
   * @description: 激活
   * @param {*} index
   * @return {*}
   */
  activate(index) {
    if (this.#disposed) return;
    this.#onMouseenter(index);
  }

  /**
   * @description: 取消激活
   * @return {*}
   */
  deactivate() {
    if (this.#disposed) return;
    this.#onMouseleave();
  }

  /**
   * @description: 销毁实例
   * @return {*}
   */
  dispose() {
    if (this.#disposed) return;

    this.#domEvents.forEach((unbind) => unbind());
    this.#emitter.all.clear();
    this.#domEvents = null;
    this.#emitter = null;

    this.#labels.forEach((label) => {
      this.$el.removeChild(label);
    });

    if (this.#centerLabel) {
      this.$el.removeChild(this.#centerLabel);
      this.#centerLabel = null;
      this.#centerLabelKey = null;
    }

    this.#stopMakePieAnimate();
    this.#stopAutoplay();

    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }

    if (this.#resizeUnbind) {
      this.#resizeUnbind();
      this.#resizeUnbind = null;
    }

    if (this.#tracker) {
      this.#tracker.disposeAll();
      this.#tracker = null;
    }

    if (this.#scene) {
      this.#scene.clear();
      this.#scene = null;
    }

    if (this.#camera) {
      this.#camera.clear();
      this.#camera = null;
    }

    if (this.#renderer) {
      this.#renderer.setAnimationLoop(null);
      this.#renderer.dispose();
      this.#renderer.forceContextLoss();
      this.#renderer.content = null;
      let gl = this.#renderer.domElement.getContext('webgl');
      gl && gl.getExtension('WEBGL_lose_context').loseContext();
      this.#renderer.domElement.parentNode.removeChild(this.#renderer.domElement);
      this.#renderer = null;
    }

    this.$el = null;
    this.options = null;
    this.#controls = null;
    this.#zoomRadiusTarget = null;
    this.#raycaster = null;
    this.#pie = null;
    this.#isEmpty = false;
    this.#activeIndex = -1;
    this.#legends = null;
    this.#arcs = null;
    this.#labels = null;
    this.#runtimeEvents = null;
    this.#debounceCompleteCb = null;
    this.#autoplay = null;
    this.#disposed = true;
  }

  /**
   * @description: 获取事件参数
   * @param {*} index
   * @return {*}
   */
  #getEventParam(index) {
    let param = null;

    if (index > -1) {
      const mesh = this.#pie.children.find((v) => v._index === index);
      const { value } = this.#arcs[index];
      const total = this.#arcs.reduce((s, a) => s + a.value, 0);

      param = {
        index,
        name: this.#getItemName(index),
        value,
        percent: total > 0 ? value / total : 0,
        color: mesh._color,
        data: this.options.data?.[index],
      };
    }

    return param;
  }

  /**
   * @description: ratio getter
   * @return {*}
   */
  get ratio() {
    return this.#width / this.#height;
  }

  /**
   * @description: debug 开关 getter
   * @return {*}
   */
  get openDebug() {
    return Boolean(this.options?.debug);
  }
}

export { defaultOptions };

export default Pie;
