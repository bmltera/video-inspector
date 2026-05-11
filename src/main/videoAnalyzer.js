const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

function isWin() { return process.platform === 'win32'; }
function exe(name) { return isWin() ? `${name}.exe` : name; }

function candidateToolPaths(name) {
  const candidates = [];
  const resources = process.resourcesPath || '';
  const projectRoot = path.resolve(__dirname, '../..');
  const roots = [
    path.join(resources, 'tools'),
    path.join(projectRoot, 'tools'),
    path.join(projectRoot, 'bin'),
    projectRoot
  ];
  for (const root of roots) {
    candidates.push(path.join(root, exe(name)));
    candidates.push(path.join(root, name, exe(name)));
  }
  candidates.push(exe(name));
  return [...new Set(candidates)];
}

function resolveTool(name) {
  for (const p of candidateToolPaths(name)) {
    if (p === exe(name) || fs.existsSync(p)) return p;
  }
  return exe(name);
}

function runTool(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: opts.timeout || 30000, windowsHide: true, maxBuffer: opts.maxBuffer || 40 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, error: error ? String(error.message || error) : null, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function parseJSON(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

async function discoverTools() {
  const tools = {};
  for (const name of ['ffprobe', 'exiftool', 'mediainfo']) {
    const file = resolveTool(name);
    const args = name === 'ffprobe' ? ['-version'] : name === 'exiftool' ? ['-ver'] : ['--Version'];
    const r = await runTool(file, args, { timeout: 6000, maxBuffer: 1024 * 1024 });
    tools[name] = { found: r.ok, path: file, version: (r.stdout || r.stderr || '').split(/\r?\n/)[0].trim(), error: r.ok ? null : r.error };
  }
  return tools;
}

async function analyzeVideo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('File does not exist: ' + filePath);
  const stat = fs.statSync(filePath);
  const [ffprobe, exiftool, mediainfo] = await Promise.all([
    runFFProbe(filePath),
    runExifTool(filePath),
    runMediaInfo(filePath)
  ]);
  const summary = buildSummary(filePath, stat, ffprobe.data, exiftool.data, mediainfo.data);
  return {
    filePath,
    fileName: path.basename(filePath),
    sizeBytes: stat.size,
    summary,
    sources: {
      ffprobe: { available: ffprobe.ok, error: ffprobe.error, data: ffprobe.data },
      exiftool: { available: exiftool.ok, error: exiftool.error, data: exiftool.data },
      mediainfo: { available: mediainfo.ok, error: mediainfo.error, data: mediainfo.data }
    }
  };
}

async function runFFProbe(filePath) {
  const file = resolveTool('ffprobe');
  const args = ['-v', 'error', '-show_format', '-show_streams', '-show_chapters', '-show_programs', '-print_format', 'json', filePath];
  const r = await runTool(file, args, { timeout: 45000 });
  return { ok: r.ok, error: r.error || r.stderr, data: parseJSON(r.stdout, null) };
}

async function runExifTool(filePath) {
  const file = resolveTool('exiftool');
  const args = ['-json', '-G', '-a', '-s', '-ee', filePath];
  const r = await runTool(file, args, { timeout: 45000 });
  const parsed = parseJSON(r.stdout, null);
  return { ok: r.ok && Array.isArray(parsed), error: r.error || r.stderr, data: Array.isArray(parsed) ? parsed[0] : null };
}

async function runMediaInfo(filePath) {
  const file = resolveTool('mediainfo');
  const args = ['--Output=JSON', filePath];
  const r = await runTool(file, args, { timeout: 45000 });
  return { ok: r.ok, error: r.error || r.stderr, data: parseJSON(r.stdout, null) };
}

function first(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return null;
}

function flattenExif(exif) {
  const out = {};
  if (!exif) return out;
  for (const [k, v] of Object.entries(exif)) {
    const bare = k.includes(':') ? k.split(':').pop() : k;
    if (out[bare] === undefined) out[bare] = v;
  }
  return out;
}

function tagGet(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== '') return obj[k];
    const found = Object.keys(obj).find(x => x.toLowerCase() === k.toLowerCase());
    if (found && obj[found] !== '') return obj[found];
  }
  return null;
}

function parseRate(rate) {
  if (!rate || rate === '0/0') return null;
  if (String(rate).includes('/')) {
    const [n, d] = String(rate).split('/').map(Number);
    if (d) return n / d;
  }
  const n = Number(rate);
  return Number.isFinite(n) ? n : null;
}

function fmtRate(rate) {
  const n = parseRate(rate);
  if (!n) return null;
  return `${Number.isInteger(n) ? n : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} fps`;
}

function fmtBytes(bytes) {
  const units = ['B','KB','MB','GB','TB'];
  let n = Number(bytes || 0), i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function fmtBitrate(bits) {
  const n = Number(bits);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} Gbps`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)} Mbps`;
  if (n >= 1e3) return `${(n/1e3).toFixed(2)} Kbps`;
  return `${n} bps`;
}

function mediaInfoTracks(mi) {
  return mi?.media?.track || [];
}

function inferBitDepth(video, miTrack, flatExif) {
  return first(video?.bits_per_raw_sample, video?.bits_per_sample, miTrack?.BitDepth, miTrack?.BitDepth_String, flatExif.BitDepth, flatExif.BitsPerSample);
}

function inferCompression(video, format, miTrack, flatExif) {
  const pieces = [];
  const codec = first(video?.codec_long_name, video?.codec_name, miTrack?.Format_Commercial_IfAny, miTrack?.Format, flatExif.CompressorName, flatExif.Compression);
  if (codec) pieces.push(codec);
  const profile = first(video?.profile, miTrack?.Format_Profile, flatExif.Profile);
  if (profile) pieces.push(`Profile: ${profile}`);
  const pix = first(video?.pix_fmt, miTrack?.ColorSpace, miTrack?.ChromaSubsampling);
  if (pix) pieces.push(`Pixel/chroma: ${pix}`);
  const compression = first(miTrack?.Compression_Mode, miTrack?.Compression_Mode_String);
  if (compression) pieces.push(`Mode: ${compression}`);
  const brand = first(format?.tags?.major_brand, format?.format_long_name);
  if (brand) pieces.push(`Container brand: ${brand}`);
  return pieces.join(' • ') || null;
}

function detectGyro(ffprobe, flatExif, mi) {
  const clues = [];
  const terms = /(gyro|gpmf|telemetry|inertial|accelerometer|angular|imu|stabilization|insta360|gopro|camera data|timed metadata|meta)/i;
  const streams = ffprobe?.streams || [];
  streams.forEach((s, idx) => {
    const blob = JSON.stringify({ codec_type: s.codec_type, codec_name: s.codec_name, codec_tag_string: s.codec_tag_string, tags: s.tags || {} });
    if (terms.test(blob) || s.codec_type === 'data') {
      clues.push(`Stream #${idx}: ${s.codec_type || 'unknown'} ${s.codec_name || s.codec_tag_string || ''} ${s.tags?.handler_name || ''}`.trim());
    }
  });
  Object.entries(flatExif || {}).forEach(([k,v]) => {
    if (terms.test(k) || terms.test(String(v))) clues.push(`${k}: ${String(v).slice(0, 140)}`);
  });
  mediaInfoTracks(mi).forEach((t, idx) => {
    const blob = JSON.stringify(t);
    if (terms.test(blob) || t['@type'] === 'Other') clues.push(`MediaInfo track ${idx}: ${t['@type'] || ''} ${t.Format || ''} ${t.Title || t.Type || ''}`.trim());
  });
  return [...new Set(clues)].slice(0, 20);
}

function buildSummary(filePath, stat, ffprobe, exif, mi) {
  const flat = flattenExif(exif);
  const streams = ffprobe?.streams || [];
  const video = streams.find(s => s.codec_type === 'video') || {};
  const audio = streams.filter(s => s.codec_type === 'audio');
  const dataStreams = streams.filter(s => s.codec_type === 'data' || s.codec_type === 'subtitle' || s.codec_type === 'attachment');
  const format = ffprobe?.format || {};
  const miVideo = mediaInfoTracks(mi).find(t => t['@type'] === 'Video') || {};
  const miGeneral = mediaInfoTracks(mi).find(t => t['@type'] === 'General') || {};
  const tags = Object.assign({}, format.tags || {}, video.tags || {});

  const make = first(flat.Make, flat.CameraMake, flat.Manufacturer, flat.DeviceManufacturer, tagGet(tags, ['make', 'com.apple.quicktime.make', 'manufacturer']));
  const model = first(flat.Model, flat.CameraModelName, flat.CameraModel, flat.DeviceModelName, tagGet(tags, ['model', 'com.apple.quicktime.model']));
  const camera = first(
    [make, model].filter(Boolean).join(' ').trim(),
    flat.CameraType,
    flat.DeviceName,
    tagGet(tags, ['camera', 'encoder']),
    miGeneral.Encoded_Application
  );

  const lens = first(flat.LensModel, flat.Lens, flat.LensID, flat.LensInfo, flat.FocalLength, flat.FocalLengthIn35mmFormat);
  const duration = first(format.duration, video.duration, miGeneral.Duration);
  const bitrate = first(format.bit_rate, video.bit_rate, miGeneral.OverallBitRate, miVideo.BitRate);
  const fps = first(fmtRate(video.avg_frame_rate), fmtRate(video.r_frame_rate), miVideo.FrameRate ? `${miVideo.FrameRate} fps` : null);
  const width = first(video.width, miVideo.Width);
  const height = first(video.height, miVideo.Height);
  const bitDepth = inferBitDepth(video, miVideo, flat);
  const codec = first(video.codec_long_name, video.codec_name, miVideo.Format_Commercial_IfAny, miVideo.Format);
  const container = first(format.format_long_name, format.format_name, miGeneral.Format);
  const color = {
    bitDepth,
    pixelFormat: first(video.pix_fmt, miVideo.ChromaSubsampling),
    colorSpace: first(video.color_space, miVideo.ColorSpace),
    colorTransfer: first(video.color_transfer, miVideo.transfer_characteristics, flat.ColorRepresentation),
    colorPrimaries: first(video.color_primaries, miVideo.colour_primaries),
    range: first(video.color_range)
  };

  return {
    file: { path: filePath, name: path.basename(filePath), size: fmtBytes(stat.size), sizeBytes: stat.size, modified: stat.mtime.toISOString() },
    camera: { display: camera || 'Unknown / not embedded', make: make || null, model: model || null, lens: lens || null },
    image: { resolution: width && height ? `${width} × ${height}` : 'Unknown', width: width || null, height: height || null, fps: fps || 'Unknown', duration: duration ? `${Number(duration).toFixed(2)} sec` : 'Unknown' },
    encoding: { container: container || 'Unknown', codec: codec || 'Unknown', codecTag: first(video.codec_tag_string, miVideo.CodecID), bitrate: fmtBitrate(bitrate) || 'Unknown', rawBitrate: bitrate || null, compression: inferCompression(video, format, miVideo, flat) || 'Unknown' },
    color,
    audio: audio.map(a => ({ codec: first(a.codec_long_name, a.codec_name), channels: a.channels, sampleRate: a.sample_rate, bitrate: fmtBitrate(a.bit_rate) })),
    sideData: { streamCount: streams.length, dataStreams: dataStreams.map(s => ({ type: s.codec_type, codec: s.codec_name, tag: s.codec_tag_string, handler: s.tags?.handler_name })) },
    gyro: { found: detectGyro(ffprobe, flat, mi).length > 0, clues: detectGyro(ffprobe, flat, mi) },
    metadataHighlights: pickHighlights(flat, tags, miGeneral, miVideo)
  };
}

function pickHighlights(flat, tags, miGeneral, miVideo) {
  const keys = ['CreateDate','DateTimeOriginal','TimeCode','ReelName','Encoder','Software','HandlerDescription','CompressorName','Format','CodecID','Encoded_Application','Encoded_Library','Mastered_Date','Tagged_Date'];
  const out = [];
  for (const k of keys) {
    const v = first(flat[k], tags[k], miGeneral[k], miVideo[k]);
    if (v) out.push({ key: k, value: String(v) });
  }
  for (const [k,v] of Object.entries(flat)) {
    if (/camera|lens|gyro|gpmf|timecode|iso|white|focal|shutter|aperture|serial/i.test(k) && out.length < 40) {
      out.push({ key: k, value: String(v).slice(0, 300) });
    }
  }
  const seen = new Set();
  return out.filter(x => { const id = x.key + x.value; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 40);
}

module.exports = { analyzeVideo, discoverTools, buildSummary, flattenExif, parseRate, fmtBitrate, detectGyro };
