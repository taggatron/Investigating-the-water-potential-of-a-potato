// Lightweight chart without external libs
export class ResultChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = [];
    this.padding = { left:60,right:20,top:20,bottom:45 };
    this.canvas.addEventListener('mousemove', e => this._onMove(e));
    this.hoverIndex = null;
    this._render();
  }
  setData(series) {
    this.data = series.slice().sort((a,b)=>a.x-b.x);
    this._render();
  }
  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { ctx } = this;
    this.hoverIndex = null;
    for (let i=0;i<this.data.length;i++) {
      const pt = this._dataToCanvas(this.data[i]);
      if ((x-pt.x)**2 + (y-pt.y)**2 < 9*9) { this.hoverIndex = i; break; }
    }
    this._render();
  }
  _range(arr, key) {
    if (!arr.length) return [0,1];
    let min = arr[0][key]; let max=min;
    for (const a of arr){ if (a[key]<min) min=a[key]; if(a[key]>max) max=a[key]; }
    if (min===max) { min -= 1; max += 1; }
    return [min,max];
  }
  _dataToCanvas(p) {
    const [xmin,xmax]=this._range(this.data,'x');
    const [ymin,ymax]=this._range(this.data,'y');
    const w = this.canvas.width - this.padding.left - this.padding.right;
    const h = this.canvas.height - this.padding.top - this.padding.bottom;
    const x = this.padding.left + (p.x - xmin)/(xmax - xmin) * w;
    const y = this.padding.top + (ymax - p.y)/(ymax - ymin) * h;
    return { x,y };
  }
  _renderAxes(xmin,xmax,ymin,ymax) {
    const { ctx, canvas, padding } = this;
    ctx.strokeStyle = '#3b5466'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();
    ctx.fillStyle = '#9ec2d8';
    ctx.font = '12px system-ui';
    ctx.textAlign='center';
    ctx.fillText('Sucrose concentration (mol dm⁻³)', canvas.width/2, canvas.height - 10);
    ctx.save();
    ctx.translate(15, canvas.height/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('% mass change',0,0);
    ctx.restore();

    // zero line
    if (ymin<0 && ymax>0) {
      const zeroY = this._dataToCanvas({x:xmin,y:0}).y;
      ctx.strokeStyle = '#445d6f'; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(padding.left, zeroY); ctx.lineTo(canvas.width - padding.right, zeroY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#aac7d8'; ctx.textAlign='left'; ctx.fillText('0%', padding.left+4, zeroY-4);
    }

    // ticks
    ctx.fillStyle='#789db3'; ctx.textAlign='right';
    for (let i=0;i<=5;i++) {
      const v = ymin + i*(ymax-ymin)/5;
      const y = this._dataToCanvas({x:xmin,y:v}).y;
      ctx.beginPath(); ctx.moveTo(padding.left-4,y); ctx.lineTo(padding.left,y); ctx.strokeStyle='#3b5466'; ctx.stroke();
      ctx.fillText(v.toFixed(0), padding.left-6, y+3);
    }
    ctx.textAlign='center';
    for (let i=0;i<=5;i++) {
      const v = xmin + i*(xmax-xmin)/5;
      const x = this._dataToCanvas({x:v,y:ymin}).x;
      ctx.beginPath(); ctx.moveTo(x, canvas.height - padding.bottom); ctx.lineTo(x, canvas.height - padding.bottom +4); ctx.strokeStyle='#3b5466'; ctx.stroke();
      ctx.fillText(v.toFixed(2), x, canvas.height - padding.bottom +16);
    }
  }
  _render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const [xmin,xmax]=this._range(this.data,'x');
    const [ymin,ymax]=this._range(this.data,'y');
    this._renderAxes(xmin,xmax,ymin,ymax);
    // Smoothed best-fit line (LOESS) instead of dot-to-dot
    if (this.data.length>=2) {
      const curve = this._loessCurvePoints(this.data, 0.6, 160); // alpha=0.6 bandwidth, 160 samples
      if (curve.length>1) {
        ctx.strokeStyle='#2e88d6'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round';
        ctx.beginPath();
        curve.forEach((p,i)=>{ const c=this._dataToCanvas(p); if(i===0) ctx.moveTo(c.x,c.y); else ctx.lineTo(c.x,c.y); });
        ctx.stroke();
      }
    }
    // points
    this.data.forEach((p,i)=>{
      const c = this._dataToCanvas(p);
      ctx.beginPath(); ctx.arc(c.x,c.y, i===this.hoverIndex?7:5,0,Math.PI*2); ctx.fillStyle = i===this.hoverIndex? '#ffbe55':'#44b0ff'; ctx.fill();
    });
    // tooltip
    if (this.hoverIndex!=null) {
      const p = this.data[this.hoverIndex];
      const c = this._dataToCanvas(p);
      const text = `${p.x.toFixed(2)} M, ${p.y.toFixed(2)}%`;
      ctx.font='12px system-ui';
      const w = ctx.measureText(text).width + 10;
      const h = 20;
      const x = Math.min(c.x + 10, canvas.width - w - 5);
      const y = Math.max(c.y - h - 10, 5);
      ctx.fillStyle='#0e1b23'; ctx.strokeStyle='#4a6a80'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(x,y,w,h,4); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#cfe6f4'; ctx.textAlign='left'; ctx.fillText(text, x+5, y+14);
    }
  }
}

// --- LOESS smoothing helpers ---
// Returns sampled points {x,y} across [xmin,xmax] using locally weighted linear regression
ResultChart.prototype._loessCurvePoints = function(points, bandwidth=0.6, samples=160) {
  const n = points.length;
  if (n<2) return [];
  const data = points.slice().sort((a,b)=>a.x-b.x);
  const xs = data.map(p=>p.x); const ys = data.map(p=>p.y);
  const xmin = xs[0], xmax = xs[xs.length-1];
  const result = [];
  for (let i=0;i<samples;i++) {
    const xq = xmin + (i/(samples-1))*(xmax-xmin);
    const yq = _loessAt(xq, xs, ys, bandwidth);
    if (Number.isFinite(yq)) result.push({x:xq,y:yq});
  }
  return result;
};

// Compute LOESS estimate at xq using tricube weights and linear local fit
function _loessAt(xq, xs, ys, bandwidth) {
  const n = xs.length;
  const span = Math.max(2, Math.floor(bandwidth*n));
  // Find nearest span points around xq
  // Get indices sorted by distance to xq
  const idx = Array.from({length:n}, (_,i)=>i).sort((i,j)=>Math.abs(xs[i]-xq)-Math.abs(xs[j]-xq));
  const sel = idx.slice(0, span).sort((a,b)=>xs[a]-xs[b]);
  const x0 = xs[sel[0]], xk = xs[sel[sel.length-1]];
  const maxDist = Math.max(Math.abs(xq - x0), Math.abs(xq - xk)) || 1e-9;
  // Weighted linear regression y = a + b x
  let sw=0, swx=0, swy=0, swxx=0, swxy=0;
  for (const i of sel) {
    const d = Math.abs(xs[i]-xq) / maxDist;
    const w = tricube(1 - Math.min(1, d));
    const x = xs[i], y = ys[i];
    sw += w; swx += w*x; swy += w*y; swxx += w*x*x; swxy += w*x*y;
  }
  const denom = sw*swxx - swx*swx;
  if (Math.abs(denom) < 1e-12) {
    // Fallback to weighted average if ill-conditioned
    return sw ? swy/sw : NaN;
  }
  const b = (sw*swxy - swx*swy)/denom;
  const a = (swy - b*swx)/sw;
  return a + b*xq;
}

function tricube(t) {
  // t in [0,1]
  const tt = Math.max(0, Math.min(1, t));
  const v = 1 - Math.pow(tt,3);
  return Math.pow(v,3);
}

// Polyfill for roundRect for older browsers (if needed)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    if (typeof r === 'number') r = { tl:r, tr:r, br:r, bl:r };
    const { tl, tr, br, bl } = r;
    this.beginPath();
    this.moveTo(x+tl,y);
    this.lineTo(x+w-tr,y);
    this.quadraticCurveTo(x+w,y,x+w,y+tr);
    this.lineTo(x+w,y+h-br);
    this.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
    this.lineTo(x+bl,y+h);
    this.quadraticCurveTo(x,y+h,x,y+h-bl);
    this.lineTo(x,y+tl);
    this.quadraticCurveTo(x,y,x+tl,y);
    return this;
  };
}
