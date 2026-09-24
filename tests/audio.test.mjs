import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, encodeWav, formatTime, waveformPeaks } from '../public/audio.js';

function buffer(channels, rate = 44100) {
  return { numberOfChannels: channels.length, length: channels[0].length, sampleRate: rate, duration: channels[0].length / rate, getChannelData: c => Float32Array.from(channels[c]) };
}
test('analysis measures channel peaks, RMS and silent input without fabricated values', () => {
  const result = analyze(buffer([[0, .5, -.5, 1], [0, 0, 0, 0]]));
  assert.equal(result.channels, 2); assert.equal(result.peak, 1); assert.equal(result.clipping, 1);
  assert.ok(Math.abs(result.rmsDb - 10 * Math.log10(1.5 / 8)) < 1e-9);
  assert.equal(analyze(buffer([[0, 0]])).rmsDb, -Infinity);
});
test('WAV export writes PCM headers, interleaves stereo, and clamps overflowing samples', () => {
  const wav = encodeWav(buffer([[0, 1, -1, 2], [.5, -.5, -2, 0]], 48000));
  const bytes = Buffer.from(wav); const view = new DataView(wav);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(view.getUint32(4, true), wav.byteLength - 8); assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000); assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 16); assert.equal(view.getInt16(46, true), 16384);
  assert.equal(view.getInt16(54, true), -32768); assert.equal(view.getInt16(56, true), 32767);
});
test('waveform handles silence and short clips; time formatting is stable', () => {
  assert.deepEqual(waveformPeaks(buffer([[0, 0]]), 4), [0, 0, 0, 0]);
  assert.ok(waveformPeaks(buffer([[.5, -.25]]), 8).every(n => Number.isFinite(n) && n >= 0 && n <= 1));
  assert.equal(formatTime(125.9), '2:05'); assert.equal(formatTime(-1), '0:00'); assert.equal(formatTime(Infinity), '0:00');
});
