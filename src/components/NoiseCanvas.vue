<template>
  <canvas ref="canvasRef" style="position:fixed;inset:0;z-index:0;pointer-events:none" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Renderer, Program, Mesh, Geometry } from 'ogl';

const canvasRef = ref(null);

let renderer, gl, program, mesh, rafId;

const vert = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;

uniform float uTime;

varying vec2 vUv;

// --- value noise helpers ---

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep

  float a = fract(sin(dot(i + vec2(0.0, 0.0), vec2(127.1, 311.7))) * 43758.5453123);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453123);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// --- fBm: 5 octaves ---

float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(st * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 st = vUv * 3.0;

  // slow time drift
  float t = uTime * 0.035;

  // domain warping: fbm(st + fbm(st + t))
  vec2 q = vec2(
    fbm(st + vec2(t, t)),
    fbm(st + vec2(1.7 + t, 9.2 + t))
  );

  float n = fbm(st + q);

  vec3 dark  = vec3(0.082, 0.075, 0.047);
  vec3 light = vec3(0.096, 0.088, 0.053);

  vec3 color = mix(dark, light, clamp(n, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

function resize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function tick(t) {
  rafId = requestAnimationFrame(tick);
  program.uniforms.uTime.value = t * 0.001;
  renderer.render({ scene: mesh });
}

onMounted(() => {
  renderer = new Renderer({
    canvas: canvasRef.value,
    alpha: false,
    antialias: false,
  });
  gl = renderer.gl;

  resize();
  window.addEventListener('resize', resize);

  const geometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    uv:       { size: 2, data: new Float32Array([0,  0,  2,  0,  0,  2]) },
  });

  program = new Program(gl, {
    vertex: vert,
    fragment: frag,
    uniforms: {
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });

  mesh = new Mesh(gl, { geometry, program });

  rafId = requestAnimationFrame(tick);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', resize);
  // lose context to free GPU memory
  const ext = gl && gl.getExtension('WEBGL_lose_context');
  if (ext) ext.loseContext();
});
</script>
