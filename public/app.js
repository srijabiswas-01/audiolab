import { AudioEngine, analyze, encodeWav, formatTime, makeDemo, waveformPeaks } from './audio.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.7 13.2A9 9 0 0 1 10.8 3.3 9 9 0 1 0 20.7 13.2Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  wave: '<path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4"/>',
  sliders: '<path d="M5 3v7m0 4v7M12 3v12m0 4v2M19 3v3m0 4v11M2 10h6m1 5h6m1-9h6"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  split: '<path d="M4 12h4c6 0 4-7 10-7h3M17 2l4 3-4 3M8 12c6 0 4 7 10 7h3m-4-3 4 3-4 3"/>',
  convert: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  settings: '<path d="m9 3-.5 3-2 1-3-.5-2 3 2.5 2v2L1.5 16l2 3 3-.5 2 1L9 22h4l.5-2.5 2-1 3 .5 2-3-2.5-2.5v-2l2.5-2-2-3-3 .5-2-1L13 3Z"/><circle cx="11" cy="12.5" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5v14M17 5v14" stroke-width="4"/>',
  back: '<path d="M5 5v14m14-14L8 12l11 7Z"/>',
  forward: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
  loop: '<path d="M4 9a5 5 0 0 1 5-5h10m-3-3 3 3-3 3M20 15a5 5 0 0 1-5 5H5m3-3-3 3 3 3"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9ZM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v9H5a2 2 0 0 1-2-2Zm18 0h-4v9h2a2 2 0 0 0 2-2Z"/>',
  music: '<path d="M9 18V5l12-3v14M9 9l12-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v6h9V3M7 21v-8h10v8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 4H4v16h5m6-12 4 4-4 4M9 12h11"/>',
  activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A11.7 11.7 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-3.2 4.1M6.2 6.2C3.6 8 2 12 2 12s3.5 7 10 7a11.9 11.9 0 0 0 3.1-.4"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wave}</svg>`;
const engine = new AudioEngine();
const state = { page: 'workspace', tab: 'overview', user: null, setupRequired: false, projects: [], exports: [], project: null, tracks: [], mix: null, analysis: null, loop: false, zoom: 1, loading: false, authMode: 'login', activeTool: null, demo: null, modalReturnFocus: null, draft: null };
const owner = () => state.user?.id || 'demo';
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('audiolab-studio', 1);
  request.onupgradeneeded = () => { request.result.createObjectStore('projects', { keyPath: 'id' }); request.result.createObjectStore('exports', { keyPath: 'id' }); };
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
async function database(store, method, value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, method === 'getAll' || method === 'get' ? 'readonly' : 'readwrite');
    const request = transaction.objectStore(store)[method](value);
    transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
async function api(path, body, retry = true) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (body === undefined && retry && [502, 503, 504].includes(response.status)) return api(path, body, false);
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const message = result?.error || `AudioLab's service is temporarily unavailable (HTTP ${response.status}). Please try again.`;
    throw new Error(message);
  }
  if (!result) throw new Error('AudioLab received an invalid response from the hosting service. Please try again.');
  return result;
}
const CLOUD_CHUNK_SIZE = 512 * 1024;
function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function cloudMetadata(record, resetChunks = false) {
  return { id:record.id, name:record.name, filename:record.filename, size:record.size, duration:record.duration, transcript:record.transcript||'', settings:record.settings||[], createdAt:record.createdAt, updatedAt:record.updatedAt||record.createdAt, chunks:Math.ceil(record.size/CLOUD_CHUNK_SIZE), resetChunks };
}
async function uploadProject(record, includeAudio = true) {
  await api('/api/projects', cloudMetadata(record, includeAudio));
  if (!includeAudio) return;
  const bytes = new Uint8Array(record.bytes);
  for (let index = 0, offset = 0; offset < bytes.length; index++, offset += CLOUD_CHUNK_SIZE) {
    await api('/api/projects/chunk', { id:record.id, index, data:bytesToBase64(bytes.subarray(offset, offset+CLOUD_CHUNK_SIZE)) });
  }
}
async function downloadCloudBytes(kind, record) {
  const bytes=new Uint8Array(record.size);
  for(let index=0,offset=0;index<record.chunks;index++,offset+=CLOUD_CHUNK_SIZE) {
    const chunk=base64ToBytes((await api(`/api/${kind}/${encodeURIComponent(record.id)}/chunks/${index}`)).data);bytes.set(chunk,offset);
  }
  return bytes;
}
async function uploadExport(record) {
  const bytes=new Uint8Array(await record.blob.arrayBuffer()),chunks=Math.ceil(bytes.length/CLOUD_CHUNK_SIZE);
  await api('/api/exports',{id:record.id,projectId:record.projectId,name:record.name,size:record.size,createdAt:record.createdAt,chunks});
  for(let index=0,offset=0;offset<bytes.length;index++,offset+=CLOUD_CHUNK_SIZE)await api('/api/exports/chunk',{id:record.id,index,data:bytesToBase64(bytes.subarray(offset,offset+CLOUD_CHUNK_SIZE))});
}
async function migrateBrowserData() {
  if(!state.user)return;
  const cloudProjects=await api('/api/projects'),cloudExports=await api('/api/exports');
  const projectIds=new Set(cloudProjects.projects.map(item=>item.id)),exportIds=new Set(cloudExports.exports.map(item=>item.id));
  for(const project of (await database('projects','getAll')).filter(item=>item.owner===owner())){if(!projectIds.has(project.id))await uploadProject(project,true);await database('projects','delete',project.id);}
  for(const item of (await database('exports','getAll')).filter(item=>item.owner===owner())){if(!exportIds.has(item.id))await uploadExport(item);await database('exports','delete',item.id);}
}
function toast(message, error = false) {
  $('#toast-region').replaceChildren();
  const element = document.createElement('div'); element.className = `toast ${error ? 'error' : ''}`;
  element.innerHTML = `${icon(error ? 'info' : 'check')}<span>${escapeHtml(message)}</span>`; $('#toast-region').append(element);
  setTimeout(() => element.remove(), 5000);
}
function showModal(content) {
  const modal = $('#modal'); state.modalReturnFocus = document.activeElement;
  modal.innerHTML = `<button class="icon-button modal-close" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button>${content}`;
  if (!modal.open) modal.showModal();
}
function closeModal() { $('#modal').close(); state.modalReturnFocus?.focus(); }
const dateText = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const bytesText = bytes => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
function title() { return { workspace: 'Workspace', projects: 'My projects', exports: 'Export center', settings: 'Settings', admin: 'Administration' }[state.page] || 'Workspace'; }
function themeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
  return `<button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="${label}" title="${label}">${icon(dark ? 'sun' : 'moon')}</button>`;
}
window.addEventListener('audiolab:theme', () => {
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
  button.innerHTML = icon(dark ? 'sun' : 'moon');
  button.setAttribute('aria-label', label);
  button.title = label;
});
function navButton(page, label, name, extra = '') { return `<button class="nav-item ${state.page === page ? 'active' : ''}" data-page="${page}">${icon(name)}<span>${label}</span>${extra}</button>`; }
function render() {
  const totalBytes = state.projects.reduce((sum, p) => sum + p.size, 0) + state.exports.reduce((sum, e) => sum + e.size, 0);
  $('#app').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#" data-page="workspace"><span class="brand-mark">${icon('wave')}</span>audio<span>lab</span><span class="brand-dot">.</span></a>
      <button class="workspace-switch" data-action="account"><span class="workspace-avatar">${state.user ? escapeHtml(state.user.name[0].toUpperCase()) : 'P'}</span><span><strong>Personal workspace</strong><small>${state.user ? escapeHtml(state.user.name) : 'A little room to create'}</small></span>${icon('down')}</button>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        ${navButton('workspace', 'Overview', 'grid')}
        ${navButton('projects', 'My projects', 'folder', `<span class="nav-count">${state.projects.length + 1}</span>`)}
        ${navButton('exports', 'Export center', 'download')}
      </nav>
      <div class="nav-label tools-label">AUDIO TOOLS <span>6</span></div>
      <nav aria-label="Audio tools">
        ${[['convert','Audio converter','convert'],['extract','Audio extractor','music'],['analysis','Audio analyzer','activity'],['stems','Stem separator','split'],['transcript','Transcription','mic'],['remix','Remix studio','sliders']].map(([tool,label,name]) => `<button class="nav-item ${state.activeTool === tool ? 'tool-active' : ''}" data-tool="${tool}">${icon(name)}<span>${label}</span>${tool === 'stems' || tool === 'transcript' ? '<span class="ai-tag">AI</span>' : ''}</button>`).join('')}
      </nav>
      <div class="sidebar-bottom">
        <div class="storage-card"><div>${icon('folder')}<strong>Your creative space</strong><span class="status-dot"></span></div><p>${bytesText(totalBytes)} <span>of 2 GB account allowance</span></p><div class="storage-bar"><span style="width:${Math.min(100, Math.max(3, totalBytes / (2 * 1024 ** 3) * 100))}%"></span></div><small>${state.user?'Stored in Neon':'Sign in to save'} ${icon('shield')}</small></div>
        ${navButton('settings', 'Settings', 'settings')}
        ${state.user?.role === 'admin' ? navButton('admin', 'User approvals', 'shield') : ''}
        <button class="nav-item" data-action="help">${icon('help')}<span>Help & getting started</span>${icon('arrow', 'tiny-icon')}</button>
        <div class="sidebar-foot">A little science. A lot of sound.</div>
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu" aria-label="Open navigation">${icon('menu')}</button><span>Workspace</span>${icon('chevron')}<strong>${title() === 'Workspace' ? 'Overview' : title()}</strong></div>
        <div class="topbar-right"><label class="search-box">${icon('search')}<input id="search" placeholder="Find a project..." aria-label="Find a project"><kbd>/</kbd></label>${themeButton()}<button class="icon-button notification-button" data-action="notifications" aria-label="Notifications">${icon('bell')}<i></i></button><span class="topbar-divider"></span><button class="profile-button" data-action="account" aria-label="Account">${state.user ? escapeHtml(state.user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()) : 'JL'}</button></div>
      </header>
      <main id="main-content">${state.page === 'workspace' ? workspace() : state.page === 'projects' ? projectsPage() : state.page === 'exports' ? exportsPage() : state.page === 'settings' ? settingsPage() : adminPage()}</main>
      <footer class="page-footer"><span><span class="status-dot"></span>All good. Let’s make something.</span><span>Made for the love of sound ${icon('wave')}</span></footer>
    </div>`;
  drawAll();
  if (state.page === 'admin') loadAdmin();
}
function workspace() {
  return `<div class="page-heading"><div><div class="eyebrow">YOUR SOUND, REIMAGINED</div><h1>A good day to create<span>.</span></h1><p>Bring your ideas. We’ll bring the possibilities.</p></div><button class="button primary" data-action="upload">${icon('plus')} New project</button></div>
    <section class="hero-grid" aria-label="Welcome to AudioLab"><div class="hero-card"><div class="hero-copy"><span class="small-badge">${icon('sparkles')} A LITTLE SOUND. A LOT OF POSSIBILITY.</span><h2>Find the magic<br>in your sound.</h2><p>Separate. Discover. Remix.<br>Your next great idea starts with a single track.</p><button class="button dark" data-action="upload">Let’s make something ${icon('arrow')}</button></div><div class="record-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="floating-note note-one">✦</div><div class="floating-note note-two">✧</div><div class="vinyl"><div class="vinyl-grooves"></div><div class="record-label"><span>audio<br><b>lab.</b></span><i></i></div></div><div class="sound-pill">${icon('wave')} endless possibilities</div><div class="tiny-star">✦</div></div><span class="hero-edition">VOL. 001 — THE CREATIVE SESSION</span></div>
    <button class="upload-card" id="drop-zone" data-action="upload"><span class="upload-symbol">${icon('upload')}</span><h3>Drop a little inspiration</h3><p>Drag & drop your audio or video here<br>or <span>browse files</span></p><div class="file-tags"><span>MP3</span><span>WAV</span><span>FLAC</span><span>MP4</span><span>+ more</span></div><small>Up to 100 MB · 10 minutes per file</small></button></section>
    <section class="tools-section"><div class="section-heading"><h2>Your creative toolkit <span>Small tools. Big possibilities.</span></h2><span class="subtle-text">PICK YOUR STARTING POINT ${icon('arrow')}</span></div><div class="tool-grid">${[
      ['convert','convert','Convert audio','A fresh format','peach'],['extract','music','Extract audio','Let the sound out','mauve'],['analysis','activity','Analyze audio','Go beneath the surface','purple'],['stems','split','Separate stems','Find every layer','indigo'],['transcript','mic','Transcribe','Sound into words','mauve'],['remix','sliders','Remix studio','Make it your own','peach']
    ].map(([id,name,label,sub,color]) => `<button class="tool-card" data-tool="${id}"><span class="tool-icon ${color}">${icon(name)}</span><strong>${label}</strong><small>${sub}</small>${id === 'stems' || id === 'transcript' ? '<span class="tool-ai">AI</span>' : ''}</button>`).join('')}</div></section>
    <div class="work-grid"><section class="project-panel panel" aria-label="Current project">${projectPanel()}</section><aside class="right-column"><section class="panel recent-panel"><div class="section-heading"><h2>Recent projects</h2><button class="text-button" data-page="projects">View all ${icon('arrow')}</button></div><div class="recent-list">${projectRows(3)}</div><button class="add-project" data-action="upload">${icon('plus')} Start something new</button></section><div class="inspiration-card"><span class="tip-icon">${icon('headphones')}</span><div class="eyebrow">A LITTLE CREATIVE NUDGE</div><h3>Sometimes, less<br>sounds like more.</h3><p>Try muting a layer. You might discover a whole new feeling.</p><button class="text-button" data-tool="remix">Explore your mix ${icon('arrow')}</button><div class="tip-lines" aria-hidden="true">${Array.from({length:20}, (_,i)=>`<i style="height:${12 + Math.sin(i*.8)**2*32}px"></i>`).join('')}</div></div></aside></div>`;
}
function projectPanel() {
  if (!state.project) return '<div class="loading-state"><span class="spinner"></span>Setting the mood…</div>';
  const p = state.project;
  return `<div class="project-title-row"><div class="project-art">${icon('music')}</div><div class="project-title"><div class="overline">${p.demo ? 'MEET YOUR DEMO PROJECT' : 'NOW IN YOUR WORKSPACE'}</div><h2>${escapeHtml(p.name)} <span class="pill">${p.demo ? 'Demo' : 'Neon'}</span></h2><p>${p.demo ? 'An original AudioLab session' : escapeHtml(p.filename)} <span>·</span> ${formatTime(state.mix.duration)} <span>·</span> ${p.demo ? '4 playable layers' : 'Original audio'}</p></div><button class="icon-button" data-action="project-info" aria-label="Project information">${icon('info')}</button></div>
    <div class="project-tabs" role="tablist" aria-label="Project views">${[['overview','Overview'],['stems','Stems'],['transcript','Transcript'],['analysis','Analysis']].map(([id,label])=>`<button role="tab" aria-selected="${state.tab===id}" class="${state.tab===id?'selected':''}" data-tab="${id}">${label}${id==='stems'?`<span>${state.tracks.length}</span>`:''}</button>`).join('')}<span class="saved-state">${icon('check')} ${p.demo ? 'Ready to explore' : 'Saved to Neon'}</span></div>
    <div class="project-view" role="tabpanel">${state.tab==='analysis'?analysisView():state.tab==='transcript'?transcriptView():state.tab==='stems'?stemsView():overviewView()}</div>
    <div class="project-bottom"><span>${icon('shield')} ${p.demo ? 'Original demo audio. Yours to play with.' : 'Stored privately in your Neon account.'}</span><button class="button primary small" data-action="export">${icon('download')} Export audio</button></div>`;
}
function waveform(buffer, className='main-wave', id='main') {
  return `<div class="waveform-scroll"><div class="waveform-area ${className}" style="min-width:${state.zoom*100}%"><canvas data-wave="${id}" role="img" aria-label="Audio waveform"></canvas>${id === 'main' ? '<div class="playhead" id="playhead"><span></span></div><input class="waveform-seek" type="range" min="0" max="1000" value="0" aria-label="Seek through audio">' : ''}</div></div>`;
}
function overviewView() {
  return `<div class="waveform-heading"><span>${icon('wave')} ${state.project.demo ? 'Midnight in bloom · original mix' : 'Original waveform'}</span><div><span class="wave-label">STEREO</span><button class="mini-button" data-action="zoom-out" aria-label="Zoom out">−</button><span class="zoom-label">${state.zoom}×</span><button class="mini-button" data-action="zoom-in" aria-label="Zoom in">+</button></div></div>
    ${waveform(state.mix)}<div class="time-ruler">${Array.from({length:7},(_,i)=>`<span>${formatTime(state.mix.duration*i/6)}</span>`).join('')}</div>
    ${transport()}<div class="audio-stats"><div><span>${icon('clock')} Duration</span><strong>${formatTime(state.mix.duration)}</strong></div><div><span>${icon('activity')} Sample rate</span><strong>${(state.analysis.sampleRate/1000).toFixed(1)} <small>kHz</small></strong></div><div><span>${icon('wave')} Sample peak</span><strong>${Number.isFinite(state.analysis.peakDb)?state.analysis.peakDb.toFixed(1):'−∞'} <small>dBFS</small></strong></div><div><span>${icon('headphones')} Channels</span><strong>${state.analysis.channels===2?'Stereo':state.analysis.channels===1?'Mono':state.analysis.channels}</strong></div></div>`;
}
function transport() {
  return `<div class="transport"><div class="playback-controls"><button class="icon-button ${state.loop?'enabled':''}" data-action="loop" aria-label="Loop playback" aria-pressed="${state.loop}">${icon('loop')}</button><button class="icon-button" data-action="restart" aria-label="Restart">${icon('back')}</button><button class="play-button" data-action="play" aria-label="${engine.playing?'Pause':'Play'}">${icon(engine.playing?'pause':'play')}</button><button class="icon-button" data-action="skip" aria-label="Skip forward 10 seconds">${icon('forward')}</button><span class="playback-time"><b id="elapsed">${formatTime(engine.position())}</b><span>/</span>${formatTime(state.mix.duration)}</span></div><div class="volume-control">${icon('volume')}<input type="range" min="0" max="1" step=".01" value="${engine.volume}" id="master-volume" aria-label="Listening volume"><span class="keyboard-hint">space</span></div></div>`;
}
function stemsView() {
  return `<div class="view-intro"><div><strong>${state.project.demo?'Every layer has a story.':'Your track, your mix.'}</strong><p>${state.project.demo?'These four demo layers were composed separately. Try a new balance.':'Adjust your original track. AI stem separation requires a processing service.'}</p></div>${!state.project.demo?'<button class="button secondary small" data-action="ai-separation">'+icon('split')+' Separate</button>':''}</div><div class="tracks">${state.tracks.map((t,i)=>`<div class="track-row" style="--track-color:${t.color}"><div class="track-name"><span class="track-dot"></span><strong>${escapeHtml(t.name)}</strong><button class="track-toggle ${t.muted?'on':''}" data-track="${i}" data-action="mute" aria-label="Mute ${escapeHtml(t.name)}" aria-pressed="${t.muted}">M</button><button class="track-toggle ${t.solo?'on':''}" data-track="${i}" data-action="solo" aria-label="Solo ${escapeHtml(t.name)}" aria-pressed="${t.solo}">S</button></div><canvas class="track-wave" data-wave="track-${i}" role="img" aria-label="${escapeHtml(t.name)} waveform"></canvas><div class="track-controls"><label>Level <input type="range" min="0" max="1.5" step=".01" value="${t.gain}" data-gain="${i}"><output>${Math.round(t.gain*100)}%</output></label><label>Pan <input type="range" min="-1" max="1" step=".05" value="${t.pan}" data-pan="${i}"><output>${t.pan===0?'C':`${Math.round(Math.abs(t.pan)*100)}${t.pan<0?'L':'R'}`}</output></label></div></div>`).join('')}</div>${transport()}<div class="mix-note">${icon('info')} Listening volume affects preview only. Exports use your track levels.<button class="text-button" data-action="reset-mix">Reset mix</button></div>`;
}
function analysisView() {
  const a = state.analysis, db = value => Number.isFinite(value)?value.toFixed(2):'−∞';
  return `<div class="view-intro"><div><strong>A closer look at your sound.</strong><p>Measured from the original decoded audio.</p></div><span class="pill green">${icon('check')} Analyzed</span></div><div class="analysis-grid">${[['Duration',formatTime(a.duration),'minutes : seconds'],['Sample rate',`${(a.sampleRate/1000).toFixed(1)} kHz`,'decoded sample rate'],['Channels',a.channels===2?'Stereo':a.channels===1?'Mono':a.channels,`${a.channels} audio channels`],['Sample peak',`${db(a.peakDb)} dBFS`,'highest sample level'],['RMS level',`${db(a.rmsDb)} dBFS`,'average signal energy'],['Near-full-scale samples',a.clipping.toLocaleString(),'absolute amplitude ≥ 0.999']].map(([label,value,detail])=>`<div class="analysis-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('')}</div><div class="insight">${icon(a.clipping?'info':'check')}<div><strong>${a.clipping?'Some samples are near full scale.':'There’s room for your creativity.'}</strong><p>${a.clipping?'Check the original recording for audible distortion before raising the gain.':'No near-full-scale samples detected in the original. Check the final mix when raising track levels.'}</p></div></div><p class="fine-print">RMS is not perceived loudness (LUFS). Tempo, key, and AI quality scores are not estimated in this build.</p>`;
}
function transcriptView() {
  return `<div class="view-intro"><div><strong>Give your sound a voice.</strong><p>${state.project.demo?'This instrumental demo contains no spoken words.':'Add a transcript manually or import text you already have.'}</p></div><button class="button secondary small" data-action="ai-transcription">${icon('sparkles')} Auto-transcribe</button></div><label class="field-label" for="transcript-text">Project notes & transcript <span>Manually edited</span></label><textarea id="transcript-text" class="transcript-editor" placeholder="Your words belong here. Type or paste a transcript…">${escapeHtml(state.project.transcript||'')}</textarea><div class="transcript-actions"><span class="subtle-text">${icon('shield')} Saved to Neon</span><button class="text-button" data-action="download-transcript">${icon('download')} Download TXT</button><button class="button primary small" data-action="save-transcript">Save text</button></div>`;
}
function projectRows(limit=100) {
  const rows = [...state.projects, { id:'demo',name:'Midnight in bloom',duration:48,demo:true }].slice(0,limit);
  return rows.map((p,i)=>`<button class="recent-project" data-project="${p.id}"><span class="mini-cover cover-${i%3}">${icon(p.demo?'wave':'music')}</span><span class="recent-project-text"><strong>${escapeHtml(p.name)}</strong><small>${p.demo?'Demo session':dateText(p.createdAt)} <span>·</span> ${formatTime(p.duration)}</small></span>${icon('chevron')}</button>`).join('');
}
function pageHeading(eyebrow, heading, description, action='') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${heading}<span>.</span></h1><p>${description}</p></div>${action}</div>`; }
function projectsPage() {
  return `${pageHeading('A PLACE FOR EVERY IDEA','Your collection of sound','Pick up where you left off. Or start something completely new.',`<button class="button primary" data-action="upload">${icon('plus')} New project</button>`)}<div class="collection-bar"><h2>All projects <span class="pill">${state.projects.length+1}</span></h2><span>Private · ${state.user?'Synced across your devices':'Saved in this browser'}</span></div><div class="project-card-grid">${[...state.projects,{id:'demo',name:'Midnight in bloom',duration:48,demo:true}].map((p,i)=>`<article class="collection-card"><button class="collection-cover cover-${i%3}" data-project="${p.id}" aria-label="Open ${escapeHtml(p.name)}"><div class="mini-vinyl"></div><span>${p.demo?'AUDIOLAB ORIGINAL':'YOUR ORIGINAL SOUND'}</span></button><div class="collection-details"><span class="overline">${p.demo?'DEMO SESSION':'AUDIO PROJECT'}</span><button class="project-name-button" data-project="${p.id}">${escapeHtml(p.name)}</button><p>${formatTime(p.duration)} · ${p.demo?'4 playable layers':dateText(p.createdAt)}</p><div><button class="text-button" data-project="${p.id}">Open project ${icon('arrow')}</button>${!p.demo?`<button class="icon-button" data-action="delete-project" data-id="${p.id}" aria-label="Delete ${escapeHtml(p.name)}">${icon('trash')}</button>`:'<span class="pill">Try it out</span>'}</div></div></article>`).join('')}<button class="new-project-card" data-action="upload"><span>${icon('plus')}</span><strong>The next one is yours.</strong><p>Add a new audio or video file</p></button></div>`;
}
function exportsPage() {
  return `${pageHeading('READY FOR THE WORLD','Your finished sounds','Every export, ready for its next adventure.')}<section class="panel exports-panel">${state.exports.length?`<div class="export-table"><div class="export-table-head"><span>File</span><span>Format</span><span>Size</span><span>Created</span><span>Actions</span></div>${state.exports.map(e=>`<div class="export-row"><span class="export-filename">${icon('music')}<strong>${escapeHtml(e.name)}</strong></span><span class="pill">WAV</span><span>${bytesText(e.size)}</span><span>${dateText(e.createdAt)}</span><div><button class="icon-button" data-action="download-export" data-id="${e.id}" aria-label="Download ${escapeHtml(e.name)}">${icon('download')}</button><button class="icon-button" data-action="delete-export" data-id="${e.id}" aria-label="Delete ${escapeHtml(e.name)}">${icon('trash')}</button></div></div>`).join('')}</div>`:`<div class="empty-state"><span class="empty-icon">${icon('download')}</span><h2>Your next favorite mix goes here.</h2><p>Open a project, find your balance, and export your first WAV file.</p><button class="button primary" data-page="workspace">Back to the studio ${icon('arrow')}</button></div>`}</section>`;
}
function settingsPage() {
  return `${pageHeading('MAKE YOURSELF AT HOME','The little details','Your account, your workspace, your way.')}<div class="settings-grid"><section class="panel settings-panel"><h2>${icon('shield')} Account & access</h2>${state.user?`<div class="account-details"><span class="profile-button">${escapeHtml(state.user.name[0])}</span><div><strong>${escapeHtml(state.user.name)}</strong><p>${escapeHtml(state.user.email)}</p></div><span class="pill">${state.user.role}</span></div><p>Your approved account keeps projects and exports available across browsers and devices.</p><button class="button secondary" data-action="logout">${icon('logout')} Sign out</button>`:`<p>Explore the demo freely. Sign in to access your Neon library.</p><button class="button primary" data-action="account">${state.setupRequired?'Set up your workspace':'Sign in / Register'}</button>`}</section><section class="panel settings-panel"><h2>${icon('folder')} Neon storage</h2><p>Your audio is decoded and mixed on your device, while projects, source audio, settings, transcripts, and exports are stored in Neon.</p><div class="settings-list"><div><span>Primary database</span><strong>Neon Postgres</strong></div><div><span>Output format</span><strong>16-bit stereo WAV</strong></div><div><span>Upload limit</span><strong>100 MB / 10 min</strong></div><div><span>Account allowance</span><strong>2 GB</strong></div></div><p class="fine-print">Download important finished mixes separately for safekeeping.</p></section><section class="panel settings-panel"><h2>${icon('sparkles')} Processing services</h2><p>These advanced tools need a server-side processing integration.</p><div class="settings-list"><div><span>AI stem separation</span><span class="pill">Not connected</span></div><div><span>Automatic transcription</span><span class="pill">Not connected</span></div><div><span>Remote URL import</span><span class="pill">Not connected</span></div><div><span>MP3 / FLAC encoding</span><span class="pill">Not connected</span></div></div></section><section class="panel settings-panel palette-panel"><h2>${icon('sliders')} A softer kind of studio</h2><p>Your palette, woven into every part of AudioLab.</p><div class="palette-swatches">${['#F8B2B2','#AF719D','#8B639B','#403D88'].map(c=>`<div><span style="background:${c}"></span><small>${c}</small></div>`).join('')}</div></section></div>`;
}
function adminPage() { return `${pageHeading('A LITTLE BEHIND THE SCENES','People in your studio','Approve new accounts and manage workspace access.')}<section class="panel admin-panel" id="admin-users"><div class="loading-state">Loading accounts…</div></section>`; }
async function loadAdmin() {
  try { const {users} = await api('/api/admin/users'); const target=$('#admin-users'); if (!target) return;
    target.innerHTML=`<div class="admin-note">${icon('shield')} Account approval is required before new users can sign in.</div>${users.map(u=>`<div class="admin-user"><span class="workspace-avatar">${escapeHtml(u.name[0])}</span><div><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.email)}</small></div><span class="pill ${u.status==='active'?'green':''}">${u.status}</span>${u.role==='admin'?'<span class="subtle-text">Administrator</span>':`<div class="admin-actions">${u.status!=='active'?`<button class="button primary small" data-action="approve" data-id="${u.id}">Approve</button>`:`<button class="button secondary small" data-action="suspend" data-id="${u.id}">Suspend</button>`}${u.status==='pending'?`<button class="text-button" data-action="reject" data-id="${u.id}">Reject</button>`:''}</div>`}</div>`).join('')}`;
  } catch(e) { if($('#admin-users')) $('#admin-users').innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}
async function refreshLibrary() {
  if(!state.user){state.projects=[];state.exports=[];return;}
  [state.projects,state.exports]=await Promise.all([api('/api/projects').then(result=>result.projects),api('/api/exports').then(result=>result.exports)]);
}
function setProject(project, mix, tracks) {
  engine.pause(); engine.offset=0; state.project=project; state.mix=mix; state.tracks=tracks; state.analysis=analyze(mix); state.tab='overview'; state.zoom=1; state.activeTool=null;
}
async function loadDemo() {
  state.demo ||= makeDemo(engine.getContext());
  const settings=JSON.parse(localStorage.getItem(`audiolab-demo-${owner()}`)||'{}');
  setProject({ id:'demo', name:'Midnight in bloom', demo:true, transcript:settings.transcript||'' },state.demo.mix,state.demo.tracks.map(t=>({...t,...settings.tracks?.find(s=>s.id===t.id)})));
}
async function openProject(id) {
  if (id==='demo') await loadDemo();
  else { const record=state.projects.find(project=>project.id===id);if(!record)throw new Error('Project not found in this account.');const bytes=await downloadCloudBytes('projects',record);const buffer=await engine.decode(bytes.buffer);const track={id:'original',name:'Original audio',buffer,gain:1,pan:0,muted:false,solo:false,color:'#AF719D',...record.settings?.[0]};setProject(record,buffer,[track]); }
  state.page='workspace'; render();
}
async function saveProject() {
  const settings=state.tracks.map(({id,gain,pan,muted,solo})=>({id,gain,pan,muted,solo}));
  if(state.project.demo) localStorage.setItem(`audiolab-demo-${owner()}`,JSON.stringify({tracks:settings,transcript:state.project.transcript}));
  else { const updated={...state.project,settings,transcript:state.project.transcript,updatedAt:Date.now()};await uploadProject(updated,false);state.project=updated;const index=state.projects.findIndex(project=>project.id===updated.id);if(index>=0)state.projects[index]=updated; }
}
function drawAll() {
  requestAnimationFrame(()=>{
    document.querySelectorAll('canvas[data-wave]').forEach(canvas=>{
      const id=canvas.dataset.wave, track=id.startsWith('track-')?state.tracks[Number(id.split('-')[1])]:null, buffer=track?.buffer||state.mix;
      if(!buffer)return;
      const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
      canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
      const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
      const peaks=waveformPeaks(buffer,Math.floor(rect.width/3.5)); const center=rect.height/2;
      const gradient=ctx.createLinearGradient(0,0,rect.width,0);gradient.addColorStop(0,'#8B639B');gradient.addColorStop(.48,'#AF719D');gradient.addColorStop(1,'#E9A9B6');
      ctx.fillStyle=track?.color||gradient;
      peaks.forEach((v,i)=>{const h=Math.max(3,v*(rect.height-15));ctx.beginPath();ctx.roundRect(i*3.5,center-h/2,2,h,1);ctx.fill();});
    });updatePlayback();
  });
}
function updatePlayback() {
  const position=engine.position(); const elapsed=$('#elapsed'); if(elapsed)elapsed.textContent=formatTime(position);
  const head=$('#playhead');if(head&&state.mix)head.style.left=`${position/state.mix.duration*100}%`;
  const seek=$('.waveform-seek');if(seek&&state.mix)seek.value=Math.round(position/state.mix.duration*1000);
}
setInterval(()=>{if(engine.playing)updatePlayback();},70);
engine.onEnd=()=>{if(state.loop){engine.offset=0;engine.play(state.tracks,state.mix.duration).catch(e=>toast(e.message,true));}else updatePlayButton();};
function updatePlayButton(){document.querySelectorAll('[data-action="play"]').forEach(b=>{b.innerHTML=icon(engine.playing?'pause':'play');b.setAttribute('aria-label',engine.playing?'Pause':'Play');});updatePlayback();}
async function togglePlay(){if(!state.mix)return;if(engine.playing)engine.pause();else await engine.play(state.tracks,state.mix.duration);updatePlayButton();}
function requestUpload(){
  if(!state.user){state.authMode=state.setupRequired?'register':'login';showAuth();return;}
  $('#file-input').click();
}
async function importFile(file) {
  if(!file)return;if(!state.user){showAuth();return;}if(state.loading)throw new Error('Please wait for the current file to finish.');
  const session = await api('/api/status');
  if (!session.user || session.user.status !== 'active') { state.user = null; await refreshLibrary(); await loadDemo(); render(); showAuth(); throw new Error('Your session ended. Sign in to import audio.'); }
  if(file.size>100*1024**2)throw new Error('Choose a file smaller than 100 MB.');
  const used=state.projects.reduce((s,p)=>s+p.size,0)+state.exports.reduce((s,p)=>s+p.size,0);
  if(used+file.size>2*1024**3)throw new Error('Your account allowance is full. Remove a project or export first.');
  if(!file.size)throw new Error('This file is empty.');
  state.loading=true;toast('Opening your audio. This may take a moment…');
  try {
    const bytes=await file.arrayBuffer();let buffer;
    try{buffer=await engine.decode(bytes.slice(0));}catch{throw new Error('This browser cannot decode that file. Try WAV, MP3, or a supported audio/video codec.');}
    if(buffer.duration>600)throw new Error('Choose a recording shorter than 10 minutes.');
    const now=Date.now();const record={id:crypto.randomUUID(),owner:owner(),name:file.name.replace(/\.[^.]+$/,''),filename:file.name,bytes,size:file.size,duration:buffer.duration,createdAt:now,updatedAt:now,transcript:''};
    await uploadProject(record,true);await refreshLibrary();setProject(record,buffer,[{id:'original',name:'Original audio',buffer,gain:1,pan:0,muted:false,solo:false,color:'#AF719D'}]);state.page='workspace';render();toast('Project saved to Neon.');
  }finally{state.loading=false;$('#file-input').value='';}
}
function passwordField(name, label, autocomplete, confirmation = false) {
  return `<label>${label}<span class="password-field"><input id="auth-${name}" name="${name}" type="password" required minlength="10" maxlength="128" autocomplete="${autocomplete}" placeholder="At least 10 characters"${confirmation ? ' aria-describedby="password-match-help"' : ''}><button class="password-toggle" type="button" data-action="toggle-password" data-target="auth-${name}" aria-label="Show ${label.toLowerCase()}" aria-pressed="false">${icon('eye')}</button></span>${confirmation ? '<small id="password-match-help">Enter the same password again.</small>' : ''}</label>`;
}
function showAuth(){
  if(state.user){showModal(`<div class="modal-symbol">${icon('shield')}</div><h2>Your little corner of AudioLab.</h2><p>Signed in as <strong>${escapeHtml(state.user.name)}</strong>.</p><div class="account-modal-actions"><button class="button primary" data-action="account-settings">Account settings</button><button class="button secondary" data-action="logout">Sign out</button></div>`);return;}
  const register=state.authMode==='register';
  showModal(`<div class="modal-symbol">${icon('wave')}</div><div class="eyebrow">WELCOME TO YOUR CREATIVE SPACE</div><h2>${register?(state.setupRequired?'Make yourself at home.':'Find your sound with us.'):'Good to have you back.'}</h2><p>${state.setupRequired?'The first account becomes the workspace administrator.':register?'New accounts need administrator approval before signing in.':'Sign in to access your projects and exports in Neon.'}</p><form id="auth-form">${register?'<label>Your name<input name="name" required maxlength="80" autocomplete="name" placeholder="Jamie Lee"></label>':''}<label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>${passwordField('password', 'Password', register ? 'new-password' : 'current-password')}${register ? passwordField('confirmPassword', 'Confirm password', 'new-password', true) : ''}<div class="form-error" role="alert"></div><button class="button primary full-width" type="submit">${register?'Create account':'Sign in'} ${icon('arrow')}</button></form><div class="auth-switch">${register?'Already have an account?':'New here?'} <button class="text-button" data-action="switch-auth">${register?'Sign in':'Create an account'}</button></div>`);
}
function showExport(){
  if(!state.mix)return;
  const duration=state.mix.duration;
  showModal(`<div class="modal-symbol">${icon('download')}</div><div class="eyebrow">ONE LAST TOUCH</div><h2>Let your sound out.</h2><p>Render your saved track levels, panning, mute, and solo settings into a new audio file.</p><form id="export-form"><label>File name<input name="filename" required value="${escapeHtml(state.project.name)} — mix" maxlength="120"></label><div class="form-row"><label>Start (seconds)<input name="start" type="number" min="0" max="${duration}" step=".01" value="0" required></label><label>End (seconds)<input name="end" type="number" min=".01" max="${duration}" step=".01" value="${Math.floor(duration*100)/100}" required></label></div><div class="form-row"><label>Fade in (seconds)<input name="fadeIn" type="number" min="0" max="10" step=".1" value="0"></label><label>Fade out (seconds)<input name="fadeOut" type="number" min="0" max="10" step=".1" value="0"></label></div><div class="form-row"><label>Sample rate<select name="sampleRate"><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option><option value="22050">22.05 kHz</option></select></label><label>Format<select name="format"><option>WAV · 16-bit stereo</option></select></label></div><p class="fine-print">WAV export is available locally. MP3 and FLAC encoding need an additional encoder. Preview volume does not affect export.</p><div class="form-error" role="alert"></div><button class="button primary full-width" type="submit">${icon('download')} Export & download</button></form>`);
}
function unavailable(tool){
  const separation=tool==='separation';showModal(`<div class="modal-symbol">${icon(separation?'split':'mic')}</div><span class="pill">PROCESSING SERVICE REQUIRED</span><h2>${separation?'There’s more in every layer.':'Every voice has a story.'}</h2><p>${separation?'AI separation needs a source-separation model running on a processing server. No AI service is connected in this local build.':'Automatic transcription needs a speech-recognition service. No AI service is connected in this local build.'}</p><div class="info-box">${separation?'Explore the demo’s four individually composed layers, or mix the original audio you upload. The demo layers are not an AI separation result.':'You can write or paste a transcript, save it to your project, and download a TXT file. Your audio is not sent anywhere.'}</div><button class="button primary full-width" data-action="${separation?'demo-stems':'manual-transcript'}">${separation?'Explore demo layers':'Open transcript editor'} ${icon('arrow')}</button>`);
}
function download(blob,name){const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function selectTool(tool){state.activeTool=tool;state.page='workspace';
  if(tool==='convert'){render();showExport();}
  else if(tool==='extract'){render();showModal(`<div class="modal-symbol">${icon('music')}</div><h2>Let the picture become sound.</h2><p>Import a video with an audio codec this browser can decode, then export its audio as WAV.</p><div class="info-box">Support depends on the video’s container and codec. Unsupported videos need a server-side media converter, which is not connected yet.</div><button class="button primary full-width" data-action="upload">${icon('upload')} Choose a video</button>`);}
  else {state.tab=tool==='remix'?'stems':tool;render();if(tool==='stems'&&!state.project.demo)unavailable('separation');}
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button,a[data-page]');if(!button)return;
  try{
    if(button.dataset.page){event.preventDefault();state.page=button.dataset.page;state.activeTool=null;render();window.scrollTo({top:0,behavior:'smooth'});return;}
    if(button.dataset.project){await openProject(button.dataset.project);return;}
    if(button.dataset.tool){await selectTool(button.dataset.tool);return;}
    if(button.dataset.tab){state.tab=button.dataset.tab;render();return;}
    const action=button.dataset.action;
    if(action==='close-modal')closeModal();
    else if(action==='toggle-theme')window.AudioLabTheme.toggle();
    else if(action==='menu')$('#sidebar').classList.toggle('mobile-open');
    else if(action==='reload')location.reload();
    else if(action==='upload'){closeModal();requestUpload();}
    else if(action==='play')await togglePlay();
    else if(action==='restart')await engine.seek(0,state.tracks,state.mix.duration);
    else if(action==='skip')await engine.seek(Math.min(state.mix.duration,engine.position()+10),state.tracks,state.mix.duration);
    else if(action==='loop'){state.loop=!state.loop;button.classList.toggle('enabled',state.loop);button.setAttribute('aria-pressed',state.loop);}
    else if(action==='zoom-in'||action==='zoom-out'){state.zoom=Math.max(1,Math.min(4,state.zoom+(action==='zoom-in'?1:-1)));render();}
    else if(action==='mute'||action==='solo'){const t=state.tracks[Number(button.dataset.track)];t[action==='mute'?'muted':'solo']=!t[action==='mute'?'muted':'solo'];engine.update(state.tracks);await saveProject();render();}
    else if(action==='reset-mix'){state.tracks.forEach(t=>{t.gain=1;t.pan=0;t.muted=false;t.solo=false;});engine.update(state.tracks);await saveProject();render();toast('A fresh start. Mix reset.');}
    else if(action==='account') {state.authMode=state.setupRequired?'register':'login';showAuth();}
    else if(action==='switch-auth'){state.authMode=state.authMode==='login'?'register':'login';showAuth();}
    else if(action==='toggle-password'){const input=$(`#${button.dataset.target}`);const revealed=input.type==='text';input.type=revealed?'password':'text';button.setAttribute('aria-label',`${revealed?'Show':'Hide'} ${input.closest('label').childNodes[0].textContent.trim().toLowerCase()}`);button.setAttribute('aria-pressed',String(!revealed));button.innerHTML=icon(revealed?'eye':'eyeOff');input.focus();}
    else if(action==='logout'){await api('/api/logout',{});state.user=null;state.page='workspace';closeModal();await refreshLibrary();await loadDemo();render();toast('Signed out. Your projects remain in your account.');}
    else if(action==='account-settings'){closeModal();state.page='settings';render();}
    else if(action==='export')showExport();
    else if(action==='ai-separation')unavailable('separation');
    else if(action==='ai-transcription')unavailable('transcription');
    else if(action==='demo-stems'){closeModal();await loadDemo();state.page='workspace';state.tab='stems';render();}
    else if(action==='manual-transcript'){closeModal();state.page='workspace';state.tab='transcript';render();}
    else if(action==='save-transcript'){state.project.transcript=$('#transcript-text').value;await saveProject();toast('Your words are saved.');}
    else if(action==='download-transcript'){const text=$('#transcript-text').value;if(!text.trim())throw new Error('Add some text before downloading.');download(new Blob([text],{type:'text/plain;charset=utf-8'}),`${state.project.name}.txt`);}
    else if(action==='download-export'){const record=state.exports.find(item=>item.id===button.dataset.id);if(!record)throw new Error('Export not found.');const bytes=await downloadCloudBytes('exports',record);download(new Blob([bytes],{type:'audio/wav'}),record.name);}
    else if(action==='delete-project'||action==='delete-export'){const store=action==='delete-project'?'projects':'exports';showModal(`<div class="modal-symbol">${icon('trash')}</div><h2>Make room for what’s next?</h2><p>This removes the ${store==='projects'?'project and its audio':'export'} from your Neon account and every signed-in device. Downloaded files are kept.</p><div class="account-modal-actions"><button class="button secondary" data-action="close-modal">Keep it</button><button class="button danger" data-action="confirm-delete" data-store="${store}" data-id="${button.dataset.id}">Delete ${store==='projects'?'project':'export'}</button></div>`);}
    else if(action==='confirm-delete'){const store=button.dataset.store,records=store==='projects'?state.projects:state.exports,record=records.find(item=>item.id===button.dataset.id);if(!record)throw new Error('Item not found.');await api(`/api/${store}/delete`,{id:record.id});if(store==='projects'&&state.project.id===button.dataset.id)await loadDemo();await refreshLibrary();closeModal();render();toast('Removed from your Neon account.');}
    else if(['approve','suspend','reject'].includes(action)){await api('/api/admin/users',{id:button.dataset.id,status:{approve:'active',suspend:'suspended',reject:'rejected'}[action]});await loadAdmin();toast('Account status updated.');}
    else if(action==='project-info'){showModal(`<div class="modal-symbol">${icon('music')}</div><h2>${escapeHtml(state.project.name)}</h2><p>${state.project.demo?'An original 48-second instrumental composed in this application. Four synthesized layers: melody, drums, bass, and atmosphere.':'Your original file is stored in Neon. Mixing creates a new WAV file and does not change the source.'}</p><div class="settings-list"><div><span>Duration</span><strong>${formatTime(state.mix.duration)}</strong></div><div><span>Storage</span><strong>${state.project.demo?'Generated locally':'Neon Postgres'}</strong></div></div>`);}
    else if(action==='notifications'){showModal(`<div class="modal-symbol">${icon('bell')}</div><h2>You’re all caught up.</h2><p>${state.exports.length?`${state.exports.length} audio export${state.exports.length===1?' is':'s are'} ready in your export center.`:'Your workspace is ready. Import a track or explore the demo to get started.'}</p>${state.user?.role==='admin'?'<div class="info-box">Visit Settings → User approvals from the sidebar to review new registrations.</div>':''}`);}
    else if(action==='help'){showModal(`<div class="modal-symbol">${icon('headphones')}</div><h2>A little tour of your studio.</h2><ol class="help-steps"><li><strong>Meet the demo.</strong> Play the original session and explore its four composed layers.</li><li><strong>Bring your own sound.</strong> Create an account, then upload a browser-supported audio or video file.</li><li><strong>Find your balance.</strong> Adjust track level, pan, mute, and solo in Remix studio.</li><li><strong>Make it yours.</strong> Export a stereo WAV with trim and fades.</li></ol><div class="info-box">AI separation, automatic transcription, remote URL import, and additional output encoders need processing integrations. This build keeps audio on your device.</div><p class="fine-print">Keyboard: Space to play/pause. / to search. Escape to close a dialog.</p>`);}
    updatePlayback();
  }catch(e){toast(e.message,true);}
});
document.addEventListener('input',event=>{
  const target=event.target;
  if(target.id==='master-volume')engine.setVolume(Number(target.value));
  if(target.classList.contains('waveform-seek'))engine.seek(Number(target.value)/1000*state.mix.duration,state.tracks,state.mix.duration).catch(e=>toast(e.message,true));
  if(target.dataset.gain!==undefined||target.dataset.pan!==undefined){const gain=target.dataset.gain!==undefined;const track=state.tracks[Number(gain?target.dataset.gain:target.dataset.pan)];const value=Number(target.value);track[gain?'gain':'pan']=value;target.nextElementSibling.textContent=gain?`${Math.round(value*100)}%`:value===0?'C':`${Math.round(Math.abs(value)*100)}${value<0?'L':'R'}`;engine.update(state.tracks);}
  if(target.id==='transcript-text'){state.project.transcript=target.value;}
  if(target.id==='search'){
    const query=target.value.toLowerCase().trim();let results=$('#search-results');if(!query){results?.remove();return;}
    if(!results){results=document.createElement('div');results.id='search-results';results.className='search-results';$('.search-box').append(results);}
    const matches=[...state.projects,{id:'demo',name:'Midnight in bloom'}].filter(p=>p.name.toLowerCase().includes(query));
    results.innerHTML=matches.length?matches.map(p=>`<button data-project="${p.id}">${icon('music')}<span>${escapeHtml(p.name)}</span>${icon('arrow')}</button>`).join(''):'<p>No projects found. Try another name.</p>';
  }
});
document.addEventListener('change',event=>{if(event.target.dataset.gain!==undefined||event.target.dataset.pan!==undefined||event.target.id==='transcript-text')saveProject().catch(e=>toast(e.message,true));});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;const button=$('button[type="submit"]',form);if(!button)return;const values=Object.fromEntries(new FormData(form));const error=$('.form-error',form);button.disabled=true;
  try{
    if(form.id==='auth-form'){
      if(state.authMode==='register'&&values.password!==values.confirmPassword)throw new Error('Passwords do not match.');
      delete values.confirmPassword;
      const result=await api(state.authMode==='register'?'/api/register':'/api/login',values);
      if(result.pending){showModal(`<div class="modal-symbol">${icon('clock')}</div><h2>You’re on the list.</h2><p>${escapeHtml(result.message)}</p><button class="button primary full-width" data-action="close-modal">Explore the demo</button>`);}
      else{state.user=result.user;state.setupRequired=false;await migrateBrowserData();await refreshLibrary();await loadDemo();closeModal();render();toast(`Welcome, ${state.user.name.split(' ')[0]}. Your Neon library is ready.`);}
    }
    if(form.id==='export-form'){
      button.innerHTML='<span class="spinner"></span> Rendering your sound…';
      const start=Number(values.start),end=Number(values.end);
      if(start<0||end>state.mix.duration||end<=start)throw new Error('Choose an end time after the start and within the recording.');
      const estimate=Math.ceil((end-start)*Number(values.sampleRate))*4+44;
      if(state.projects.reduce((s,p)=>s+p.size,0)+state.exports.reduce((s,p)=>s+p.size,0)+estimate>2*1024**3)throw new Error('Local allowance reached. Delete an older export first.');
      const buffer=await engine.render(state.tracks,{start,end,fadeIn:Number(values.fadeIn),fadeOut:Number(values.fadeOut),sampleRate:Number(values.sampleRate)});
      const name=values.filename.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g,'_');if(!name)throw new Error('Enter a file name.');
      const blob=new Blob([encodeWav(buffer)],{type:'audio/wav'});
      const record={id:crypto.randomUUID(),owner:owner(),name:`${name}.wav`,blob,size:blob.size,createdAt:Date.now(),projectId:state.project.id};
      await uploadExport(record);await refreshLibrary();download(blob,record.name);closeModal();render();toast('Your mix is ready and saved to Neon.');
    }
  }catch(e){if(error)error.textContent=e.message;else toast(e.message,true);}
  finally{button.disabled=false;if(form.id==='export-form')button.innerHTML=`${icon('download')} Export & download`;}
});
$('#file-input').addEventListener('change',event=>importFile(event.target.files[0]).catch(e=>toast(e.message,true)));
document.addEventListener('dragover',event=>{event.preventDefault();$('#drop-zone')?.classList.add('dragging');});
document.addEventListener('dragleave',event=>{if(!event.relatedTarget)$('#drop-zone')?.classList.remove('dragging');});
document.addEventListener('drop',event=>{event.preventDefault();$('#drop-zone')?.classList.remove('dragging');if(event.dataTransfer.files.length>1)toast('One sound at a time. Importing the first file.');importFile(event.dataTransfer.files[0]).catch(e=>toast(e.message,true));});
document.addEventListener('keydown',event=>{const editing=event.target.matches('input,textarea,select,[contenteditable]');if(event.code==='Space'&&!editing&&!$('#modal').open&&!event.target.closest('button,a')){event.preventDefault();togglePlay().catch(e=>toast(e.message,true));}if(event.key==='/'&&!editing&&!$('#modal').open){event.preventDefault();$('#search')?.focus();}if(event.key==='Escape'){$('#search-results')?.remove();$('#sidebar')?.classList.remove('mobile-open');}});
document.addEventListener('click',event=>{if(!event.target.closest('.search-box'))$('#search-results')?.remove();if(!event.target.closest('.sidebar,.mobile-menu'))$('#sidebar')?.classList.remove('mobile-open');});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
window.addEventListener('resize',drawAll);
async function init(){
  try{
    const status=await api('/api/status');state.user=status.user;state.setupRequired=status.setupRequired;
    const loadingStatus = $('#startup-status');
    if (loadingStatus) loadingStatus.textContent = 'Gathering your projects…';
    if(state.user)await migrateBrowserData();
    await refreshLibrary();
    if (loadingStatus) loadingStatus.textContent = 'Setting the mood. Preparing your sound…';
    await loadDemo();render();
  }
  catch(e){$('#app').innerHTML=`<div class="startup-error"><img src="/favicon.svg" width="60" alt="AudioLab"><h1>Let’s get your studio ready.</h1><p>${escapeHtml(e.message)}</p><p>Start the application with <code>npm start</code> and open the local address shown in the terminal. Browser storage must be enabled.</p><button class="button primary" data-action="reload">Reload the page</button></div>`;}
}
export const ready = init();
