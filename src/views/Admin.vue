<script setup>
import { ref, onMounted, watch } from "vue";

const OWNER = "aidashpy";
const REPO = "aidashpy.github.io";
const ADMIN_USER = "aidashpy";
const ADMIN_PASS_HASH = "efd457adc8e473a6a754dbec44971e226e8dc6c284dc2a88fbabe6708c800e67";

const authed = ref(false);
const loginUser = ref("");
const loginPass = ref("");
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

async function decryptPat(password) {
  const blob = import.meta.env.VITE_ENCRYPTED_PAT;
  if (!blob) throw new Error("No encrypted token in build.");
  const combined = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
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
    let token;
    try {
      token = await decryptPat(loginPass.value);
    } catch {
      loginErr.value = "Token decryption failed. Contact admin.";
      return;
    }
    const test = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!test.ok) {
      loginErr.value = "GitHub token expired. Contact admin to re-encrypt.";
      return;
    }
    pat.value = token;
    authed.value = true;
    sessionStorage.setItem("bookAdminAuth", "1");
    sessionStorage.setItem("bookAdminPat", token);
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

async function updateBooksFile(newBook) {
  // Read both SHAs in parallel; use main as the content source of truth
  const [mainFile, ghFile] = await Promise.all([
    ghGetFile("public/books.json", "main"),
    ghGetFile("books.json", "gh-pages"),
  ]);
  let entries = [];
  if (mainFile) {
    try { entries = JSON.parse(b64Decode(mainFile.content)); } catch {}
  }
  const m = newBook.date?.match(/\/(\d{4})$/);
  const year = m ? m[1] : String(new Date().getFullYear());
  let group = entries.find((g) => g.year === year);
  if (!group) { group = { year, entries: [] }; entries.unshift(group); }
  group.entries.unshift(newBook);
  const content = JSON.stringify(entries, null, 2);
  const message = `Add book: ${newBook.name}`;
  await Promise.all([
    ghPutFile("books.json", "gh-pages", content, ghFile?.sha, message),
    ghPutFile("public/books.json", "main", content, mainFile?.sha, message),
  ]);
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
    const file = await ghGetFile("public/books.json", "main");
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

async function patchBook(name, author, dateStr) {
  // Read both SHAs in parallel; use main as the content source of truth
  const [mainFile, ghFile] = await Promise.all([
    ghGetFile("public/books.json", "main"),
    ghGetFile("books.json", "gh-pages"),
  ]);
  if (!mainFile) throw new Error("public/books.json not found on main");
  const data = JSON.parse(b64Decode(mainFile.content));
  let found = false;
  for (const y of data) {
    const b = (y.entries ?? []).find((e) => e.name === name && e.author === author);
    if (b) { b.finished = true; b.date = dateStr; delete b.finish; found = true; break; }
  }
  if (!found) throw new Error(`Book "${name}" not found`);
  const content = JSON.stringify(data, null, 2);
  const message = `Finish: ${name}`;
  await Promise.all([
    ghPutFile("books.json", "gh-pages", content, ghFile?.sha, message),
    ghPutFile("public/books.json", "main", content, mainFile?.sha, message),
  ]);
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
    await patchBook(book.name, book.author, dateStr);
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

// ── Google Books search ───────────────────────────────────────

const gbQuery = ref('')
const gbResults = ref([])
const gbSearching = ref(false)
const gbSearchErr = ref('')

async function searchGoogleBooks() {
  if (!gbQuery.value.trim()) return
  gbSearching.value = true
  gbSearchErr.value = ''
  gbResults.value = []
  try {
    const key = import.meta.env.VITE_BOOKS_API_KEY
    const q = encodeURIComponent(gbQuery.value.trim())
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6&fields=items(id,volumeInfo(title,authors,imageLinks,industryIdentifiers))${key ? `&key=${key}` : ''}`
    const res = await fetch(url).then(r => r.json())
    gbResults.value = (res.items ?? [])
      .map(item => {
        const ids = item.volumeInfo?.industryIdentifiers ?? []
        const isbn = (ids.find(i => i.type === 'ISBN_13') ?? ids.find(i => i.type === 'ISBN_10'))?.identifier ?? null
        return {
          title: item.volumeInfo?.title ?? '',
          author: item.volumeInfo?.authors?.[0] ?? '',
          thumbnail: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
          isbn,
        }
      })
      .filter(r => r.title)
    if (!gbResults.value.length) gbSearchErr.value = 'No results found.'
  } catch {
    gbSearchErr.value = 'Search failed.'
  } finally {
    gbSearching.value = false
  }
}

async function fetchCoverBlob(item) {
  // 1. Open Library by ISBN — CORS-native, no proxy
  if (item.isbn) {
    try {
      const res = await fetch(`https://covers.openlibrary.org/b/isbn/${item.isbn}-L.jpg`)
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 1000) return blob
      }
    } catch {}
  }
  // 2. Open Library search by title+author — catches books without ISBN
  if (item.title) {
    try {
      const q = encodeURIComponent(item.title)
      const a = encodeURIComponent(item.author)
      const data = await fetch(`https://openlibrary.org/search.json?q=${q}&author=${a}&limit=1&fields=cover_i`).then(r => r.json())
      const coverId = data.docs?.[0]?.cover_i
      if (coverId) {
        const res = await fetch(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`)
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size > 1000) return blob
        }
      }
    } catch {}
  }
  // 3. allorigins proxy for Google Books thumbnail
  if (item.thumbnail) {
    try {
      const hiRes = item.thumbnail.replace(/zoom=\d+/, 'zoom=5')
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(hiRes)}`)
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 1000) return blob
      }
    } catch {}
  }
  return null
}

async function selectGbResult(item) {
  form.value.name = item.title
  form.value.author = item.author
  gbResults.value = []
  gbQuery.value = ''

  if (item.isbn || item.thumbnail) {
    clearImage()
    imgProcessing.value = true
    try {
      const blob = await fetchCoverBlob(item)
      if (blob) {
        const base = item.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase()
        form.value.imgFilename = `${base}.webp`
        const result = await processImage(new File([blob], `${base}.jpg`, { type: blob.type }))
        form.value.imgPreview = result.dataUrl
        imgInfo.value = { origW: result.origW, origH: result.origH, origSize: result.origSize, newW: result.newW, newH: result.newH, newSize: result.newSize }
      }
    } catch {
      // silently skip — user can upload manually
    } finally {
      imgProcessing.value = false
    }
  }
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

    await updateBooksFile(book);

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

        <!-- Google Books search -->
        <div class="gb-search">
          <div class="gb-row">
            <input
              v-model="gbQuery"
              class="input"
              type="text"
              placeholder="Search Google Books to autofill…"
              @keydown.enter.prevent="searchGoogleBooks"
            />
            <button class="btn-ghost gb-btn" type="button" :disabled="gbSearching" @click="searchGoogleBooks">
              {{ gbSearching ? '…' : 'Search' }}
            </button>
          </div>
          <div v-if="gbSearchErr" class="gb-err">{{ gbSearchErr }}</div>
          <div v-if="gbResults.length" class="gb-results">
            <button
              v-for="(item, i) in gbResults"
              :key="i"
              class="gb-item"
              type="button"
              @click="selectGbResult(item)"
            >
              <img v-if="item.thumbnail" :src="item.thumbnail" class="gb-thumb" alt="" />
              <div v-else class="gb-thumb-placeholder" />
              <div class="gb-text">
                <span class="gb-title">{{ item.title }}</span>
                <span class="gb-author">{{ item.author }}</span>
              </div>
            </button>
          </div>
        </div>

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
@media (max-width: 520px) {
  .form-grid { grid-template-columns: 1fr; }
  .panel { padding: 1rem 0.875rem 4rem; }
  .card { padding: 1.1rem; }

  /* Stack in-progress rows: book info on top, actions below */
  .ip-row { flex-direction: column; align-items: stretch; gap: 0.6rem; }
  .ip-info { flex: unset; }
  .ip-actions { width: 100%; }
  .ip-date { flex: 1; width: auto; }

  /* Full-width submit buttons (not the inline finish button inside ip-actions) */
  .btn-primary:not(.ip-btn) { width: 100%; }
  .ip-btn { width: auto; flex-shrink: 0; }

  /* Bigger touch targets in search results */
  .gb-item { padding: 0.7rem 0.75rem; }
  .gb-thumb { width: 32px; height: 48px; }
  .gb-thumb-placeholder { width: 32px; height: 48px; }
}

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

/* ── Google Books search ────────────────────────────── */
.gb-search { margin-bottom: 1.25rem; }
.gb-row { display: flex; gap: 0.5rem; }
.gb-btn { margin-top: 0; min-width: 70px; }
.gb-err { font-size: 0.75rem; color: #3c3924; margin-top: 0.5rem; }
.gb-results {
  margin-top: 0.5rem;
  border: 1px solid #2a2618;
  border-radius: 8px;
  overflow: hidden;
  max-height: 280px;
  overflow-y: auto;
}
.gb-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  background: #1a1810;
  border: none;
  border-bottom: 1px solid #222016;
  cursor: pointer;
  text-align: left;
  transition: background 120ms;
  box-sizing: border-box;
}
.gb-item:last-child { border-bottom: none; }
.gb-item:hover { background: #1f1d12; }
.gb-thumb {
  width: 28px; height: 42px;
  object-fit: contain; border-radius: 2px;
  flex-shrink: 0; background: #16140d;
}
.gb-thumb-placeholder {
  width: 28px; height: 42px; flex-shrink: 0;
  background: #1c1a12; border-radius: 2px; border: 1px solid #2a2618;
}
.gb-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gb-title { font-size: 0.83rem; font-weight: 600; color: #c8ba8c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gb-author { font-size: 0.72rem; color: #728a50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
