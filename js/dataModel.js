// Experiment data logic & persistence
const STORAGE_KEY = 'pag81-potato-data-v1';

export class ExperimentData {
  constructor() {
    this.points = [];
  }
  addMeasurement(conc, initial, final) {
    this.points.push({ conc, initial, final });
    this.save();
  }
  percentChange(p) {
    return (p.final - p.initial) / p.initial * 100;
  }
  clear() {
    this.points = [];
    this.save();
  }
  simulateFinalMass(conc, initial) {
    // Simple model: logistic-ish response around isotonic ~0.28 M.
    const iso = 0.28;
    // mass change fraction: negative for higher conc (plasmolysis), positive for lower.
    const gradient = -0.55; // scaling factor
    const diff = conc - iso;
    const fracChange = gradient * diff * Math.exp(-Math.abs(diff)*2) + this._noise(0.005);
    let finalMass = initial * (1 + fracChange);
    finalMass = Math.max(0.01, finalMass);
    return finalMass;
  }
  isotonicPoint() {
    if (this.points.length < 2) return null;
    const pts = this.points.slice().sort((a,b)=>a.conc-b.conc).map(p=>({x:p.conc,y:this.percentChange(p)}));
    // find sign change brackets
    for (let i=0;i<pts.length-1;i++) {
      if (pts[i].y === 0) return pts[i].x;
      if (pts[i].y * pts[i+1].y < 0) {
        // linear interpolation
        const x1 = pts[i].x, y1=pts[i].y; const x2=pts[i+1].x, y2=pts[i+1].y;
        const m = (y2 - y1)/(x2 - x1);
        const xZero = x1 - y1/m;
        return xZero;
      }
    }
    return null;
  }
  save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.points)); } catch(e){} }
  load() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) this.points = JSON.parse(raw); } catch(e){ this.points=[]; } }
  _noise(sd) { return (Math.random()*2-1)*sd; }
}
