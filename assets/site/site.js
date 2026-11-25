'use strict';

function installGeometry(plate) {
  const canvas = plate.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const field = plate.querySelector('.geo-field');
  const control = plate.querySelector('input');
  const output = plate.querySelector('output');
  const tau = 2 * Math.PI;
  const nu = 92, nv = 29;
  const vertices = [];
  for (let i=0; i<nu; i++) {
    const u = tau*i/nu;
    const ring = [];
    for (let j=0; j<nv; j++) {
      const v = tau*j/nv;
      const tube = (.45+.105*Math.sin(u-.8))*(1+.09*Math.cos(3*v-u));
      const radius = 1.16+.25*Math.cos(2*u-.5)+tube*Math.cos(v);
      ring.push([radius*Math.cos(u), radius*Math.sin(u)*.91, .39*Math.sin(2*u+.4)+tube*Math.sin(v)]);
    }
    vertices.push(ring);
  }
  function draw() {
    const width = field.clientWidth, height = field.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width*ratio);
    canvas.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    const degrees = Number(control.value);
    const theta = (degrees-43)*Math.PI/180;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const scale = Math.min(width/4.0,height/2.65);
    const center = [width*.515,height*.48];
    function project(point, rotate=true) {
      const [x,y,z] = point;
      const a = rotate ? x*cos-y*sin : x;
      const b = rotate ? x*sin+y*cos : y;
      return [center[0]+scale*(.95*a+.31*b),center[1]+scale*(.195*a-.60*b-.78*z),.24*a-.74*b+.63*z];
    }
    function line(start,end,color,lw) {
      ctx.strokeStyle=color; ctx.lineWidth=lw;
      ctx.beginPath(); ctx.moveTo(start[0],start[1]); ctx.lineTo(end[0],end[1]); ctx.stroke();
    }
    // A fixed coordinate lattice makes the change of orientation visible.
    ctx.save();
    ctx.fillStyle='rgba(202,214,177,.15)';
    for (let x=10; x<width; x+=15) for (let y=9; y<height; y+=15) ctx.fillRect(x,y,.8,.8);
    for(let i=-4; i<=4; i++) {
      line(project([-1.9,i*.4,-.78],false),project([1.9,i*.4,-.78],false),'rgba(165,193,166,.14)',.65);
      line(project([i*.4,-1.7,-.78],false),project([i*.4,1.7,-.78],false),'rgba(165,193,166,.14)',.65);
    }
    const projected = vertices.map(row=>row.map(point=>project(point)));
    const faces=[];
    for (let i=0; i<nu; i++) for (let j=0; j<nv; j++) {
      const ni=(i+1)%nu, nj=(j+1)%nv;
      const pts=[projected[i][j],projected[ni][j],projected[ni][nj],projected[i][nj]];
      const depth=pts.reduce((total,p)=>total+p[2],0)/4;
      faces.push({pts,i,j,depth});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const {pts,i,j,depth} of faces) {
      const [a,b,c,d]=pts;
      const warm = Math.cos(tau*i/nu+.55) > -.17;
      const intensity = Math.min(.95,Math.max(.34,.61+depth*.19+.09*Math.sin(tau*j/nv)));
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();
      ctx.fillStyle=warm?'#394f3f':'#24483e';
      ctx.fill();
      ctx.strokeStyle=warm?'rgba(234,177,122,'+intensity+')':'rgba(181,208,184,'+intensity+')';
      ctx.lineWidth=.68; ctx.stroke();
    }
    // Three reference axes stay still as the mesh rotates.
    const axisOrigin = [width*.085, height*.79];
    const axisSize = Math.min(width,height)*.11;
    ctx.font='9px '+getComputedStyle(plate).fontFamily;ctx.fillStyle='#b8c5ac';
    for (const [dx,dy,label] of [[.98,.16,'x'],[.60,-.36,'y'],[0,-.96,'z']]){
      const end=[axisOrigin[0]+axisSize*dx,axisOrigin[1]+axisSize*dy];
      line(axisOrigin,end,'#9dac93',.8); ctx.fillText(label,end[0]+3,end[1]+2);
    }
    ctx.restore();
    output.value=degrees+'°';
    control.setAttribute('aria-valuetext',output.value);
  }
  canvas.hidden = false;
  control.disabled = false;
  draw();
  plate.querySelector('.geo-still').hidden = true;
  control.addEventListener('input',draw);
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(field);
  else window.addEventListener('resize',draw);
}

for(const plate of document.querySelectorAll('[data-geometry]')) installGeometry(plate);

const language = document.querySelector('[data-language-switch]');
if(language && location.hash){
  const target=document.getElementById(location.hash.slice(1));
  if(target) language.hash=location.hash;
}
window.addEventListener('hashchange',()=>{if(language) language.hash=location.hash;});

const sections = Array.from(document.querySelectorAll('.paper-section[id]'));
const tocLinks = Array.from(document.querySelectorAll('.contents a'));
if(sections.length){
  function markSection(){
    let current=sections[0].id;
    for(const section of sections) if(section.getBoundingClientRect().top<=100) current=section.id;
    for(const link of tocLinks){
      if(link.hash==='#'+current) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
  }
  let pending=false;
  window.addEventListener('scroll',()=>{if(!pending) {pending=true;requestAnimationFrame(()=>{markSection();pending=false;});}},{passive:true});
  markSection();
}
const copy = document.querySelector('[data-copy]');
if(copy && navigator.clipboard && window.isSecureContext){
  copy.hidden=false;
  copy.addEventListener('click',async()=>{
    const section=copy.closest('section');
    const zh=document.documentElement.lang.startsWith('zh');
    try{
      await navigator.clipboard.writeText(section.querySelector('code').textContent);
      section.querySelector('.copy-status').textContent=zh?'已复制':'Copied';
    }catch{
      section.querySelector('details').open=true;
      const range=document.createRange();range.selectNodeContents(section.querySelector('code'));
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      section.querySelector('.copy-status').textContent=zh?'已选中，可手动复制':'Selected for copying';
    }
  });
}
