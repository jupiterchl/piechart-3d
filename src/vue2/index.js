import Pie from '../plugin';

const EVENTS = ['mouseenter', 'mouseleave', 'active'];

/**
 * @description: 卸载组件下的所有插槽渲染实例
 * @param {Object} component
 * @return {*}
 */
function destroyMounts(component) {
  const mounts = component._pieSlotMounts;

  if (!mounts) return;

  mounts.forEach((destroy) => destroy());
  mounts.clear();
}

/**
 * @description: 用插槽渲染标签内容，返回可挂到图表上的 DOM 容器
 * @param {Object} component
 * @param {String} slotName
 * @param {Object} context { params, mounts, mountKey }
 * @return {HTMLElement|undefined}
 */
function renderSlot(component, slotName, { params, mounts, mountKey }) {
  // 组件本身不直接依赖 vue，用当前实例的构造函数创建临时渲染实例
  const VueCtor = component.$options._base || (component.$root && component.$root.constructor);

  if (!VueCtor) return undefined;

  const key = mountKey === undefined ? slotName : mountKey;
  const prev = mounts.get(key);

  if (prev) prev();

  const container = document.createElement('div');
  const vm = new VueCtor({
    parent: component,
    render(h) {
      const slot = component.$scopedSlots[slotName];

      return slot ? h('div', { class: `piechart-3d__${slotName}` }, slot(params)) : null;
    },
  });

  vm.$mount();
  container.appendChild(vm.$el);
  mounts.set(key, () => {
    vm.$destroy();
    container.remove();
  });

  return container;
}

/**
 * @description: Vue 2 组件，参数与 Pie 实例配置一致
 * @return {*}
 */
export default {
  name: 'PieChart3d',

  props: {
    // 与 new Pie(el, options) 的配置项完全一致
    options: {
      type: Object,
      required: true,
    },
  },

  render(h) {
    return h('div', {
      class: 'piechart-3d',
      style: {
        width: '100%',
        height: '100%',
      },
    });
  },

  mounted() {
    this.createChart();
  },

  beforeDestroy() {
    this.destroyChart();
  },

  watch: {
    // 配置或数据变化时重建图表，Vue 侧改完数据无需手动调用实例方法
    options: {
      deep: true,
      handler() {
        this.scheduleRecreate();
      },
    },
  },

  methods: {
    createChart() {
      if (this._pieInstance || !this.$el || !this.options) return;

      const { on, label, centerLabel, ...rest } = this.options;
      const listeners = { ...on };
      const pieOptions = { ...rest, label: this.createLabelOptions(label) };

      if (centerLabel || this.$scopedSlots.center) {
        pieOptions.centerLabel = this.createCenterLabelOptions(centerLabel);
      }

      // 转发为 Vue 事件，同时保留 options.on 中的原有回调
      EVENTS.forEach((name) => {
        listeners[name] = (e) => {
          if (on && typeof on[name] === 'function') {
            on[name](e);
          }

          this.$emit(name, e);
        };
      });

      pieOptions.on = listeners;
      this._pieInstance = new Pie(this.$el, pieOptions);
    },

    /**
     * @description: 把 #label 插槽包装成 label.render
     * @param {Object} label
     * @return {Object}
     */
    createLabelOptions(label) {
      const nextLabel = { ...label };

      if (!this.$scopedSlots.label) return nextLabel;

      if (nextLabel.show === undefined) nextLabel.show = true;

      if (!this._pieSlotMounts) this._pieSlotMounts = new Map();

      const mounts = this._pieSlotMounts;

      nextLabel.render = (params) =>
        renderSlot(this, 'label', { params, mounts, mountKey: params.index ?? 0 }) ||
        document.createElement('div');

      return nextLabel;
    },

    /**
     * @description: 把 #center 插槽包装成 centerLabel.render
     * @param {Object} centerLabel
     * @return {Object}
     */
    createCenterLabelOptions(centerLabel) {
      const nextCenterLabel = { ...centerLabel };

      if (!this.$scopedSlots.center) return nextCenterLabel;

      if (nextCenterLabel.show === undefined) nextCenterLabel.show = true;

      if (!this._pieSlotMounts) this._pieSlotMounts = new Map();

      const mounts = this._pieSlotMounts;

      nextCenterLabel.render = (params) =>
        renderSlot(this, 'center', { params, mounts }) || document.createElement('div');

      return nextCenterLabel;
    },

    destroyChart() {
      if (this._pieInstance) {
        this._pieInstance.dispose();
        this._pieInstance = null;
      }

      destroyMounts(this);
    },

    recreateChart() {
      this.destroyChart();
      this.createChart();
    },

    /**
     * @description: 同一轮更新内多次触发时只重建一次
     * @return {*}
     */
    scheduleRecreate() {
      if (this._recreatePending) return;

      this._recreatePending = true;
      this.$nextTick(() => {
        this._recreatePending = false;
        this.recreateChart();
      });
    },

    /**
     * @description: 激活指定切片
     * @param {Number} index
     * @return {*}
     */
    activate(index) {
      if (this._pieInstance) {
        this._pieInstance.activate(index);
      }
    },

    /**
     * @description: 取消激活
     * @return {*}
     */
    deactivate() {
      if (this._pieInstance) {
        this._pieInstance.deactivate();
      }
    },

    /**
     * @description: 控制图例显隐
     * @param {Function} param
     * @return {*}
     */
    setLegendChecked(param) {
      if (this._pieInstance) {
        return this._pieInstance.setLegendChecked(param);
      }

      return undefined;
    },

    /**
     * @description: 获取底层 Pie 实例
     * @return {*}
     */
    getInstance() {
      return this._pieInstance;
    },
  },
};
