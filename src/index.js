import './index.scss';
import Pie from './plugin';

function init() {
  const options = {
    debug: true,
    data: [38, 40, 28, 5, 20],
    innerRadius: 0,
    outerRadius: 150,
    cornerRadius: 0,
    padAngle: 0,
    height: 40,
    animation: {
      duration: 0.75,
      activeHeight: 1.5,
    },
    autoplay: {
      index: 0,
      delay: 2,
    },
    // light: {
    //   ambientLight: {
    //     color: '#fff',
    //     intensity: 0.3,
    //   },
    // },
    on: {
      mouseenter(index, mesh, group, e) {
        console.log('mouseenter', index);
        mesh.material.color.set('#ff0000');
      },
      mouseleave(index, mesh, group, e) {
        console.log('mouseleave', index);
        mesh.material.color.set(mesh._color);
      },
    },
  };

  let pie = null;

  pie = new Pie('.chart', options);

  document.getElementById('mount').addEventListener(
    'click',
    () => {
      pie = new Pie('.chart', options);
      console.log('pie', pie);
    },
    false
  );

  document.getElementById('dispose').addEventListener(
    'click',
    () => {
      pie.dispose();
    },
    false
  );
}

function randomCfg() {
  const genData = function () {
    return Array.from({ length: 10 }, (v, i) => ({
      label: `${i + 1}类物品`,
      value: ~~(Math.random() * 100) + 20,
    }));
  };

  const cfg = {
    radius: [~~(Math.random() * 100), ~~(Math.random() * 80) + 120], // 半径：[内径, 外径]
    tilt: ~~(Math.random() * 30) + 30, // 倾角
    height: ~~(Math.random() * 50) + 50, // 高度
    colors: ['#0896FF', '#0FC7FF', '#4EF7E7', '#2FEEC8', '#FFB632', '#FF8C3F', '#3FEC9B'], // 颜色
    data: genData(), // 数据
    textNode(d) {
      const p = document.createElement('p');
      p.innerText = Math.round(d.realtimeValue);
      return p;
    },
  };

  return cfg;
}

init();
