const recognizeForm = document.getElementById('recognizeForm');
const registerForm = document.getElementById('registerForm');
const refreshAllBtn = document.getElementById('refreshAllBtn');
const recognizeImage = document.getElementById('recognizeImage');
const registerImage = document.getElementById('registerImage');
const recognizePreview = document.getElementById('recognizePreview');
const registerPreview = document.getElementById('registerPreview');
const recognitionResult = document.getElementById('recognitionResult');
const registerResult = document.getElementById('registerResult');
const latestMessage = document.getElementById('latestMessage');
const latestPhotoLabel = document.getElementById('latestPhotoLabel');
const latestPhoto = document.getElementById('latestPhoto');
const latestFaces = document.getElementById('latestFaces');
const historyRecognitions = document.getElementById('historyRecognitions');
const historyPhotos = document.getElementById('historyPhotos');
const historyFaces = document.getElementById('historyFaces');
const recognitionChart = document.getElementById('recognitionChart');
const recognitionPieChart = document.getElementById('recognitionPieChart');
const personChart = document.getElementById('personChart');
const chartSummary = document.getElementById('chartSummary');
const chartStartDate = document.getElementById('chartStartDate');
const chartEndDate = document.getElementById('chartEndDate');
const rangeButtons = document.querySelectorAll('.range-button');
const tabs = document.querySelectorAll('.tab');

const state = {
  photos: [],
  faces: [],
  recognitions: [],
  chartRange: {
    start: null,
    end: null,
  },
};

function toBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const payload = result.includes(',') ? result.split(',')[1] : result;
      resolve({ preview: result, payload });
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function renderImage(target, dataUrl, fallback = '') {
  if (!dataUrl) {
    target.classList.add('hidden');
    target.removeAttribute('src');
    target.alt = fallback;
    return;
  }

  target.src = dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;
  target.classList.remove('hidden');
}

function setStatus(box, html, tone = '') {
  box.innerHTML = `<div class="${tone}">${html}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function faceLabel(face) {
  if (face.status === 'recognized') {
    return `<span class="face-tag">Pessoa identificada: ${escapeHtml(face.name)}</span>`;
  }
  return `<span class="face-tag unrecognized">Tem uma pessoa, mas nao identifiquei</span>`;
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function setQuickRange(days) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  chartStartDate.value = formatDayKey(start);
  chartEndDate.value = formatDayKey(end);
  state.chartRange.start = parseDateInput(chartStartDate.value);
  state.chartRange.end = parseDateInput(chartEndDate.value, true);
}

function setAllRange() {
  if (!state.recognitions.length) {
    setQuickRange(30);
    return;
  }

  const dates = state.recognitions
    .map((event) => new Date(event.created_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => first - second);

  if (!dates.length) {
    setQuickRange(30);
    return;
  }

  chartStartDate.value = formatDayKey(dates[0]);
  chartEndDate.value = formatDayKey(dates[dates.length - 1]);
  state.chartRange.start = parseDateInput(chartStartDate.value);
  state.chartRange.end = parseDateInput(chartEndDate.value, true);
}

function syncChartRangeFromInputs() {
  state.chartRange.start = parseDateInput(chartStartDate.value);
  state.chartRange.end = parseDateInput(chartEndDate.value, true);
  if (state.chartRange.start && state.chartRange.end && state.chartRange.start > state.chartRange.end) {
    chartEndDate.value = chartStartDate.value;
    state.chartRange.end = parseDateInput(chartEndDate.value, true);
  }
}

function setActiveRangeButton(range) {
  rangeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.range === range);
  });
}

function getFilteredRecognitions() {
  return state.recognitions.filter((event) => {
    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) return false;
    if (state.chartRange.start && date < state.chartRange.start) return false;
    if (state.chartRange.end && date > state.chartRange.end) return false;
    return true;
  });
}

function getChartDays() {
  const fallbackDays = getLastSevenDays();
  const start = state.chartRange.start || fallbackDays[0];
  const end = state.chartRange.end || fallbackDays[fallbackDays.length - 1];
  const days = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const final = new Date(end);
  final.setHours(0, 0, 0, 0);

  while (cursor <= final && days.length < 62) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.length ? days : fallbackDays;
}

function getRecognitionStats() {
  const filtered = getFilteredRecognitions();
  const days = getChartDays();
  const buckets = days.map((date) => ({
    key: formatDayKey(date),
    label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    recognized: 0,
    unrecognized: 0,
    noFace: 0,
  }));
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const totals = { events: 0, recognized: 0, unrecognized: 0, noFace: 0 };
  const people = new Map();

  filtered.forEach((event) => {
    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) return;

    const key = formatDayKey(date);
    const bucket = bucketByKey.get(key);
    if (!bucket) return;

    const faces = event.recognition_result?.faces || [];
    const recognizedCount = faces.filter((face) => face.status === 'recognized').length;
    const unrecognizedCount = faces.filter((face) => face.status !== 'recognized').length;
    const hasNoFace = faces.length === 0 ? 1 : 0;

    bucket.recognized += recognizedCount;
    bucket.unrecognized += unrecognizedCount;
    bucket.noFace += hasNoFace;
    totals.events += 1;
    totals.recognized += recognizedCount;
    totals.unrecognized += unrecognizedCount;
    totals.noFace += hasNoFace;

    faces
      .filter((face) => face.status === 'recognized' && face.name)
      .forEach((face) => {
        people.set(face.name, (people.get(face.name) || 0) + 1);
      });
  });

  return {
    buckets,
    totals,
    people: Array.from(people, ([name, count]) => ({ name, count }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 5),
  };
}

function renderChartSummary(totals) {
  chartSummary.innerHTML = `
    <div class="summary-item">
      <span class="label">Eventos</span>
      <strong>${totals.events}</strong>
    </div>
    <div class="summary-item">
      <span class="label">Pessoas identificadas</span>
      <strong>${totals.recognized}</strong>
    </div>
    <div class="summary-item">
      <span class="label">Não identificados</span>
      <strong>${totals.unrecognized + totals.noFace}</strong>
    </div>
  `;
}

function prepareCanvas(canvas, minWidth = 320, minHeight = 220) {
  const context = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(minWidth, rect.width);
  const height = Math.max(minHeight, rect.height);

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  return { context, width, height };
}

function drawRecognitionChart(buckets) {
  const { context, width, height } = prepareCanvas(recognitionChart);
  const padding = { top: 18, right: 16, bottom: 42, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const dataMax = Math.max(0, ...buckets.map((bucket) => bucket.recognized + bucket.unrecognized + bucket.noFace));
  const maxValue = Math.max(1, dataMax);
  const yValues = dataMax <= 1
    ? [0, 1]
    : Array.from({ length: Math.min(5, dataMax + 1) }, (_, index) => Math.round((dataMax / Math.min(4, dataMax)) * index));
  const barGap = Math.min(18, chartWidth / 22);
  const barWidth = Math.max(18, (chartWidth - barGap * (buckets.length - 1)) / buckets.length);

  context.strokeStyle = 'rgba(24, 32, 51, 0.1)';
  context.lineWidth = 1;
  context.font = '12px "Plus Jakarta Sans", sans-serif';
  context.fillStyle = '#667085';
  context.textAlign = 'right';
  context.textBaseline = 'middle';

  yValues.forEach((value) => {
    const y = padding.top + chartHeight - (chartHeight * value) / maxValue;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(value, padding.left - 8, y);
  });

  buckets.forEach((bucket, index) => {
    const total = bucket.recognized + bucket.unrecognized + bucket.noFace;
    const x = padding.left + index * (barWidth + barGap);
    const baseY = padding.top + chartHeight;
    const recognizedHeight = (bucket.recognized / maxValue) * chartHeight;
    const unrecognizedHeight = (bucket.unrecognized / maxValue) * chartHeight;
    const noFaceHeight = (bucket.noFace / maxValue) * chartHeight;

    context.fillStyle = 'rgba(12, 128, 120, 0.18)';
    context.fillRect(x, padding.top, barWidth, chartHeight);

    context.fillStyle = '#9aa4b2';
    context.fillRect(x, baseY - noFaceHeight, barWidth, noFaceHeight);

    context.fillStyle = '#d84c5f';
    context.fillRect(x, baseY - noFaceHeight - unrecognizedHeight, barWidth, unrecognizedHeight);

    context.fillStyle = '#0c8078';
    context.fillRect(x, baseY - noFaceHeight - unrecognizedHeight - recognizedHeight, barWidth, recognizedHeight);

    if (total > 0) {
      context.fillStyle = '#182033';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.font = '700 12px "Plus Jakarta Sans", sans-serif';
      context.fillText(total, x + barWidth / 2, baseY - noFaceHeight - unrecognizedHeight - recognizedHeight - 6);
    }

    context.fillStyle = '#667085';
    context.textBaseline = 'top';
    context.font = '12px "Plus Jakarta Sans", sans-serif';
    if (buckets.length <= 16 || index % Math.ceil(buckets.length / 12) === 0) {
      context.fillText(bucket.label, x + barWidth / 2, baseY + 12);
    }
  });
}

function drawDonutChart(totals) {
  const { context, width, height } = prepareCanvas(recognitionPieChart, 220, 220);
  const values = [
    { label: 'Identificados', value: totals.recognized, color: '#0c8078' },
    { label: 'Não identificados', value: totals.unrecognized, color: '#d84c5f' },
    { label: 'Sem rosto', value: totals.noFace, color: '#9aa4b2' },
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;
  let angle = -Math.PI / 2;

  if (!total) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(12, 128, 120, 0.22)';
    context.lineWidth = radius * 0.42;
    context.stroke();
  } else {
    values.forEach((item) => {
      if (!item.value) return;
      const slice = (item.value / total) * Math.PI * 2;
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, angle, angle + slice);
      context.closePath();
      context.fillStyle = item.color;
      context.fill();
      angle += slice;
    });
  }

  context.beginPath();
  context.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  context.fillStyle = '#182033';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '800 30px "Plus Jakarta Sans", sans-serif';
  context.fillText(String(total), centerX, centerY - 8);
  context.fillStyle = '#667085';
  context.font = '12px "Plus Jakarta Sans", sans-serif';
  context.fillText('resultados', centerX, centerY + 20);
}

function drawPersonChart(people) {
  const { context, width, height } = prepareCanvas(personChart, 220, 220);
  const rows = people.length
    ? people
    : [
        { name: 'Sem dados', count: 0 },
        { name: 'Aguardando', count: 0 },
        { name: 'Reconhecimentos', count: 0 },
      ];
  const maxValue = Math.max(1, ...rows.map((item) => item.count));
  const padding = { top: 18, right: 18, bottom: 18, left: 18 };
  const rowHeight = (height - padding.top - padding.bottom) / rows.length;

  rows.forEach((item, index) => {
    const y = padding.top + index * rowHeight;
    const barWidth = ((width - padding.left - padding.right) * item.count) / maxValue;

    context.fillStyle = 'rgba(12, 128, 120, 0.1)';
    context.fillRect(padding.left, y + 30, width - padding.left - padding.right, 12);

    context.fillStyle = item.count ? '#0c8078' : '#c9d4d2';
    context.fillRect(padding.left, y + 30, barWidth, 12);

    context.fillStyle = '#182033';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = '700 13px "Plus Jakarta Sans", sans-serif';
    context.fillText(item.name.slice(0, 22), padding.left, y + 16);

    context.fillStyle = '#667085';
    context.textAlign = 'right';
    context.font = '700 13px "Plus Jakarta Sans", sans-serif';
    context.fillText(String(item.count), width - padding.right, y + 16);
  });
}

function renderDashboardChart() {
  syncChartRangeFromInputs();
  const { buckets, totals, people } = getRecognitionStats();
  renderChartSummary(totals);
  drawRecognitionChart(buckets);
  drawDonutChart(totals);
  drawPersonChart(people);
}

function renderLatestRecognition() {
  const latest = state.recognitions[0];
  if (!latest) {
    latestMessage.textContent = '-';
    latestPhotoLabel.textContent = '-';
    latestFaces.innerHTML = 'Nenhum evento processado ainda.';
    renderImage(latestPhoto, '', 'Sem foto');
    return;
  }

  const result = latest.recognition_result || {};
  latestMessage.textContent = result.message || '-';
  latestPhotoLabel.textContent = formatDate(latest.created_at);
  renderImage(latestPhoto, latest.image_base64, 'Ultima captura');

  if (!result.faces || !result.faces.length) {
    latestFaces.classList.add('empty-state');
    latestFaces.innerHTML = '<p class="muted">Nenhuma pessoa detectada nessa captura.</p>';
    return;
  }

  latestFaces.classList.remove('empty-state');
  latestFaces.innerHTML = result.faces
    .map((face) => `
      <div class="history-card">
        <strong>${escapeHtml(face.message || 'Resultado')}</strong>
        ${face.name ? `<div class="history-meta">Nome: ${escapeHtml(face.name)}</div>` : ''}
        ${typeof face.confidence === 'number' ? `<div class="history-meta">Confiança: ${(face.confidence * 100).toFixed(1)}%</div>` : ''}
        ${faceLabel(face)}
      </div>
    `)
    .join('');
}

function renderHistory() {
  historyRecognitions.innerHTML = state.recognitions.length
    ? state.recognitions.map((event) => {
        const result = event.recognition_result || {};
        const recognizedNames = (result.recognized || []).map((item) => item.name).filter(Boolean).join(', ');
        return `
          <div class="history-card">
            <h3>${escapeHtml(result.message || 'Reconhecimento')}</h3>
            <div class="history-meta">${formatDate(event.created_at)}</div>
            <div class="history-row">
              <img class="thumb" src="${event.image_base64.startsWith('data:') ? event.image_base64 : `data:image/jpeg;base64,${event.image_base64}`}" alt="Histórico de reconhecimento" />
              <div>
                <div>${recognizedNames ? `Reconhecidos: ${escapeHtml(recognizedNames)}` : 'Sem reconhecimento confirmado'}</div>
                <div class="history-meta">${escapeHtml((result.faces || []).map((face) => face.message).join(' | ') || 'Sem detalhes')}</div>
              </div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="history-card muted">Nenhum reconhecimento salvo ainda.</div>';

  historyPhotos.innerHTML = state.photos.length
    ? state.photos.slice(0, 12).map((photo) => `
        <div class="history-card">
          <div class="history-row">
            <img class="thumb" src="${photo.image_base64.startsWith('data:') ? photo.image_base64 : `data:image/jpeg;base64,${photo.image_base64}`}" alt="Foto salva" />
            <div>
              <strong>Foto recebida</strong>
              <div class="history-meta">${formatDate(photo.created_at)}</div>
              <div class="history-meta">${escapeHtml(JSON.stringify(photo.photo_metadata || {}))}</div>
            </div>
          </div>
        </div>
      `).join('')
    : '<div class="history-card muted">Nenhuma foto recebida ainda.</div>';

  historyFaces.innerHTML = state.faces.length
    ? state.faces.map((face) => `
        <div class="history-card">
          <strong>${escapeHtml(face.name)}</strong>
          <div class="history-meta">${formatDate(face.created_at)}</div>
          <div class="face-tag">Cadastro ativo</div>
        </div>
      `).join('')
    : '<div class="history-card muted">Nenhuma face cadastrada ainda.</div>';
}

async function loadData() {
  const [photosRes, facesRes, recognitionsRes] = await Promise.all([
    fetch('/photos'),
    fetch('/faces'),
    fetch('/recognitions'),
  ]);

  state.photos = await photosRes.json();
  state.faces = await facesRes.json();
  state.recognitions = await recognitionsRes.json();

  renderLatestRecognition();
  renderHistory();
  renderDashboardChart();
}

async function submitImage(formData, endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Falha na requisicao');
  }
  return data;
}

recognizeImage.addEventListener('change', async () => {
  const file = recognizeImage.files?.[0];
  if (!file) return;
  const { preview } = await toBase64Payload(file);
  renderImage(recognizePreview, preview, 'Captura para reconhecimento');
});

registerImage.addEventListener('change', async () => {
  const file = registerImage.files?.[0];
  if (!file) return;
  const { preview } = await toBase64Payload(file);
  renderImage(registerPreview, preview, 'Foto para cadastro');
});

recognizeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const file = recognizeImage.files?.[0];
    if (!file) throw new Error('Selecione uma foto para reconhecer.');

    const { payload, preview } = await toBase64Payload(file);
    const formData = new FormData();
    formData.append('image_base64', payload);

    const result = await submitImage(formData, '/recognize_face');
    renderImage(recognizePreview, preview, 'Captura para reconhecimento');
    setStatus(recognitionResult, `<strong>${escapeHtml(result.message || 'Reconhecimento concluido')}</strong>`, 'success');
    await loadData();
  } catch (error) {
    setStatus(recognitionResult, `<strong>Erro:</strong> ${escapeHtml(error.message)}`, 'error');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const file = registerImage.files?.[0];
    const name = document.getElementById('faceName').value.trim();
    if (!file) throw new Error('Selecione uma foto para cadastro.');
    if (!name) throw new Error('Informe o nome da pessoa.');

    const { payload, preview } = await toBase64Payload(file);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image_base64', payload);

    const result = await submitImage(formData, '/register_face');
    renderImage(registerPreview, preview, 'Foto para cadastro');
    setStatus(registerResult, `<strong>${escapeHtml(result.message || 'Face cadastrada')}</strong>`, 'success');
    registerForm.reset();
    await loadData();
  } catch (error) {
    setStatus(registerResult, `<strong>Erro:</strong> ${escapeHtml(error.message)}`, 'error');
  }
});

refreshAllBtn.addEventListener('click', loadData);

chartStartDate.addEventListener('change', () => {
  setActiveRangeButton('');
  renderDashboardChart();
});

chartEndDate.addEventListener('change', () => {
  setActiveRangeButton('');
  renderDashboardChart();
});

rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const range = button.dataset.range;
    setActiveRangeButton(range);

    if (range === 'all') {
      setAllRange();
    } else {
      setQuickRange(Number(range));
    }

    renderDashboardChart();
  });
});

window.addEventListener('resize', () => {
  renderDashboardChart();
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.dataset.tab;
    historyRecognitions.classList.toggle('hidden', target !== 'recognitions');
    historyPhotos.classList.toggle('hidden', target !== 'photos');
    historyFaces.classList.toggle('hidden', target !== 'faces');
  });
});

setQuickRange(7);

loadData().catch((error) => {
  recognitionResult.innerHTML = `<div class="error"><strong>Erro ao carregar dashboard:</strong> ${escapeHtml(error.message)}</div>`;
});
