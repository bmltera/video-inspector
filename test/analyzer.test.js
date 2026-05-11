const assert = require('assert');
const { buildSummary, parseRate, fmtBitrate, detectGyro } = require('../src/main/videoAnalyzer');

assert.strictEqual(parseRate('24000/1001').toFixed(3), '23.976');
assert.strictEqual(fmtBitrate(125000000), '125.00 Mbps');

const ffprobe = {
  format: { duration: '12.5', bit_rate: '125000000', format_long_name: 'QuickTime / MOV', tags: { major_brand: 'qt  ', make: 'Sony', model: 'ILME-FX3' } },
  streams: [
    { codec_type: 'video', codec_name: 'prores', codec_long_name: 'Apple ProRes', width: 3840, height: 2160, avg_frame_rate: '24000/1001', pix_fmt: 'yuv422p10le', bits_per_raw_sample: '10', color_space: 'bt709', color_transfer: 'bt709', color_primaries: 'bt709', codec_tag_string: 'apch' },
    { codec_type: 'audio', codec_name: 'pcm_s24le', channels: 2, sample_rate: '48000' },
    { codec_type: 'data', codec_name: 'gpmd', tags: { handler_name: 'GoPro GPMF metadata' } }
  ]
};
const exif = { 'EXIF:LensModel': 'FE 24-70mm F2.8 GM II', 'QuickTime:TimeCode': '01:00:00:00' };
const summary = buildSummary('C:/clip.mov', { size: 1000, mtime: new Date('2025-01-01') }, ffprobe, exif, null);
assert(summary.camera.display.includes('Sony'));
assert.strictEqual(summary.image.resolution, '3840 × 2160');
assert.strictEqual(summary.image.fps, '23.976 fps');
assert.strictEqual(summary.color.bitDepth, '10');
assert(summary.gyro.found);
assert(detectGyro(ffprobe, {}, null).length > 0);
console.log('analyzer tests passed');
