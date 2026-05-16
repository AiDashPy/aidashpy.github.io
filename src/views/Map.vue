<script setup>
import { ref, computed, onMounted } from "vue";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import { feature, mesh } from "topojson-client";

// ── Country detection ────────────────────────────────────────

const AUTHOR_MAP = [
  ["Karl Marx", "DEU"], ["Friedrich Engels", "DEU"],
  ["Antoine de Saint-Exupéry", "FRA"], ["Pierre Broué", "FRA"],
  ["Guillaume Suing", "FRA"], ["Philippe Bourrinet", "FRA"],
  ["Frantz Fanon", "FRA"],
  ["Silvio Pons", "ITA"], ["Dante Alighieri", "ITA"], ["Virgil", "ITA"],
  ["Domenico Losurdo", "ITA"], ["Amadeo Bordiga", "ITA"], ["Pietro Basso", "ITA"],
  ["Plato", "GRC"], ["Homer", "GRC"], ["Heraclitus", "GRC"], ["Yanis Varoufakis", "GRC"],
  ["Georg Lukács", "HUN"],
  ["Julius Braunthal", "AUT"],
  ["Hans van de Ven", "NLD"], ["Tony Saich", "NLD"],
  ["Yoshiyuki Tomino", "JPN"],
  ["Stanisław Lem", "POL"],
  ["Strugatsky", "RUS"],
  ["Thomas Pynchon", "USA"], ["Cormac McCarthy", "USA"],
  ["Alexander Rabinowitch", "USA"], ["Ronald Suny", "USA"], ["Jack Ross", "USA"],
  ["Charisse Burden-Stelly", "USA"], ["Tariq D. Khan", "USA"],
  ["Daniel Immerwahr", "USA"], ["Tracy Rosenthal", "USA"], ["Hafsa Kanjwal", "USA"],
  ["Carlos Martinez", "GBR"],
  ["Vijay Prashad", "IND"],
  ["Rashid Khalidi", "PSE"], ["Areej Sabbagh-Khoury", "PSE"],
  ["Xiaohuan Lan", "CHN"],
  ["Unknown Author", "IRQ"],
];

const ALPHA3_TO_NUM = {
  CHN: 156, JPN: 392, USA: 840, DEU: 276, FRA: 250, GBR: 826,
  ITA: 380, GRC: 300, HUN: 348, AUT: 40, NLD: 528, POL: 616,
  RUS: 643, IND: 356, PSE: 275, IRQ: 368,
};

const COUNTRY_NAMES = {
  156: "China", 392: "Japan", 840: "United States", 276: "Germany",
  250: "France", 826: "United Kingdom", 380: "Italy", 300: "Greece",
  348: "Hungary", 40: "Austria", 528: "Netherlands", 616: "Poland",
  643: "Russia", 356: "India", 275: "Palestine", 368: "Iraq (ancient Mesopotamia)",
};

const COUNTRY_COORDS = {
  276: [51.17,  10.45],
  250: [46.23,   2.21],
  826: [55.38,  -3.44],
  380: [41.87,  12.57],
  300: [39.07,  21.82],
  348: [47.16,  19.50],
   40: [47.52,  14.55],
  528: [52.13,   5.29],
  616: [51.92,  19.15],
  643: [61.52, 105.32],
  840: [37.09, -95.71],
  156: [35.86, 104.20],
  392: [36.20, 138.25],
  356: [20.59,  78.96],
  275: [31.95,  35.23],
  368: [33.22,  43.68],
};

function detectCountry(book) {
  const cjk  = /[一-鿿㐀-䶿]/;
  const kana  = /[぀-ヿ]/;
  if (kana.test(book.author) || kana.test(book.name)) return "JPN";
  if (cjk.test(book.author)) return "CHN";
  for (const [pattern, code] of AUTHOR_MAP) {
    if (book.author.includes(pattern)) return code;
  }
  if (cjk.test(book.name)) return "CHN";
  return null;
}

// ── State ────────────────────────────────────────────────────

const books   = ref([]);
const loading = ref(true);
const world   = ref(null);
const hoveredId = ref(null);

const countryBooks = computed(() => {
  const map = {};
  for (const year of books.value) {
    for (const book of year.entries ?? []) {
      const alpha3 = detectCountry(book);
      if (!alpha3) continue;
      const numId = ALPHA3_TO_NUM[alpha3];
      if (!numId) continue;
      if (!map[numId]) map[numId] = [];
      map[numId].push({ ...book, year: year.year });
    }
  }
  return map;
});

const totalCountries = computed(() => Object.keys(countryBooks.value).length);
const totalBooks     = computed(() => books.value.reduce((s, y) => s + (y.entries?.length ?? 0), 0));

// ── Map ──────────────────────────────────────────────────────

const projection = geoNaturalEarth1().scale(153).translate([480, 250]);
const pathGen    = geoPath(projection);
const graticule  = geoGraticule();

const spherePath    = computed(() => pathGen({ type: "Sphere" }) ?? "");
const graticulePath = computed(() => pathGen(graticule()) ?? "");

const countryPathData = computed(() => {
  if (!world.value) return [];
  return feature(world.value, world.value.objects.countries).features.map(f => ({
    id: +f.id,
    d: pathGen(f) ?? "",
  }));
});

const bordersPath = computed(() => {
  if (!world.value) return "";
  return pathGen(mesh(world.value, world.value.objects.countries, (a, b) => a !== b)) ?? "";
});

const markerPositions = computed(() => {
  return Object.entries(countryBooks.value)
    .filter(([id]) => COUNTRY_COORDS[+id])
    .map(([id, bks]) => {
      const [lat, lng] = COUNTRY_COORDS[+id];
      const pt = projection([lng, lat]);
      if (!pt) return null;
      return { id: +id, x: pt[0], y: pt[1], count: bks.length, name: COUNTRY_NAMES[+id] ?? "" };
    })
    .filter(Boolean);
});

function countryFill(id) {
  const hasBooks = !!countryBooks.value[id];
  if (hoveredId.value === id && hasBooks) return "#3a4a20";
  if (hasBooks) return "#242e16";
  return "#19170f";
}

onMounted(async () => {
  const [booksRes, worldRes] = await Promise.all([
    fetch("/books.json"),
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  ]);
  books.value  = await booksRes.json();
  world.value  = await worldRes.json();
  loading.value = false;
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1 class="page-title">Reading Map</h1>
      <p v-if="!loading" class="page-sub">
        {{ totalBooks }} books&thinsp;·&thinsp;{{ totalCountries }} countries
      </p>
    </header>

    <div class="map-wrap">
      <div v-if="loading" class="map-loading">Loading…</div>
      <svg v-else viewBox="0 0 960 500" class="world-svg">
        <!-- Ocean -->
        <path :d="spherePath" fill="#0f0e09" />

        <!-- Graticule -->
        <path :d="graticulePath" fill="none" stroke="#1a1810" stroke-width="0.4" />

        <!-- Countries -->
        <path
          v-for="f in countryPathData"
          :key="f.id"
          :d="f.d"
          :fill="countryFill(f.id)"
          stroke="#222010"
          stroke-width="0.5"
          @mouseenter="hoveredId = f.id"
          @mouseleave="hoveredId = null"
        />

        <!-- Internal borders -->
        <path :d="bordersPath" fill="none" stroke="#2a2618" stroke-width="0.5" />

        <!-- Sphere outline -->
        <path :d="spherePath" fill="none" stroke="#2a2618" stroke-width="1" />

        <!-- Book count markers -->
        <g v-for="m in markerPositions" :key="m.id" class="marker-group">
          <title>{{ m.name }} — {{ m.count }} book{{ m.count !== 1 ? 's' : '' }}</title>
          <circle
            :cx="m.x" :cy="m.y"
            :r="3.5 + m.count * 1.1"
            fill="#c8ba8c"
            opacity="0.88"
          />
          <text
            :x="m.x" :y="m.y"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="7"
            font-weight="700"
            fill="#16140d"
            style="pointer-events:none"
          >{{ m.count }}</text>
        </g>
      </svg>
    </div>

    <section v-if="!loading" class="legend">
      <div
        v-for="(bks, numId) in countryBooks"
        :key="numId"
        class="legend-item"
      >
        <div class="legend-dot"></div>
        <div class="legend-info">
          <span class="legend-country">{{ COUNTRY_NAMES[numId] ?? `Country ${numId}` }}</span>
          <span class="legend-count">{{ bks.length }} book{{ bks.length !== 1 ? "s" : "" }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #16140d;
  padding: 5rem 1.25rem 4rem;
  max-width: 1100px;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-head { margin-bottom: 2rem; }

.page-title {
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: 900;
  color: #c8ba8c;
  letter-spacing: -0.04em;
  margin: 0 0 0.25rem;
}
.page-sub {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3c3924;
  margin: 0;
}

/* ── Map ─────────────────────────────────────────────────── */
.map-wrap {
  width: 100%;
  margin-bottom: 3rem;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #222010;
  background: #0f0e09;
}

.map-loading {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  color: #3c3924;
}

.world-svg {
  width: 100%;
  display: block;
}

.marker-group { cursor: default; }
.marker-group circle { transition: r 150ms ease, opacity 150ms ease; }
.marker-group:hover circle { opacity: 1; }

/* ── Legend ──────────────────────────────────────────────── */
.legend {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  background: #1c1a12;
  border: 1px solid #211f15;
  border-radius: 7px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c8ba8c;
  flex-shrink: 0;
}

.legend-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.legend-country {
  font-size: 0.8rem;
  font-weight: 600;
  color: #c8ba8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.legend-count {
  font-size: 0.68rem;
  color: #524e3c;
}
</style>
