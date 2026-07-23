import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { VEIL_WARP_COLORS, VEIL_WARP_CONFIG } from './veilWarpFieldConfig';
import {
  SWEEP_WAKE_DEG,
  scannerSweepBridge,
} from './scannerSweepBridge';

const VERT_SRC = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uMotionScale;
uniform float uIntensity;
uniform float uWarpStrength;
uniform float uContourIntensity;
uniform float uVioletIntensity;
uniform float uPinkIntensity;
uniform float uMintIntensity;
uniform float uVignetteStrength;
uniform float uSweepAngle;
uniform vec2 uScannerCenter;
uniform float uScannerRadius;
uniform float uSweepActive;
uniform float uWakeDeg;
uniform float uSweepLeadDeg;
uniform float uSweepContourBoost;
uniform float uSweepMintShift;
uniform float uSweepRefraction;
uniform float uSweepWakeStrength;
uniform float uReducedMotion;
uniform vec2 uSelectedContact;
uniform float uHasSelectedContact;
uniform float uSelectionStrength;
uniform float uSelectionStartTime;
uniform float uSelectionRippleExpand;
uniform float uSelectionRippleMaxR;
uniform float uSelectionInitialSec;
uniform float uSelectionFlowInfluence;
uniform float uSelectionRadialStrength;
uniform float uSelectionTangentialStrength;

in vec2 vUv;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec3 hexToRgb(float r, float g, float b) {
  return vec3(r, g, b) / 255.0;
}

float angDiffDeg(float a, float b) {
  float d = mod(a - b + 180.0, 360.0) - 180.0;
  return abs(d);
}

float wakeBehindDeg(float sampleDeg, float leadDeg) {
  return mod(leadDeg - sampleDeg + 360.0, 360.0);
}

/** Existing base flow — same character as the accepted Veil animation. */
vec2 sampleVeilFlow(vec2 pos, float t, float warpScale) {
  float waveA = sin(pos.x * 2.1 + t * 0.38) * cos(pos.y * 1.55 - t * 0.27);
  float waveB = sin(pos.y * 2.4 + t * 0.52 + 1.7) * cos(pos.x * 1.2 + t * 0.31);
  float waveC = sin(dot(pos, vec2(1.35, -0.95)) * 1.8 - t * 0.22);
  vec2 vortexCenter = vec2(0.22, -0.18);
  vec2 toVortex = pos - vortexCenter;
  float vortexR = length(toVortex) + 0.001;
  vec2 curl = vec2(-toVortex.y, toVortex.x) / vortexR;
  curl *= 0.045 * warpScale * smoothstep(1.4, 0.15, vortexR);
  vec2 warp = vec2(waveA, waveB) * (0.018 * warpScale);
  warp += curl;
  warp += vec2(sin(t * 0.19), cos(t * 0.14)) * 0.006 * warpScale;
  float basin = smoothstep(0.55, 0.0, length(pos - vec2(-0.35, 0.28)));
  warp += vec2(waveC, -waveA) * (0.012 * warpScale * basin);
  return warp;
}

/** Primary Veil scalar field sampled in atmospheric domain space. */
float sampleVeilField(vec2 q, float t) {
  float field = 0.0;
  field += sin(q.x * 4.2 + q.y * 1.3 + t * 0.25) * 0.45;
  field += sin(q.y * 5.1 - q.x * 0.9 - t * 0.18) * 0.35;
  field += cos(length(q - vec2(0.4, -0.25)) * 7.0 - t * 0.3) * 0.4;
  field += vnoise(q * 3.2 + t * 0.05) * 0.55;
  field += vnoise(q * 6.5 - vec2(t * 0.04, -t * 0.03)) * 0.28;
  return field;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  // Sweep uses y-down screen space to match SVG scanner angles.
  vec2 sweepDelta = vec2((uv.x - uScannerCenter.x) * aspect, -(uv.y - uScannerCenter.y));
  float sweepDist = length(sweepDelta);
  float inScope = 1.0 - smoothstep(uScannerRadius * 0.94, uScannerRadius * 1.04, sweepDist);
  float sampleDeg = degrees(atan(sweepDelta.y, sweepDelta.x));
  if (sampleDeg < 0.0) sampleDeg += 360.0;

  float wakeT = 0.0;
  float leadEdge = 0.0;
  float sweepGate = inScope * uSweepActive;
  if (sweepGate > 0.001) {
    float behind = wakeBehindDeg(sampleDeg, uSweepAngle);
    float wakeWidth = max(uWakeDeg, 1.0);
    wakeT = (1.0 - smoothstep(0.0, wakeWidth, behind)) * sweepGate;
    wakeT *= wakeT;
    leadEdge = (1.0 - smoothstep(0.0, uSweepLeadDeg, behind)) * sweepGate;
    if (uReducedMotion > 0.5) {
      wakeT = 0.0;
      leadEdge = (1.0 - smoothstep(0.0, uSweepLeadDeg * 0.85, angDiffDeg(sampleDeg, uSweepAngle)))
        * sweepGate * 0.65;
    }
  }

  vec2 refractOff = vec2(0.0);
  if (uReducedMotion < 0.5 && leadEdge > 0.01) {
    vec2 radial = sweepDelta / max(sweepDist, 0.0001);
    refractOff = radial.yx * vec2(1.0, -1.0) * (uSweepRefraction * leadEdge);
  }

  // Aspect-correct atmospheric space; mild artistic bias (independent of sweep).
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  p += vec2(-0.08, 0.05);
  p += refractOff;

  float t = uTime * uMotionScale;
  float warpScale = uWarpStrength;

  // --- Base flow (accepted Veil character) ---
  vec2 baseFlow = sampleVeilFlow(p, t, warpScale);
  vec2 qBase = p + baseFlow;

  // --- Selected lock in scanner UV (same transform as visible pips) ---
  vec2 selDelta = vec2((uv.x - uSelectedContact.x) * aspect, uv.y - uSelectedContact.y);
  float selDist = length(selDelta);
  float selGate = uHasSelectedContact * uSelectionStrength * inScope;
  float selWell = selGate * smoothstep(0.15, 0.0, selDist);
  float selCore = selGate * smoothstep(0.05, 0.0, selDist);

  // Origin in the same atmospheric domain as p (bias included) so relative flow anchors.
  vec2 selOrigin = (uSelectedContact - 0.5) * vec2(aspect, 1.0) + vec2(-0.08, 0.05);
  vec2 originFlow = sampleVeilFlow(selOrigin, t, warpScale);
  vec2 relativeFlow = baseFlow - originFlow;

  // Screen-aligned ripple space, distorted by relative flow (origin stays locked).
  vec2 rippleSpace = selDelta + relativeFlow * uSelectionFlowInfluence;
  float distortedDist = length(rippleSpace);
  vec2 radialDir = rippleSpace / max(distortedDist, 0.0001);
  vec2 tangentialDir = vec2(-radialDir.y, radialDir.x);

  float selAge = max(0.0, uTime - uSelectionStartTime);
  float expandDur = max(uSelectionRippleExpand, 0.05);
  float expandT = clamp(selAge / expandDur, 0.0, 1.0);
  float expandEase = 1.0 - pow(1.0 - expandT, 2.2);
  float fadeEnd = expandDur + 0.25;
  float rippleLife = (1.0 - smoothstep(expandDur * 0.78, fadeEnd, selAge))
    * smoothstep(0.0, 0.035, expandT);

  // Local speed / width variation from the existing noise field.
  float speedJitter = 0.92 + 0.16 * vnoise(rippleSpace * 3.4 + t * 0.08);
  float frontR = uSelectionRippleMaxR * expandEase * speedJitter;
  float bandHalf = 0.0036 + 0.0014 * (1.0 - expandEase);
  float signedFront = distortedDist - frontR;
  float frontEnvelope = exp(-(signedFront * signedFront) / max(2.0 * bandHalf * bandHalf, 1e-6));
  // Mild rebound / stretch immediately behind the primary front.
  float wakeSigned = signedFront + bandHalf * 2.4;
  float wakeEnvelope = exp(-(wakeSigned * wakeSigned) / max(2.0 * (bandHalf * 1.8) * (bandHalf * 1.8), 1e-6)) * 0.45;
  float rangeFalloff = 1.0 - expandEase * 0.62;
  float rippleFront = (frontEnvelope + wakeEnvelope * 0.55)
    * rippleLife
    * selGate
    * rangeFalloff;
  float outerFringe = exp(-pow(max(signedFront - bandHalf * 1.2, 0.0), 2.0) / max(2.0 * bandHalf * bandHalf, 1e-6))
    * rippleLife
    * selGate
    * rangeFalloff
    * 0.7;
  float initialFlash = selGate
    * exp(-selAge / max(uSelectionInitialSec, 0.04))
    * smoothstep(0.085, 0.0, selDist);

  if (uReducedMotion > 0.5) {
    rippleFront = 0.0;
    outerFringe = 0.0;
    initialFlash = 0.0;
  }

  // Domain displacement: ripple bends the same coordinates used to sample the Veil.
  vec2 rippleDisp = radialDir * (rippleFront * uSelectionRadialStrength)
    + tangentialDir * (rippleFront * uSelectionTangentialStrength
      * (vnoise(rippleSpace * 5.0 + t * 0.12) - 0.5) * 2.0);
  // Behind the front: mild outward stretch (band separation).
  rippleDisp += radialDir * (wakeEnvelope * rippleLife * selGate * 0.006 * rangeFalloff);
  // Persistent selection well — small inward bend, no continuous waves / outlines.
  vec2 wellDisp = -radialDir * (selWell * 0.004);
  // Stabilize immediately under the pip.
  float stabilize = clamp(selCore * (0.55 + 0.45 * initialFlash), 0.0, 1.0);

  vec2 coupledQ = qBase + rippleDisp + wellDisp;
  coupledQ = mix(coupledQ, qBase * (1.0 - stabilize * 0.35) + selOrigin * (stabilize * 0.35), stabilize * 0.55);

  // Re-evaluate primary field on displaced coordinates (the coupling).
  float field = sampleVeilField(coupledQ, t);
  float fieldBase = sampleVeilField(qBase, t);
  float fieldDelta = abs(field - fieldBase);

  vec2 q = coupledQ;

  float contourRaw = abs(fract(field * 1.65) - 0.5);
  // Sharpen slightly at the deforming front; soften in the wake.
  float contourSoft = mix(0.12, 0.085, clamp(rippleFront * 1.4, 0.0, 1.0));
  float contourHard = mix(0.04, 0.028, clamp(rippleFront, 0.0, 1.0));
  float contours = smoothstep(contourSoft, contourHard, contourRaw);
  contours *= mix(0.35, 1.0, smoothstep(-0.4, 0.8, field));
  float traces = smoothstep(0.08, 0.0, abs(sin(field * 9.0 + q.x * 2.0))) * 0.35;
  traces *= smoothstep(0.2, 0.7, vnoise(q * 2.0));

  float seam = abs(q.y + q.x * 0.55 + sin(q.x * 2.2 + t * 0.2) * 0.08 - 0.05);
  float seamMask = smoothstep(0.07, 0.0, seam) * 0.55;

  vec3 voidCol = hexToRgb(6.0, 10.0, 14.0);
  vec3 baseCol = hexToRgb(7.0, 13.0, 14.0);
  vec3 violet = hexToRgb(129.0, 115.0, 143.0);
  vec3 purple = hexToRgb(114.0, 87.0, 127.0);
  vec3 pink = hexToRgb(164.0, 95.0, 130.0);
  vec3 magenta = hexToRgb(177.0, 95.0, 140.0);
  vec3 mint = hexToRgb(100.0, 201.0, 177.0);
  vec3 teal = hexToRgb(49.0, 94.0, 89.0);

  vec3 col = mix(voidCol, baseCol, 0.65);

  float pinkBasin = smoothstep(1.1, 0.1, length(q - vec2(-0.55, 0.15)));
  pinkBasin *= (0.55 + 0.45 * sin(field * 2.0 + t * 0.15));
  col = mix(col, purple * 0.55, pinkBasin * 0.42 * uVioletIntensity * uIntensity);
  col = mix(col, pink * 0.5, pinkBasin * 0.22 * uPinkIntensity * uIntensity);
  col += magenta * (pinkBasin * 0.04 * uPinkIntensity * uIntensity);

  float mintLane = smoothstep(0.55, 0.0, abs(q.y - q.x * 0.2 + 0.08));
  mintLane *= 0.35 + contours * 0.65;
  col = mix(col, teal * 0.45, mintLane * 0.28 * uMintIntensity * uIntensity);
  col += mint * (contours * mintLane * 0.07 * uMintIntensity * uIntensity);

  float cAmp = contours * uContourIntensity * uIntensity;
  col += violet * (cAmp * 0.08 * uVioletIntensity);
  col += pink * (cAmp * 0.05 * uPinkIntensity * (0.4 + pinkBasin));
  col += mint * (cAmp * 0.045 * uMintIntensity * (0.3 + mintLane));
  col += teal * (traces * 0.06 * uMintIntensity * uIntensity);
  col += purple * (seamMask * 0.1 * uVioletIntensity * uIntensity);

  float haze = vnoise(q * 1.4 + t * 0.03);
  col = mix(col, violet * 0.25, haze * 0.08 * uVioletIntensity * uIntensity);

  // Illumination driven by actual field displacement (not a painted ring).
  float deformResponse = clamp(fieldDelta * 3.2, 0.0, 1.0);
  float frontLight = rippleFront * mix(0.35, 1.0, deformResponse);
  float fringeLight = outerFringe * mix(0.25, 0.85, deformResponse);
  float lockLight = initialFlash * 0.55 + selWell * 0.35 * deformResponse;

  // Soft-compress sweep + lock illumination so overlap does not blow out.
  float interrogate = max(leadEdge, wakeT * 0.9);
  float combined = interrogate + frontLight * 0.85 + lockLight * 0.4;
  float compressed = combined / (1.0 + combined * 0.65);
  float sweepShare = interrogate / max(combined, 0.001);
  float rippleShare = (frontLight * 0.85) / max(combined, 0.001);

  if (interrogate > 0.001) {
    float sweepAmt = compressed * sweepShare;
    col += vec3(0.05, 0.06, 0.065) * (contours * sweepAmt * uSweepContourBoost);
    col += vec3(0.03, 0.035, 0.04) * (traces * sweepAmt * 0.45);
    float mintPull = sweepAmt * uSweepMintShift;
    col = mix(col, mix(col, mint * 0.62, 0.5), mintPull * (0.4 + pinkBasin * 0.45));
    col += mint * (contours * leadEdge * 0.08 * uMintIntensity);
    col += mint * (wakeT * uSweepWakeStrength * 0.1);
    col += teal * (wakeT * uSweepWakeStrength * 0.055);
  }

  if (selGate > 0.001) {
    float ripAmt = compressed * rippleShare;
    // Color follows deformed contours only — no standalone painted ring.
    col += mint * (frontLight * deformResponse * (0.04 + contours * 0.08) * uMintIntensity);
    col += teal * (frontLight * deformResponse * traces * 0.03 * uMintIntensity);
    col += violet * (fringeLight * deformResponse * 0.05 * uVioletIntensity);
    col += mint * (initialFlash * 0.045 * uMintIntensity);
    // Persistent well — subordinate to the selected pip.
    col += mint * (contours * selWell * 0.04 * uMintIntensity);
    col += teal * (selCore * 0.02 * uMintIntensity);
    col = mix(col, mix(col, mint * 0.42, 0.18), selCore * 0.1);
    col += vec3(0.01, 0.014, 0.016) * (traces * selCore * 0.2);
    col += mint * (ripAmt * deformResponse * contours * 0.025);
  }

  vec2 vigUv = uv * (1.0 - uv);
  float vig = vigUv.x * vigUv.y * 18.0;
  vig = pow(clamp(vig, 0.0, 1.0), 0.55);
  float vignette = mix(1.0, vig, 0.55 * uVignetteStrength);
  col *= vignette;
  col = mix(voidCol, col, 0.92);
  col = min(col, vec3(0.45));

  fragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[VeilWarpField] shader compile failed:', info);
    }
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[VeilWarpField] program link failed:', info);
    }
    return null;
  }
  return program;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Web-only WebGL2 Veil atmosphere — decorative underlay for the scanner field.
 * Independent RAF; no React per-frame state. Sweep angle is read from scannerSweepBridge.
 */
export default function VeilWarpField(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || failed) return undefined;

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'low-power',
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[VeilWarpField] WebGL2 unavailable — using static fallback.');
      }
      setFailed(true);
      return undefined;
    }

    const program = createProgram(gl);
    if (!program) {
      setFailed(true);
      return undefined;
    }

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      uTime: gl.getUniformLocation(program, 'uTime'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uMotionScale: gl.getUniformLocation(program, 'uMotionScale'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uWarpStrength: gl.getUniformLocation(program, 'uWarpStrength'),
      uContourIntensity: gl.getUniformLocation(program, 'uContourIntensity'),
      uVioletIntensity: gl.getUniformLocation(program, 'uVioletIntensity'),
      uPinkIntensity: gl.getUniformLocation(program, 'uPinkIntensity'),
      uMintIntensity: gl.getUniformLocation(program, 'uMintIntensity'),
      uVignetteStrength: gl.getUniformLocation(program, 'uVignetteStrength'),
      uSweepAngle: gl.getUniformLocation(program, 'uSweepAngle'),
      uScannerCenter: gl.getUniformLocation(program, 'uScannerCenter'),
      uScannerRadius: gl.getUniformLocation(program, 'uScannerRadius'),
      uSweepActive: gl.getUniformLocation(program, 'uSweepActive'),
      uWakeDeg: gl.getUniformLocation(program, 'uWakeDeg'),
      uSweepLeadDeg: gl.getUniformLocation(program, 'uSweepLeadDeg'),
      uSweepContourBoost: gl.getUniformLocation(program, 'uSweepContourBoost'),
      uSweepMintShift: gl.getUniformLocation(program, 'uSweepMintShift'),
      uSweepRefraction: gl.getUniformLocation(program, 'uSweepRefraction'),
      uSweepWakeStrength: gl.getUniformLocation(program, 'uSweepWakeStrength'),
      uReducedMotion: gl.getUniformLocation(program, 'uReducedMotion'),
      uSelectedContact: gl.getUniformLocation(program, 'uSelectedContact'),
      uHasSelectedContact: gl.getUniformLocation(program, 'uHasSelectedContact'),
      uSelectionStrength: gl.getUniformLocation(program, 'uSelectionStrength'),
      uSelectionStartTime: gl.getUniformLocation(program, 'uSelectionStartTime'),
      uSelectionRippleExpand: gl.getUniformLocation(program, 'uSelectionRippleExpand'),
      uSelectionRippleMaxR: gl.getUniformLocation(program, 'uSelectionRippleMaxR'),
      uSelectionInitialSec: gl.getUniformLocation(program, 'uSelectionInitialSec'),
      uSelectionFlowInfluence: gl.getUniformLocation(program, 'uSelectionFlowInfluence'),
      uSelectionRadialStrength: gl.getUniformLocation(program, 'uSelectionRadialStrength'),
      uSelectionTangentialStrength: gl.getUniformLocation(program, 'uSelectionTangentialStrength'),
    };

    let rafId: number | null = null;
    let running = true;
    let reduced = prefersReducedMotion();
    let visibleDoc = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let inView = true;
    let lastCssW = 0;
    let lastCssH = 0;
    let startMs = performance.now();
    let pausedAccumMs = 0;
    let pauseStartedMs: number | null = null;
    /** Shader-clock timestamp of the current lock ripple — restarted on selectionEpoch. */
    let selectionStartTimeSec = -10;
    let lastSelectionEpoch = -1;

    const cfg = VEIL_WARP_CONFIG;

    const applyStaticUniforms = () => {
      if (!gl) return;
      gl.useProgram(program);
      gl.uniform1f(uniforms.uMotionScale, cfg.motionSpeed);
      gl.uniform1f(uniforms.uIntensity, 1);
      gl.uniform1f(uniforms.uWarpStrength, cfg.warpStrength);
      gl.uniform1f(uniforms.uContourIntensity, cfg.contourIntensity);
      gl.uniform1f(uniforms.uVioletIntensity, cfg.violetIntensity);
      gl.uniform1f(uniforms.uPinkIntensity, cfg.pinkIntensity);
      gl.uniform1f(uniforms.uMintIntensity, cfg.mintIntensity);
      gl.uniform1f(uniforms.uVignetteStrength, cfg.vignetteStrength);
      gl.uniform1f(uniforms.uWakeDeg, SWEEP_WAKE_DEG);
      gl.uniform1f(uniforms.uSweepLeadDeg, cfg.sweepLeadDeg);
      gl.uniform1f(uniforms.uSweepContourBoost, cfg.sweepContourBoost);
      gl.uniform1f(uniforms.uSweepMintShift, cfg.sweepMintShift);
      gl.uniform1f(uniforms.uSweepRefraction, cfg.sweepRefraction);
      gl.uniform1f(uniforms.uSweepWakeStrength, cfg.sweepWakeStrength);
      gl.uniform1f(uniforms.uSelectionRippleExpand, cfg.selectionRippleExpandSec);
      gl.uniform1f(uniforms.uSelectionRippleMaxR, cfg.selectionRippleMaxRadius);
      gl.uniform1f(uniforms.uSelectionInitialSec, cfg.selectionInitialSec);
      gl.uniform1f(uniforms.uSelectionFlowInfluence, cfg.selectionRippleFlowInfluence);
      gl.uniform1f(uniforms.uSelectionRadialStrength, cfg.selectionRippleRadialStrength);
      gl.uniform1f(uniforms.uSelectionTangentialStrength, cfg.selectionRippleTangentialStrength);
    };

    const resizeIfNeeded = () => {
      if (!gl || !host) return;
      const rect = host.getBoundingClientRect();
      const cssW = Math.max(0, Math.floor(rect.width));
      const cssH = Math.max(0, Math.floor(rect.height));
      if (cssW === 0 || cssH === 0) return;
      if (cssW === lastCssW && cssH === lastCssH) return;
      lastCssW = cssW;
      lastCssH = cssH;
      const dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap);
      const scale = cfg.renderScale;
      const bw = Math.max(1, Math.floor(cssW * dpr * scale));
      const bh = Math.max(1, Math.floor(cssH * dpr * scale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uResolution, bw, bh);
    };

    const applySweepUniforms = (timeSec: number) => {
      if (!gl) return;
      const sample = scannerSweepBridge;
      if (sample.selectionEpoch !== lastSelectionEpoch) {
        lastSelectionEpoch = sample.selectionEpoch;
        if (sample.hasSelectedContact > 0.5) {
          // Bind ripple age to this RAF's shader clock — no second animation clock.
          selectionStartTimeSec = timeSec;
        }
      }
      gl.uniform1f(uniforms.uSweepAngle, sample.angleDeg);
      gl.uniform2f(uniforms.uScannerCenter, sample.centerU, sample.centerV);
      gl.uniform1f(uniforms.uScannerRadius, sample.radius);
      gl.uniform1f(uniforms.uSweepActive, sample.active);
      gl.uniform1f(uniforms.uReducedMotion, reduced ? 1 : 0);
      gl.uniform2f(uniforms.uSelectedContact, sample.selectedU, sample.selectedV);
      gl.uniform1f(uniforms.uHasSelectedContact, sample.hasSelectedContact);
      gl.uniform1f(uniforms.uSelectionStrength, sample.selectionStrength);
      gl.uniform1f(uniforms.uSelectionStartTime, selectionStartTimeSec);
    };

    const draw = (timeSec: number) => {
      if (!gl) return;
      resizeIfNeeded();
      if (lastCssW === 0 || lastCssH === 0) return;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1f(uniforms.uTime, timeSec);
      applySweepUniforms(timeSec);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    /** Full field animation, or reduced-motion redraw that only tracks sweep angle. */
    const shouldRunLoop = () => running && visibleDoc && inView;

    const markPause = () => {
      if (pauseStartedMs == null) pauseStartedMs = performance.now();
    };

    const markResume = () => {
      if (pauseStartedMs != null) {
        pausedAccumMs += performance.now() - pauseStartedMs;
        pauseStartedMs = null;
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      if (!shouldRunLoop()) {
        markPause();
        rafId = null;
        return;
      }
      markResume();
      if (reduced) {
        // Static field composition; still follow the real sweep angle (no wake / refraction).
        draw(cfg.reducedMotionTime);
      } else {
        const elapsedSec = (now - startMs - pausedAccumMs) / 1000;
        draw(elapsedSec);
      }
      rafId = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (!shouldRunLoop()) return;
      if (rafId != null) return;
      markResume();
      rafId = requestAnimationFrame(tick);
    };

    applyStaticUniforms();
    resizeIfNeeded();
    ensureLoop();

    const onVisibility = () => {
      visibleDoc = document.visibilityState !== 'hidden';
      if (visibleDoc) ensureLoop();
      else markPause();
    };

    const onMotionChange = () => {
      const next = prefersReducedMotion();
      if (next === reduced) return;
      reduced = next;
      if (reduced) {
        markPause();
        draw(cfg.reducedMotionTime);
        ensureLoop();
      } else {
        startMs = performance.now();
        pausedAccumMs = 0;
        pauseStartedMs = null;
        ensureLoop();
      }
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener?.('change', onMotionChange);
    document.addEventListener('visibilitychange', onVisibility);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        resizeIfNeeded();
        if (reduced) {
          draw(cfg.reducedMotionTime);
        }
        ensureLoop();
      })
      : null;
    resizeObserver?.observe(host);

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          inView = entry ? entry.isIntersecting && entry.intersectionRatio > 0.02 : true;
          if (inView) ensureLoop();
          else markPause();
        },
        { threshold: [0, 0.02, 0.1] },
      );
      intersectionObserver.observe(host);
    }

    return () => {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener?.('change', onMotionChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (gl) {
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        if (buffer) gl.deleteBuffer(buffer);
        if (vao) gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
        const ext = gl.getExtension('WEBGL_lose_context');
        ext?.loseContext();
      }
    };
  }, [failed]);

  if (failed) {
    return (
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        {...({ 'aria-hidden': true } as object)}
        style={styles.fallback}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      aria-hidden
      style={hostStyle}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        tabIndex={-1}
        style={canvasStyle}
      />
    </div>
  );
}

const hostStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 0,
  overflow: 'hidden',
  backgroundColor: VEIL_WARP_COLORS.scannerBase,
};

const canvasStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
};

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: VEIL_WARP_COLORS.scannerBase,
    ...({
      backgroundImage:
        `radial-gradient(ellipse at 72% 28%, rgba(114, 87, 127, 0.14) 0%, transparent 52%),`
        + `radial-gradient(ellipse at 30% 60%, rgba(49, 94, 89, 0.1) 0%, transparent 48%),`
        + `linear-gradient(180deg, ${VEIL_WARP_COLORS.voidBg} 0%, ${VEIL_WARP_COLORS.scannerBase} 100%)`,
    } as object),
  },
});
