/* eslint-disable no-invalid-this */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';
import merge from 'lodash.merge';
import castArray from 'lodash.castarray';
import upperFirst from 'lodash.upperfirst';
import makePie from './libs/makePie';
import ResourceTracker from './libs/ResourceTracker';

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
};

class Pie {
  constructor(el, options) {
    this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    this.options = merge({}, defaultOptions, options);

    this.resMgr = new ResourceTracker();
    this.track = this.resMgr.track.bind(this.resMgr);

    this.init();
  }

  width;
  height;
  renderer;
  scene;
  camera;

  /**
   * @description: 初始化
   * @return {*}
   */
  init() {
    this.initData();
    this.initFrame();
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
    this.camera.position.set(0, 3, 4);
    this.camera.lookAt(0, 0, 0);

    this.buildAuxSystem();
    this.buildLightSystem();

    const animation = (time) => {
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(animation);
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
    const gridHelper = new THREE.GridHelper(100, 50);
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

  /**
   * @description: 构建饼图
   * @return {*}
   */
  buildPie() {
    const { data, parseValue, innerRadius, outerRadius, cornerRadius, padAngle } = this.options;
    const { pieSvgDataUri, arcs, arcGenerator } = makePie(data, {
      parseValue,
      innerRadius,
      outerRadius,
      cornerRadius,
      padAngle,
    });

    const loader = new SVGLoader();
    this.track(loader);

    loader.load(
      pieSvgDataUri,
      (data) => {
        this.genPie(data, arcs, arcGenerator);
      },
      (xhr) => {
        // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('SVGLoader: An error happened', error);
      }
    );
  }

  /**
   * @description: 生成饼图
   * @param {*} data
   * @param {*} arcs
   * @param {*} arcGenerator
   * @return {*}
   */
  genPie(data, arcs, arcGenerator) {
    const { height, animation, colors, activeCallback } = this.options;
    const shapes = data.paths.map((v) => v.toShapes()).flat();
    const group = new THREE.Group();

    const extrudeSettings = {
      curveSegments: 256,
      steps: 2,
      depth: 1,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelOffset: 0.0,
      bevelSegments: 1,
    };

    shapes.forEach((shape, i) => {
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const material = new THREE.MeshPhongMaterial({ color: colors[i % colors.length], wireframe: false });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    });

    group.rotation.x -= Math.PI / 2;
    group.scale.set(1, 1, height / 100);
    this.scene.add(group);
    this.track(group);

    if (animation) {
      const { delay, duration, activeHeight } = animation;

      let idx = 0;

      const loopCb = () => {
        idx = idx % group.children.length;

        group.children.forEach((mesh, i) => {
          if (i === idx) {
            gsap.fromTo(mesh.scale, null, {
              z: activeHeight,
              duration,
              ease: 'sine.inOut',
            });

            if (typeof activeCallback === 'function') {
              activeCallback(arcs[idx].data, idx);
            }
          } else {
            gsap.fromTo(mesh.scale, null, {
              z: 1,
              duration,
              ease: 'sine.inOut',
            });
          }
        });

        idx += 1;
      };

      // 定时轮询
      this._interval = setInterval(loopCb, delay * 1000);

      // 初始执行
      loopCb();
    }

    // console.log('renderer.info', this.renderer.info);
  }

  /**
   * @description: 销毁实例
   * @return {*}
   */
  dispose() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

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
