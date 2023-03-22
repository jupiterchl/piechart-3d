/* eslint-disable no-invalid-this */
import merge from 'lodash.merge';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import gsap from 'gsap';
import makePie from './libs/makePie';
import { lg, numFixed, checkArcFlag, calcZIndex, adjustAngle, compare } from './libs/utils';

const defultOptions = {
  stroke: null, // 绘制线条样式
  fill: null, // 绘制填充样式
  activeStyle: 1, // 激活样式（1->升高; 2->平移）
  activeOffset: 40, // 激活偏移量
  angleOffset: 0, // 弧度偏移（用于调整起始绘制角度）
  textPosRatio: 0.5, // 文本位置比例
  textPrecision: 0, // 文本数值精度
  // ...
  data: [],
  parseValue: (v) => v,
  innerRadius: 0,
  outerRadius: 1,
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
};

class Pie {
  constructor(el, options) {
    this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    this.options = merge(defultOptions, options);

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
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
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
    // 坐标轴
    const axisHelper = new THREE.AxesHelper(10);
    this.scene.add(axisHelper);

    // 网格
    const gridHelper = new THREE.GridHelper(100, 50);
    this.scene.add(gridHelper);

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

    const sphere = new THREE.SphereGeometry(0.2);

    // 环境光
    let light = new THREE.AmbientLight(0xffffff, 0.3);

    // 点光
    let pointLight = new THREE.PointLight(0xffffff, 0.75);
    pointLight.add(new THREE.Mesh(sphere.clone(), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    pointLight.position.set(0, 10, 0);
    pointLight.castShadow = true;
    pointLight.shadow.camera.near = 0.1;
    pointLight.shadow.camera.far = 25;

    // 平行光
    let directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.add(new THREE.Mesh(sphere.clone(), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    directionalLight.position.set(8, 8, -8);
    directionalLight.castShadow = true;

    // 聚光灯
    const spotLight = new THREE.SpotLight(0xffffff, 0.75);
    spotLight.add(new THREE.Mesh(sphere.clone(), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    spotLight.position.set(10, 15, 10);
    // spotLight.map = new THREE.TextureLoader().load(url);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 50;
    spotLight.shadow.mapSize.height = 50;
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 20;
    spotLight.shadow.camera.fov = 30;

    this.scene.add(light);
    // this.scene.add(pointLight);
    // this.scene.add(directionalLight);
    this.scene.add(spotLight);
  }

  /**
   * @description: 构建饼图
   * @return {*}
   */
  buildPie() {
    const { data, parseValue, innerRadius, outerRadius, cornerRadius, padAngle, height, animation, colors } =
      this.options;
    const { pieSvgDataUri, arcs, arcGenerator } = makePie(data, {
      parseValue,
      innerRadius,
      outerRadius,
      cornerRadius,
      padAngle,
    });

    const loader = new SVGLoader();

    loader.load(
      pieSvgDataUri,
      (data) => {
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

        if (animation) {
          const { delay, duration, activeHeight } = animation;

          let idx = 0;
          setInterval(() => {
            idx = idx % group.children.length;

            group.children.forEach((mesh, i) => {
              if (i === idx) {
                gsap.fromTo(mesh.scale, null, {
                  z: activeHeight,
                  duration,
                  ease: 'sine.inOut',
                });
              } else {
                gsap.fromTo(mesh.scale, null, {
                  z: 1,
                  duration,
                  ease: 'sine.inOut',
                });
              }
            });

            idx += 1;
          }, delay * 1000);
        }
      },
      (xhr) => {
        // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('SVGLoader: An error happened', error);
      }
    );
  }

  get ratio() {
    return this.width / this.height;
  }

  /**
   * @description: 激活饼图
   * @param {*} idx
   * @return {*}
   */
  activePie(idx) {
    if (this._options.data[idx].active) return;

    this._options.data.forEach((v, i) => {
      v.active = i === idx;
    });

    this.updateOptionsDebounce();
  }

  /**
   * @description: 取消激活饼图
   * @param {*} idx
   * @return {*}
   */
  inactivePie(idx) {
    if (!this._options.data[idx].active) return;

    this._options.data.forEach((v) => {
      v.active = false;
    });

    this.updateOptionsDebounce();
  }
}

export default Pie;
