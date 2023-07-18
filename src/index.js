import './index.scss';
import Pie from './plugin';
// import Pie from '../es/pieChart3d.js';

function init() {
  const options = {
    debug: false,
    data: Array.from({ length: 6 }, () => Math.floor(Math.random() * 100)),
    innerRadius: 0.7,
    outerRadius: 1,
    cornerRadius: 0,
    padAngle: 0,
    height: 0.2,
    activeAnimation: {
      duration: 0.25,
      heightScale: 2,
    },
    label: {
      show: false,
      position: 0.85,
      render({ percent, color }) {
        const div = document.createElement('div');
        div.innerText = Number((percent * 100).toFixed(2)) + '%';
        div.style.background = color;
        return div;
      },
    },
    autoplay: true,
    // autoplay: {
    //   index: 0,
    //   delay: 2,
    // },
    // light: {
    //   ambientLight: {
    //     color: '#fff',
    //     intensity: 0.3,
    //   },
    // },
    on: {
      mouseenter(e) {
        console.log('mouseenter', e);
      },
      mouseleave(e) {
        console.log('mouseleave', e);
      },
      active(e) {
        console.log('active', e);
      },
    },
  };

  let pie = null;

  // pie = new Pie('.chart', options);

  document.getElementById('mount').addEventListener(
    'click',
    () => {
      pie?.dispose();
      pie = new Pie('.chart', options);
      console.log('pie', pie);
    },
    false
  );

  document.getElementById('dispose').addEventListener(
    'click',
    () => {
      pie?.dispose();
    },
    false
  );

  const legendHandler = (e) => {
    const index = Number(e.target.getAttribute('data-idx')) - 1;

    switch (e.type) {
      case 'mouseenter':
        pie?.activate(index);
        break;
      case 'mouseleave':
        pie?.deactivate();
        break;
    }
  };

  const legendEl = document.getElementById('legend');

  legendEl.addEventListener(
    'click',
    (e) => {
      if (e.target.nodeName === 'INPUT') {
        const checked = e.target.checked;
        const index = Number(e.target.id[1]) - 1;

        pie?.setLegendChecked((legends) => {
          legends[index] = checked;
          return legends;
        });
      }
    },
    false
  );
  // [...legendEl.querySelectorAll('div')].forEach((el) => {
  //   el.addEventListener('mouseenter', legendHandler, false);
  //   el.addEventListener('mouseleave', legendHandler, false);
  // });
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
