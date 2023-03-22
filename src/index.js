import './index.scss';
import Pie from './plugin';

function init() {
  const options = {
    data: [1.5, 0.78, 0.62, 0.48],
    innerRadius: 0,
    outerRadius: 150,
    cornerRadius: 0,
    padAngle: 0,
    height: 40,
    animation: {
      delay: 2,
      duration: 0.75,
      activeHeight: 1.5,
    },
  };
  const myPie = new Pie('.chart1', options);

  const myPie1 = new Pie('.chart2', options);

  // document.getElementById('click').addEventListener(
  //   'click',
  //   () => {
  //     myPie.setOption(randomCfg());
  //   },
  //   false
  // );
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
