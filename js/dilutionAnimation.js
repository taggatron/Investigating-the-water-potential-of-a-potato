// Handles dilution calculation animation
export function computeDilution(stockConc, targetConc, finalVol) {
  // C1 V1 = C2 V2 => V1 = (C2 V2)/C1
  const stockVol = (targetConc * finalVol) / stockConc;
  const waterVol = finalVol - stockVol;
  return { stockVol, waterVol };
}

export class DilutionAnimator {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.svg = null;
    this.reset();
  }
  reset() {
    this.container.innerHTML = `<div class="placeholder">Enter dilution values and press 'Check & Animate'.</div>`;
    this.running = false;
  }
  previewVolumes(stockVol, waterVol, userWaterVol, finalVol) {
    const percentStock = stockVol / finalVol * 100;
    const percentWater = waterVol / finalVol * 100;
    const percentUserWater = userWaterVol / finalVol * 100;
    this.container.innerHTML = this._buildSVG(percentStock, percentWater, percentUserWater, false);
  }
  animatePour(stockVol, waterVol, finalVol) {
    if (this.running) return;
    this.running = true;
    const percentStock = stockVol / finalVol * 100;
    const percentWater = waterVol / finalVol * 100;
    this.container.innerHTML = this._buildSVG(percentStock, percentWater, null, true);
    const stockRect = this.container.querySelector('#stockFill');
    const waterRect = this.container.querySelector('#waterFill');
    stockRect.animate([{ height: '0%' }, { height: percentStock + '%' }], { duration: 1400, fill: 'forwards', easing: 'ease-out' });
    waterRect.animate([{ y: '100%', height: '0%' }, { y: (100 - percentWater) + '%', height: percentWater + '%' }], { delay: 1400, duration: 1300, fill: 'forwards', easing: 'ease-out' });
    setTimeout(()=>{this.running=false;}, 3000);
  }
  _buildSVG(percentStock, percentWater, percentUserWater, correct) {
    const userLayer = percentUserWater != null ? `<rect id="userWater" x="55" width="70" y="${100 - percentUserWater}%" height="${percentUserWater}%" fill="rgba(255,90,120,0.45)" stroke="#ff5773" stroke-width="1" />` : '';
    const legendUser = percentUserWater != null ? `<g><rect x="200" y="96" width="14" height="14" fill="rgba(255,90,120,0.45)" stroke="#ff5773"/><text x="218" y="107" font-size="10" fill="#ff889e">Your water</text></g>` : '';
    return `<svg viewBox="0 0 360 200" role="img" aria-label="Dilution animation showing beaker filling" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gStock" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#8fd3ff"/><stop offset="100%" stop-color="#2477c9"/></linearGradient>
        <linearGradient id="gWater" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="100%" stop-color="#b5d9ff"/></linearGradient>
      </defs>
      <rect x="50" y="10" width="80" height="180" fill="none" stroke="#4b6880" stroke-width="3" rx="6"/>
      <rect id="stockFill" x="55" width="70" y="${100 - percentStock}%" height="${percentStock}%" fill="url(#gStock)" opacity="${correct?1:0.5}" />
      <rect id="waterFill" x="55" width="70" y="${100 - percentWater}%" height="${percentWater}%" fill="url(#gWater)" opacity="${correct?1:0.5}" />
      ${userLayer}
      <g font-family="system-ui" font-size="11" fill="#cfe8ff" text-anchor="start">
        <text x="150" y="30">Target fill</text>
        <g><rect x="200" y="40" width="14" height="14" fill="url(#gStock)"/><text x="218" y="51">Stock part</text></g>
        <g><rect x="200" y="58" width="14" height="14" fill="url(#gWater)"/><text x="218" y="69">Water part</text></g>
        ${legendUser}
      </g>
      <g stroke="#2d4252" stroke-width="1" stroke-dasharray="2 4" opacity="0.5">
        <line x1="50" x2="130" y1="${100 - percentStock}%" y2="${100 - percentStock}%" />
        <line x1="50" x2="130" y1="${100 - percentWater}%" y2="${100 - percentWater}%" />
      </g>
    </svg>`;
  }
}
