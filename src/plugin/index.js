/* eslint-disable no-invalid-this */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';
import merge from 'lodash.merge';
import castArray from 'lodash.castarray';
import upperFirst from 'lodash.upperfirst';
import ResourceTracker from './libs/ResourceTracker';
import Handler, { events } from './libs/Handler';
import { arc, pie } from 'd3-shape';

const defaultOptions = {
  data: [],
  parseValue: (v) => v,
  innerRadius: 0,
  outerRadius: 100,
  cornerRadius: 0,
  padAngle: 0,
  height: 40,
  animation: null,
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
  light: {
    ambientLight: {
      color: '#fff',
      intensity: 0.3,
    },
    spotLight: {
      color: '#fff',
      intensity: 1,
      position: [5, 5, 5],
    },
  },
  activeCallback: null,
  on: null,
};

class Pie {
  constructor(el, options) {
    this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    this.options = merge({}, defaultOptions, options, {
      on: {
        mouseenter: (index) => {
          // this.stopAutoplay();
          this.active(index);
        },
        mouseleave: (index) => {
          // this.startAutoplay(index + 1);
          this.active(-1);
        },
      },
    });

    this.resMgr = new ResourceTracker();
    this.track = this.resMgr.track.bind(this.resMgr);

    this.handler = new Handler();

    this.init();
  }

  width;
  height;
  renderer;
  scene;
  camera;
  raycaster;
  pie;
  updateEvents;

  /**
   * @description: 初始化
   * @return {*}
   */
  init() {
    this.initData();
    this.initFrame();
    this.initEvent();
    this.buildPie();
  }

  /**
   * @description: 初始化数据
   * @return {*}
   */
  initData() {
    if (this.$el) {
      this.width = this.$el.clientWidth;
      this.height = this.$el.clientHeight;
    } else {
      throw new Error('dom节点不存在');
    }
  }

  /**
   * @description: 初始化界面
   * @return {*}
   */
  initFrame() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.$el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // this.scene.background = new THREE.Color(0xf0f0f0);

    this.camera = new THREE.PerspectiveCamera(50, this.ratio, 0.1, 100);
    this.camera.position.set(0, 2, 3);
    this.camera.lookAt(0, 0, 0);

    this.buildAuxSystem();
    this.buildLightSystem();

    this.updateEvents = [];

    const animation = (time) => {
      this.renderer.render(this.scene, this.camera);

      this.updateEvents.forEach((event) => {
        event(time);
      });
    };
    this.renderer.setAnimationLoop(animation);
  }

  /**
   * @description: 初始化事件
   * @return {*}
   */
  initEvent() {
    this.raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handler = (e) => {
      console.log('e.type', e.type);
      mouse.x = (e.offsetX / this.width) * 2 - 1;
      mouse.y = -(e.offsetY / this.height) * 2 + 1;
      this.raycaster.setFromCamera(mouse, this.camera);
      this.handler.emit(e.type, e);
    };

    events.forEach((type) => {
      this.$el.addEventListener(type, handler, false);

      this.handler.on('unbind', () => {
        this.$el.removeEventListener(type, handler, false);
      });
    });
  }

  /**
   * @description: 构建辅助系统
   * @return {*}
   */
  buildAuxSystem() {
    if (!this.options.debug) return;

    // 坐标轴
    const axisHelper = new THREE.AxesHelper(10);
    this.scene.add(axisHelper);
    this.track(axisHelper);

    // 网格
    const gridHelper = new THREE.GridHelper(100, 100);
    this.scene.add(gridHelper);
    this.track(gridHelper);

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
    this.scene.add(floor);
    this.track(floor);

    // 控制器
    let controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.rotateSpeed = 0.35;
  }

  /**
   * @description: 构建灯光系统
   * @return {*}
   */
  buildLightSystem() {
    const { debug, light } = this.options;

    Object.entries(light).forEach(([type, option]) => {
      const _type = upperFirst(type);
      if (!option || !THREE[_type]) return;

      castArray(option).forEach(({ color, intensity, position }) => {
        let _light = new THREE[_type](color, intensity);

        if (position) {
          _light.position.set(...position);
        }

        if (debug) {
          const _sphere = new THREE.SphereGeometry(0.2);
          _light.add(new THREE.Mesh(_sphere, new THREE.MeshBasicMaterial({ color })));
        }

        this.scene.add(_light);
        this.track(_light);
      });
    });
  }

  setLegends(fn) {
    const legends = this.legends ?? this.options.data.map((v) => true);
    this.legends = fn(legends.slice());
    this.buildPie();
  }

  /**
   * @description: 构建饼图
   * @return {*}
   */
  buildPie() {
    const { data, parseValue } = this.options;
    const loader = new SVGLoader();
    // this.track(loader);

    const update = (pieSvgDataUri, arcs) => {
      loader.load(
        pieSvgDataUri,
        (data) => {
          this.genPie(data, arcs);
        },
        (xhr) => {
          // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
        },
        (error) => {
          console.error('SVGLoader: An error happened', error);
        }
      );
    };

    const _data = data.map((v, i) => {
      if (this.legends?.[i] === false) {
        return 0;
      }
      return parseValue(v);
    });

    this.makePie(_data, update);
  }

  makePie(data, update) {
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

    if (this.curArcs) {
      curArray = this.curArcs.map((v) => v.endAngle - v.startAngle);
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

      this.curArcs = curArcs;

      const pieSvgDataUri = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg">
          <g>
            ${curArcs.map((arcData, i) => `<path d="${arcGenerator(arcData)}" />`)}
          </g>
        </svg>
      `)}`;

      update(pieSvgDataUri, curArcs);
    };

    if (this.animate) {
      this.animate.kill();
    }

    this.animate = gsap.to(curArray, {
      endArray,
      // duration: 3,
      onUpdate,
      onComplete: () => {
        console.log('complete');
        this.animate.kill();
        this.animate = null;

        this.bindEvent();
      },
    });
  }

  /**
   * @description: 生成饼图
   * @param {*} data
   * @return {*}
   */
  genPie(data, arcs) {
    const { data: _data, height, animation, colors, activeCallback, on } = this.options;
    const shapes = data.paths.map((v) => v.toShapes()).flat();
    const group = new THREE.Group();

    const extrudeSettings = {
      curveSegments: 256,
      steps: 2,
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.005,
      bevelOffset: 0.0,
      bevelSegments: 1,
    };

    shapes.forEach((shape, i) => {
      if (arcs[i].startAngle !== arcs[i].endAngle) {
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshPhongMaterial({ color: colors[i % colors.length], wireframe: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh._index = i;
        mesh._color = colors[i % colors.length];
        group.add(mesh);
      }
    });

    group.rotation.x -= Math.PI / 2;
    // this.pie = group;

    if (this.pie) {
      this.scene.remove(this.pie);
    }
    this.pie = group;
    this.scene.add(group);
    // this.track(group);

    // this.startAutoplay();

    // console.log('renderer.info', this.renderer.info);
  }

  bindEvent() {
    const { data, on } = this.options;
    const group = this.pie;

    const handler = () => {
      let _index = -1;
      return (e) => {
        const intersects = this.raycaster.intersectObject(group);
        const mesh = group.children.find((v) => v === intersects[0]?.object);
        const index = mesh?._index ?? -1;

        if (index !== _index) {
          // mouseleave
          if (_index > -1 && typeof on?.mouseleave === 'function') {
            on.mouseleave(_index, data[_index], e);
          }

          // mouseenter
          if (index > -1 && typeof on?.mouseenter === 'function') {
            on.mouseenter(index, data[index], e);
          }

          _index = index;
        }

        if (typeof on?.[e.type] === 'function') {
          on[e.type](index, data[index], e);
        }
      };
    };

    const _handler = handler();
    this.handler.all(_handler);

    if (this.unbind) {
      this.unbind();
    }

    this.unbind = () => {
      this.handler.none(_handler);
    };
  }

  /**
   * @description: 开启自动播放
   * @return {*}
   */
  startAutoplay(activeIndex) {
    const { autoplay } = this.options;

    if (autoplay) {
      const { index, delay } = autoplay;
      let idx = activeIndex ?? index ?? 0;

      const loopCb = () => {
        this.active(idx++ % this.pie.children.length);
      };

      // 定时轮询
      let interval = setInterval(loopCb, delay * 1000);

      const unbind = () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };
      this.handler.emit('clearInterval');
      this.handler.once('clearInterval', unbind);

      // 初始执行
      loopCb();
    }
  }

  /**
   * @description: 停止自动播放
   * @return {*}
   */
  stopAutoplay() {
    this.handler.emit('clearInterval');
  }

  /**
   * @description: 激活饼图块
   * @param {*} index
   * @return {*}
   */
  active(index) {
    if (!this.options.animation) return;
    const { duration, activeHeight } = this.options.animation;

    this.pie?.children.forEach((mesh) => {
      if (!mesh.tw) {
        mesh.tw = gsap
          .to(mesh.scale, {
            z: activeHeight,
            duration,
            ease: 'sine.inOut',
          })
          .pause();
      }

      if (mesh._index === index) {
        mesh.tw.play();
      } else {
        mesh.tw.reverse();
      }
    });

    //     if (typeof activeCallback === 'function') {
    //       activeCallback(arcs[idx].data, idx);
    //     }
  }

  /**
   * @description: 销毁实例
   * @return {*}
   */
  dispose() {
    this.stopAutoplay();

    this.handler.emit('unbind');
    this.handler.clear();

    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }

    if (this.resMgr) {
      this.resMgr.dispose();
    }

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.content = null;
      let gl = this.renderer.domElement.getContext('webgl');
      gl && gl.getExtension('WEBGL_lose_context').loseContext();
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      // console.log('dispose renderer.info', this.renderer.info);
      this.renderer = null;
    }
  }

  /**
   * @description: ratio getter
   * @return {*}
   */
  get ratio() {
    return this.width / this.height;
  }
}

export default Pie;
