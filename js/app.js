import { DilutionAnimator, computeDilution } from './dilutionAnimation.js';
import { ExperimentData } from './dataModel.js';
import { ResultChart } from './chart.js';
import { SeriesAnimator } from './seriesAnimation.js';

const qs = sel => document.querySelector(sel);

const state = {
  dilutionAnimator: null,
  data: new ExperimentData(),
  chart: null,
  seriesAnimator: null,
  latestSeries: []
};

function init() {
  setupDilution();
  setupDataEntry();
  setupChart();
  restoreSaved();
  qs('#app').hidden = false;
  qs('#loading').remove();
}

function setupDilution() {
  const form = qs('#dilution-form');
  const feedback = qs('#dilution-feedback');
  const animCanvas = qs('#animationCanvas');
  state.dilutionAnimator = new DilutionAnimator(animCanvas);
  // Live update final volume display
  const finalVolInput = qs('#finalVol');
  const finalVolValue = qs('#finalVolValue');
  finalVolInput.addEventListener('input', () => {
    finalVolValue.textContent = finalVolInput.value || '—';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    feedback.textContent = '';
    const stock = parseFloat(qs('#stockConc').value);
    const target = parseFloat(qs('#targetConc').value);
    const finalVol = parseFloat(qs('#finalVol').value);
    const userWater = parseFloat(qs('#userWaterVol').value);
    if ([stock,target,finalVol,userWater].some(isNaN)) {
      feedback.textContent = 'Please complete all dilution fields.';
      feedback.className = 'err';
      return;
    }
    if (target > stock) {
      feedback.textContent = 'Target concentration cannot exceed stock concentration';
      feedback.className = 'err';
      return;
    }
    const { stockVol, waterVol } = computeDilution(stock, target, finalVol);
    const tol = 0.15; // mL tolerance
    const diff = Math.abs(userWater - waterVol);
    if (diff <= tol) {
      feedback.textContent = `Correct! Stock: ${stockVol.toFixed(2)} mL, Water: ${waterVol.toFixed(2)} mL`;
      feedback.className = 'ok';
      state.dilutionAnimator.animatePour(stockVol, waterVol, finalVol);
    } else {
      feedback.textContent = `Not quite. Required water ≈ ${waterVol.toFixed(2)} mL (you entered ${userWater.toFixed(2)} mL)`;
      feedback.className = 'err';
      state.dilutionAnimator.previewVolumes(stockVol, waterVol, userWater, finalVol);
    }
  });
  qs('#resetAnimation').addEventListener('click',()=>state.dilutionAnimator.reset());

  // Batch series controls
  const seriesConcs = qs('#seriesConcs');
  const seriesInitial = qs('#seriesInitialMass');
  const seriesFeedback = qs('#seriesFeedback');
  const seriesAnimContainer = qs('#seriesAnimation');
  state.seriesAnimator = new SeriesAnimator(seriesAnimContainer);
  // Normalize toggle
  const normalize = qs('#normalizeScaling');
  if (normalize) {
    normalize.addEventListener('change', ()=>{
      state.seriesAnimator.setNormalize(normalize.checked);
    });
  }
  qs('#generateSeries').addEventListener('click', () => {
    const parsed = (seriesConcs.value||'').split(/[,\s]+/).map(v=>parseFloat(v)).filter(v=>!isNaN(v));
    if (!parsed.length) { seriesFeedback.textContent = 'Enter at least one valid concentration.'; return; }
    const initialMass = parseFloat(seriesInitial.value);
    if (isNaN(initialMass) || initialMass<=0) { seriesFeedback.textContent = 'Initial mass invalid.'; return; }
    if (state.data.points.length && !confirm('Replace existing data with generated series?')) return;
    state.data.clear();
    state.latestSeries = [];
    parsed.forEach(c => {
      const finalMass = state.data.simulateFinalMass(c, initialMass);
      state.data.addMeasurement(c, initialMass, finalMass);
      const pct = state.data.percentChange({initial:initialMass, final:finalMass});
      state.latestSeries.push({ conc:c, percentChange:pct });
    });
    // Render table & chart automatically
    const tbody = qs('#results-table tbody');
    tbody.innerHTML='';
    state.data.points.sort((a,b)=>a.conc-b.conc).forEach((p,i)=>{
      const tr = document.createElement('tr');
      const pct = state.data.percentChange(p).toFixed(2);
      tr.innerHTML = `<td>${p.conc.toFixed(2)}</td><td>${p.initial.toFixed(2)}</td><td>${p.final.toFixed(2)}</td><td>${pct}</td><td><button data-i="${i}" aria-label="Delete row">×</button></td>`;
      tbody.appendChild(tr);
    });
    updateChart();
    seriesFeedback.textContent = 'Series generated and added to data.';
    // Prepare animation view
    state.seriesAnimator.setSeries(state.latestSeries);
  });
  qs('#animateSeries').addEventListener('click', () => {
    if (!state.latestSeries.length) { seriesFeedback.textContent = 'Generate a series first.'; return; }
    state.seriesAnimator.animate();
  });
  const btnSerial = qs('#animateSerial');
  if (btnSerial) {
    btnSerial.addEventListener('click', () => {
      if (!state.latestSeries.length) { seriesFeedback.textContent = 'Generate a series first.'; return; }
      state.seriesAnimator.animateSerialTransfer();
    });
  }
}

function setupDataEntry() {
  const form = qs('#data-form');
  const tableBody = qs('#results-table tbody');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const conc = parseFloat(qs('#dataConc').value);
    const im = parseFloat(qs('#initialMass').value);
    const fm = parseFloat(qs('#finalMass').value);
    if ([conc,im,fm].some(isNaN) || im <= 0 || fm <= 0) return;
    state.data.addMeasurement(conc, im, fm);
    renderTable();
    updateChart();
    form.reset();
  });
  qs('#simulateBtn').addEventListener('click',() => {
    const conc = parseFloat(qs('#dataConc').value);
    const im = parseFloat(qs('#initialMass').value);
    if (isNaN(conc) || isNaN(im) || im <= 0) return;
    const fm = state.data.simulateFinalMass(conc, im);
    qs('#finalMass').value = fm.toFixed(2);
  });
  qs('#clearData').addEventListener('click', () => {
    if (!confirm('Clear all data?')) return;
    state.data.clear();
    renderTable();
    updateChart();
  });
  function renderTable() {
    tableBody.innerHTML = '';
    state.data.points.sort((a,b)=>a.conc-b.conc).forEach((p,i) => {
      const tr = document.createElement('tr');
      const pct = state.data.percentChange(p).toFixed(2);
      tr.innerHTML = `<td>${p.conc.toFixed(2)}</td><td>${p.initial.toFixed(2)}</td><td>${p.final.toFixed(2)}</td><td>${pct}</td><td><button data-i="${i}" aria-label="Delete row">×</button></td>`;
      tableBody.appendChild(tr);
    });
  }
  tableBody.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const idx = parseInt(btn.dataset.i,10);
    state.data.points.splice(idx,1);
    renderTable();
    updateChart();
  });
}

function setupChart() {
  const canvas = qs('#resultChart');
  state.chart = new ResultChart(canvas);
}

function updateChart() {
  const series = state.data.points.map(p => ({ x: p.conc, y: state.data.percentChange(p) }));
  state.chart.setData(series);
  const iso = state.data.isotonicPoint();
  const el = qs('#isotonicPoint');
  if (iso == null) {
    el.textContent = 'Add points spanning positive and negative % change to estimate isotonic concentration.';
  } else {
    el.textContent = `Estimated isotonic concentration ≈ ${iso.toFixed(3)} mol dm⁻³ (where % mass change = 0)`;
  }
}

function restoreSaved() {
  state.data.load();
  if (state.data.points.length) {
    const form = qs('#data-form');
    // render existing
    const event = new Event('submit'); // We'll manually render afterwards
    // Instead of faking submission, just call render and chart update
    const tbody = qs('#results-table tbody');
    tbody.innerHTML='';
    state.data.points.forEach(()=>{}); // no-op
    // replicate table render logic quickly
    state.data.points.sort((a,b)=>a.conc-b.conc).forEach((p,i)=>{
      const tr = document.createElement('tr');
      const pct = state.data.percentChange(p).toFixed(2);
      tr.innerHTML = `<td>${p.conc.toFixed(2)}</td><td>${p.initial.toFixed(2)}</td><td>${p.final.toFixed(2)}</td><td>${pct}</td><td><button data-i="${i}" aria-label="Delete row">×</button></td>`;
      qs('#results-table tbody').appendChild(tr);
    });
    updateChart();
  }
}

document.addEventListener('DOMContentLoaded', init);
