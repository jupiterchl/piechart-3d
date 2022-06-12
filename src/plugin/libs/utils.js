/**
 * @description: 打印
 * @param {array} args
 * @return {*}
 */
export function lg(...args) {
  args.forEach((arg) => {
    if (['[object Object]', '[object Array]'].indexOf(Object.prototype.toString.call(arg)) > -1) {
      console.log(JSON.stringify(arg, null, 2));
    } else {
      console.log(arg);
    }
  });
}

/**
 * @description: 数值精度处理
 * @param {*} num
 * @param {*} precision
 * @return {*}
 */
export function numFixed(num, precision) {
  return Number(num.toFixed(precision));
}

/**
 * @description: 检测绘制弧度大小
 * @param {*} startAngle
 * @param {*} endAngle
 * @return {*}
 */
export function checkArcFlag(startAngle, endAngle) {
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
export function calcZIndex(startAngle, endAngle) {
  // 过下中线优先级最高
  if (startAngle < Math.PI / 2 && endAngle > Math.PI / 2) {
    return 99999;
  }
  // 过上中线优先级最低
  if (startAngle < (Math.PI * 3) / 2 && endAngle > (Math.PI * 3) / 2) {
    return -99999;
  }

  let avg = (startAngle + endAngle) / 2;

  if (avg >= 0 && avg <= Math.PI / 2) {
    avg += 2 * Math.PI;
  }

  return Math.abs((Math.PI * 3) / 2 - avg) * 10000;
}

/**
 * @description: 弧度矫正
 * @param {*} angle
 * @param {*} offset
 * @param {*} type 0->起点, 1->终点
 * @return {*}
 */
export function adjustAngle(angle, offset, type) {
  let _angle = angle + (offset % (Math.PI * 2));

  if (_angle < 0) {
    _angle += Math.PI * 2;
  } else if (compare(1, _angle, Math.PI * 2)) {
    _angle -= Math.PI * 2;
  }

  // 端点矫正
  if (type === 0 && compare(0, _angle, Math.PI * 2)) {
    _angle = 0;
  } else if (type === 1 && compare(0, _angle, 0)) {
    _angle = Math.PI * 2;
  }

  return _angle;
}

/**
 * @description: 高精度比较
 * @param {*} t
 * @param {*} m
 * @param {*} n
 * @return {*}
 */
export function compare(t, m, n) {
  const precision = 5;
  const _m = numFixed(m, precision);
  const _n = numFixed(n, precision);

  switch (t) {
    case 0:
      return _m === _n;
    case 1:
      return _m > _n;
    case 2:
      return _m >= _n;
    case -1:
      return _m < _n;
    case -2:
      return _m <= _n;
  }
}
