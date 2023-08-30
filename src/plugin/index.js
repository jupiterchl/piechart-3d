/* eslint-disable no-invalid-this */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';
import { arc, pie } from 'd3-shape';
import { clamp, isFunction, debounce } from 'lodash-es';
import mitt from 'mitt';
import ResourceTracker from './libs/ResourceTracker';

const PREFIX = 'PIE';
const EVENTS = ['mousemove', 'click'];

const defaultOptions = {
  debug: false,

  data: [], // [5, 2, 3, 4]
  innerRadius: 0, // 0-100
  outerRadius: 100, // 0-100
  cornerRadius: 0, // 0-50 (outerRadius-innerRadius)/2
  padAngle: 0, // 0-0.1
  height: 20, // 0-50
  scale: 1,

  viewport: [0, 2, 3],
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
    '#ec4899', // pink
    '#a855f7', // purple
    '#0ea5e9', // lightBlue
    '#14b8a6', // teal
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
  ],
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
  activeAnimation: null, // { duration: 0.25, heightScale: 2 }
  autoplay: false, // boolean|number 自动播放间隔时长

  on: null, // { mouseenter, mouseleave, active }
};

class Pie {
  constructor(el, options) {
    this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    this.options = { ...defaultOptions, ...options };

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
  #activeIndex = -1;
  #legends = [];
  #arcs = null;
  #labels = [];
  #makePieAnimate = null;
  #runtimeEvents = [];
  #debounceCompleteCb = null;
  #svgLoader = null;
  #disposed = false;

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

    if (this.options.data.length) {
      this.#buildPie();
    }
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
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(this.#width, this.#height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    this.$el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(50, this.ratio, 0.1, 100);
    camera.position.set(...this.options.viewport);
    camera.lookAt(0, 0, 0);

    const animation = (time) => {
      this.#controls?.update();

      renderer.render(scene, camera);

      // 更新标签
      this.#updateLabel();
    };
    renderer.setAnimationLoop(animation);

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;

    this.#buildAuxSystem();
    this.#buildLightSystem();
  }

  /**
   * @description: 构建辅助系统
   * @return {*}
   */
  #buildAuxSystem() {
    if (!this.openDebug) return;

    // 坐标轴
    const axisHelper = new THREE.AxesHelper(10);
    this.#scene.add(axisHelper);
    this.#tracker.add(axisHelper);

    // 网格
    const gridHelper = new THREE.GridHelper(100, 100);
    this.#scene.add(gridHelper);
    this.#tracker.add(gridHelper);

    // 地板
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshPhongMaterial({
        color: 0x3980b5,
        wireframe: false,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.#scene.add(floor);
    this.#tracker.add(floor);

    // 控制器
    let controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.rotateSpeed = 0.35;
    this.#controls = controls;
    this.#tracker.add(controls);
  }

  /**
   * @description: 构建灯光系统
   * @return {*}
   */
  #buildLightSystem() {
    const { lights } = this.options;

    lights.forEach((option) => {
      const type = option.type;

      if (!THREE[type]) return;

      const { color, intensity, position } = option;
      let light = new THREE[type](color, intensity);

      if (type !== 'AmbientLight' && position) {
        light.position.set(...position);
      }

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
    const { data } = this.options;
    let loader = this.#svgLoader;

    if (!loader) {
      loader = this.#svgLoader = new SVGLoader();
      this.#tracker.add(loader);
    }

    const update = (pieSvgDataUri, arcs) => {
      loader.load(
        pieSvgDataUri,
        (data) => {
          this.#genPie(data, arcs);
        },
        (xhr) => {
          // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
        },
        (error) => {
          console.error('SVGLoader: An error happened', error);
        }
      );
    };

    const _data = data.map((v, i) => (this.#legends[i] ? v : 0));

    this.#makePie(_data, update);
  }

  /**
   * @description: 制作饼图
   * @param {*} data
   * @param {*} update
   * @return {*}
   */
  #makePie(data, update) {
    const { innerRadius, outerRadius, cornerRadius, padAngle } = this.options;

    const arcs = pie()
      .sortValues(() => 0) // 设置为不排序，默认降序
      .startAngle(() => Math.PI) // 设置起点为12点钟方向，默认6点钟方向
      .endAngle(() => -Math.PI)(data); // 设置方向为顺时针，默认逆时针

    const arcGenerator = arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(cornerRadius)
      .padAngle(padAngle);

    let curArray = Array.from({ length: arcs.length }, () => 0);
    let endArray = arcs.map((v) => v.endAngle - v.startAngle);

    if (this.#arcs) {
      curArray = this.#arcs.map((v) => v.endAngle - v.startAngle);
      endArray = arcs.map((v) => v.endAngle - v.startAngle);
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

      const pieSvgDataUri = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg">
          <g>
            ${curArcs.map((arcData, i) => `<path d="${arcGenerator(arcData)}" />`)}
          </g>
        </svg>
      `)}`;

      this.#arcs = curArcs;

      update(pieSvgDataUri, curArcs);
    };

    this.#stopMakePieAnimate();

    this.#makePieAnimate = gsap.to(curArray, {
      endArray,
      onUpdate,
      onComplete: () => {
        this.#stopMakePieAnimate();
      },
    });
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
   * @param {*} data
   * @param {*} arcs
   * @return {*}
   */
  #genPie(data, arcs) {
    if (this.#disposed) return;

    const { height, scale, colors } = this.options;
    const shapes = data.paths.map((v) => v.toShapes()).flat();
    const group = new THREE.Group();

    const extrudeSettings = {
      curveSegments: 64,
      steps: 2,
      depth: height,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelOffset: 0,
      bevelSegments: 3,
    };

    shapes.forEach((shape, i) => {
      if (arcs[i].startAngle !== arcs[i].endAngle) {
        const color = colors[i % colors.length];
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshPhongMaterial({ color, wireframe: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh._index = i; // 标记序号
        mesh._color = color; // 标记颜色
        group.add(mesh);
      }
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
    const { innerRadius, height, label } = this.options;

    if (!label || !label.show) {
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

    const labelPosition = label.position ?? 0.7;
    const isDonut = innerRadius > 0;
    const isCenter = labelPosition === 0;

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

        if (isFunction(label.render)) {
          const el = label.render(this.#getEventParam(index));
          node.appendChild(el);
        }

        this.$el.appendChild(node);

        labelEl = this.#labels[index] = node;
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
        const box = new THREE.Box3().setFromObject(mesh);
        const vector3 = new THREE.Vector3();
        const size = box.getSize(vector3);
        // track box

        const { startAngle, endAngle } = this.#arcs[index];
        const theta = (startAngle + endAngle) / 2 - Math.PI / 2;
        const xOffset = Math.cos(theta) * labelPosition;
        const zOffset = -Math.sin(theta) * labelPosition;
        const vector = new THREE.Vector3(xOffset, size.y, zOffset);
        const position = vector.project(this.#camera);

        labelEl.style.zIndex = index === this.#activeIndex ? 99999 : Math.floor((1 - position.y) * 10000);
        labelEl.style.display = 'flex';
        labelEl.style.top = ((1 - position.y) * this.#height) / 2 + 'px';
        labelEl.style.left = ((1 + position.x) * this.#width) / 2 + 'px';
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

    if (!autoplay) return;

    const loopCb = () => {
      const index = this.#autoplay.activeIndex;
      const len = this.#pie.children.length;
      const nextMesh = this.#pie.children[index];

      if (nextMesh) {
        this.#active(nextMesh._index);
      }

      this.#autoplay.activeIndex = (index + 1) % len;
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
    if (!this.options.activeAnimation) return;

    const { duration, heightScale } = this.options.activeAnimation;

    this.#pie?.children.forEach((mesh) => {
      if (!mesh._tw) {
        mesh._tw = gsap
          .to(mesh.scale, {
            z: heightScale,
            duration,
            ease: 'sine.out',
          })
          .pause();
      }

      if (mesh._index === index) {
        mesh._tw.play();
      } else {
        mesh._tw.reverse();
      }
    });

    this.#activeIndex = index;

    this.#emitter.emit('active', this.#getEventParam(index));
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

    this.#stopMakePieAnimate();
    this.#stopAutoplay();

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
    this.#raycaster = null;
    this.#pie = null;
    this.#activeIndex = -1;
    this.#legends = null;
    this.#arcs = null;
    this.#labels = null;
    this.#runtimeEvents = null;
    this.#debounceCompleteCb = null;
    this.#svgLoader = null;
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
        value,
        percent: total > 0 ? value / total : 0,
        color: mesh._color,
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
   * @description: debugger getter
   * @return {*}
   */
  get openDebug() {
    return Boolean(this.options?.debug);
  }
}

export default Pie;
