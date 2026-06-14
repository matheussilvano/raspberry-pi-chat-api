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
const tabs = document.querySelectorAll('.tab');

const state = {
  photos: [],
  faces: [],
  recognitions: [],
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

loadData().catch((error) => {
  recognitionResult.innerHTML = `<div class="error"><strong>Erro ao carregar dashboard:</strong> ${escapeHtml(error.message)}</div>`;
});
