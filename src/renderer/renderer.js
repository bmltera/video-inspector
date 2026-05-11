const $ = (id) => document.getElementById(id);
let currentFile = null;

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function setText(id, text) { $(id).textContent = text ?? '—'; }

function addDL(el, rows) {
  el.innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v ?? '—';
    el.append(dt, dd);
  }
}

async function refreshTools() {
  try {
    if (!window.videoInspector) throw new Error('preload bridge did not initialize');
    const tools = await window.videoInspector.discoverTools();
    $('toolsStatus').innerHTML = Object.entries(tools).map(([name, t]) =>
      `<div><b>${name}</b>: <span class="${t.found ? 'tool-ok' : 'tool-miss'}">${t.found ? 'found' : 'missing'}</span> ${escapeHTML(t.version || '')}</div>`
    ).join('');
  } catch (e) {
    $('toolsStatus').textContent = 'Tool check failed: ' + e.message;
  }
}

function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function inspect(filePath) {
  currentFile = filePath;
  hide('dropZone'); hide('report'); show('loading');
  try {
    const result = await window.videoInspector.analyzeVideo(filePath);
    renderReport(result);
    hide('loading'); show('report');
  } catch (e) {
    hide('loading'); show('dropZone');
    alert('Could not inspect file:\n' + e.message);
  }
}

function renderReport(r) {
  const s = r.summary;
  setText('fileName', r.fileName);
  setText('filePath', r.filePath);
  setText('cameraDisplay', s.camera.display);
  setText('resolution', s.image.resolution);
  setText('fps', s.image.fps);
  setText('bitrate', s.encoding.bitrate);

  addDL($('encodingList'), [
    ['Container', s.encoding.container],
    ['Codec', s.encoding.codec],
    ['Codec tag', s.encoding.codecTag],
    ['Compression', s.encoding.compression],
    ['Duration', s.image.duration],
    ['File size', s.file.size]
  ]);
  addDL($('colorList'), [
    ['Bit depth', s.color.bitDepth],
    ['Pixel format', s.color.pixelFormat],
    ['Color space', s.color.colorSpace],
    ['Transfer', s.color.colorTransfer],
    ['Primaries', s.color.colorPrimaries],
    ['Range', s.color.range]
  ]);
  addDL($('cameraList'), [
    ['Camera', s.camera.display],
    ['Make', s.camera.make],
    ['Model', s.camera.model],
    ['Lens', s.camera.lens]
  ]);
  addDL($('sideList'), [
    ['Streams', String(s.sideData.streamCount)],
    ['Audio', s.audio.length ? s.audio.map(a => `${a.codec || 'audio'} ${a.channels || '?'}ch ${a.sampleRate || ''}`).join(' | ') : 'None found'],
    ['Data streams', s.sideData.dataStreams.length ? s.sideData.dataStreams.map(d => `${d.codec || d.type || '?'} ${d.handler || ''}`).join(' | ') : 'None found']
  ]);

  const gyro = $('gyroStatus');
  gyro.textContent = s.gyro.found ? 'Telemetry / gyro clues found' : 'No obvious gyro metadata found';
  gyro.className = 'pill ' + (s.gyro.found ? 'good' : 'warn');
  $('gyroList').innerHTML = '';
  for (const clue of (s.gyro.clues || [])) {
    const li = document.createElement('li'); li.textContent = clue; $('gyroList').appendChild(li);
  }

  const tbody = $('metadataTable').querySelector('tbody');
  tbody.innerHTML = '';
  for (const row of s.metadataHighlights || []) {
    const tr = document.createElement('tr');
    const key = document.createElement('td'); key.textContent = row.key;
    const val = document.createElement('td'); val.textContent = row.value;
    tr.append(key, val); tbody.appendChild(tr);
  }
  $('rawJson').textContent = JSON.stringify(r.sources, null, 2);
}

$('openBtn').addEventListener('click', async () => {
  const f = await window.videoInspector.chooseVideo();
  if (f) inspect(f);
});
$('showInFolder').addEventListener('click', () => currentFile && window.videoInspector.openPath(currentFile));

const drop = $('dropZone');
for (const el of [document.body, drop]) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  el.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  el.addEventListener('drop', async (e) => {
    e.preventDefault(); drop.classList.remove('dragging');
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const filePath = window.videoInspector.getPathForFile(file) || file.path;
      if (filePath) inspect(filePath);
    }
  });
}
refreshTools();
