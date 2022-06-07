/* eslint-disable no-invalid-this */
import * as d3 from 'd3';
import cloneDeep from 'lodash.clonedeep';
import debounce from 'lodash.debounce';

function lg(...args) {
  args.forEach((arg) => {
    if (['[object Object]', '[object Array]'].indexOf(Object.prototype.toString.call(arg)) > -1) {
      console.log(JSON.stringify(arg, null, 2));
    } else {
      console.log(arg);
    }
  });
}

const defultOptions = {
  stroke: null,
  fill: null,
};

const config = {
  pieTransition: () => d3.transition().duration(500), // 饼图渐变
  activeTransition: () => d3.transition().duration(250), // 激活块渐变
};

class Pie {
  constructor(el) {
    this.el = el;

    this.startData = null; // 起始数据
    this.endData = null; // 结束数据
    this.currentData = null; // 当前数据（在起始数据和结束数据之间渐变）

    this.data = null; // 绘制实际使用的数据（基于当前数据计算后的数据）

    this.setOptionDebounce = debounce(this.setOption, 200, { leading: true }); // setOption防抖
  }

  setOption(options) {
    this._options = options;
    this.options = { ...defultOptions, ...options };
    this.initData();
    this.draw();
  }

  initData() {
    if (this.currentData) {
      // 起始数据等于当前数据，而不是结束数据（因为渐变可能会中断）
      this.startData = this.currentData;
    } else {
      // 创建空数据
      const emptyData = this.options.data.map((v) => ({ ...v, value: 0 }));
      this.startData = this.dataToPie(emptyData);
    }

    this.endData = this.dataToPie(this.options.data);

    // lg('startData: ', this.startData.map((v) => v.custom.height).join());
    // lg('endData: ', this.endData.map((v) => v.custom.height).join());
  }

  dataToPie(data) {
    const { radius, height, tilt } = this.options;
    let pieData = d3
      .pie()
      .sort(null)
      .value((v) => v.value)(data);

    // 添加自定义属性，参与渐变
    pieData.forEach((d) => {
      d.custom = { radius, height: d.data.active ? height + 40 : height, tilt };
    });

    return pieData;
  }

  draw() {
    const node = d3.select(this.el);
    this.root = node.select('.rootGroup');

    if (this.root.empty()) {
      // 清空子节点
      node.html('');

      // 添加svg子节点
      const svg = node.append('svg').attr('width', '100%').attr('height', '100%');
      const { width, height } = svg.node().getBoundingClientRect();

      // 添加一个居中的根分组，并作为后续绘制的根节点
      this.root = svg
        .append('g')
        .attr('class', 'rootGroup')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
    }

    const time = Date.now();

    this.root
      .interrupt()
      .transition(config.pieTransition())
      .tween('tw', () => {
        // 在开始数据和结束数据之间创建插值
        const i = d3.interpolate(this.startData, this.endData);

        return (t) => {
          // 更新当前数据
          this.currentData = i(t);
          // lg(`currentData ${time}: `, this.currentData.map((v) => v.custom.height).join());

          // 基于当前数据创建绘制所需数据
          this.genData(this.currentData);

          // 绘制
          // this.drawPoints();
          this.drawPies();
        };
      });
  }

  genData(data) {
    const { height: initHeight, colors } = this.options;
    const { radius, tilt } = data[0].custom;
    const zoom = { x: 1, y: (90 - tilt) / 90 };
    const heightZoom = Math.sin((tilt * Math.PI) / 180);
    const offsetY = 0 && (initHeight * heightZoom) / 2;
    const r = radius.map((v) => ({ x: v * zoom.x, y: v * zoom.y }));

    let _data = data;

    const sum = _data.reduce((s, b) => s + b.value, 0);

    _data.forEach((d, i) => {
      d.options = {
        offsetY, // 底面Y轴偏移量
        // height: height * heightZoom * (1 + d.value / sum), // 高度
        height: d.custom.height * heightZoom, // 高度
        color: colors[i % colors.length], // 颜色
        // 内圈
        inner: {
          radius: r[0],
          startPoint: {
            x: r[0].x * Math.cos(d.startAngle),
            y: r[0].y * Math.sin(d.startAngle) + offsetY,
          },
          endPoint: {
            x: r[0].x * Math.cos(d.endAngle),
            y: r[0].y * Math.sin(d.endAngle) + offsetY,
          },
        },
        // 外圈
        outer: {
          radius: r[1],
          startPoint: {
            x: r[1].x * Math.cos(d.startAngle),
            y: r[1].y * Math.sin(d.startAngle) + offsetY,
          },
          endPoint: {
            x: r[1].x * Math.cos(d.endAngle),
            y: r[1].y * Math.sin(d.endAngle) + offsetY,
          },
        },
      };
    });

    // lg(_data);

    this.data = _data;
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

  genShapes() {
    const shapes = this.data.reduce((s, d) => {
      const {
        startAngle,
        endAngle,
        options: { height, inner, outer },
      } = d;
      const slices = this.dataSlice(d);

      // 起点位于左半边，则需要绘制起始侧面
      if (startAngle > Math.PI / 2 && startAngle < (3 * Math.PI) / 2) {
        const _d = slices[0];
        const zIndex = this.calcZIndex(_d.startAngle, _d.endAngle);
        const startSide = [
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

        if (startAngle >= Math.PI) {
          s.push({ type: 'backSide', d, path: startSide, zIndex });
        } else {
          s.push({ type: 'frontSide', d, path: startSide, zIndex });
        }
      }

      // 终点位于右半边，则需要绘制结尾侧面
      if (endAngle < Math.PI / 2 || endAngle > (3 * Math.PI) / 2) {
        const _d = slices[slices.length - 1];
        const zIndex = this.calcZIndex(_d.startAngle, _d.endAngle);
        const endSide = [
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

        if (endAngle >= Math.PI) {
          s.push({ type: 'backSide', d, path: endSide, zIndex });
        } else {
          s.push({ type: 'frontSide', d, path: endSide, zIndex });
        }
      }

      // 绘制内外圈和顶面时需要考虑左右边界进行切割
      slices.forEach((_d) => {
        const {
          startAngle: startAngleW,
          endAngle: endAngleW,
          options: { height: heightW, inner: innerW, outer: outerW },
        } = d;
        const {
          startAngle,
          endAngle,
          options: { height, inner, outer },
        } = _d;

        const zIndex = this.calcZIndex(startAngle, endAngle);

        // 位于上半边，则需要绘制内圈
        if (startAngle >= Math.PI) {
          const innerSide = [
            'M',
            inner.startPoint.x,
            inner.startPoint.y,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            this.checkArcFlag(startAngle, endAngle),
            1,
            inner.endPoint.x,
            inner.endPoint.y,
            'v',
            -height,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            this.checkArcFlag(startAngle, endAngle),
            0,
            inner.startPoint.x,
            inner.startPoint.y - height,
            'z',
          ];

          s.push({ type: 'innerSide', d, path: innerSide, zIndex });

          // 后顶面绘制完整，以解决接缝处可能出现的白线问题
          const backTop = [
            'M',
            innerW.startPoint.x,
            innerW.startPoint.y - heightW,
            'A',
            innerW.radius.x,
            innerW.radius.y,
            0,
            this.checkArcFlag(startAngleW, endAngleW),
            1,
            innerW.endPoint.x,
            innerW.endPoint.y - heightW,
            'L',
            outerW.endPoint.x,
            outerW.endPoint.y - heightW,
            'A',
            outerW.radius.x,
            outerW.radius.y,
            0,
            this.checkArcFlag(startAngleW, endAngleW),
            0,
            outerW.startPoint.x,
            outerW.startPoint.y - heightW,
            'z',
          ];

          s.push({ type: 'backTop', d, path: backTop, zIndex });
        }

        // 位于下半边，则需要绘制外圈
        if (endAngle <= Math.PI) {
          const outerSide = [
            'M',
            outer.startPoint.x,
            outer.startPoint.y,
            'A',
            outer.radius.x,
            outer.radius.y,
            0,
            this.checkArcFlag(startAngle, endAngle),
            1,
            outer.endPoint.x,
            outer.endPoint.y,
            'v',
            -height,
            'A',
            outer.radius.x,
            outer.radius.y,
            0,
            this.checkArcFlag(startAngle, endAngle),
            0,
            outer.startPoint.x,
            outer.startPoint.y - height,
            'z',
          ];

          s.push({ type: 'outerSide', d, path: outerSide, zIndex });

          const frontTop = [
            'M',
            inner.startPoint.x,
            inner.startPoint.y - height,
            'A',
            inner.radius.x,
            inner.radius.y,
            0,
            this.checkArcFlag(startAngle, endAngle),
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
            this.checkArcFlag(startAngle, endAngle),
            0,
            outer.startPoint.x,
            outer.startPoint.y - height,
            'z',
          ];

          s.push({ type: 'frontTop', d, path: frontTop, zIndex });
        }
      });

      return s;
    }, []);

    // 按优先级zIndex排序
    const _shapes = shapes.sort((a, b) => (a.zIndex > b.zIndex ? 1 : a.zIndex < b.zIndex ? -1 : 0));

    return _shapes;
  }

  /**
   * @description: 绘制饼图
   * @return {*}
   */
  drawPies() {
    const { stroke, fill } = this.options;
    let pieGroup = this.root.select('.pieGroup');

    if (pieGroup.empty()) {
      pieGroup = this.root.append('g').attr('class', 'pieGroup');
    }

    const path = pieGroup.selectAll('path').data(this.genShapes());

    // 删除多余并移除所有事件
    path.exit().remove().on('.', null);

    // 新增与合并
    path
      // 新增
      .enter()
      .append('path')
      .on('mouseenter', this.handleMouseEnter.bind(this))
      .on('mouseleave', this.handleMouseLeave.bind(this))
      // 合并
      .merge(path)
      .attr('stroke', (p) => {
        if (p.type === 'frontTop') return 'transparent';

        let color = d3.color(p.d.options.color);
        if (typeof stroke === 'function') {
          return stroke(color, p.d);
        }
        return color;
      })
      // .attr('stroke', 'transparent')
      // .attr('stroke-width', 0)
      .attr('fill', (p) => {
        let color = d3.color(p.d.options.color);
        if (typeof fill === 'function') {
          return fill(color, p.d, p.type);
        }
        if (/top$/i.test(p.type)) {
          return color.darker(0.1);
        } else {
          return color.darker(0.75);
        }
      })
      .attr('d', (p) => p.path.join(' '))
      .attr('ss', (p) => p.zIndex);
  }

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
   * @description: 边数据分割
   * @param {*} d
   * @return {*}
   */
  dataSlice(d) {
    const {
      startAngle,
      endAngle,
      options: { offsetY },
    } = d;

    // 跨右边界
    if (startAngle > endAngle) {
      let back = cloneDeep(d);
      let front = cloneDeep(d);

      back.endAngle = Math.PI * 2;
      front.startAngle = 0;
      ['inner', 'outer'].forEach((t) => {
        back.options[t].endPoint = front.options[t].startPoint = {
          x: d.options[t].radius.x,
          y: offsetY,
        };
      });

      return this.dataSlice(front).concat(this.dataSlice(back));
    }

    // 跨左边界
    if (startAngle < Math.PI && endAngle > Math.PI) {
      let front = cloneDeep(d);
      let back = cloneDeep(d);

      front.endAngle = back.startAngle = Math.PI;
      ['inner', 'outer'].forEach((t) => {
        front.options[t].endPoint = back.options[t].startPoint = {
          x: -d.options[t].radius.x,
          y: offsetY,
        };
      });

      return this.dataSlice(front).concat(this.dataSlice(back));
    }

    return [d];
  }

  /**
   * @description: 检测绘制弧度大小
   * @param {*} startAngle
   * @param {*} endAngle
   * @return {*}
   */
  checkArcFlag(startAngle, endAngle) {
    let offsetAngle = endAngle - startAngle;

    if (offsetAngle < 0) {
      offsetAngle += Math.PI * 2;
    }

    return offsetAngle > Math.PI ? 1 : 0;
  }

  /**
   * @description: 计算区块的层级，根据外圈Y轴中值来确定，过上下中线的优先级分别为最小和最大
   * @param {*} startAngle
   * @param {*} endAngle
   * @return {*}
   */
  calcZIndex(startAngle, endAngle) {
    // 过下中线优先级最高
    if (startAngle < Math.PI / 2 && endAngle > Math.PI / 2) {
      return Infinity;
    }
    // 过上中线优先级最低
    if (startAngle < (Math.PI * 3) / 2 && endAngle > (Math.PI * 3) / 2) {
      return -Infinity;
    }

    let avg = (startAngle + endAngle) / 2;

    if (avg >= 0 && avg <= Math.PI / 2) {
      avg += 2 * Math.PI;
    }

    return Math.abs((Math.PI * 3) / 2 - avg) * 10000;
  }
}

export default {
  init(el) {
    return new Pie(el);
  },
};
