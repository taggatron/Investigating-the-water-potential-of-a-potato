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
    // Smoothed best-fit line using sinusoidal regression (y ≈ a sin(ωx) + b cos(ωx) + c)
    if (this.data.length>=2) {
      const curve = this._sinusoidCurvePoints(this.data, 160) || this._loessCurvePoints(this.data, 0.6, 160);
      if (curve && curve.length>1) {
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

// --- Sinusoidal regression helpers ---
// Find a, b, c and frequency w by scanning w and solving linear least squares for a,b,c.
ResultChart.prototype._sinusoidCurvePoints = function(points, samples=160){
  const n = points.length; if (n<3) return null;
  const data = points.slice().sort((a,b)=>a.x-b.x);
  const xs = data.map(p=>p.x), ys = data.map(p=>p.y);
  const xmin = xs[0], xmax = xs[xs.length-1];
  const xrange = Math.max(1e-6, xmax - xmin);
  // Frequency search space: allow up to ~1.25 oscillations across the domain
  const wMin = 0.01; // rad per unit x
  const wMax = (2*Math.PI)*1.25 / xrange; // up to ~1.25 cycles across domain
  const steps = 48;
  let best = { sse: Infinity, a:0, b:0, c:0, w:0 };
  for (let k=0;k<=steps;k++) {
    const w = wMin + (wMax - wMin) * (k/steps);
    const params = fitSinusoidFixedW(xs, ys, w);
    if (!params) continue;
    const {a,b,c} = params;
    let sse = 0;
    for (let i=0;i<n;i++){
      const yhat = a*Math.sin(w*xs[i]) + b*Math.cos(w*xs[i]) + c;
      const e = ys[i]-yhat; sse += e*e;
    }
    if (sse < best.sse) best = { sse, a, b, c, w };
  }
  if (!isFinite(best.sse) || best.sse===Infinity) return null;
  // Generate curve points
  const out=[];
  for (let i=0;i<samples;i++){
    const x = xmin + (i/(samples-1)) * (xmax-xmin);
    const y = best.a*Math.sin(best.w*x) + best.b*Math.cos(best.w*x) + best.c;
    out.push({x,y});
  }
  return out;
};

function fitSinusoidFixedW(xs, ys, w){
  const n = xs.length;
  // Build normal equation sums
  let S=0,C=0,T=n, SC=0, S1=0, C1=0, Sy=0, Cy=0, Y1=0;
  for (let i=0;i<n;i++){
    const s = Math.sin(w*xs[i]);
    const c = Math.cos(w*xs[i]);
    const y = ys[i];
    S += s*s; C += c*c; SC += s*c; S1 += s; C1 += c; Sy += s*y; Cy += c*y; Y1 += y;
  }
  // Solve 3x3 symmetric system
  const A = [
    [S,  SC, S1],
    [SC, C,  C1],
    [S1, C1, T ]
  ];
  const b = [Sy, Cy, Y1];
  const sol = solve3x3(A,b);
  if (!sol) return null;
  const [a, bcoef, c] = sol; // bcoef is 'b' in y = a sin(wx) + b cos(wx) + c
  return { a, b: bcoef, c };
}

function solve3x3(A,b){
  // Gaussian elimination with partial pivoting
  const M = [A[0].slice(), A[1].slice(), A[2].slice()];
  const v = b.slice();
  const n = 3;
  for (let i=0;i<n;i++){
    // pivot
    let p=i; let max=Math.abs(M[i][i]);
    for (let r=i+1;r<n;r++){ const val=Math.abs(M[r][i]); if (val>max){max=val;p=r;} }
    if (max<1e-12) return null;
    if (p!==i){ const tmp=M[i]; M[i]=M[p]; M[p]=tmp; const tv=v[i]; v[i]=v[p]; v[p]=tv; }
    // eliminate
    for (let r=i+1;r<n;r++){
      const f = M[r][i]/M[i][i];
      for (let c=i;c<n;c++) M[r][c] -= f*M[i][c];
      v[r] -= f*v[i];
    }
  }
  // back-substitute
  const x = new Array(n).fill(0);
  for (let i=n-1;i>=0;i--){
    let sum=v[i];
    for (let c=i+1;c<n;c++) sum -= M[i][c]*x[c];
    x[i] = sum / M[i][i];
  }
  return x;
}

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
