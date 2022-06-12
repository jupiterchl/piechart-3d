/* eslint-disable no-invalid-this */
import * as d3 from 'd3';
import cloneDeep from 'lodash.clonedeep';
import debounce from 'lodash.debounce';
import { lg, numFixed, checkArcFlag, calcZIndex, adjustAngle, compare } from './libs/utils';

const defultOptions = {
  stroke: null, // 绘制线条样式
  fill: null, // 绘制填充样式
  activeStyle: 1, // 激活样式（1->升高; 2->平移）
  activeOffset: 40, // 激活偏移量
  angleOffset: 0, // 弧度偏移（用于调整起始绘制角度）
  textPosRatio: 0.5, // 文本位置比例
  textPrecision: 0, // 文本数值精度
};

const config = {
  pieTransition: () => d3.transition().duration(500), // 饼图渐变
  activeTransition: () => d3.transition().duration(250), // 激活块渐变
};

class Pie {
  constructor(el) {
    this.el = el;

    this.size = { w: 0, h: 0 }; // svg尺寸

    this.startData = null; // 渐变起始数据
    this.endData = null; // 渐变结束数据
    this.currentData = null; // 渐变当前数据（在起始数据和结束数据之间渐变）

    this.drawData = null; // 绘制实际使用的数据（基于当前数据计算后的数据）

    this.updateOptionsDebounce = debounce(this.updateOptions, 200, { leading: true }); // 防抖
  }

  /**
   * @description: 设置参数
   * @param {*} options
   * @return {*}
   */
  setOption(options) {
    this._options = cloneDeep(options); // 缓存原始options
    this.updateOptionsDebounce();
  }

  /**
   * @description: 配置更新
   * @return {*}
   */
  updateOptions() {
    this.options = { ...defultOptions, ...this._options };
    this.initData();
    this.draw();
  }

  /**
   * @description: 数据初始化
   * @return {*}
   */
  initData() {
    if (this.currentData && this.currentData.length === this.options.data.length) {
      // 如果当前数据存在且数据项没变，则起始数据等于当前数据
      this.startData = this.currentData;
    } else {
      // 创建空数据
      const emptyData = this.options.data.map((v) => ({ ...v, value: 0 }));
      this.startData = this.genTrantitionData(emptyData);
    }

    this.endData = this.genTrantitionData(this.options.data);

    // lg('startData: ', this.startData);
    // lg('endData: ', this.endData);
  }

  /**
   * @description: 基于数据和初始配置生成需要参与渐变的数据
   * @return {*}
   */
  genTrantitionData(data) {
    const opts = this.options;
    const pieData = d3
      .pie()
      .sort(null)
      .value((v) => v.value)(data);

    return pieData.map((v, i) => {
      let d = {
        startAngle: v.startAngle,
        endAngle: v.endAngle,
        value: v.value,
        radius: opts.radius,
        height: opts.height,
        offsetY: opts.height / 2,
        tilt: opts.tilt,
        translate: 0,
      };

      // 处理激活块数据变化
      if (opts.data[i].active) {
        if (opts.activeStyle === 1) {
          // 样式一：激活块高度升高
          d.height += opts.activeOffset;
        } else if (opts.activeStyle === 2) {
          // 样式二：激活块相对中心平移
          d.translate = opts.activeOffset;
        }
      }

      return d;
    });
  }

  /**
   * @description: 绘制
   * @return {*}
   */
  draw() {
    const node = d3.select(this.el);
    this.root = node.select('.rootGroup');

    if (this.root.empty()) {
      // 清空子节点
      node.html('');

      // 添加svg子节点
      const svg = node.append('svg').attr('width', '100%').attr('height', '100%');
      const { width, height } = svg.node().getBoundingClientRect();

      // 保存svg尺寸
      this.size.w = width;
      this.size.h = height;

      // 添加一个居中的根分组，并作为后续绘制的根节点
      this.root = svg
        .append('g')
        .attr('class', 'rootGroup')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
    }

    this.root
      .interrupt() // 中断未结束的渐变
      .transition(config.pieTransition()) // 开始新的渐变
      .tween('pieTransition', () => {
        // 在开始数据和结束数据之间创建插值
        const i = d3.interpolate(this.startData, this.endData);

        return (t) => {
          // 更新当前数据
          this.currentData = i(t);

          // 基于当前数据创建绘制所需数据
          this.genDrawData(this.currentData);

          // 绘制饼图
          this.drawPies();

          // 绘制图例（图例不参与渐变）
          this.drawLegends();
        };
      });
  }

  /**
   * @description: 生成绘制数据
   * @param {*} data
   * @return {*}
   */
  genDrawData(data) {
    const { colors, data: originData, angleOffset, textPosRatio, textPrecision } = this.options; // 取基本配置
    const { radius, tilt, offsetY } = data[0]; // 取渐变的公共配置

    const heightZoom = Math.sin((tilt * Math.PI) / 180); // 根据倾角计算高度缩放

    const radiusZoom = Math.cos((tilt * Math.PI) / 180); // 根据倾角计算半径缩放
    const r = radius.map((r) => ({ x: r, y: r * radiusZoom })); // 计算实际的绘制半径

    const sum = originData.reduce((s, a) => s + a.value, 0); // 数据之和（用于计算分区占比）

    this.drawData = data.map((d, i) => {
      let _d = {
        index: i,
        hidden: originData[i].hidden,
        startAngle: adjustAngle(d.startAngle, angleOffset, -1), // 矫正的起始角度
        endAngle: adjustAngle(d.endAngle, angleOffset, -1), // 矫正的结束角度
        offsetY: offsetY * heightZoom, // 底面Y轴偏移量（对称绘制时为高度一半）
        color: colors[i % colors.length], // 区块颜色
        height: d.height * heightZoom, // 区块高度
        origin: originData[i], // 原始数据
      };

      // 计算区块中线位置
      _d.middleAngle = 0;

      if (compare(-1, _d.endAngle, _d.startAngle)) {
        // 跨右边界
        _d.middleAngle = adjustAngle((_d.startAngle + _d.endAngle) / 2 + Math.PI, 0, 0);
      } else {
        // 普通情况
        _d.middleAngle = (_d.startAngle + _d.endAngle) / 2;
      }

      // 根据中线计算文本显示中心点位置
      const midSin = Math.sin(_d.middleAngle);
      const midCos = Math.cos(_d.middleAngle);
      const textX = r[0].x * midCos + (r[1].x * midCos - r[0].x * midCos) * textPosRatio;
      const textY = r[0].y * midSin + (r[1].y * midSin - r[0].y * midSin) * textPosRatio + _d.offsetY - _d.height;

      // 文本参数
      _d.text = {
        data: {
          sum: numFixed(sum, textPrecision),
          value: numFixed(originData[i].value, textPrecision),
          percent: numFixed(originData[i].value / sum, textPrecision + 2),
          realtimeValue: numFixed(d.value, textPrecision),
          realtimePercent: numFixed(d.value / sum, textPrecision + 2),
        },
        x: textX,
        y: textY,
      };

      // 内圈参数
      _d.inner = {
        radius: r[0],
        startPoint: {
          x: r[0].x * Math.cos(_d.startAngle),
          y: r[0].y * Math.sin(_d.startAngle) + _d.offsetY,
        },
        middlePoint: {
          x: r[0].x * Math.cos(_d.middleAngle),
          y: r[0].y * Math.sin(_d.middleAngle) + _d.offsetY,
        },
        endPoint: {
          x: r[0].x * Math.cos(_d.endAngle),
          y: r[0].y * Math.sin(_d.endAngle) + _d.offsetY,
        },
      };

      // 外圈参数
      _d.outer = {
        radius: r[1],
        startPoint: {
          x: r[1].x * Math.cos(_d.startAngle),
          y: r[1].y * Math.sin(_d.startAngle) + _d.offsetY,
        },
        middlePoint: {
          x: r[1].x * Math.cos(_d.middleAngle),
          y: r[1].y * Math.sin(_d.middleAngle) + _d.offsetY,
        },
        endPoint: {
          x: r[1].x * Math.cos(_d.endAngle),
          y: r[1].y * Math.sin(_d.endAngle) + _d.offsetY,
        },
      };

      return _d;
    });
  }

  /**
   * @description: 生成shape数据
   * @return {*}
   */
  genShapes() {
    const shapes = this.drawData.reduce((s, d) => {
      if (d.hidden) return s;

      const slices = this.dataSlice(d);

      const groups = slices.map((_d, i) => {
        const { startAngle, endAngle, height, inner, outer } = _d;
        const zIndex = calcZIndex(startAngle, endAngle); // 区块层级

        let group = { zIndex, data: [] }; // 创建区块分组

        // 起点位于左半边且为第一切片，则需要绘制起始侧面
        if (compare(1, startAngle, Math.PI / 2) && compare(-1, startAngle, (3 * Math.PI) / 2) && i === 0) {
          const path = [
            'M',
            inner.startPoint.x,
            inner.startPoint.y,
            'L',
            outer.startPoint.x,
            outer.startPoint.y,
            'v',
            -height,
            'L',
            inner.startPoint.x,
            inner.startPoint.y - height,
            'z',
          ];

          group.data.push({ type: 'path', name: 'startSide', d: _d, data: path.join(' ') });
        }

        // 终点位于右半边且为最后切片，则需要绘制结尾侧面
        if (
          (compare(-1, endAngle, Math.PI / 2) || compare(1, endAngle, (3 * Math.PI) / 2)) &&
          i === slices.length - 1
        ) {
          const path = [
            'M',
            inner.endPoint.x,
            inner.endPoint.y,
            'L',
            outer.endPoint.x,
            outer.endPoint.y,
            'v',
            -height,
            'L',
            inner.endPoint.x,
            inner.endPoint.y - height,
            'z',
          ];

          group.data.push({ type: 'path', name: 'endSide', d: _d, data: path.join(' ') });
        }

        // 位于上半边，则需要绘制内圈
        if (startAngle >= Math.PI) {
          const path = [
            'M',
            inner.startPoint.x,
            inner.startPoint.y,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            1,
            inner.endPoint.x,
            inner.endPoint.y,
            'v',
            -height,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            0,
            inner.startPoint.x,
            inner.startPoint.y - height,
            'z',
          ];

          // 内圈层级低，可以被侧面和顶面覆盖
          group.data.unshift({ type: 'path', name: 'innerSide', d: _d, data: path.join(' ') });

          // 后顶面绘制完整，以解决接缝处可能出现的白线问题
          const path2 = [
            'M',
            d.inner.startPoint.x,
            d.inner.startPoint.y - d.height,
            'A',
            d.inner.radius.x,
            d.inner.radius.y,
            0,
            checkArcFlag(d.startAngle, d.middleAngle),
            1,
            d.inner.middlePoint.x,
            d.inner.middlePoint.y - d.height,
            'A',
            d.inner.radius.x,
            d.inner.radius.y,
            0,
            checkArcFlag(d.middleAngle, d.endAngle),
            1,
            d.inner.endPoint.x,
            d.inner.endPoint.y - d.height,
            'L',
            d.outer.endPoint.x,
            d.outer.endPoint.y - d.height,
            'A',
            d.outer.radius.x,
            d.outer.radius.y,
            0,
            checkArcFlag(d.middleAngle, d.endAngle),
            0,
            d.outer.middlePoint.x,
            d.outer.middlePoint.y - d.height,
            'A',
            d.outer.radius.x,
            d.outer.radius.y,
            0,
            checkArcFlag(d.startAngle, d.middleAngle),
            0,
            d.outer.startPoint.x,
            d.outer.startPoint.y - d.height,
            'z',
          ];

          group.data.push({ type: 'path', name: 'backTop', d: _d, data: path2.join(' ') });
        }

        // 位于下半边，则需要绘制外圈
        if (endAngle <= Math.PI) {
          const path = [
            'M',
            outer.startPoint.x,
            outer.startPoint.y,
            'A',
            outer.radius.x,
            outer.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            1,
            outer.endPoint.x,
            outer.endPoint.y,
            'v',
            -height,
            'A',
            outer.radius.x,
            outer.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            0,
            outer.startPoint.x,
            outer.startPoint.y - height,
            'z',
          ];

          group.data.push({ type: 'path', name: 'outerSide', d: _d, data: path.join(' ') });

          // 绘制前顶面，可能为一半，需要特殊标识
          const path2 = [
            'M',
            inner.startPoint.x,
            inner.startPoint.y - height,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            1,
            inner.endPoint.x,
            inner.endPoint.y - height,
            'L',
            outer.endPoint.x,
            outer.endPoint.y - height,
            'A',
            outer.radius.x,
            outer.radius.y,
            0,
            checkArcFlag(startAngle, endAngle),
            0,
            outer.startPoint.x,
            outer.startPoint.y - height,
            'z',
          ];

          group.data.push({
            type: 'path',
            name: 'frontTop',
            d: _d,
            data: path2.join(' '),
            extra: {
              i,
              len: slices.length,
            },
          });
        }

        return group;
      });

      // 文本（文本插入到层级最高的组）
      groups.sort((a, b) => (a.zIndex < b.zIndex ? 1 : -1));
      groups[0].data.push({ type: 'text', name: 'text', d: d, data: d.text });

      return s.concat(groups);
    }, []);

    // 按优先级zIndex排序
    const _shapes = shapes.sort((a, b) => (a.zIndex > b.zIndex ? 1 : -1));
    // lg('shapes', _shapes);
    return _shapes;
  }

  /**
   * @description: 绘制饼图
   * @return {*}
   */
  drawPies() {
    const { stroke, fill } = this.options;
    const shapes = this.genShapes();

    // 添加分组
    let group = this.root.selectAll('.pieGroup').data(shapes);

    // 删除多余分组
    group.exit().remove();

    // 新增与合并分组
    group = group.enter().append('g').attr('class', 'pieGroup').merge(group);

    // 添加path
    const path = group.selectAll('path').data((d) => d.data.filter((v) => v.type === 'path'));

    // 删除多余path并移除所有事件
    path.exit().remove().on('.', null);

    // 新增与合并path
    path
      .enter()
      .append('path')
      .on('mouseenter', this.handleMouseEnter.bind(this))
      .on('mouseleave', this.handleMouseLeave.bind(this))
      .merge(path)
      .attr('stroke', (s) => {
        if (s.name === 'frontTop') return 'transparent';

        let color = d3.color(s.d.color);
        if (typeof stroke === 'function') {
          return stroke(color, s.d);
        }
        return color;
      })
      .attr('fill', (s) => {
        let color = d3.color(s.d.color);
        if (typeof fill === 'function') {
          return fill(color, s.d, s.name);
        }
        if (/top$/i.test(s.name)) {
          return color.darker(0.1);
        } else {
          return color.darker(0.75);
        }
      })
      .attr('d', (p) => p.data);

    // 删除text，因为必须保证text位于分组最后面
    group.selectAll('foreignObject').remove();

    let text = group.selectAll('foreignObject').data((d) => d.data.filter((v) => v.type === 'text'));

    text = text
      .enter()
      .append('foreignObject')
      .attr('x', (s) => s.data.x)
      .attr('y', (s) => s.data.y)
      .attr('width', this.size.w)
      .attr('height', this.size.h)
      .style('transform', 'translate(-50%, -50%)')
      .style('pointer-events', 'none')
      .append('xhtml:div')
      .style('position', 'absolute')
      .style('top', '50%')
      .style('left', '50%')
      .style('transform', 'translate(-50%, -50%)');

    if (typeof this.options.textNode === 'function') {
      text.html('').append((d) => {
        return this.options.textNode({ ...d.data.data });
      });
    } else {
      text.text((d) => {
        return d.data.data.realtimeValue;
      });
    }
  }

  /**
   * @description: 绘制图例
   * @return {*}
   */
  drawLegends() {
    let legend = this.root.select('.legend');

    if (legend.empty()) {
      // 创建图例根元素
      legend = this.root.append('foreignObject').attr('class', 'legend').style('transform', 'translate(-50%, 0)');
      // 创建图例列表
      legend
        .append('xhtml:div')
        .attr('class', 'legend-list')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '50%')
        .style('transform', 'translate(-50%, 0)')
        .style('display', 'flex')
        .style('flex-wrap', 'wrap')
        .style('align-content', 'flex-start')
        .style('justify-content', 'center')
        .style('width', '100%')
        .style('height', '100%')
        .style('padding', '10px')
        .style('box-sizing', 'border-box');
    }

    const drawData = this.drawData;
    let legendItem = legend.select('.legend-list').selectAll('.legend-item').data(drawData);

    legendItem.exit().remove().on('.', null);

    if (drawData.length > 0) {
      const { offsetY, outer } = drawData[0];
      const y = offsetY + outer.radius.y;

      // 更新图例根节点尺寸、位置
      legend
        .attr('width', this.size.w)
        .attr('height', this.size.h / 2 - y)
        .attr('x', 0)
        .attr('y', y);

      // 更新图例项
      legendItem = legendItem
        .enter()
        .append('div')
        .attr('class', 'legend-item')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('margin', '4px 10px')
        .style('cursor', 'pointer')
        .on('mouseenter', this.handleLegendMouseEnter.bind(this))
        .on('mouseleave', this.handleLegendMouseLeave.bind(this))
        .on('click', this.handleLegendClick.bind(this))
        .merge(legendItem)
        .classed('inactive', (d) => d.hidden)
        .style('opacity', (d) => (d.hidden ? 0.5 : 1))
        .html('');

      legendItem
        .append('span')
        .attr('class', 'legend-tag')
        .style('display', 'inline-block')
        .style('width', '10px')
        .style('height', '10px')
        .style('margin-right', '4px')
        .style('background-color', (d) => d.color);
      legendItem
        .append('span')
        .attr('class', 'legend-label')
        .text((d) => d.origin.label);
    }
  }

  /**
   * @description: 处理图例点击
   * @param {*} e
   * @param {*} data
   * @return {*}
   */
  handleLegendClick(e, data) {
    const { index } = data;
    const item = this._options.data[index];

    if (item.hidden) {
      item.value = item._value;
      item.hidden = false;
    } else {
      item._value = item.value;
      item.value = 0;
      item.hidden = true;
    }

    this.updateOptionsDebounce();
  }

  /**
   * @description: 处理图例悬浮
   * @param {*} e
   * @param {*} data
   * @return {*}
   */
  handleLegendMouseEnter(e, data) {
    this.activePie(data.index);
  }

  handleLegendMouseLeave(e, data) {
    this.inactivePie(data.index);
  }

  /**
   * @description: 处理鼠标悬浮
   * @param {*} e
   * @param {*} data
   * @return {*}
   */
  handleMouseEnter(e, data) {
    this.leaveTimeout && clearTimeout(this.leaveTimeout);

    this.activePie(data.d.index);
  }

  handleMouseLeave(e, data) {
    // 当在同一区块不同切片上切换时，添加防抖
    this.leaveTimeout = setTimeout(() => {
      this.inactivePie(data.d.index);
    });
  }

  /**
   * @description: 激活饼图
   * @param {*} idx
   * @return {*}
   */
  activePie(idx) {
    if (this._options.data[idx].active) return;

    this._options.data.forEach((v, i) => {
      v.active = i === idx;
    });

    this.updateOptionsDebounce();
  }

  /**
   * @description: 取消激活饼图
   * @param {*} idx
   * @return {*}
   */
  inactivePie(idx) {
    if (!this._options.data[idx].active) return;

    this._options.data.forEach((v) => {
      v.active = false;
    });

    this.updateOptionsDebounce();
  }

  /**
   * @description: 数据分割
   * @param {*} d
   * @return {*}
   */
  dataSlice(d) {
    const { startAngle, endAngle, offsetY } = d;

    // 跨右边界
    if (compare(1, startAngle, endAngle)) {
      let back = cloneDeep(d);
      let front = cloneDeep(d);

      back.endAngle = Math.PI * 2;
      front.startAngle = 0;
      ['inner', 'outer'].forEach((t) => {
        back[t].endPoint = front[t].startPoint = {
          x: d[t].radius.x,
          y: offsetY,
        };
      });

      return this.dataSlice(back).concat(this.dataSlice(front));
    }

    // 跨左边界
    if (compare(-1, startAngle, Math.PI) && compare(1, endAngle, Math.PI)) {
      let front = cloneDeep(d);
      let back = cloneDeep(d);

      front.endAngle = back.startAngle = Math.PI;
      ['inner', 'outer'].forEach((t) => {
        front[t].endPoint = back[t].startPoint = {
          x: -d[t].radius.x,
          y: offsetY,
        };
      });

      return this.dataSlice(front).concat(this.dataSlice(back));
    }

    return [d];
  }
}

export default {
  init(el) {
    return new Pie(el);
  },
};
