import './index.scss';
import pie from './plugin';

function init() {
  const myPie = pie.init(document.querySelector('.chart'));
  myPie.setOption(randomCfg());
  // console.log(myPie);

  document.getElementById('click').addEventListener(
    'click',
    () => {
      myPie.setOption(randomCfg());
    },
    false
  );
}

function randomCfg() {
  const genData = function () {
    return Array.from({ length: 5 }, (v, i) => ({ label: `${i + 1}类物品`, value: ~~(Math.random() * 100) + 20 }));
  };

  const cfg = {
    radius: [~~(Math.random() * 100), ~~(Math.random() * 80) + 120], // 半径：[内径, 外径]
    tilt: ~~(Math.random() * 30) + 30, // 倾角
    height: ~~(Math.random() * 50) + 50, // 高度
    colors: ['#1A6AA3', '#A5789E', '#FF6D54', '#FFC154', '#47B39C'], // 颜色
    data: genData(), // 数据
  };

  return cfg;
}

init();
