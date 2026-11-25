for (const figure of document.querySelectorAll('[data-demo-map]')) {
  const canvas = figure.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) continue;

  const width = canvas.width;
  const height = canvas.height;
  const zoomIn = figure.querySelector('[data-map-action="in"]');
  const zoomOut = figure.querySelector('[data-map-action="out"]');
  const levels = [0.8, 1, 1.35, 1.8, 2.4];
  let level = 1;
  let offsetX = 0;
  let offsetY = 0;
  let lastPointer = null;

  const blocks = [
    [-140,-105,82,53], [-40,-105,67,53], [46,-105,71,53], [133,-105,83,53],
    [-140,-34,82,47], [-40,-34,67,47], [46,-34,71,47], [133,-34,83,47],
    [-140,36,82,55], [-40,36,67,55], [46,36,71,55], [133,36,83,55],
  ];
  function road(points, color, size) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.strokeStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = size;
    context.stroke();
  }

  function draw() {
    context.fillStyle = '#37363b';
    context.fillRect(0,0,width,height);
    context.save();
    context.translate(width/2 + offsetX,height/2 + offsetY);
    context.scale(levels[level],levels[level]);

    context.fillStyle = '#444348';
    context.fillRect(-440,-165,245,350);
    context.fillRect(243,36,225,133);
    for (const block of blocks) {
      context.fillStyle = '#4b4a52';
      context.fillRect(...block);
      context.strokeStyle = '#5f5e66';
      context.lineWidth = 1;
      context.strokeRect(...block);
    }

    road([[-550,-75],[-245,-75],[-160,-43],[520,-43]],'#2b2a2e',14);
    road([[-550,110],[-180,110],[-121,22],[520,22]],'#2b2a2e',19);
    road([[-50,-380],[-50,155],[-94,320]],'#2b2a2e',10);
    road([[36,-380],[36,22],[88,110],[88,320]],'#2b2a2e',13);
    road([[124,-380],[124,80],[215,320]],'#2b2a2e',11);
    road([[-550,152],[-209,152],[-137,122],[540,122]],'#706870',27);
    road([[-550,152],[-209,152],[-137,122],[540,122]],'#4f434a',12);

    context.font = '600 12px "Microsoft YaHei",sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#ede9ed';
    context.fillText('园区主路', -108, 26);
    context.fillText('研发区', 172, -75);

    context.beginPath();
    context.moveTo(0,10);
    context.lineTo(-9,-5);
    context.arc(0,-10,10,Math.PI,0);
    context.closePath();
    context.fillStyle = '#db1b2c';
    context.fill();
    context.beginPath();
    context.arc(0,-10,3,0,Math.PI*2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.restore();
    zoomIn.disabled = level === levels.length - 1;
    zoomOut.disabled = level === 0;
  }

  function changeZoom(delta) {
    level = Math.max(0, Math.min(levels.length - 1, level + delta));
    draw();
  }
  function pan(dx,dy) {
    offsetX = Math.max(-270, Math.min(270, offsetX + dx));
    offsetY = Math.max(-170, Math.min(170, offsetY + dy));
    draw();
  }

  zoomIn.addEventListener('click', () => changeZoom(1));
  zoomOut.addEventListener('click', () => changeZoom(-1));
  figure.querySelector('[data-map-action="reset"]').addEventListener('click', () => {
    [level, offsetX, offsetY] = [1, 0, 0];
    draw();
  });
  canvas.addEventListener('keydown', event => {
    const movements = {ArrowUp:[0,20],ArrowDown:[0,-20],ArrowLeft:[20,0],ArrowRight:[-20,0]};
    if (Object.hasOwn(movements,event.key)) pan(...movements[event.key]);
    else if (event.key === '+' || event.key === '=') changeZoom(1);
    else if (event.key === '-') changeZoom(-1);
    else return;
    event.preventDefault();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    lastPointer = [event.clientX,event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!lastPointer || !event.isPrimary) return;
    const ratio = width / canvas.getBoundingClientRect().width;
    pan((event.clientX - lastPointer[0]) * ratio, (event.clientY - lastPointer[1]) * ratio);
    lastPointer = [event.clientX,event.clientY];
  });
  canvas.addEventListener('lostpointercapture', () => { lastPointer = null; });

  draw();
}

