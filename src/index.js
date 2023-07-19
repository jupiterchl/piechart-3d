import './index.scss';
import Pie from './plugin';

function init() {
  const options = {
    debug: false,
    data: [16406.8, 50256, 15752, 19467.6, 112249.6, 18601.6],
    innerRadius: 0,
    outerRadius: 100,
    cornerRadius: 0,
    padAngle: 0,
    height: 20,
    activeAnimation: {
      duration: 0.25,
      heightScale: 2,
    },
    label: {
      show: true,
      position: 0.75,
      render({ percent, color }) {
        const div = document.createElement('div');
        div.innerText = Number((percent * 100).toFixed(2)) + '%';
        div.style.background = color;
        return div;
      },
    },
    autoplay: 2,
    on: {
      mouseenter(e) {
        console.log('mouseenter', e);
      },
      mouseleave(e) {
        console.log('mouseleave', e);
      },
      active(e) {
        console.log('active', e);
      },
    },
  };

  let pie = null;

  pie = new Pie('.chart', options);

  console.log('pie', pie);

  document.getElementById('mount').addEventListener(
    'click',
    () => {
      pie?.dispose();
      pie = new Pie('.chart', options);
      console.log('pie', pie);
    },
    false
  );

  document.getElementById('dispose').addEventListener(
    'click',
    () => {
      pie?.dispose();
    },
    false
  );

  const legendHandler = (e) => {
    const index = Number(e.target.getAttribute('data-idx')) - 1;

    switch (e.type) {
      case 'mouseenter':
        pie?.activate(index);
        break;
      case 'mouseleave':
        pie?.deactivate();
        break;
    }
  };

  const legendEl = document.getElementById('legend');

  legendEl.addEventListener(
    'click',
    (e) => {
      if (e.target.nodeName === 'INPUT') {
        const checked = e.target.checked;
        const index = Number(e.target.id[1]) - 1;

        pie?.setLegendChecked((legends) => {
          legends[index] = checked;
          return legends;
        });
      }
    },
    false
  );
  // [...legendEl.querySelectorAll('div')].forEach((el) => {
  //   el.addEventListener('mouseenter', legendHandler, false);
  //   el.addEventListener('mouseleave', legendHandler, false);
  // });
}

init();
