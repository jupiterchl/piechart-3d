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

class Pie {
  constructor(el) {
    this.el = el;
  }

  setOption(options) {
    this.options = { ...defultOptions, ...options };
    this.initData();
    // this.drawPoints();
    // this.drawPies();
    this.draw();
    this.transitionDraw();
  }

  initData() {
    this.oldData = d3
      .pie()
      .sort(null)
      .value((v) => v.value)(this.options.data.map((v) => ({ ...v, value: 0 })));

    this.data = d3
      .pie()
      .sort(null)
      .value((v) => v.value)(this.options.data);

    // lg(this.oldData, this.data);
  }

  draw() {
    const node = d3.select(this.el);

    // 如果已经有子节点，清除所有子节点
    if (!node.empty()) {
      node.html('');
    }

    // 添加svg子节点
    const svg = node.append('svg').attr('width', '100%').attr('height', '100%');
    const { width, height } = svg.node().getBoundingClientRect();

    // 添加一个居中的分组，并作为后续绘制的根节点
    this.root = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    // 添加饼图分组
    let pieGroup = this.root.append('g').attr('class', 'pieGroup');
    const that = this;

    pieGroup
      .selectAll('.pie')
      .data(this.oldData)
      .enter()
      .append('g')
      .attr('class', 'pie')
      .each(function (d, i) {
        this.color = that.getColor(i);
      })
      .selectAll('.pieSlice')
      .data((d) => Array.from({ length: 6 }, () => d))
      .enter()
      .append('path')
      .attr('class', 'pieSlice')
      .attr('stroke', function () {
        return this.parentNode.color;
      })
      .attr('fill', function () {
        return this.parentNode.color;
      })
      .attr('d', this.drawPie.bind(this))
      .each(function (d) {
        this._d = d;
      });

    this.pieGroup = pieGroup;
  }

  transitionDraw() {
    const that = this;
    this.pieGroup
      .selectAll('.pie')
      .data(this.data)
      .selectAll('.pieSlice')
      .data((d) => Array.from({ length: 6 }, () => d))
      .transition()
      .duration(750)
      .attrTween('d', function (d, i) {
        const _d = this._d;
        const ip = d3.interpolate(_d, d);
        return (t) => {
          return that.drawPie(ip(t), i);
        };
      });
  }

  getColor(i) {
    const { colors } = this.options;
    return colors[i % colors.length];
  }

  drawPie(d, i) {
    const { radius, height, tilt } = this.options;
    const zoom = { x: 1, y: (90 - tilt) / 90 };
    const h = height * Math.sin((tilt * Math.PI) / 180);
    const offsetY = h / 2;
    const r = radius.map((v) => ({ x: v * zoom.x, y: v * zoom.y }));

    // 内圈
    const inner = {
      radius: r[0],
      startPoint: {
        x: r[0].x * Math.cos(d.startAngle),
        y: r[0].y * Math.sin(d.startAngle) + offsetY,
      },
      endPoint: {
        x: r[0].x * Math.cos(d.endAngle),
        y: r[0].y * Math.sin(d.endAngle) + offsetY,
      },
    };
    // 外圈
    const outer = {
      radius: r[1],
      startPoint: {
        x: r[1].x * Math.cos(d.startAngle),
        y: r[1].y * Math.sin(d.startAngle) + offsetY,
      },
      endPoint: {
        x: r[1].x * Math.cos(d.endAngle),
        y: r[1].y * Math.sin(d.endAngle) + offsetY,
      },
    };

    return [
      'M',
      inner.startPoint.x,
      inner.startPoint.y,
      'A',
      inner.radius.x,
      inner.radius.y,
      0,
      this.checkArcFlag(d.startAngle, d.endAngle),
      1,
      inner.endPoint.x,
      inner.endPoint.y,
      'L',
      outer.endPoint.x,
      outer.endPoint.y,
      'A',
      outer.radius.x,
      outer.radius.y,
      0,
      this.checkArcFlag(d.startAngle, d.endAngle),
      0,
      outer.startPoint.x,
      outer.startPoint.y,
      'z',
    ].join(' ');
  }

  initData2() {
    const { radius, height, tilt, colors, data } = this.options;
    const zoom = { x: 1, y: (90 - tilt) / 90 };
    const h = height * Math.sin((tilt * Math.PI) / 180);
    const offsetY = h / 2;
    const r = radius.map((v) => ({ x: v * zoom.x, y: v * zoom.y }));

    let _data = d3
      .pie()
      .sort(null)
      .value((v) => v.value)(data);

    const sum = _data.reduce((s, b) => s + b.value, 0);

    // _data.forEach((d, i) => {
    //   d.options = {
    //     offsetY, // 底面Y轴偏移量
    //     height: h, // 高度
    //     color: colors[i % colors.length], // 颜色
    //     // 内圈
    //     inner: {
    //       radius: r[0],
    //       startPoint: {
    //         x: r[0].x * Math.cos(d.startAngle),
    //         y: r[0].y * Math.sin(d.startAngle) + offsetY,
    //       },
    //       endPoint: {
    //         x: r[0].x * Math.cos(d.endAngle),
    //         y: r[0].y * Math.sin(d.endAngle) + offsetY,
    //       },
    //     },
    //     // 外圈
    //     outer: {
    //       radius: r[1],
    //       startPoint: {
    //         x: r[1].x * Math.cos(d.startAngle),
    //         y: r[1].y * Math.sin(d.startAngle) + offsetY,
    //       },
    //       endPoint: {
    //         x: r[1].x * Math.cos(d.endAngle),
    //         y: r[1].y * Math.sin(d.endAngle) + offsetY,
    //       },
    //     },
    //   };
    // });

    // lg(_data);

    this.data = _data;
  }

  draw2() {
    const svg = d3.select(this.el).append('svg').attr('width', '100%').attr('height', '100%');
    const { width, height } = svg.node().getBoundingClientRect();
    this.root = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    // this.drawPoints();
    this.drawPies();
  }

  drawPoints() {
    const pointGroup = this.root.append('g').attr('class', 'pointGroup');
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
            s.backSide.push({ type: 'backSide', d, path: startSide });
          } else {
            s.frontSide.push({ type: 'frontSide', d, path: startSide });
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
            s.backSide.push({ type: 'backSide', d, path: endSide });
          } else {
            s.frontSide.push({ type: 'frontSide', d, path: endSide });
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
          }
        });

        // 绘制顶面
        const top = [
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

        if (startAngle >= Math.PI) {
          s.backTop.push({ type: 'backTop', d, path: top });
        } else {
          s.frontTop.push({ type: 'frontTop', d, path: top });
        }

        return s;
      },
      { backSide: [], backTop: [], innerSide: [], frontSide: [], outerSide: [], frontTop: [] }
    );

    // 前后侧面按Y轴排序
    [shapes.backSide, shapes.frontSide].forEach((v) => {
      v.sort((a, b) => a.d.options.inner.startPoint.y - b.d.options.inner.startPoint.y);
    });

    // 顶面按高度排序
    [shapes.backTop, shapes.frontTop].forEach((v) => {
      v.sort((a, b) => a.d.options.height - b.d.options.height);
    });

    // 类型优先级由低到高依次为：后侧面、后顶面、内圈、前侧面、前顶面、外圈
    const _shapes = [
      ...shapes.backSide,
      ...shapes.backTop,
      ...shapes.innerSide,
      ...shapes.frontSide,
      ...shapes.frontTop,
      ...shapes.outerSide,
    ];

    return _shapes;
  }

  drawPies() {
    const { stroke, fill } = this.options;
    let pieGroup = this.root.select('.pieGroup');

    if (pieGroup.empty()) {
      pieGroup = this.root.append('g').attr('class', 'pieGroup');
    }

    pieGroup
      .selectAll('path')
      .data(this.genShapes())
      .enter()
      .append('path')
      .attr('d', (p) => p.path.join(' '))
      .attr('stroke', (p) => {
        let color = d3.color(p.d.options.color);
        if (typeof stroke === 'function') {
          return stroke(color, p.d);
        }
        return color;
      })
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
      .exit()
      .remove();
  }

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

      back.endAngle = front.startAngle = 0;
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
