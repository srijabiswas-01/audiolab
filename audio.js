export function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function analyze(buffer) {
  let peak = 0, energy = 0, clipping = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
      energy += data[i] ** 2;
      if (Math.abs(data[i]) >= .999) clipping++;
    }
  }
  const count = buffer.length * buffer.numberOfChannels;
  return { duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, peak, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, rmsDb: energy > 0 ? 10 * Math.log10(energy / count) : -Infinity, clipping };
}

export function waveformPeaks(buffer, count = 240) {
  const data = buffer.getChannelData(0);
  const result = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * data.length / count);
    const end = Math.max(start + 1, Math.floor((i + 1) * data.length / count));
    let peak = 0;
    for (let j = start; j < end && j < data.length; j += Math.max(1, Math.floor((end - start) / 128))) peak = Math.max(peak, Math.abs(data[j]));
    result.push(peak);
  }
  const max = Math.max(...result, .01);
  return result.map(v => v / max);
}

export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const bytes = buffer.length * channels * 2;
  const out = new ArrayBuffer(44 + bytes);
  const view = new DataView(out);
  const str = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) for (let c = 0; c < channels; c++) {
    const value = Math.max(-1, Math.min(1, data[c][i]));
    view.setInt16(44 + (i * channels + c) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return out;
}

export function makeDemo(context) {
  const rate = 22050, duration = 48, length = duration * rate;
  const names = ['Melody', 'Drums', 'Bass', 'Atmosphere'];
  const buffers = names.map(() => context.createBuffer(2, length, rate));
  const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
  let seed = 713;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let i = 0; i < length; i++) {
    const t = i / rate, beat = t % .625, note = notes[Math.floor(t / .625) % notes.length];
    const fade = Math.min(t / 1.5, (duration - t) / 2, 1);
    const melody = (Math.sin(2 * Math.PI * note * t) + .25 * Math.sin(2 * Math.PI * note * 2 * t)) * Math.exp(-beat * 6) * .12 * fade;
    const kick = Math.sin(2 * Math.PI * (48 * beat + 5 * (1 - Math.exp(-beat * 30)))) * Math.exp(-beat * 22) * .28;
    const hatTime = t % .3125;
    const noise = random();
    const snare = Math.floor(t / .625) % 2 ? noise * Math.exp(-beat * 32) * .1 : 0;
    const drums = (kick + snare + noise * Math.exp(-hatTime * 95) * .04) * fade;
    const bassHz = [65.406, 55, 43.654, 49][Math.floor(t / 5) % 4];
    const bass = Math.sin(2 * Math.PI * bassHz * t) * .17 * (1 - Math.exp(-beat * 60)) * Math.exp(-beat * 2) * fade;
    const pad = (Math.sin(2 * Math.PI * 130.813 * t) + Math.sin(2 * Math.PI * 164.814 * t) + Math.sin(2 * Math.PI * 196 * t)) * .022 * (.7 + .3 * Math.sin(t)) * fade;
    [melody, drums, bass, pad].forEach((v, c) => { buffers[c].getChannelData(0)[i] = v; buffers[c].getChannelData(1)[i] = v * (c === 0 ? .85 : 1); });
  }
  const mix = context.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) { const out = mix.getChannelData(c); for (const buffer of buffers) { const data = buffer.getChannelData(c); for (let i = 0; i < length; i++) out[i] += data[i]; } }
  return { mix, tracks: buffers.map((buffer, i) => ({ id: `demo-${i}`, name: names[i], buffer, gain: 1, pan: 0, muted: false, solo: false, color: ['#AF719D', '#F8B2B2', '#8B639B', '#403D88'][i] })) };
}

export class AudioEngine {
  constructor() { this.context = null; this.sources = []; this.nodes = []; this.playing = false; this.offset = 0; this.volume = .8; this.onEnd = () => {}; }
  getContext() { return this.context ||= new AudioContext(); }
  async decode(data) { return this.getContext().decodeAudioData(data); }
  position() { return this.playing ? Math.max(0, Math.min(this.duration, this.offset + this.context.currentTime - this.startedAt)) : this.offset; }
  async play(tracks, duration) {
    const context = this.getContext(); await context.resume();
    this.stopSources(); this.duration = duration;
    if (this.offset >= duration) this.offset = 0;
    this.master = context.createGain(); this.master.gain.value = this.volume; this.master.connect(context.destination);
    this.startedAt = context.currentTime + .025; this.playing = true;
    const solo = tracks.some(t => t.solo);
    for (const track of tracks) {
      const source = context.createBufferSource(); source.buffer = track.buffer;
      const gain = context.createGain(); gain.gain.value = track.muted || (solo && !track.solo) ? 0 : track.gain;
      const pan = context.createStereoPanner(); pan.pan.value = track.pan;
      source.connect(gain).connect(pan).connect(this.master); source.start(this.startedAt, this.offset);
      this.sources.push(source); this.nodes.push({ id: track.id, gain, pan });
    }
    this.timer = setTimeout(() => { this.pause(); this.offset = duration; this.onEnd(); }, (duration - this.offset + .025) * 1000);
  }
  update(tracks) { const solo = tracks.some(t => t.solo); for (const node of this.nodes) { const track = tracks.find(t => t.id === node.id); if (track) { node.gain.gain.setTargetAtTime(track.muted || (solo && !track.solo) ? 0 : track.gain, this.context.currentTime, .015); node.pan.pan.setTargetAtTime(track.pan, this.context.currentTime, .015); } } }
  stopSources() { clearTimeout(this.timer); for (const s of this.sources) { try { s.stop(); } catch {} s.disconnect(); } this.sources = []; for (const n of this.nodes) { n.gain.disconnect(); n.pan.disconnect(); } this.nodes = []; this.master?.disconnect(); }
  pause() { this.offset = this.position(); this.playing = false; this.stopSources(); }
  async seek(position, tracks, duration) { const wasPlaying = this.playing; this.pause(); this.offset = Math.max(0, Math.min(duration, position)); if (wasPlaying) await this.play(tracks, duration); }
  setVolume(value) { this.volume = value; if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, .02); }
  async render(tracks, { start = 0, end, fadeIn = 0, fadeOut = 0, sampleRate = 44100, master = 1 }) {
    const duration = end - start;
    if (!(duration > 0)) throw new Error('The end must be after the start.');
    const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const solo = tracks.some(t => t.solo);
    const masterGain = context.createGain(); masterGain.gain.value = master; masterGain.connect(context.destination);
    for (const track of tracks) {
      if (track.muted || (solo && !track.solo)) continue;
      const source = context.createBufferSource(); source.buffer = track.buffer;
      const gain = context.createGain(); gain.gain.setValueAtTime(fadeIn ? 0 : track.gain, 0);
      if (fadeIn) gain.gain.linearRampToValueAtTime(track.gain, Math.min(fadeIn, duration / 2));
      if (fadeOut) { gain.gain.setValueAtTime(track.gain, Math.max(duration / 2, duration - fadeOut)); gain.gain.linearRampToValueAtTime(0, duration); }
      const pan = context.createStereoPanner(); pan.pan.value = track.pan;
      source.connect(gain).connect(pan).connect(masterGain); source.start(0, start, duration);
    }
    return context.startRendering();
  }
}
