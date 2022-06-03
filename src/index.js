import './index.scss';
import Pie from './plugin';

function init() {
  const data = [
    { label: 'A类物品', value: 32 },
    { label: 'B类物品', value: 44 },
    { label: 'C类物品', value: 80 },
    { label: 'D类物品', value: 40 },
    { label: 'E类物品', value: 66 },
  ];

  new Pie(document.querySelector('.chart'), {
    radius: [100, 200], // 半径：[内径, 外径]
    tilt: 40, // 倾角
    height: 50, // 高度
    colors: ['#1A6AA3', '#A5789E', '#FF6D54', '#FFC154', '#47B39C'], // 颜色
    data, // 数据
  });
}

init();
