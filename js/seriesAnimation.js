// Animates a row of test tubes with potato cylinders responding to sucrose concentration
// Higher sucrose -> shrink (plasmolysis); lower sucrose -> swell.
export class SeriesAnimator {
  constructor(container) {
    this.container = container;
    this.series = [];
    this.normalize = false; // external toggle
    this.tooltipEl = null;
  }
  setSeries(series) { // series: [{conc, percentChange}]
    this.series = series.slice().sort((a,b)=>a.conc-b.conc);
    this.renderStatic();
  }
  renderStatic() {
    if (!this.series.length) { this.container.innerHTML = '<div class="placeholder">No series yet.</div>'; return; }
    const tubes = this.series.map((s,i)=>this._tubeSVG(s,i,false)).join('');
    // Provide gradient for potato cylinders
    this.container.innerHTML = `<svg viewBox="0 0 ${this.series.length*80} 200" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="potBody" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f4d98b"/><stop offset="100%" stop-color="#c9a85e"/></linearGradient>
      </defs>${tubes}</svg>`;
    this._ensureTooltip();
    this._attachHoverHandlers();
  }
  animate() {
    if (!this.series.length) return;
    const svg = this.container.querySelector('svg');
    if (!svg) return;
    this.series.forEach((s,i)=>{
      const cyl = svg.querySelector(`#potato-${i}`);
      if (!cyl) return;
      const { scaleX, scaleY, translateY } = this._transformForChange(s.percentChange);
      cyl.animate([
        { transform: 'translateY(0) scale(1,1)' },
        { transform: `translateY(${translateY}px) scale(${scaleX},${scaleY})` }
      ], { duration: 1400, delay: i*170, fill: 'forwards', easing: 'ease-out' });
    });
  }
  animateSerialTransfer() {
    // simple droplet animation traveling from tube i to i+1 sequentially
    const svg = this.container.querySelector('svg');
    if (!svg || this.series.length < 2) return;
    const run = (i) => {
      if (i >= this.series.length - 1) return;
      const from = svg.querySelector(`#tube-${i}`);
      const to = svg.querySelector(`#tube-${i+1}`);
      if (!(from && to)) return;
      const fromRect = from.querySelector('rect');
      const toRect = to.querySelector('rect');
      if (!(fromRect && toRect)) return;
      const fx = parseFloat(fromRect.getAttribute('x')) + parseFloat(fromRect.getAttribute('width'))/2;
      const tx = parseFloat(toRect.getAttribute('x')) + parseFloat(toRect.getAttribute('width'))/2;
      const y = parseFloat(fromRect.getAttribute('y')) - 8;
      const drop = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      drop.setAttribute('cx', fx);
      drop.setAttribute('cy', y);
      drop.setAttribute('r', 4);
      drop.setAttribute('fill', '#8fd3ff');
      drop.setAttribute('opacity','0.9');
      svg.appendChild(drop);
      drop.animate([
        { transform: 'translateX(0) translateY(0)', opacity:0.9 },
        { transform: `translateX(${tx-fx}px) translateY(12px)`, opacity:0.2 }
      ], { duration: 700, easing: 'ease-in-out', fill:'forwards' }).onfinish = () => {
        drop.remove();
        run(i+1);
      };
    };
    run(0);
  }
  setNormalize(on) { this.normalize = !!on; this.renderStatic(); }
  _transformForChange(pct) {
    // Map percent change to radial and height changes. Optionally normalize to series extremes
    let clamped = Math.max(-40, Math.min(40, pct));
    if (this.normalize && this.series.length) {
      const ys = this.series.map(s=>Math.max(-40, Math.min(40, s.percentChange)));
      const min = Math.min(...ys), max = Math.max(...ys);
      if (max !== min) {
        const t = (clamped - min)/(max - min); // 0..1
        clamped = (t*2 - 1) * 40; // map to -40..+40
      }
    }
    // Height grows a bit more strongly than width (osmosis causes turgidity elongation in discs simulation)
    const scaleY = 1 + clamped/80; // ±0.5 at extremes
    const scaleX = 1 + clamped/130; // ±0.307
    const translateY = clamped < 0 ? 10 : -8; // shrink sinks, swell rises
    return { scaleX, scaleY, translateY };
  }
  _tubeSVG(s, idx, animated) {
    const baseY = 120; const tubeH = 90; const tubeW = 40; const x = idx*80 + 20;
    const fluidLevel = 30; // constant for simplification
    // Potato cylinder base dimensions
    const cylWidth = 20; const cylHeight = 28; // unscaled
    const cx = x + tubeW/2; const topY = baseY - fluidLevel - 8; // top ellipse center
    const { scaleX, scaleY, translateY } = this._transformForChange(s.percentChange);
    const bodyColor = this._colorForChange(s.percentChange);
    const transform = animated ? 'translateY(0) scale(1,1)' : `translateY(${translateY}px) scale(${scaleX},${scaleY})`;
    return `<g id="tube-${idx}">
      <rect x="${x}" y="${baseY - tubeH}" width="${tubeW}" height="${tubeH}" rx="6" fill="none" stroke="#4a6a80" stroke-width="2" />
      <rect x="${x+2}" y="${baseY - fluidLevel}" width="${tubeW-4}" height="${fluidLevel}" fill="#2a6ea9" opacity="0.35" />
      <g id="potato-${idx}" class="potato" style="transform:${transform};transform-origin:${cx}px ${topY}px">
        <ellipse cx="${cx}" cy="${topY}" rx="${cylWidth/2}" ry="6" fill="${bodyColor.top}" stroke="#9c7c3a" stroke-width="2" />
        <rect x="${cx - cylWidth/2}" y="${topY}" width="${cylWidth}" height="${cylHeight}" fill="${bodyColor.mid}" stroke="#9c7c3a" stroke-width="2" />
        <ellipse cx="${cx}" cy="${topY + cylHeight}" rx="${cylWidth/2}" ry="6" fill="${bodyColor.bot}" stroke="#8a6a2e" stroke-width="2" />
      </g>
      <text x="${x + tubeW/2}" y="${baseY + 14}" class="tubeLabel" text-anchor="middle">${s.conc.toFixed(2)} M</text>
    </g>`;
  }
  _colorForChange(pct) {
    // green for turgid, golden for iso, brown for plasmolysed
    const clamped = Math.max(-40, Math.min(40, pct));
    const toHex = (r,g,b)=>`#${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`;
    const mix = (a,b,t)=>a+(b-a)*t;
    // base endpoints
    const greenTop=[140,220,150], greenMid=[80,180,100], greenBot=[60,150,80];
    const brownTop=[230,180,110], brownMid=[200,140,90], brownBot=[160,110,70];
    // map clamped -40..+40 to t 0..1 where 0=brown, 0.5=golden,1=green
    const t = (clamped+40)/80; // 0..1
    const goldTop=[240,220,140], goldMid=[210,190,110], goldBot=[200,170,90];
    const lerp3 = (c1,c2,c3,t)=>{
      if (t<0.5){ const k=t/0.5; return c1.map((v,i)=>mix(v,c2[i],k)); }
      const k=(t-0.5)/0.5; return c2.map((v,i)=>mix(v,c3[i],k));
    };
    const top = lerp3(brownTop, goldTop, greenTop, t);
    const mid = lerp3(brownMid, goldMid, greenMid, t);
    const bot = lerp3(brownBot, goldBot, greenBot, t);
    return { top: toHex(...top), mid: toHex(...mid), bot: toHex(...bot) };
  }
  _ensureTooltip() {
    let tip = document.getElementById('seriesTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'seriesTooltip';
      this.container.parentElement.appendChild(tip);
    }
    this.tooltipEl = tip;
  }
  _attachHoverHandlers() {
    const svg = this.container.querySelector('svg');
    if (!svg || !this.tooltipEl) return;
    svg.querySelectorAll('.potato').forEach((g,i)=>{
      g.addEventListener('mousemove', (e)=>{
        const pct = this.series[i]?.percentChange ?? 0;
        this.tooltipEl.textContent = `${pct.toFixed(2)}%`;
        const rect = this.container.getBoundingClientRect();
        this.tooltipEl.style.left = (e.clientX - rect.left + 10) + 'px';
        this.tooltipEl.style.top = (e.clientY - rect.top - 10) + 'px';
        this.tooltipEl.style.display = 'block';
      });
      g.addEventListener('mouseleave', ()=>{ this.tooltipEl.style.display='none'; });
    });
  }
}
