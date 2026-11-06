import { h, render } from 'vue';
import Pie from '../plugin';

const EVENTS = ['mouseenter', 'mouseleave', 'active'];

// 组件实例与 Pie 实例的映射，避免往 Vue 实例上挂内部字段
const pieInstances = new WeakMap();
const recreatePending = new WeakSet();
// 插槽渲染出的 DOM 根，按「组件 + 标签下标」管理，标签重建时卸载旧的
const labelMounts = new WeakMap();
const centerMounts = new WeakMap();

/**
 * @description: 卸载组件下的所有插槽渲染根
 * @param {Object} component
 * @return {*}
 */
function destroyMounts(component) {
  const mounts = labelMounts.get(component);

  if (mounts) {
    mounts.forEach((destroy) => destroy());
    mounts.clear();
    labelMounts.delete(component);
  }

  const destroyCenter = centerMounts.get(component);

  if (destroyCenter) {
    destroyCenter();
    centerMounts.delete(component);
  }
}

/**
 * @description: Vue 3 组件，参数与 Pie 实例配置一致
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

  emits: EVENTS,

  render() {
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

  beforeUnmount() {
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
      if (pieInstances.has(this) || !this.$el || !this.options) return;

      const { on, label, centerLabel, ...rest } = this.options;
      const listeners = { ...on };
      const pieOptions = { ...rest, label: this.createLabelOptions(label) };

      if (centerLabel || this.$slots.center) {
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
      pieInstances.set(this, new Pie(this.$el, pieOptions));
    },

    /**
     * @description: 把 #label 插槽包装成 label.render
     * @param {Object} label
     * @return {Object}
     */
    createLabelOptions(label) {
      const nextLabel = { ...label };

      if (!this.$slots.label) return nextLabel;

      if (nextLabel.show === undefined) nextLabel.show = true;

      let mounts = labelMounts.get(this);

      if (!mounts) {
        mounts = new Map();
        labelMounts.set(this, mounts);
      }

      const component = this;

      nextLabel.render = (params) => {
        const index = params.index ?? 0;
        const prev = mounts.get(index);

        if (prev) prev();

        // 每次标签内容变化都重新渲染，保证插槽依赖的父组件状态同步
        const container = document.createElement('div');
        const LabelContent = {
          name: 'PieChart3dLabelContent',
          props: { params: { type: Object, required: true } },
          render() {
            const slot = component.$slots.label;

            return slot ? h('div', { class: 'piechart-3d__label' }, slot(this.params)) : null;
          },
        };

        render(h(LabelContent, { params }), container);
        mounts.set(index, () => render(null, container));

        // 返回渲染容器，卸载时对同一个容器执行 render(null) 即可
        return container;
      };

      return nextLabel;
    },

    /**
     * @description: 把 #center 插槽包装成 centerLabel.render
     * @param {Object} centerLabel
     * @return {Object}
     */
    createCenterLabelOptions(centerLabel) {
      const nextCenterLabel = { ...centerLabel };

      if (!this.$slots.center) return nextCenterLabel;

      if (nextCenterLabel.show === undefined) nextCenterLabel.show = true;

      const component = this;

      nextCenterLabel.render = (params) => {
        const prev = centerMounts.get(this);

        if (prev) prev();

        const container = document.createElement('div');
        const CenterContent = {
          name: 'PieChart3dCenterContent',
          props: { params: { type: Object, required: true } },
          render() {
            const slot = component.$slots.center;

            return slot ? h('div', { class: 'piechart-3d__center' }, slot(this.params)) : null;
          },
        };

        render(h(CenterContent, { params }), container);
        centerMounts.set(this, () => render(null, container));

        return container;
      };

      return nextCenterLabel;
    },

    destroyChart() {
      const pie = pieInstances.get(this);

      if (pie) {
        pie.dispose();
        pieInstances.delete(this);
      }

      destroyMounts(this);
      recreatePending.delete(this);
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
      if (recreatePending.has(this)) return;

      recreatePending.add(this);
      this.$nextTick(() => {
        recreatePending.delete(this);
        this.recreateChart();
      });
    },

    /**
     * @description: 激活指定切片
     * @param {Number} index
     * @return {*}
     */
    activate(index) {
      pieInstances.get(this)?.activate(index);
    },

    /**
     * @description: 取消激活
     * @return {*}
     */
    deactivate() {
      pieInstances.get(this)?.deactivate();
    },

    /**
     * @description: 控制图例显隐
     * @param {Function} param
     * @return {*}
     */
    setLegendChecked(param) {
      const pie = pieInstances.get(this);

      return pie ? pie.setLegendChecked(param) : undefined;
    },

    /**
     * @description: 获取底层 Pie 实例
     * @return {*}
     */
    getInstance() {
      return pieInstances.get(this);
    },
  },
};
