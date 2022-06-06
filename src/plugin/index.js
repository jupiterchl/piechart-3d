/* eslint-disable no-invalid-this */
import * as d3 from 'd3';
import cloneDeep from 'lodash.clonedeep';

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
  }

  setOption(options) {
    this._options = options;
    this.options = { ...defultOptions, ...options };
    this.initData();
    this.draw();
  }

  initData() {
    if (this.root) {
      // 中断渐变
      this.root.interrupt();
    }

    if (this.nowData) {
      this.oldData = this.nowData;
    } else {
      // 创建空数据，以便初始渐变
      const emptyData = this.options.data.map((v) => ({ ...v, value: 0 }));
      this.oldData = this.dataToPie(emptyData);
    }

    this.nowData = this.dataToPie(this.options.data);

    // lg('data', this.oldData.map((v) => v.custom.height).join(), this.nowData.map((v) => v.custom.height).join());
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

    // const time = Date.now();

    this.root.transition(config.pieTransition()).tween('tw', () => {
      const i = d3.interpolate(this.oldData, this.nowData);
      return (t) => {
        this.nowData = i(t);
        // lg(time, this.nowData.map((v) => v.custom.height).join());
        this.genData(this.nowData);
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
    const shapes = this.data.reduce(
      (s, d) => {
        const {
          startAngle,
          endAngle,
          options: { height, inner, outer },
        } = d;

        // 起点位于左半边，则需要绘制起始侧面
        if (startAngle > Math.PI / 2 && startAngle < (3 * Math.PI) / 2) {
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
            s.backSide.push({ type: 'backSide', d, path: startSide, pos: 's' });
          } else {
            s.frontSide.push({ type: 'frontSide', d, path: startSide, pos: 's' });
          }
        }

        // 终点位于右半边，则需要绘制结尾侧面
        if (endAngle < Math.PI / 2 || endAngle > (3 * Math.PI) / 2) {
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
            s.backSide.push({ type: 'backSide', d, path: endSide, pos: 'e' });
          } else {
            s.frontSide.push({ type: 'frontSide', d, path: endSide, pos: 'e' });
          }
        }

        // 绘制边时需要考虑左右边界进行切割
        this.dataSlice(d).forEach((d) => {
          const {
            startAngle,
            endAngle,
            options: { height, inner, outer },
          } = d;

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

            s.innerSide.push({ type: 'innerSide', d, path: innerSide });

            const backTop = [
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

            s.backTop.push({ type: 'backTop', d, path: backTop });
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

            s.outerSide.push({ type: 'outerSide', d, path: outerSide });

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

            s.frontTop.push({ type: 'frontTop', d, path: frontTop });
          }
        });

        return s;
      },
      { backSide: [], backTop: [], innerSide: [], frontSide: [], outerSide: [], frontTop: [] }
    );

    // 前后侧面按Y轴排序
    [shapes.backSide, shapes.frontSide].forEach((v) => {
      v.sort(
        (a, b) =>
          a.d.options.inner[a.pos === 's' ? 'startPoint' : 'endPoint'].y -
          b.d.options.inner[b.pos === 's' ? 'startPoint' : 'endPoint'].y
      );
    });

    // 顶面按高度排序
    [shapes.backTop, shapes.frontTop].forEach((v) => {
      v.sort((a, b) => a.d.options.height - b.d.options.height);
    });

    const compareFn = (v) => {
      if (/side$/i.test(v.type)) {
        return v.d.options.inner[v.pos === 's' ? 'startPoint' : 'endPoint'].y;
      }
      return (v.d.options.inner.startPoint.y + v.d.options.inner.endPoint.y) / 2;
    };

    const backSlices = [...shapes.backSide, ...shapes.backTop].sort((a, b) => {
      return compareFn(a) - compareFn(b);
    });

    // 类型优先级由低到高依次为：后侧面、后顶面、内圈、前侧面、前顶面、外圈
    const _shapes = [...backSlices, ...shapes.innerSide, ...shapes.frontSide, ...shapes.frontTop, ...shapes.outerSide];

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
      .attr('d', (p) => p.path.join(' '));
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

    this.setOption(options);
  }

  handleMouseLeave(e, data) {
    this.leaveTimeout = setTimeout(() => {
      const idx = Math.round(data.d.index);
      if (!this._options.data[idx].active) return;

      console.log('leave', idx, data);

      let options = { ...this._options };

      options.data.forEach((v, i) => {
        v.active = false;
      });

      this.setOption(options);
    }, 50);
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

      return this.dataSlice(back).concat(this.dataSlice(front));
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

      return this.dataSlice(back).concat(this.dataSlice(front));
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
}

export default {
  init(el) {
    return new Pie(el);
  },
};
