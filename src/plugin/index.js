/* eslint-disable no-invalid-this */
import * as d3 from 'd3';
import cloneDeep from 'lodash.clonedeep';
import debounce from 'lodash.debounce';
import { lg, numFixed, checkArcFlag, calcZIndex, adjustAngle } from './libs/utils';

const defultOptions = {
  stroke: null, // 绘制线条样式
  fill: null, // 绘制填充样式
  activeStyle: 1, // 激活样式（1->升高; 2->平移）
  activeOffset: 40, // 激活偏移量
  angleOffset: -Math.PI / 2, // 弧度偏移（用于调整起始绘制角度）
  textPosRatio: 0.5, // 文本位置比例
  textPrecision: 0, // 文本数值精度
};

const config = {
  pieTransition: () => d3.transition().duration(500), // 饼图渐变
  activeTransition: () => d3.transition().duration(250), // 激活块渐变
  angleOffset: -Math.PI / 2, // 弧度偏移（用于调整起始绘制角度）
};

class Pie {
  constructor(el) {
    this.el = el;

    this.size = { w: 0, h: 0 }; // svg尺寸

    this.startData = null; // 渐变起始数据
    this.endData = null; // 渐变结束数据
    this.currentData = null; // 渐变当前数据（在起始数据和结束数据之间渐变）

    this.drawData = null; // 绘制实际使用的数据（基于当前数据计算后的数据）

    this.setOptionDebounce = debounce(this.setOption, 200, { leading: true }); // setOption防抖
  }

  setOption(options) {
    this._options = options;
    this.options = { ...defultOptions, ...options };
    this.initData();
    this.draw();
  }

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

    const time = Date.now();

    this.root
      .interrupt() // 中断未结束的渐变
      .transition(config.pieTransition()) // 开始新的渐变
      .tween('pieTransition', () => {
        // 在开始数据和结束数据之间创建插值
        const i = d3.interpolate(this.startData, this.endData);

        return (t) => {
          // 更新当前数据
          this.currentData = i(t);
          // lg(`currentData ${time}: `, this.currentData.map((v) => v.common.height).join());

          // 基于当前数据创建绘制所需数据
          this.genDrawData(cloneDeep(this.currentData));

          // 绘制
          // this.drawPoints();
          this.drawPies();
          // this.drawText();
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
        startAngle: adjustAngle(d.startAngle, angleOffset, 0), // 矫正的起始角度
        endAngle: adjustAngle(d.endAngle, angleOffset, 1), // 矫正的结束角度
        offsetY: offsetY * heightZoom, // 底面Y轴偏移量（对称绘制时为高度一半）
        color: colors[i % colors.length], // 区块颜色
        height: d.height * heightZoom, // 区块高度
      };

      // 计算区块中线位置
      _d.middleAngle = 0;

      if (_d.endAngle < _d.startAngle) {
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
        endPoint: {
          x: r[1].x * Math.cos(_d.endAngle),
          y: r[1].y * Math.sin(_d.endAngle) + _d.offsetY,
        },
      };

      return _d;
    });

    // lg(this.drawData);
  }

  drawPoints() {
    const pointGroup = this.root.select('.pointGroup');

    if (pointGroup.empty()) {
      this.root.append('g').attr('class', 'pointGroup');
    } else {
      pointGroup.html('');
    }

    // 绘制中心点
    pointGroup.append('circle').attr('fill', 'red').attr('r', 6).attr('cx', 0).attr('cy', 0);
    // 绘制辅助点
    const g = pointGroup.append('g').selectAll('circle').data(this.data).enter();

    [
      { type: 'inner', color: 'green' },
      { type: 'outer', color: 'blue' },
    ].forEach((v) => {
      ['startPoint', 'endPoint'].forEach((p) => {
        for (let i = 0; i < 2; i++) {
          g.append('circle')
            .attr('fill', v.color)
            .attr('r', 4)
            .attr('cx', ({ options }) => options[v.type][p].x)
            .attr('cy', ({ options }) => options[v.type][p].y - options.height * i);
        }
      });
    });
  }

  /**
   * @description: 生成shape数据
   * @return {*}
   */
  genShapes() {
    const shapes = this.drawData.reduce((s, d) => {
      const slices = this.dataSlice(d);

      slices.forEach((_d, i) => {
        const { startAngle, endAngle, height, inner, outer } = _d;
        const zIndex = calcZIndex(startAngle, endAngle); // 区块层级

        let group = { zIndex, data: [] }; // 创建区块分组

        // 起点位于左半边且为第一切片，则需要绘制起始侧面
        if (startAngle > Math.PI / 2 && startAngle < (3 * Math.PI) / 2 && i === 0) {
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
        if ((endAngle < Math.PI / 2 || endAngle > (3 * Math.PI) / 2) && i === slices.length - 1) {
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
            checkArcFlag(d.startAngle, d.endAngle),
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
            checkArcFlag(d.startAngle, d.endAngle),
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

        // 文本
        if (d.middleAngle >= startAngle && d.middleAngle <= endAngle) {
          group.data.push({ type: 'text', name: 'text', d: _d, data: d.text });
        }

        s.push(group);
      });

      return s;
    }, []);

    // 按优先级zIndex排序
    const _shapes = shapes.sort((a, b) => (a.zIndex > b.zIndex ? 1 : -1));

    // lg(_shapes.map((v) => v.zIndex));

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
   * @description: 处理鼠标悬浮
   * @param {*} e
   * @param {*} data
   * @return {*}
   */
  handleMouseEnter(e, data) {
    this.leaveTimeout && clearTimeout(this.leaveTimeout);

    const idx = Math.round(data.d.index); // 渐变后可能会出现浮点
    if (this._options.data[idx].active) return;

    console.log('enter', idx, data);

    let options = { ...this._options };

    options.data.forEach((v, i) => {
      v.active = i === idx;
    });

    this.setOptionDebounce(options);
  }

  handleMouseLeave(e, data) {
    // 当在同一区块不同切片上切换时，添加防抖
    this.leaveTimeout = setTimeout(() => {
      const idx = Math.round(data.d.index);
      if (!this._options.data[idx].active) return;

      console.log('leave', idx, data);

      let options = { ...this._options };

      options.data.forEach((v, i) => {
        v.active = false;
      });

      this.setOptionDebounce(options);
    });
  }

  /**
   * @description: 数据分割
   * @param {*} d
   * @return {*}
   */
  dataSlice(d) {
    const { startAngle, endAngle, offsetY } = d;

    // 跨右边界
    if (startAngle > endAngle) {
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
    if (startAngle < Math.PI && endAngle > Math.PI) {
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
