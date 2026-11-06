import './index.scss';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github-dark.css';
import Vue from 'vue2';
import { createApp as createVue3App, h as vue3H, reactive } from 'vue3';
import Sortable from 'sortablejs';
import { Pane } from 'tweakpane';
import Pie, { defaultOptions } from './plugin';
import PieChart3d from './vue2';
import PieChart3dVue3 from './vue3';

// 只注册示例用到的语言，避免打入完整的 highlight.js
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);

// highlight.js 没有内置 Vue 单文件组件语法：按 xml 处理，并让 <script> 内部使用 JavaScript 高亮
hljs.registerLanguage('vue', () => ({
  subLanguage: 'xml',
  contains: [
    {
      begin: /<script[^>]*>/,
      end: /<\/script>/,
      subLanguage: 'javascript',
      excludeBegin: true,
      excludeEnd: true,
    },
  ],
}));

Vue.component('pie-chart3d', PieChart3d);

const DATASETS = {
  quad: { label: '4 项（44 / 23 / 18 / 14）', data: [44, 23, 18, 14] },
  region: {
    label: '对象数组（JSON）',
    data: [
      { name: '华东', value: 44 },
      { name: '华南', value: 23 },
      { name: '华北', value: 18 },
      { name: '西南', value: 14 },
    ],
  },
  half: { label: '2 等分', data: [1, 1] },
  ten: { label: '10 等分', data: Array.from({ length: 10 }, () => 1) },
  six: { label: '6 项', data: [12, 9, 7, 5, 4, 3] },
};

const INITIAL_STATE = {
  data: [44, 23, 18, 14],
  presetKey: 'quad',
  dataText: '44, 23, 18, 14',
  colors: defaultOptions.colors.slice(),
  innerRadius: 0,
  outerRadius: 100,
  height: 32,
  padAngle: 0.05,
  cornerRadius: 0,
  scale: 1,
  labelShow: true,
  labelPosition: 0.72,
  centerShow: false,
  activeAnim: true,
  heightScale: 1.6,
  autoplay: false,
  controls: true,
  viewX: 2,
  viewY: 2,
  viewZ: 2.67,
  legacyMode: false, // 旧版观感：开启后使用 legacy 预设（与 3.3.1 渲染一致）
};

// 色板会原地修改，需与 INITIAL_STATE 分开，否则重置无法还原
const state = { ...INITIAL_STATE, colors: INITIAL_STATE.colors.slice() };

// 三个示例共享同一视角；拖拽任意一个时同步其余图表与配置面板
let viewTarget = [0, 0, 0];
let syncingView = false;

const dataStatusEl = document.getElementById('data-status');

function setDataStatus(message) {
  dataStatusEl.textContent = message;
  dataStatusEl.hidden = !message;
}

/**
 * @description: 解析手动输入的数据；支持纯数值和 JSON 对象数组
 * @param {String} text
 * @return {Array|null}
 */
function parseDataText(text) {
  const source = String(text).trim();

  if (!source) return null;

  // JSON 对象数组：[{ "name": "华东", "value": 44 }]
  if (source.startsWith('[')) {
    try {
      const list = JSON.parse(source);

      if (!Array.isArray(list) || !list.length) return null;

      const items = list.map((item) => {
        if (item !== null && typeof item === 'object') {
          const value = Number(item.value);

          return Number.isFinite(value) && value >= 0 ? { ...item, value } : null;
        }

        const value = Number(item);

        return Number.isFinite(value) && value >= 0 ? value : null;
      });

      return items.some((item) => item === null) ? null : items;
    } catch (error) {
      return null;
    }
  }

  const values = source
    .split(/[\s,，、;；]+/)
    .filter(Boolean)
    .map(Number);

  if (!values.length) return null;

  return values.some((value) => !Number.isFinite(value) || value < 0) ? null : values;
}

/**
 * @description: 把数据回填到自定义输入框；对象数组用 JSON 展示
 * @param {Array} data
 * @return {String}
 */
function formatDataText(data) {
  if (data.some((item) => item !== null && typeof item === 'object')) {
    return JSON.stringify(data, null, 2);
  }

  return data.join(', ');
}

const SLOT_LABEL_STYLE =
  'color:#fff;font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.55);white-space:nowrap;';
const SLOT_CENTER_STYLE =
  'display:flex;flex-direction:column;align-items:center;color:#e2e8f0;font:600 12px/1.4 system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.55);white-space:nowrap;';
const SLOT_CENTER_TITLE_STYLE = 'font-size:12px;color:#f8fafc;letter-spacing:.08em;';
const SLOT_CENTER_VALUE_STYLE = 'font-size:22px;line-height:1.2;color:#f8fafc;';

/**
 * @description: 标签文本；对象数据带名称时显示「名称 百分比」
 * @param {Object} params
 * @return {String}
 */
function getLabelText({ name, percent }) {
  const text = Math.round(percent * 100) + '%';

  return name === undefined ? text : `${name} ${text}`;
}

// 示例代码中这两个函数会被序列化成源码，需保持自包含，不能引用外部变量
function renderLabel({ name, percent }) {
  const text = Math.round(percent * 100) + '%';
  const div = document.createElement('div');

  div.innerText = name === undefined ? text : `${name} ${text}`;
  div.style.cssText =
    'color:#fff;font:700 14px/1 system-ui,sans-serif;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.5);-webkit-text-stroke:.4px rgba(0,0,0,.22);white-space:nowrap;';
  return div;
}

/**
 * @description: 环形图中心合计
 * @param {Object} params
 * @return {HTMLElement}
 */
function renderCenterLabel({ total }) {
  const wrap = document.createElement('div');
  const title = document.createElement('span');
  const value = document.createElement('strong');

  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;color:#e2e8f0;font:600 12px/1.4 system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.55);white-space:nowrap;';
  title.textContent = '合计';
  title.style.cssText = 'font-size:12px;color:#f8fafc;letter-spacing:.08em;';
  value.textContent = String(Math.round(total * 100) / 100);
  value.style.cssText = 'font-size:22px;line-height:1.2;color:#f8fafc;';

  wrap.appendChild(title);
  wrap.appendChild(value);
  return wrap;
}

function buildOptions(animate) {
  return {
    debug: false,
    data: state.data,
    innerRadius: Math.min(state.innerRadius, state.outerRadius),
    outerRadius: state.outerRadius,
    cornerRadius: state.cornerRadius,
    padAngle: state.padAngle,
    height: state.height,
    scale: state.scale,
    colors: state.colors,
    viewport: [state.viewX, state.viewY, state.viewZ],
    controls: state.controls,
    renderer: { preset: state.legacyMode ? 'legacy' : 'modern' },
    enterAnimation: animate,
    activeAnimation: state.activeAnim ? { duration: 0.25, heightScale: state.heightScale } : null,
    label: {
      show: state.labelShow,
      position: state.labelPosition,
      render: renderLabel,
    },
    centerLabel: {
      show: state.centerShow,
      render: renderCenterLabel,
    },
    autoplay: state.autoplay,
    on: {
      active(e) {
        console.log('active', e);
      },
      viewchange: handleViewChange,
    },
  };
}

// 原生示例
const nativeEl = document.getElementById('native-chart');
let nativePie = null;

function renderNative(options) {
  if (nativePie) {
    nativePie.dispose();
  }

  nativePie = new Pie(nativeEl, options);
}

renderNative(buildOptions(true));

// Vue 2 组件示例：标签与中心内容都通过插槽渲染
const vueApp = new Vue({
  el: '#vue-chart',
  data() {
    return { options: buildOptions(true) };
  },
  render(h) {
    return h('pie-chart3d', {
      ref: 'chart',
      props: { options: this.options },
      scopedSlots: {
        label: (params) => h('div', { style: SLOT_LABEL_STYLE }, getLabelText(params)),
        center: (params) =>
          h('div', { style: SLOT_CENTER_STYLE }, [
            h('span', { style: SLOT_CENTER_TITLE_STYLE }, '合计'),
            h('strong', { style: SLOT_CENTER_VALUE_STYLE }, String(params.total)),
          ]),
      },
    });
  },
});

// Vue 3 组件示例：插槽由第三个参数传入
const vue3State = reactive({ options: buildOptions(true) });
let vue3ChartInstance = null;

createVue3App({
  render() {
    return vue3H(
      PieChart3dVue3,
      {
        options: vue3State.options,
        ref: (el) => {
          if (el) vue3ChartInstance = el;
        },
      },
      {
        label: (params) => vue3H('div', { style: SLOT_LABEL_STYLE }, getLabelText(params)),
        center: (params) =>
          vue3H('div', { style: SLOT_CENTER_STYLE }, [
            vue3H('span', { style: SLOT_CENTER_TITLE_STYLE }, '合计'),
            vue3H('strong', { style: SLOT_CENTER_VALUE_STYLE }, String(params.total)),
          ]),
      }
    );
  },
}).mount('#vue3-chart');

let lastApplyAt = 0;
let applyTimer = null;

/**
 * @description: 重建所有示例。Pie 没有增量更新接口，这里整体重建；
 * 入场动画默认关闭，避免拖动滑块时反复播放
 * @param {Boolean} animate
 * @return {*}
 */
function apply(animate) {
  // 取消尚未执行的节流重建，避免重置后在 180ms 内又被旧配置重建一次
  if (applyTimer) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }

  const options = buildOptions(animate);

  renderNative(options);
  vueApp.options = options;
  vue3State.options = options;
}

// 拖动滑块时按约 180ms 节流重建，兼顾实时性和重建开销
function scheduleApply() {
  if (applyTimer) return;

  const wait = Math.max(0, 180 - (performance.now() - lastApplyAt));

  applyTimer = setTimeout(() => {
    applyTimer = null;
    lastApplyAt = performance.now();
    apply(false);
  }, wait);
}

/**
 * @description: 获取三个示例的 Pie 实例
 * @return {Array}
 */
function getPieInstances() {
  const vue2Chart = vueApp.$refs.chart;
  const vue2Instance = vue2Chart ? vue2Chart.getInstance() : null;
  const vue3Instance = vue3ChartInstance ? vue3ChartInstance.getInstance() : null;

  return [nativePie, vue2Instance, vue3Instance].filter(Boolean);
}

/**
 * @description: 任意图表拖拽/缩放/平移后，同步其余图表并回写配置面板
 * @param {Object} view
 * @return {*}
 */
function handleViewChange(view) {
  if (syncingView || !view) return;

  syncingView = true;
  state.viewX = Number(view.position[0].toFixed(2));
  state.viewY = Number(view.position[1].toFixed(2));
  state.viewZ = Number(view.position[2].toFixed(2));
  viewTarget = view.target.slice();
  pane.refresh();

  getPieInstances().forEach((pie) => {
    const current = pie.getView();

    if (!current) return;

    // 正在拖拽的图表视角已经是最新值，跳过以免重复更新
    const same =
      current.position.every((value, index) => Math.abs(value - view.position[index]) < 1e-6) &&
      current.target.every((value, index) => Math.abs(value - view.target[index]) < 1e-6);

    if (!same) {
      pie.setView(view);
    }
  });

  syncingView = false;
}

/**
 * @description: 按配置面板的相机坐标立即切换视角，不重建图表
 * @return {*}
 */
function applyView() {
  const view = {
    position: [state.viewX, state.viewY, state.viewZ],
    target: viewTarget,
  };

  getPieInstances().forEach((pie) => pie.setView(view));
}

/**
 * @description: 将配置序列化为可直接粘贴的 JS 对象；函数保留源码
 * @param {*} value
 * @param {Number} indent
 * @return {String}
 */
function serializeConfig(value, indent = 0) {
  const pad = '  '.repeat(indent);

  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'function') {
    let source = value.toString();

    // 对象方法简写（如 active(e) {}）需要补全 function 关键字才能作为值使用
    if (/^[A-Za-z_$][\w$]*\s*\(/.test(source)) {
      source = `function ${source}`;
    }

    return source.replace(/\n/g, `\n${pad}`);
  }

  if (Array.isArray(value)) {
    if (!value.length) return '[]';

    const nextPad = '  '.repeat(indent + 1);
    const items = value.map((item) => `${nextPad}${serializeConfig(item, indent + 1)}`);

    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);

    if (!entries.length) return '{}';

    const nextPad = '  '.repeat(indent + 1);
    const props = entries.map(([key, item]) => {
      const keyText = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);

      return `${nextPad}${keyText}: ${serializeConfig(item, indent + 1)}`;
    });

    return `{\n${props.join(',\n')}\n${pad}}`;
  }

  return 'undefined';
}

/**
 * @description: 判断两个配置值是否相同；数字按容差比较，避免滑块产生的浮点误差
 * @param {*} a
 * @param {*} b
 * @return {Boolean}
 */
function isSameConfig(a, b) {
  if (a === b) return true;

  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isSameConfig(item, b[index]));
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    return [...keys].every((key) => isSameConfig(a[key], b[key]));
  }

  return false;
}

/**
 * @description: 去掉与默认值相同的配置，只保留改动过的项
 * @param {Object} value
 * @param {Object} defaults
 * @return {Object}
 */
function pruneDefaultOptions(value, defaults) {
  return Object.entries(value).reduce((result, [key, item]) => {
    if (!(key in defaults)) {
      result[key] = item;
      return result;
    }

    const fallback = defaults[key];
    const isObject = item && typeof item === 'object' && !Array.isArray(item);
    const fallbackIsObject = fallback && typeof fallback === 'object' && !Array.isArray(fallback);

    if (isObject && fallbackIsObject) {
      const pruned = pruneDefaultOptions(item, fallback);

      if (Object.keys(pruned).length) result[key] = pruned;

      return result;
    }

    if (!isSameConfig(item, fallback)) result[key] = item;

    return result;
  }, {});
}

/**
 * @description: 生成当前面板的配置快照；事件回调依赖示例逻辑，不包含
 * @return {Object}
 */
function buildExportOptions() {
  const options = buildOptions(true);

  delete options.on;

  return options;
}

/**
 * @description: Vue 示例的 options；标签和中心内容由插槽渲染，去掉 render
 * @return {Object}
 */
function buildVueOptions() {
  const options = buildExportOptions();

  delete options.label.render;
  delete options.centerLabel.render;

  return pruneDefaultOptions(options, defaultOptions);
}

// 打包后 Function#toString 返回的是转译代码，示例里改用简化的手写实现，保持可读
const CODE_LABEL_RENDER = `function renderLabel({ name, percent }) {
  const text = Math.round(percent * 100) + '%';
  const div = document.createElement('div');
  div.innerText = name === undefined ? text : name + ' ' + text;
  div.style.cssText = 'color:#fff;font:700 14px/1 system-ui,sans-serif;';
  return div;
}`;
const CODE_CENTER_RENDER = `function renderCenterLabel({ total }) {
  const wrap = document.createElement('div');
  const title = document.createElement('span');
  const value = document.createElement('strong');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
  title.textContent = '合计';
  title.style.cssText = 'font-size:12px;color:#f8fafc;';
  value.textContent = String(Math.round(total * 100) / 100);
  value.style.cssText = 'font-size:22px;color:#f8fafc;';
  wrap.appendChild(title);
  wrap.appendChild(value);
  return wrap;
}`;
const LABEL_RENDER_MARK = '__PIE_LABEL_RENDER__';
const CENTER_RENDER_MARK = '__PIE_CENTER_RENDER__';

/**
 * @description: 用可读源码替换序列化结果里的 render 占位符
 * @param {String} code
 * @param {String} mark
 * @param {String} source
 * @return {String}
 */
function inlineRender(code, mark, source) {
  const pattern = new RegExp(`^( *)(render: )"${mark}"(,?)$`, 'm');

  return code.replace(pattern, (...args) => {
    const [, pad, key, comma] = args;
    const body = source
      .split('\n')
      .map((line, index) => (index ? pad + line : line))
      .join('\n');

    return `${pad}${key}${body}${comma}`;
  });
}

/**
 * @description: Vue 示例模板；标签、中心插槽按当前配置是否启用生成
 * @return {String}
 */
function buildVueTemplate() {
  const labelSlot = state.labelShow
    ? `      <template #label="{ name, percent }">
        {{ name ? name + ' ' : '' }}{{ Math.round(percent * 100) }}%
      </template>
`
    : '';
  const centerSlot = state.centerShow
    ? `      <template #center="{ total }">
        <div class="pie-center">
          <span>合计</span>
          <strong>{{ total }}</strong>
        </div>
      </template>
`
    : '';
  const slots = labelSlot + centerSlot;

  // 没有任何插槽时用自闭合标签，避免出现空的开始/结束标签
  if (!slots) {
    return `<template>
  <div class="chart">
    <pie-chart3d :options="options" />
  </div>
</template>`;
  }

  return `<template>
  <div class="chart">
    <pie-chart3d :options="options">
${slots}    </pie-chart3d>
  </div>
</template>`;
}

/**
 * @description: 原生示例的 options 代码（已裁剪默认值，并内联可读的 render）
 * @return {String}
 */
function buildNativeOptionsCode() {
  const options = buildExportOptions();

  options.label.render = LABEL_RENDER_MARK;
  options.centerLabel.render = CENTER_RENDER_MARK;

  const pruned = pruneDefaultOptions(options, defaultOptions);
  const code = inlineRender(serializeConfig(pruned), LABEL_RENDER_MARK, CODE_LABEL_RENDER);

  return inlineRender(code, CENTER_RENDER_MARK, CODE_CENTER_RENDER);
}

// 各示例卡片右上角的「示例代码」弹窗，代码按当前面板配置实时生成
const EXAMPLE_CODES = {
  native: {
    title: '原生调用示例',
    hint: '通过 new Pie(el, options) 创建实例，options 为当前面板的实时配置，render 为简化写法。',
    language: 'javascript',
    build() {
      return `import Pie from 'piechart-3d';

const options = ${buildNativeOptionsCode()};

const pie = new Pie(document.getElementById('chart'), options);

// 销毁实例
pie.dispose();`;
    },
    config: buildNativeOptionsCode,
  },
  vue2: {
    title: 'Vue 2 组件示例',
    hint: '标签和中心内容通过作用域插槽渲染，options 为当前面板的实时配置。',
    language: 'vue',
    build() {
      return `${buildVueTemplate()}

<script>
import PieChart3d from 'piechart-3d/es/vue2';

export default {
  components: { PieChart3d },
  data() {
    return {
      options: ${serializeConfig(buildVueOptions(), 3)},
    };
  },
};
</script>`;
    },
    config() {
      return serializeConfig(buildVueOptions());
    },
  },
  vue3: {
    title: 'Vue 3 组件示例',
    hint: '组件从 vue 引入 h、render 渲染插槽，options 为当前面板的实时配置。',
    language: 'vue',
    build() {
      return `${buildVueTemplate()}

<script setup>
import { reactive } from 'vue';
import PieChart3d from 'piechart-3d/es/vue3';

const options = reactive(${serializeConfig(buildVueOptions())});
</script>`;
    },
    config() {
      return serializeConfig(buildVueOptions());
    },
  },
};

const codeOverlay = document.getElementById('code-overlay');
const codeTitle = document.getElementById('code-title');
const codeHint = document.getElementById('code-hint');
const codeContent = document.getElementById('code-content');
const codeStatus = document.getElementById('code-status');
// 保留原始代码文本，复制时不带高亮标签
let codeText = '';
// 当前弹窗对应的配置对象源码
let configText = '';

/**
 * @description: 打开示例代码弹窗
 * @param {String} key
 * @return {*}
 */
function openCode(key) {
  const item = EXAMPLE_CODES[key];

  if (!item) return;

  const code = item.build();

  codeText = code;
  configText = item.config();
  codeTitle.textContent = item.title;
  codeHint.textContent = item.hint;
  codeContent.innerHTML = hljs.highlight(code, { language: item.language }).value;
  codeStatus.textContent = '';
  codeOverlay.hidden = false;
  codeContent.parentElement.scrollTop = 0;
}

function closeCode() {
  codeOverlay.hidden = true;
}

/**
 * @description: 复制文本；剪贴板不可用时退回 execCommand
 * @param {String} text
 * @param {String} message
 * @return {*}
 */
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const textarea = document.createElement('textarea');

    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  codeStatus.textContent = message;
}

function copyCode() {
  copyText(codeText, '代码已复制');
}

function copyConfig() {
  copyText(configText, '配置已复制');
}

document.querySelectorAll('[data-example]').forEach((button) => {
  button.addEventListener('click', () => openCode(button.dataset.example));
});

document.getElementById('code-close').addEventListener('click', closeCode);
document.getElementById('code-copy').addEventListener('click', copyCode);
document.getElementById('code-copy-config').addEventListener('click', copyConfig);
codeOverlay.addEventListener('click', (event) => {
  if (event.target === codeOverlay) closeCode();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !codeOverlay.hidden) closeCode();
});

// 配置面板
const pane = new Pane({
  container: document.getElementById('config-panel'),
  title: '配置',
});

const dataFolder = pane.addFolder({ title: '数据' });

// Tweakpane 的文本绑定是单行，自定义数据改用多行 textarea
const dataTextarea = document.createElement('textarea');
const dataTextareaRow = document.createElement('label');
const dataTextareaLabel = document.createElement('span');

dataTextarea.className = 'pie-textarea_i';
dataTextarea.rows = 6;
dataTextarea.spellcheck = false;
dataTextarea.value = state.dataText;

dataTextareaRow.className = 'pie-textarea';
dataTextareaLabel.className = 'pie-textarea_l';
dataTextareaLabel.textContent = '自定义数据';
dataTextareaRow.appendChild(dataTextareaLabel);
dataTextareaRow.appendChild(dataTextarea);

dataFolder
  .addBinding(state, 'presetKey', {
    label: '预设',
    options: {
      ...Object.fromEntries(Object.entries(DATASETS).map(([key, item]) => [item.label, key])),
      '自定义': 'custom',
    },
  })
  .on('change', (ev) => {
    const preset = DATASETS[ev.value];

    if (!preset) return;

    state.data = preset.data.slice();
    state.dataText = formatDataText(preset.data);
    syncDataTextarea();
    setDataStatus('');
    pane.refresh();
  });

dataFolder.element.querySelector('.tp-fldv_c')?.appendChild(dataTextareaRow);
// 格式错误提示紧贴输入框下方
dataTextareaRow.appendChild(dataStatusEl);

/**
 * @description: 把当前数据回填到多行输入框
 * @return {*}
 */
function syncDataTextarea() {
  // 取消尚未执行的输入解析，避免预设回填后被旧输入覆盖
  if (dataInputTimer) {
    clearTimeout(dataInputTimer);
    dataInputTimer = null;
  }

  dataTextarea.value = state.dataText;
}

let dataInputTimer = null;

dataTextarea.addEventListener('input', () => {
  state.dataText = dataTextarea.value;

  if (dataInputTimer) clearTimeout(dataInputTimer);

  dataInputTimer = setTimeout(() => {
    dataInputTimer = null;

    const values = parseDataText(state.dataText);

    if (!values) {
      setDataStatus('格式有误：请输入用逗号/空格/换行分隔的非负数字，或 JSON 对象数组');
      return;
    }

    state.data = values;
    state.presetKey = 'custom';
    setDataStatus('');
    pane.refresh();
    apply(false);
  }, 300);
});

const shapeFolder = pane.addFolder({ title: '形状' });

shapeFolder.addBinding(state, 'innerRadius', { label: '内径', min: 0, max: 80, step: 1 });
shapeFolder.addBinding(state, 'outerRadius', { label: '外径', min: 40, max: 100, step: 1 });
shapeFolder.addBinding(state, 'height', { label: '高度', min: 0, max: 50, step: 1 });
shapeFolder.addBinding(state, 'padAngle', { label: '切片间隔', min: 0, max: 0.1, step: 0.01 });
shapeFolder.addBinding(state, 'cornerRadius', { label: '圆角', min: 0, max: 50, step: 1 });

const colorFolder = pane.addFolder({ title: '色板' });
// Tweakpane 会根据字符串色值自动使用颜色控件
// 数据项较多时色板太少无法区分，至少保留 3 个颜色
const MIN_COLOR_COUNT = 3;
const colorState = {};
const colorBindings = [];

const addColorButton = colorFolder.addButton({ title: '+' });

addColorButton.element.classList.add('tp-color-add');

// 行内追加拖拽手柄和删除按钮；排序由 SortableJS 处理，结构变化后按新顺序重建
function decorateColorRow(binding, index) {
  const row = binding.element;

  row.classList.add('tp-color-row');
  row.dataset.colorIndex = String(index);

  const handle = document.createElement('span');
  const removeButton = document.createElement('button');

  handle.className = 'tp-color-handle';
  handle.title = '拖拽排序';
  handle.textContent = '⋮⋮';

  removeButton.type = 'button';
  removeButton.className = 'tp-color-remove';
  removeButton.title = '删除';
  removeButton.textContent = '×';
  removeButton.disabled = state.colors.length <= MIN_COLOR_COUNT;
  removeButton.addEventListener('click', () => removeColor(index));

  row.insertBefore(handle, row.firstChild);
  row.appendChild(removeButton);
}

function rebuildColorRows() {
  colorBindings.forEach((binding) => binding.dispose());
  colorBindings.length = 0;
  Object.keys(colorState).forEach((key) => {
    delete colorState[key];
  });

  state.colors.forEach((color, index) => {
    const key = `color${index}`;

    colorState[key] = color;

    const binding = colorFolder.addBinding(colorState, key, { label: `色值 ${index + 1}` });

    binding.on('change', (ev) => {
      state.colors[index] = ev.value;
    });
    decorateColorRow(binding, index);
    colorBindings.push(binding);
  });

  // 新增按钮始终放在色值列表末尾
  const content = colorFolder.element.querySelector('.tp-fldv_c');

  if (content) content.appendChild(addColorButton.element);
}

// 随机色相 + 固定饱和度/亮度，避免生成过暗或过灰的颜色
function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 0.72;
  const lightness = 0.55;
  const k = (n) => (n + hue / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n) => lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));

  return `#${[f(0), f(8), f(4)]
    .map((value) => Math.round(value * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function addColor() {
  state.colors.push(randomColor());
  rebuildColorRows();
  apply(false);
}

function removeColor(index) {
  if (state.colors.length <= MIN_COLOR_COUNT) return;

  state.colors.splice(index, 1);
  rebuildColorRows();
  apply(false);
}

function initColorSortable() {
  const content = colorFolder.element.querySelector('.tp-fldv_c');

  if (!content) return;

  Sortable.create(content, {
    animation: 150,
    draggable: '.tp-color-row',
    handle: '.tp-color-handle',
    ghostClass: 'tp-color-row--ghost',
    // 「+」按钮不参与拖拽
    filter: '.tp-btnv',
    onEnd(event) {
      const rows = [...content.querySelectorAll('.tp-color-row')];

      if (event.oldIndex === event.newIndex) return;

      // 按拖拽后的 DOM 顺序同步色板，再重建以更新变更回调和「色值 N」标签
      const visibleColors = rows.map((row) => state.colors[Number(row.dataset.colorIndex)]);

      state.colors.splice(0, visibleColors.length, ...visibleColors);
      rebuildColorRows();
      apply(false);
    },
  });
}

addColorButton.on('click', addColor);
rebuildColorRows();
initColorSortable();

const labelFolder = pane.addFolder({ title: '标签' });

labelFolder.addBinding(state, 'labelShow', { label: '显示标签' });
labelFolder.addBinding(state, 'labelPosition', { label: '标签位置', min: 0, max: 1, step: 0.01 });
labelFolder.addBinding(state, 'centerShow', { label: '中心合计' });

const animationFolder = pane.addFolder({ title: '动效' });

animationFolder.addBinding(state, 'activeAnim', { label: '激活动效' });
animationFolder.addBinding(state, 'heightScale', { label: '激活高度倍数', min: 1, max: 3, step: 0.05 });
animationFolder.addBinding(state, 'autoplay', { label: '自动播放' });

const viewFolder = pane.addFolder({ title: '视角' });

viewFolder.addBinding(state, 'controls', { label: '拖拽 / 缩放' });

const renderFolder = pane.addFolder({ title: '渲染' });

renderFolder.addBinding(state, 'legacyMode', { label: '旧版观感' });

const viewBindings = [
  viewFolder.addBinding(state, 'viewX', { label: '相机 X', min: -6, max: 6, step: 0.01 }),
  viewFolder.addBinding(state, 'viewY', { label: '相机 Y', min: 0, max: 8, step: 0.01 }),
  viewFolder.addBinding(state, 'viewZ', { label: '相机 Z', min: -6, max: 6, step: 0.01 }),
];

viewFolder.addButton({ title: '重置视角' }).on('click', () => {
  state.viewX = INITIAL_STATE.viewX;
  state.viewY = INITIAL_STATE.viewY;
  state.viewZ = INITIAL_STATE.viewZ;
  viewTarget = [0, 0, 0];
  pane.refresh();
  apply(false);
});

pane.addButton({ title: '重播入场动画' }).on('click', () => apply(true));
pane.addButton({ title: '重置配置' }).on('click', () => {
  Object.assign(state, INITIAL_STATE);
  state.data = INITIAL_STATE.data.slice();
  state.colors = INITIAL_STATE.colors.slice();
  viewTarget = [0, 0, 0];
  rebuildColorRows();
  syncDataTextarea();
  setDataStatus('');
  pane.refresh();
  apply(true);
});

// 复选框整行可点击，避免只能点中很小的方框
document.querySelectorAll('.tp-lblv').forEach((row) => {
  const input = row.querySelector('.tp-ckbv_i');

  if (!input) return;

  row.classList.add('tp-lblv--clickable');
  row.addEventListener('click', (event) => {
    // 点在复选框本身时交给原生 label 处理，避免重复切换
    if (row.querySelector('.tp-ckbv_l')?.contains(event.target)) return;
    input.click();
  });
});

pane.on('change', (ev) => {
  if (syncingView) return;

  // 视角切换直接应用，不走节流重建
  const isViewBinding =
    viewBindings.includes(ev.target) || (ev.target && /^相机 [XYZ]$/.test(ev.target.label));

  if (isViewBinding) {
    applyView();
    return;
  }

  scheduleApply();
});
