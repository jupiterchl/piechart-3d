# `piechart-3d`

> 基于`threejs`开发的`3D`饼状图

## 安装

```bash
npm install piechart-3d
# OR
yarn add piechart-3d
```

## 使用

### 示例

```js
import Pie from 'piechart-3d';

const options = {
  data: [38, 40, 28, 5],
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
  light: {
    ambientLight: {
      color: '#fff',
      intensity: 0.3,
    },
  },
};

const pie = new Pie('.chart', options);

// 销毁实例
pie.dispose();
```

### 配置项

| 属性           | 类型     | 默认值   | 描述             |
| -------------- | -------- | -------- | ---------------- |
| debug          | Boolean  | false    | 是否开启调试模式 |
| data           | Array    | []       | 数据源           |
| parseValue     | Function | (v) => v | 数据源取值方法   |
| innerRadius    | Number   | 0        | 饼图内径         |
| outerRadius    | Number   | 100      | 饼图外径         |
| cornerRadius   | Number   | 0        | 饼图圆角         |
| padAngle       | Number   | 0        | 饼图间隔         |
| height         | Number   | 40       | 饼图高度         |
| colors         | Array    | \*见备注 | 饼图色板         |
| light          | Object   | \*见备注 | 饼图灯光         |
| animation      | Object   | \*见备注 | 饼图动效         |
| activeCallback | Function | null     | 激活项回调       |

### 备注

#### `colors`默认值

```js
[
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
];
```

#### `light`默认值

```js
{
  ambientLight: {
    color: '#fff',
    intensity: 0.3,
  },
  spotLight: {
    color: '#fff',  // 颜色
    intensity: 1, // 强度
    position: [5, 5, 5],  // 位置
  },
}
```

支持`ambientLight`、`pointLight`、`spotLight`、`directionalLight`等灯光效果，每种灯光支持配置属性有`color`、`intensity`、`position`。

如果有多个同类灯光，使用数组配置即可，如下所示：

```js
{
  spotLight: [
    {
      color: '#fff',
      intensity: 0.5,
      position: [5, 5, 5],
    },
    {
      color: '#fff',
      intensity: 0.75,
      position: [-5, 5, 5],
    },
  ],
}
```

#### `animation`配置

默认不开启动效，如果该项配置存在，则开启动效。

```js
{
  delay: 2, // 切换间隔
  duration: 0.75, // 动效时长
  activeHeight: 1.5,  // 激活块高度比值，如默认高度的1.5倍
}
```
