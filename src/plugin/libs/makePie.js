import { arc, pie } from 'd3-shape';
import gsap from 'gsap';

/** make our pie svg and arc generators */
export default function makePie(data, { parseValue, innerRadius, outerRadius, cornerRadius, padAngle }, draw) {
  const arcs = pie()
    .sortValues(() => 0) // 设置为不排序，默认降序
    .startAngle(() => Math.PI) // 设置起点为12点钟方向，默认6点钟方向
    .endAngle(() => -Math.PI) // 设置方向为顺时针，默认逆时针
    .value(parseValue)(data);

  const arr = Array.from({ length: arcs.length }, () => 0);
  const endArray = arcs.map((v) => Math.abs(v.endAngle - v.startAngle));

  const arcGenerator = arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)
    .padAngle(padAngle);

  const onUpdate = () => {
    let curArcs = [];

    for (let i = 0, len = arcs.length; i < len; i++) {
      const arc = arcs[i];
      let startAngle;

      if (i === 0) {
        startAngle = arc.startAngle;
      } else {
        startAngle = curArcs[i - 1].endAngle;
      }

      const endAngle = startAngle - arr[i];

      curArcs.push({ ...arc, startAngle, endAngle });
    }

    const pieSvgDataUri = `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <g>
          ${curArcs.map((arcData, i) => `<path d="${arcGenerator(arcData)}" />`)}
        </g>
      </svg>
    `)}`;

    draw(pieSvgDataUri);
  };

  gsap.to(arr, {
    endArray,
    // duration: 1,
    onUpdate,
    onComplete() {
      console.log('complete');
    },
  });
}
