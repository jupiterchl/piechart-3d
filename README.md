# `piechart-3d`

> 基于`threejs`开发的`3D`饼状图

仓库地址：[github.com/jupiterchl/piechart-3d](https://github.com/jupiterchl/piechart-3d)

在线示例：https://jupiterchl.github.io/piechart-3d/

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
  explode: 0,
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

### 数据源

`data` 既可以是数值数组，也可以直接传业务对象数组，用 `valueKey`、`nameKey` 指定取值字段，字段名默认分别为 `value`、`name`：

```js
const options = {
  data: [
    { region: '华东', amount: 44 },
    { region: '华南', amount: 23 },
    { region: '华北', amount: 18 },
  ],
  valueKey: 'amount',
  nameKey: 'region',
  label: {
    show: true,
    render({ name, percent }) {
      const div = document.createElement('div');
      div.innerText = `${name} ${(percent * 100).toFixed(1)}%`;
      return div;
    },
  },
};
```

`valueKey`、`nameKey` 也支持函数：`valueKey: (item) => item.amount / 100`。数值会统一转成数字，`NaN`、负数按 `0` 处理；名称、原始数据会通过 `name`、`data` 传给标签和事件。

示例页右侧「数据」区域的「自定义数据」是多行输入框，支持两种写法：纯数值 `44, 23, 18, 14`（逗号、空格或换行分隔）；JSON 对象数组 `[{"name":"华东","value":44}]`。选择预设时输入框会自动回填对应格式，对象数组以 JSON 展示。

「色板」默认 10 个颜色，点「+」随机追加一个颜色；每个色值可点「×」删除（至少保留 3 个），也可拖拽手柄调整顺序。

「渲染」区域的「旧版观感」开关对应 `renderer.preset`：示例页默认关闭（`modern`，sRGB 输出 + ACES 色调映射 + PBR 材质 + 环境贴图 + 新版灯光）；打开则切到 `legacy`，与 3.3.1 渲染结果一致，具体见下文「`renderer`配置」。

### 配置项

| 属性            | 类型            | 默认值   | 描述             |
| --------------- | --------------- | -------- | ---------------- |
| debug           | Boolean         | false    | 是否开启调试模式 |
| data            | Array           | []       | 数据源，支持数值数组或对象数组 |
| valueKey        | String\|Function | 'value' | 对象数组的数值字段，也可传 `(item, index) => value` |
| nameKey         | String\|Function | 'name'  | 对象数组的名称字段，也可传 `(item, index) => name` |
| innerRadius     | Number          | 0        | 饼图内径，0-100  |
| outerRadius     | Number          | 100      | 饼图外径，0-100  |
| cornerRadius    | Number          | 0        | 饼图圆角，0-50   |
| padAngle        | Number          | 0        | 饼图间隔，0-0.1  |
| explode         | Number\|Array   | 0        | 切片外爆距离，0-50 或按数据项配置的数组 |
| height          | Number          | 20       | 饼图高度，0-50   |
| scale           | Number          | 1        | 饼图缩放         |
| viewport        | Array           | [0,2,3]  | 摄像机位置，建议 `y > 0` 位于图表上方 |
| controls        | Boolean\|Object | false    | 是否开启视角控制（拖拽旋转、滚轮缩放），可传对象覆盖 OrbitControls 配置 |
| colors          | Array           | \*见备注 | 饼图色板         |
| emptyColor      | String          | #aaa     | 饼图空状态颜色   |
| lights          | Array           | \*见备注 | 饼图灯光         |
| renderer        | Object          | \*见备注 | 渲染色彩管线（输出编码、色调映射、色彩管理） |
| label           | Object          | \*见备注 | 饼图标签         |
| centerLabel     | Object          | \*见备注 | 环形图中心内容（如合计值） |
| enterAnimation  | Boolean\|Number | true     | 入场动画，`false` 关闭，数字为时长（秒），默认 0.5 秒 |
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

支持`AmbientLight`、`PointLight`、`SpotLight`、`DirectionalLight`等灯光效果，每种灯光支持配置属性有`color`、`intensity`、`position`，以及对应灯光类型的其他属性（如`SpotLight`的`angle`、`penumbra`）。

#### `renderer`配置

渲染观感开关，`preset` 决定整套渲染参数，默认 `'legacy'`，观感与 3.3.1 一致：

- `legacy`：线性输出、不开启色彩管理与色调映射、无环境贴图、`MeshPhongMaterial` 材质、3.x 的细分段数与倒角、旧版灯光（`AmbientLight 0.3` / `SpotLight 1`，位置 `[5, 5, 5]`）
- `modern`：sRGB 输出 + ACES 色调映射、开启色彩管理、夜景环境贴图、`MeshStandardMaterial`（PBR）材质、自适应细分段数、新版灯光（`AmbientLight 0.04` / `SpotLight 0.75`，位置 `[10, 15, 10]`）

```js
// 使用 4.x 的新观感
{ renderer: { preset: 'modern' } }

// 默认值与 3.x 一致
{ renderer: { preset: 'legacy' } }
```

预设展开后的完整字段如下，可单独覆盖其中任意一项（未传的字段沿用预设值）：

```js
{
  renderer: {
    preset: 'legacy', // 'legacy' | 'modern'
    outputEncoding: 'linear', // 'linear' | 'srgb'，输出编码
    toneMapping: 'none', // 'none' | 'aces'，色调映射
    toneMappingExposure: 0.94, // 仅 toneMapping 为 'aces' 时生效
    colorManagement: false, // three.js 色彩管理，需在创建颜色、灯光前设置
    environment: false, // 夜景环境贴图，仅 PBR 材质生效
    material: 'phong', // 'phong'（3.x）| 'standard'（PBR）
    geometry: 'legacy', // 'legacy'（3.x 的细分段数与倒角）| 'current'
  },
}
```

未显式传 `lights` 时，灯光随预设切换；传了 `lights` 则以传入为准。

注意：`colorManagement` 是 three.js 的全局开关，在实例创建时设置；同一页面上存在多个配置不一致的图表时，以最后创建的实例为准。

#### `label`配置

饼图标签项配置，默认值如下：

```js
{
  show: false, // 是否显示
  position: 0.7, // 标签显示位置占比。注意，如果值为`0`，则为中心展示，此时只显示激活项标签
  render: null, // 标签渲染函数，参数同事件参数，返回值为`dom`元素
}
```

#### `centerLabel`配置

环形图中心内容，常用于展示合计、总数。定位方式与标签一致：底部对齐饼图顶面（环形图对齐孔底），按世界坐标投影，视角变化时自动跟随；传入 `render` 返回字符串或 `dom` 元素即可：

```js
{
  centerLabel: {
    show: true,
    render({ total, visibleTotal, data }) {
      const div = document.createElement('div');
      div.innerText = `合计 ${total}`; // visibleTotal 为图例隐藏后可见项的合计
      return div;
    },
  },
}
```

默认值：

```js
{
  show: false,
  render: null,
}
```

空数据时不会渲染中心内容。建议配合 `innerRadius`（如 `50`）使用，留出环形区域。

#### 倒角与切片间隔

切片默认带倒角（顶面边缘的斜角）。倒角会让切片侧面向外鼓出 `0.7`，相邻切片两侧合计鼓出 `1.4`，因此切缝小于 `1.4` 时两个侧面会互相穿插，接缝处出现错色、闪烁。为避免这个问题，切缝过小时会自动关闭倒角，保证切边干净。

相邻切边的实际间距（d3 按 `padRadius` 把 `padAngle` 换算成固定线宽）：

```js
seamGap = 2 * Math.sqrt(innerRadius ** 2 + outerRadius ** 2) * Math.sin(padAngle / 2);
```

判定规则：`seamGap > 1.4` 时开启倒角，否则关闭。换算成常用配置：

| 配置 | 倒角开启的 `padAngle` 阈值 |
| --- | --- |
| 实心饼 `innerRadius: 0, outerRadius: 100` | `> 0.014` |
| 环形图 `innerRadius: 50, outerRadius: 100` | `> 0.0125` |

示例面板步长为 `0.01`，所以 `padAngle` 为 `0.01` 时无倒角，`0.02` 起恢复倒角。配置了 `explode`（外爆）时仍保持倒角。

#### `activeAnimation`配置

默认不开启动效，如果该项配置存在，则开启动效。

```js
{
  duration: 0.75, // 动效时长
  heightScale: 2,  // 激活块高度缩放，如默认高度的2倍
}
```

#### `controls`配置

开启视角控制后，默认把俯仰角限制在水平面以上（`maxPolarAngle = Math.PI / 2`），并关闭右键平移（`enablePan: false`），拖拽旋转或平移都不会看到饼图底部。滚轮缩放带平滑过渡，缩放速度可用 `zoomSpeed` 调整。如需进一步调整，可把 `controls` 配置为对象，覆盖 [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) 的任意属性：

```js
{
  controls: {
    maxPolarAngle: Math.PI / 2, // 允许的最大俯仰角，默认值
    enablePan: false,           // 右键平移，默认关闭
    minDistance: 2,             // 最小缩放距离
  },
}
```

注意：把 `maxPolarAngle` 调到大于 `Math.PI / 2` 或开启 `enablePan` 后，可能重新允许看到饼图底部。

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
  viewchange(e) {
    // 开启 controls 后，用户拖拽/缩放/平移改变视角时触发
    console.log('viewchange', e);
  },
}
```

#### 事件参数

事件参数非原生事件参数，封装值如下：

```js
{
  index,  // 触发项序号
  name,   // 触发项名称（对象数组且配置了 nameKey 时有值，否则为 undefined）
  value,  // 触发项值
  percent, // 触发项占比（0-1）
  color, // 触发项色值
  data,   // 触发项原始数据（对象数组时为对应对象）
}
```

`viewchange` 事件参数为当前视角，可用 `setView` 同步到其他图表：

```js
{
  position: [x, y, z], // 摄像机位置
  target: [x, y, z],   // 控制器目标点
}
```

### Vue 2 组件

组件本身不依赖 `vue` 运行时，注册后即可使用：

```js
import Vue from 'vue';
import PieChart3d from 'piechart-3d/es/vue2';

Vue.component('PieChart3d', PieChart3d);
```

```vue
<template>
  <div class="chart">
    <pie-chart3d ref="pie" :options="options" @active="handleActive" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      options: {
        data: [1, 2, 3],
        label: { show: true, position: 0.7 },
      },
    };
  },
  methods: {
    handleActive(e) {
      console.log(e);
    },
  },
};
</script>
```

组件配置：

| 属性    | 类型   | 描述                                                    |
| ------- | ------ | ------------------------------------------------------- |
| options | Object | 与 `new Pie(el, options)` 的配置项完全一致，必填        |

组件事件：`mouseenter`、`mouseleave`、`active`，参数与上文事件参数一致。

通过 `ref` 调用的组件方法：`activate(index)`、`deactivate()`、`setLegendChecked(fn)`、`getInstance()`。

#### 插槽

Vue 2 组件支持 `label`、`center` 两个作用域插槽，可以直接用模板写标签和中心内容，不需要在 `options` 里写 `render`：

```vue
<template>
  <div class="chart">
    <pie-chart3d ref="pie" :options="options">
      <template #label="{ name, percent, value }">
        <span class="pie-label">{{ name }} · {{ (percent * 100).toFixed(1) }}%</span>
      </template>
      <template #center="{ total }">
        <div class="pie-center">
          <span>合计</span>
          <strong>{{ total }}</strong>
        </div>
      </template>
    </pie-chart3d>
  </div>
</template>
```

```js
export default {
  data() {
    return {
      options: {
        data: [
          { name: '华东', value: 44 },
          { name: '华南', value: 23 },
        ],
        innerRadius: 55,
        label: { show: true },
        centerLabel: { show: true },
      },
    };
  },
};
```

插槽参数：`label` 为事件参数（`index`、`name`、`value`、`percent`、`color`、`data`）；`center` 为 `{ total, visibleTotal, data }`。插槽会覆盖 `options.label.render`、`options.centerLabel.render`；传了插槽而对应配置未写 `show` 时默认开启。

插槽在图表重建或标签内容签名变化时重新渲染。如果插槽文本依赖图表之外的响应式状态，把这个状态也放进 `options`（会触发重建）即可同步；仅修改与 `options` 无关的组件状态不会刷新已渲染的插槽。

注意：

- `options` 深度变化时会销毁并重建图表（默认重新播放入场动画，可配置 `enterAnimation: false` 关闭），数据更新无需手动创建实例。
- 组件根元素宽高为 `100%`，由父容器决定；容器尺寸变化时图表会自动重新适配。

### Vue 3 组件

组件内部从 `vue` 引入 `h`、`render`（用于渲染插槽），发布产物中 `vue` 为外部依赖，使用方需自行安装 Vue 3：

```js
import { createApp } from 'vue';
import PieChart3d from 'piechart-3d/es/vue3';

createApp({
  components: { PieChart3d },
  data() {
    return {
      options: {
        data: [1, 2, 3],
        label: { show: true, position: 0.7 },
      },
    };
  },
}).mount('#app');
```

```vue
<template>
  <div class="chart">
    <pie-chart3d ref="pie" :options="options" @active="handleActive" />
  </div>
</template>
```

组件配置、事件、通过 `ref` 调用的方法与 Vue 2 组件一致。组件卸载时会在 `beforeUnmount` 中自动销毁实例。

#### 插槽

Vue 3 组件同样支持 `label`、`center` 作用域插槽，用法与 Vue 2 相同：

```vue
<template>
  <div class="chart">
    <pie-chart3d ref="pie" :options="options">
      <template #label="{ name, percent }">
        <span class="pie-label">{{ name }} · {{ (percent * 100).toFixed(1) }}%</span>
      </template>
      <template #center="{ total }">
        <div class="pie-center">
          <span>合计</span>
          <strong>{{ total }}</strong>
        </div>
      </template>
    </pie-chart3d>
  </div>
</template>
```

插槽会覆盖 `options.label.render`、`options.centerLabel.render`；参数与 Vue 2 组件相同。

注意：

- `options` 深度变化时会销毁并重建图表（默认重新播放入场动画，可配置 `enterAnimation: false` 关闭）。
- 组件根元素宽高为 `100%`，由父容器决定；容器尺寸变化时图表会自动重新适配。

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

#### `getView`和`setView`

用于读取和设置视角，常在多个图表之间同步视角时使用：

```js
const view = pie.getView(); // { position: [x, y, z], target: [x, y, z] }
otherPie.setView(view);
```

`setView` 不接收 `target` 时默认看向原点，且不会触发 `viewchange` 事件，避免同步时循环触发。

#### `activate`和`deactivate`

这两个方法用于触发饼图的激活和取消激活。`activate`方法接受一个数值参数，该数值为对应激活块的序号。`deactivate`方法无参数。

#### `dispose`

该方法用于销毁实例，当组件卸载的时候需手动调用。

## 本地开发

```bash
yarn install
yarn dev          # 启动示例页，默认 http://localhost:8080
yarn build        # 构建库产物到 es/
yarn build:demo   # 构建示例页静态产物到 dist/
```

## License

[MIT](./LICENSE)
