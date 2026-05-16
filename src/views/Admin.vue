<script setup>
import { ref, onMounted, watch } from "vue";

const OWNER = "aidashpy";
const REPO = "aidashpy.github.io";
const ADMIN_USER = "aidashpy";
const ADMIN_PASS_HASH = "efd457adc8e473a6a754dbec44971e226e8dc6c284dc2a88fbabe6708c800e67";

const authed = ref(false);
const loginUser = ref("");
const loginPass = ref("");
const loginPat = ref(import.meta.env.VITE_GITHUB_PAT ?? "");
const hasEnvPat = !!import.meta.env.VITE_GITHUB_PAT;
const loginErr = ref("");
const loginLoading = ref(false);
const pat = ref("");

const form = ref({ name: "", author: "", finished: true, date: "", imgFilename: "", imgPreview: "", imgManualPath: "" });
const imgInputRef = ref(null);
const formErr = ref("");
const submitting = ref(false);
const submitResult = ref(null);

// ── Auth ──────────────────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function login() {
  loginErr.value = "";
  loginLoading.value = true;
  try {
    const h = await sha256(loginPass.value);
    if (loginUser.value !== ADMIN_USER || h !== ADMIN_PASS_HASH) {
      loginErr.value = "Invalid credentials.";
      return;
    }
    const test = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: { Authorization: `token ${loginPat.value}`, Accept: "application/vnd.github+json" },
    });
    if (!test.ok) {
      loginErr.value = "GitHub token is invalid or lacks repo access.";
      return;
    }
    pat.value = loginPat.value;
    authed.value = true;
    sessionStorage.setItem("bookAdminAuth", "1");
    sessionStorage.setItem("bookAdminPat", loginPat.value);
  } catch {
    loginErr.value = "Network error. Check your connection.";
  } finally {
    loginLoading.value = false;
  }
}

function logout() {
  authed.value = false;
  pat.value = "";
  sessionStorage.removeItem("bookAdminAuth");
  sessionStorage.removeItem("bookAdminPat");
}

onMounted(() => {
  if (sessionStorage.getItem("bookAdminAuth") === "1") {
    const saved = sessionStorage.getItem("bookAdminPat");
    if (saved) { pat.value = saved; authed.value = true; loadInProgress(); }
  }
});

// ── GitHub API ────────────────────────────────────────────────

function ghHeaders() {
  return { Authorization: `token ${pat.value}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
}

async function ghGetFile(path, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} (${branch}): HTTP ${res.status}`);
  return res.json();
}

async function ghPutFile(path, branch, content, sha, message, binary = false) {
  const encoded = binary ? content : btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded, branch, ...(sha ? { sha } : {}) };
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`,
    { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `PUT ${path} (${branch}): HTTP ${res.status}`);
  }
  return res.json();
}

function b64Decode(str) {
  const binary = atob(str.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function updateBooksFile(filePath, branch, newBook) {
  const file = await ghGetFile(filePath, branch);
  let entries = [];
  if (file) {
    try { entries = JSON.parse(b64Decode(file.content)); } catch {}
  }
  const m = newBook.date?.match(/\/(\d{4})$/);
  const year = m ? m[1] : String(new Date().getFullYear());
  let group = entries.find((g) => g.year === year);
  if (!group) { group = { year, entries: [] }; entries.unshift(group); }
  group.entries.unshift(newBook);
  await ghPutFile(filePath, branch, JSON.stringify(entries, null, 2), file?.sha, `Add book: ${newBook.name}`);
}

// ── In-progress books ─────────────────────────────────────────

const inProgress = ref([]);
const finishDates = ref({});
const finishingKey = ref(null);
const finishResult = ref(null);
const loadingProgress = ref(false);

function bookKey(b) { return b.name + "||" + b.author; }

async function loadInProgress() {
  loadingProgress.value = true;
  try {
    const file = await ghGetFile("books.json", "gh-pages");
    if (!file) return;
    const data = JSON.parse(b64Decode(file.content));
    const list = [];
    for (const y of data) {
      for (const b of (y.entries ?? [])) {
        const ip = b.finished === false || (b.finish && /^started/i.test(b.finish));
        if (ip) list.push({ ...b, year: y.year });
      }
    }
    inProgress.value = list;
    const today = new Date().toISOString().split("T")[0];
    for (const b of list) {
      if (!finishDates.value[bookKey(b)]) finishDates.value[bookKey(b)] = today;
    }
  } catch {} finally {
    loadingProgress.value = false;
  }
}

async function patchBookFile(filePath, branch, name, author, dateStr) {
  const file = await ghGetFile(filePath, branch);
  if (!file) throw new Error(`${filePath} not found on ${branch}`);
  const data = JSON.parse(b64Decode(file.content));
  let found = false;
  for (const y of data) {
    const b = (y.entries ?? []).find((e) => e.name === name && e.author === author);
    if (b) { b.finished = true; b.date = dateStr; delete b.finish; found = true; break; }
  }
  if (!found) throw new Error(`Book "${name}" not found in ${filePath}`);
  await ghPutFile(filePath, branch, JSON.stringify(data, null, 2), file.sha, `Finish: ${name}`);
}

async function markFinished(book) {
  const key = bookKey(book);
  const raw = finishDates.value[key];
  if (!raw) return;
  const [y, m, d] = raw.split("-");
  const dateStr = `${m}/${d}/${y}`;
  finishingKey.value = key;
  finishResult.value = null;
  try {
    await Promise.all([
      patchBookFile("books.json", "gh-pages", book.name, book.author, dateStr),
      patchBookFile("public/books.json", "main", book.name, book.author, dateStr),
    ]);
    finishResult.value = { ok: true, name: book.name };
    await loadInProgress();
  } catch (err) {
    finishResult.value = { ok: false, msg: err.message };
  } finally {
    finishingKey.value = null;
  }
}

watch(authed, (val) => { if (val) loadInProgress(); });

// ── Image processing ──────────────────────────────────────────

const imgProcessing = ref(false);
const imgInfo = ref(null); // { origW, origH, origSize, newW, newH, newSize }

function fmtSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

function processImage(file, maxWidth = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const origSize = file.size;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth;
      const origH = img.naturalHeight;
      const scale = Math.min(1, maxWidth / origW);
      const newW = Math.round(origW * scale);
      const newH = Math.round(origH * scale);
      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      canvas.getContext("2d").drawImage(img, 0, 0, newW, newH);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
        const reader = new FileReader();
        reader.onload = (ev) => resolve({ dataUrl: ev.target.result, origW, origH, origSize, newW, newH, newSize: blob.size });
        reader.readAsDataURL(blob);
      }, "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

async function onImagePick(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const base = file.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_");
  form.value.imgFilename = `${base}.webp`;
  form.value.imgManualPath = "";
  form.value.imgPreview = "";
  imgInfo.value = null;
  imgProcessing.value = true;
  try {
    const result = await processImage(file);
    form.value.imgPreview = result.dataUrl;
    imgInfo.value = { origW: result.origW, origH: result.origH, origSize: result.origSize, newW: result.newW, newH: result.newH, newSize: result.newSize };
  } catch (err) {
    formErr.value = `Image processing failed: ${err.message}`;
  } finally {
    imgProcessing.value = false;
  }
}

function clearImage() {
  form.value.imgFilename = "";
  form.value.imgPreview = "";
  imgInfo.value = null;
  if (imgInputRef.value) imgInputRef.value.value = "";
}

// ── Submit ────────────────────────────────────────────────────

async function submit() {
  formErr.value = "";
  submitResult.value = null;
  if (!form.value.name.trim()) { formErr.value = "Name is required."; return; }
  if (!form.value.author.trim()) { formErr.value = "Author is required."; return; }
  if (!form.value.date) { formErr.value = "Date is required."; return; }

  submitting.value = true;
  try {
    const [y, m, d] = form.value.date.split("-");
    const dateStr = `${m}/${d}/${y}`;

    let imgPath = form.value.imgManualPath.trim() || "";

    if (form.value.imgPreview && form.value.imgFilename) {
      const base64 = form.value.imgPreview.split(",")[1];
      const filename = form.value.imgFilename;
      imgPath = `/images/${filename}`;

      // Fetch existing SHAs in parallel (needed to update existing files)
      const [ghImg, mainImg] = await Promise.all([
        ghGetFile(`images/${filename}`, "gh-pages"),
        ghGetFile(`public/images/${filename}`, "main"),
      ]);

      // Commit image to both branches in parallel
      await Promise.all([
        ghPutFile(`images/${filename}`, "gh-pages", base64, ghImg?.sha, `Add cover: ${filename}`, true),
        ghPutFile(`public/images/${filename}`, "main", base64, mainImg?.sha, `Add cover: ${filename}`, true),
      ]);
    }

    const book = {
      name: form.value.name.trim(),
      author: form.value.author.trim(),
      finished: form.value.finished,
      date: dateStr,
      img: imgPath,
    };

    // Update books.json on both branches in parallel
    await Promise.all([
      updateBooksFile("books.json", "gh-pages", book),
      updateBooksFile("public/books.json", "main", book),
    ]);

    submitResult.value = { ok: true, name: book.name };
    form.value = { name: "", author: "", finished: true, date: "", imgFilename: "", imgPreview: "", imgManualPath: "" };
    if (imgInputRef.value) imgInputRef.value.value = "";
  } catch (err) {
    submitResult.value = { ok: false, msg: err.message };
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- Login -->
  <div v-if="!authed" class="login-wrap">
    <form class="login-card" @submit.prevent="login">
      <h1 class="login-title">Book Admin</h1>

      <div class="field">
        <label class="label">Username</label>
        <input v-model="loginUser" class="input" type="text" autocomplete="username" spellcheck="false" />
      </div>

      <div class="field">
        <label class="label">Password</label>
        <input v-model="loginPass" class="input" type="password" autocomplete="current-password" />
      </div>

      <div class="field" v-if="!hasEnvPat">
        <label class="label">GitHub token</label>
        <input v-model="loginPat" class="input input-mono" type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false" />
        <span class="field-hint">Fine-grained PAT with <code>contents: write</code> on this repo</span>
      </div>

      <p v-if="loginErr" class="err">{{ loginErr }}</p>
      <button class="btn-primary" type="submit" :disabled="loginLoading">
        {{ loginLoading ? "Signing in…" : "Sign in" }}
      </button>
    </form>
  </div>

  <!-- Admin panel -->
  <div v-else class="admin-wrap">

    <header class="top-bar">
      <span class="top-title">Book Admin</span>
      <button class="btn-ghost" @click="logout">Sign out</button>
    </header>

    <div class="panel">

      <!-- Result banner -->
      <div v-if="submitResult" class="result-banner" :class="submitResult.ok ? 'result-ok' : 'result-err'">
        <template v-if="submitResult.ok">
          <strong>"{{ submitResult.name }}"</strong> committed to GitHub.
          Live site updates in ~30 seconds.
        </template>
        <template v-else>
          Error: {{ submitResult.msg }}
        </template>
        <button class="result-close" @click="submitResult = null">✕</button>
      </div>

      <!-- Add book form -->
      <section class="card">
        <h2 class="section-title">Add Book</h2>

        <div class="form-grid">
          <div class="field">
            <label class="label">Book name</label>
            <input v-model="form.name" class="input" type="text" placeholder="Capital - Volume 4" />
          </div>

          <div class="field">
            <label class="label">Author</label>
            <input v-model="form.author" class="input" type="text" placeholder="Karl Marx" />
          </div>

          <div class="field">
            <label class="label">Status</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" :value="true" v-model="form.finished" class="radio" />
                Finished
              </label>
              <label class="radio-label">
                <input type="radio" :value="false" v-model="form.finished" class="radio" />
                In Progress
              </label>
            </div>
          </div>

          <div class="field">
            <label class="label">{{ form.finished ? "Date finished" : "Date started" }}</label>
            <input v-model="form.date" class="input" type="date" />
          </div>

          <!-- Image -->
          <div class="field field-full">
            <label class="label">Cover image</label>
            <div class="img-row">
              <label class="btn-file">
                Choose file
                <input ref="imgInputRef" type="file" accept="image/*" class="sr-only" @change="onImagePick" />
              </label>
              <template v-if="form.imgFilename">
                <span class="img-path">/images/{{ form.imgFilename }}</span>
                <button class="btn-x" type="button" @click="clearImage">✕</button>
              </template>
              <span v-else class="img-none">no file chosen</span>
            </div>

            <div v-if="imgProcessing" class="img-processing">Converting to WebP…</div>

            <div v-if="form.imgPreview && !imgProcessing" class="img-preview-wrap">
              <img :src="form.imgPreview" alt="Preview" class="img-preview" />
              <div v-if="imgInfo" class="img-stats">
                <span class="img-stat-orig">{{ imgInfo.origW }}×{{ imgInfo.origH }} · {{ fmtSize(imgInfo.origSize) }}</span>
                <span class="img-stat-arrow">→</span>
                <span class="img-stat-new">{{ imgInfo.newW }}×{{ imgInfo.newH }} · {{ fmtSize(imgInfo.newSize) }} WebP</span>
              </div>
            </div>

            <div class="img-manual-row">
              <span class="img-manual-label">or use existing repo path</span>
              <input
                v-model="form.imgManualPath"
                class="input input-mono"
                type="text"
                placeholder="/images/myBook.webp"
                :disabled="!!form.imgFilename"
              />
            </div>
          </div>
        </div>

        <p v-if="formErr" class="err">{{ formErr }}</p>

        <button class="btn-primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? "Committing…" : "Add to reading list" }}
        </button>
      </section>

      <!-- Finish in-progress books -->
      <section class="card" v-if="inProgress.length || loadingProgress">
        <h2 class="section-title">Finish a Book</h2>

        <div v-if="loadingProgress" class="ip-loading">Loading…</div>

        <div v-if="finishResult" class="result-banner" :class="finishResult.ok ? 'result-ok' : 'result-err'" style="margin-bottom:1rem">
          <template v-if="finishResult.ok"><strong>"{{ finishResult.name }}"</strong> marked as finished.</template>
          <template v-else>Error: {{ finishResult.msg }}</template>
          <button class="result-close" @click="finishResult = null">✕</button>
        </div>

        <div class="ip-list">
          <div v-for="b in inProgress" :key="bookKey(b)" class="ip-row">
            <div class="ip-info">
              <img v-if="b.img" :src="b.img" :alt="b.name" class="ip-cover" />
              <div class="ip-text">
                <span class="ip-title">{{ b.name }}</span>
                <span class="ip-author">{{ b.author }}</span>
              </div>
            </div>
            <div class="ip-actions">
              <input
                v-model="finishDates[bookKey(b)]"
                class="input ip-date"
                type="date"
              />
              <button
                class="btn-primary ip-btn"
                :disabled="finishingKey === bookKey(b)"
                @click="markFinished(b)"
              >
                {{ finishingKey === bookKey(b) ? "Saving…" : "Mark finished" }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section class="card card-info">
        <h2 class="section-title">How it works</h2>
        <ul class="info-list">
          <li>Commits <code>books.json</code> directly to the <code>gh-pages</code> branch — no rebuild needed</li>
          <li>Also updates <code>public/books.json</code> on <code>main</code> so future deploys stay in sync</li>
          <li>If you upload a cover, it's committed to <code>images/</code> on <code>gh-pages</code> and <code>public/images/</code> on <code>main</code></li>
          <li>GitHub Pages propagates changes within ~30 seconds</li>
        </ul>
      </section>

    </div>
  </div>
</template>

<style scoped>
/* ── Shared ─────────────────────────────────────────── */
.input {
  width: 100%;
  background: #1c1a12;
  border: 1px solid #2a2618;
  border-radius: 7px;
  padding: 0.5rem 0.75rem;
  color: #e0d4b4;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms;
}
.input:focus { border-color: #7a8c58; }
.input::placeholder { color: #3c3924; }
.input:disabled { opacity: 0.4; cursor: not-allowed; }
.input-mono { font-family: monospace; font-size: 0.82rem; }

.label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7a8c58;
  margin-bottom: 0.4rem;
}

.field { display: flex; flex-direction: column; gap: 0; }
.field-full { grid-column: 1 / -1; }

.field-hint {
  font-size: 0.7rem;
  color: #3c3924;
  margin-top: 0.35rem;
}
.field-hint code { color: #524e3c; }

.err { font-size: 0.8rem; color: #c06060; margin: 0.5rem 0 0; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #4a5c30;
  background: #2a3818;
  color: #b0c880;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms, border-color 150ms;
  margin-top: 1rem;
}
.btn-primary:hover:not(:disabled) { background: #324420; border-color: #5a6c38; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  border: 1px solid #2a2618;
  border-radius: 7px;
  color: #7a8c58;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: border-color 150ms;
}
.btn-ghost:hover { border-color: #3a3620; }

/* ── Login ─────────────────────────────────────────── */
.login-wrap {
  min-height: 100vh;
  background: #16140d;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: #1c1a12;
  border: 1px solid #2a2618;
  border-radius: 12px;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #c8ba8c;
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}

/* ── Admin panel ───────────────────────────────────── */
.admin-wrap {
  min-height: 100vh;
  background: #16140d;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #2a2618;
  background: #1a1810;
  position: sticky;
  top: 0;
  z-index: 10;
}

.top-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #c8ba8c;
  letter-spacing: -0.01em;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
  box-sizing: border-box;
}

/* ── Result banner ─────────────────────────────────── */
.result-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  font-size: 0.84rem;
  line-height: 1.5;
}
.result-ok  { background: #192010; border: 1px solid #2a3818; color: #b0c880; }
.result-err { background: #1a1010; border: 1px solid #3a2020; color: #c07070; }
.result-close {
  background: transparent; border: none; cursor: pointer;
  color: inherit; opacity: 0.5; font-size: 0.9rem; padding: 0; flex-shrink: 0;
}
.result-close:hover { opacity: 1; }

/* ── Card ──────────────────────────────────────────── */
.card {
  background: #1c1a12;
  border: 1px solid #2a2618;
  border-radius: 10px;
  padding: 1.5rem;
}
.card-info { border-color: #211f15; }

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7a8c58;
  margin: 0 0 1.25rem;
}

/* ── Form grid ─────────────────────────────────────── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } }

.radio-group {
  display: flex;
  gap: 1.25rem;
  align-items: center;
  padding: 0.5rem 0;
}
.radio-label {
  display: flex; align-items: center; gap: 0.45rem;
  font-size: 0.85rem; color: #a09474; cursor: pointer;
}
.radio { accent-color: #7a8c58; width: 15px; height: 15px; cursor: pointer; }

/* ── Image field ───────────────────────────────────── */
.img-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.btn-file {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.85rem;
  border-radius: 7px;
  border: 1px solid #2a2618;
  background: #222016;
  color: #a09474;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 150ms;
  flex-shrink: 0;
}
.btn-file:hover { border-color: #3a3620; }

.img-path { font-size: 0.75rem; color: #7a8c58; font-family: monospace; }
.img-none { font-size: 0.75rem; color: #3c3924; }

.btn-x {
  background: transparent; border: none; color: #3c3924;
  font-size: 0.8rem; cursor: pointer; padding: 0.1rem 0.3rem;
  border-radius: 4px; transition: color 150ms;
}
.btn-x:hover { color: #c06060; }

.img-processing {
  font-size: 0.75rem;
  color: #7a8c58;
  padding: 0.4rem 0;
  animation: pulse 1s ease-in-out infinite alternate;
}
@keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }

.img-preview-wrap { margin-bottom: 0.75rem; }
.img-preview {
  height: 96px; width: auto; max-width: 72px;
  object-fit: contain; border-radius: 5px;
  background: #1a1812; border: 1px solid #2a2618; display: block;
  margin-bottom: 0.5rem;
}

.img-stats {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.img-stat-orig { font-size: 0.7rem; color: #3c3924; font-variant-numeric: tabular-nums; }
.img-stat-arrow { font-size: 0.7rem; color: #3c3924; }
.img-stat-new { font-size: 0.7rem; color: #7a8c58; font-weight: 600; font-variant-numeric: tabular-nums; }

.img-manual-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.25rem;
}
.img-manual-label { font-size: 0.68rem; color: #3c3924; }

/* ── In-progress ───────────────────────────────────── */
.ip-loading { font-size: 0.78rem; color: #3c3924; padding: 0.5rem 0; }
.ip-list { display: flex; flex-direction: column; gap: 0.75rem; }
.ip-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 0.75rem;
  background: #1a1810; border: 1px solid #252110; border-radius: 8px; flex-wrap: wrap;
}
.ip-info { display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1; }
.ip-cover { width: 32px; height: 48px; object-fit: contain; border-radius: 3px; background: #16140d; flex-shrink: 0; }
.ip-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ip-title { font-size: 0.85rem; font-weight: 600; color: #c8ba8c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.ip-author { font-size: 0.72rem; color: #728a50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.ip-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.ip-date { width: 140px; padding: 0.4rem 0.6rem; font-size: 0.8rem; }
.ip-btn { margin-top: 0; font-size: 0.78rem; padding: 0.4rem 0.85rem; }

/* ── Info list ─────────────────────────────────────── */
.info-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.info-list li { font-size: 0.8rem; color: #524e3c; line-height: 1.6; }
.info-list code { color: #7a7260; font-size: 0.85em; background: #1a1810; padding: 1px 4px; border-radius: 3px; }
</style>
