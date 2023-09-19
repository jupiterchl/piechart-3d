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
  debug: false,
  data: [16406.8, 50256, 15752, 19467.6, 112249.6, 18601.6],
  innerRadius: 0,
  outerRadius: 100,
  cornerRadius: 0,
  padAngle: 0,
  height: 20,
  activeAnimation: {
    duration: 0.25,
    heightScale: 2,
  },
  label: {
    show: true,
    position: 0.75,
    render({ percent, color }) {
      const div = document.createElement('div');
      div.innerText = Number((percent * 100).toFixed(2)) + '%';
      div.style.background = color;
      return div;
    },
  },
  autoplay: false,
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

const pie = new Pie('.chart', options);

// 销毁实例
pie.dispose();
```

### 配置项

| 属性            | 类型            | 默认值   | 描述             |
| --------------- | --------------- | -------- | ---------------- |
| debug           | Boolean         | false    | 是否开启调试模式 |
| data            | Array           | []       | 数据源           |
| innerRadius     | Number          | 0        | 饼图内径，0-100  |
| outerRadius     | Number          | 100      | 饼图外径，0-100  |
| cornerRadius    | Number          | 0        | 饼图圆角，0-50   |
| padAngle        | Number          | 0        | 饼图间隔，0-0.1  |
| height          | Number          | 20       | 饼图高度，0-50   |
| scale           | Number          | 1        | 饼图缩放         |
| viewport        | Array           | [0,2,3]  | 摄像机位置       |
| colors          | Array           | \*见备注 | 饼图色板         |
| lights          | Array           | \*见备注 | 饼图灯光         |
| label           | Object          | \*见备注 | 饼图标签         |
| activeAnimation | Object          | \*见备注 | 饼图动效         |
| autoplay        | Boolean\|Number | false    | 自动播放         |
| on              | Object          | \*见备注 | 监听事件         |

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

#### `lights`默认值

```js
[
  {
    type: 'AmbientLight',
    color: '#fff',
    intensity: 0.3,
  },
  {
    type: 'SpotLight',
    color: '#fff',
    intensity: 1,
    position: [5, 5, 5],
  },
];
```

支持`AmbientLight`、`PointLight`、`SpotLight`、`DirectionalLight`等灯光效果，每种灯光支持配置属性有`color`、`intensity`、`position`。

#### `label`配置

饼图标签项配置，默认值如下：

```js
{
  show: false, // 是否显示
  position: 0.7, // 标签显示位置占比。注意，如果值为`0`，则为中心展示，此时只显示激活项标签
  render: null, // 标签渲染函数，参数同事件参数，返回值为`dom`元素
}
```

#### `activeAnimation`配置

默认不开启动效，如果该项配置存在，则开启动效。

```js
{
  duration: 0.75, // 动效时长
  heightScale: 2,  // 激活块高度缩放，如默认高度的2倍
}
```

#### `autoplay`配置

默认值为`false`，不开启自动播放。该项值接受布尔值和数值，如果需要开启自动播放，可设置为`true`或具体数值，单位秒。如果为`true`，则为`3s`，如果为数值，则取值在`1-10`之间。

#### `on`配置

默认值为`null`，如果需要监听事件，可进行相应配置，配置示例如下：

```js
{
  mouseenter(e) {
    console.log('mouseenter', e);
  },
  mouseleave(e) {
    console.log('mouseleave', e);
  },
  active(e) {
    console.log('active', e);
  },
}
```

#### 事件参数

事件参数非原生事件参数，封装值如下：

```js
{
  index,  // 触发项序号
  value,  // 触发项值
  percent, // 触发项占比（0-1）
  color, // 触发项色值
}
```

### 实例方法

#### `setLegendChecked`

为了实现图例的自定义，图例需自行实现，该方法提供图例与饼图的控制交互。

该方法参数为回调函数，该回调函数的参数为数据等长的数组，示例如下：

```js
[true, true, true];
```

每一项对应饼图的对应块，通过布尔值可以控制对应块的显示与隐藏。该回调函数的返回值应为等长的布尔值数组。使用示例如下：

```js
pie.setLegendChecked((legends) => {
  legends[index] = checked;
  return legends;
});
```

#### `activate`和`deactivate`

这两个方法用于触发饼图的激活和取消激活。`activate`方法接受一个数值参数，该数值为对应激活块的序号。`deactivate`方法无参数。

#### `dispose`

该方法用于销毁实例，当组件卸载的时候需手动调用。
