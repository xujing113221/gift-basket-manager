// ─── API 工具 ───
const API = '/api';

async function apiGet(path) { const r = await fetch(API + path); return r.json(); }
async function apiPost(path, body) { const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
async function apiPut(path, body) { const r = await fetch(API + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
async function apiDelete(path) { const r = await fetch(API + path, { method: 'DELETE' }); return r.json(); }

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function toast(msg, type) {
  type = type || 'success';
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  setTimeout(function () { t.classList.remove('show'); }, 2500);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
