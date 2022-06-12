# piechart-3d

> 基于 d3.js 开发的 3d 饼状图图表

## 安装

```bash
npm install piechart-3d
# OR
yarn add piechart-3d
```

## 使用

### 示例

```js
import pie from 'piechart-3d';

const myPie = pie.init(document.querySelector('.pieChart'));
myPie.setOption({
  radius: [100, 150],
  tilt: 30,
  height: 40,
  colors: ['#0896FF', '#0FC7FF', '#4EF7E7', '#2FEEC8'],
  data: [
    { label:'A类物品', value:22 }
    { label:'B类物品', value:35 }
    { label:'C类物品', value:18 }
  ],
});
```

### 配置项

| 属性          | 类型                                       | 默认值 | 描述                               |
| ------------- | ------------------------------------------ | ------ | ---------------------------------- |
| radius        | Array\<number\>                            |        | 饼图内径和外径                     |
| tilt          | Number                                     |        | 饼图倾角，范围 0-90                |
| height        | Number                                     |        | 饼图高度                           |
| colors        | Array\<string\>                            | []     | 饼图区块颜色，列表循环             |
| data          | Array\<object{label:string,value:number}\> | []     | 饼图数据                           |
| stroke        | Function                                   | null   | 绘制线条色处理方法                 |
| fill          | Function                                   | null   | 绘制填充色处理方法                 |
| activeStyle   | Number                                     | 1      | 饼图区块激活样式，1->升高，2->平移 |
| activeOffset  | Number                                     | 40     | 饼图区块激活偏移量                 |
| angleOffset   | Number                                     | 0      | 弧度偏移，用于调整起始绘制角度     |
| textPosRatio  | Number                                     | 0.5    | 文本位置比例                       |
| textPrecision | Number                                     | 0      | 文本数值精度，默认取整             |
