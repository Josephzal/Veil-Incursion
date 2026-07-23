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

/** Low-frequency fbm for chromatic regions (field space, not screen halves). */
float chromaFbm(vec2 p) {
  float n = 0.0;
  n += vnoise(p) * 0.55;
  n += vnoise(p * 2.05 + 11.7) * 0.3;
  n += vnoise(p * 4.1 - 3.3) * 0.15;
  return n;
}

/**
 * Map chroma ∈ [0,1] → violet / teal / mint / sparse muted green.
 * Smooth stages — avoids muddy gray mid-blends.
 */
vec3 mapChromaToPalette(float c) {
  // Deep indigo / royal violet (blue-heavy) ↔ teal / mint — not lavender or magenta.
  vec3 abyssViolet = hexToRgb(36.0, 22.0, 58.0);
  vec3 deepViolet = hexToRgb(68.0, 42.0, 112.0);
  vec3 fieldViolet = hexToRgb(92.0, 58.0, 148.0);
  vec3 indigoLift = hexToRgb(118.0, 78.0, 176.0);
  vec3 darkTeal = hexToRgb(62.0, 148.0, 138.0);
  vec3 mint = hexToRgb(100.0, 201.0, 177.0);
  vec3 mutedGreen = hexToRgb(142.0, 178.0, 118.0);

  vec3 col = mix(abyssViolet, deepViolet, smoothstep(0.0, 0.22, c));
  col = mix(col, fieldViolet, smoothstep(0.16, 0.36, c));
  col = mix(col, indigoLift, smoothstep(0.28, 0.42, c) * 0.55);
  col = mix(col, darkTeal, smoothstep(0.38, 0.56, c));
  col = mix(col, mint, smoothstep(0.5, 0.74, c));
  col = mix(col, mutedGreen, smoothstep(0.8, 0.96, c) * 0.65);
  return col;
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

  vec2 selOrigin = (uSelectedContact - 0.5) * vec2(aspect, 1.0) + vec2(-0.08, 0.05);
  vec2 originFlow = sampleVeilFlow(selOrigin, t, warpScale);
  vec2 relativeFlow = baseFlow - originFlow;

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

  float speedJitter = 0.92 + 0.16 * vnoise(rippleSpace * 3.4 + t * 0.08);
  float frontR = uSelectionRippleMaxR * expandEase * speedJitter;
  float bandHalf = 0.0036 + 0.0014 * (1.0 - expandEase);
  float signedFront = distortedDist - frontR;
  float frontEnvelope = exp(-(signedFront * signedFront) / max(2.0 * bandHalf * bandHalf, 1e-6));
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

  vec2 rippleDisp = radialDir * (rippleFront * uSelectionRadialStrength)
    + tangentialDir * (rippleFront * uSelectionTangentialStrength
      * (vnoise(rippleSpace * 5.0 + t * 0.12) - 0.5) * 2.0);
  rippleDisp += radialDir * (wakeEnvelope * rippleLife * selGate * 0.006 * rangeFalloff);
  vec2 wellDisp = -radialDir * (selWell * 0.004);
  float stabilize = clamp(selCore * (0.55 + 0.45 * initialFlash), 0.0, 1.0);

  vec2 coupledQ = qBase + rippleDisp + wellDisp;
  coupledQ = mix(coupledQ, qBase * (1.0 - stabilize * 0.35) + selOrigin * (stabilize * 0.35), stabilize * 0.55);

  // Shared contour network — geometry from coupled field coordinates.
  float field = sampleVeilField(coupledQ, t);
  float fieldBase = sampleVeilField(qBase, t);
  float fieldDelta = abs(field - fieldBase);
  vec2 q = coupledQ;

  // Irregular iso-spacing (~12–18 discernible paths; not a dense topo map).
  float density = 2.55 + vnoise(q * 0.85 + 4.2) * 0.55;
  float phase = field * density + vnoise(q * 1.15) * 0.22;
  float band = abs(fract(phase) - 0.5);
  float fw = max(fwidth(phase), 1e-4);

  // Contour prominence — only a minority of strands are strongly lit.
  float bandId = floor(phase);
  float prominence = vnoise(vec2(bandId * 0.41 + 1.7, bandId * 0.17 - 0.3));
  float primaryW = mix(0.95, 1.35, smoothstep(0.55, 0.85, prominence));
  float secondaryW = mix(0.55, 0.8, smoothstep(0.25, 0.55, prominence));
  float residualW = 0.5;

  float primaryCore = 1.0 - smoothstep(0.0, fw * primaryW, band);
  float primaryBloom = 1.0 - smoothstep(0.0, fw * (primaryW + 2.6), band);
  float secondaryCore = 1.0 - smoothstep(0.0, fw * secondaryW, band);
  float residualCore = 1.0 - smoothstep(0.0, fw * residualW, band);

  float primaryMask = smoothstep(0.4, 0.68, prominence);
  float secondaryMask = (1.0 - primaryMask) * smoothstep(0.18, 0.48, prominence);
  float residualMask = (1.0 - primaryMask - secondaryMask) * smoothstep(0.06, 0.26, prominence);
  // Incomplete / broken traces.
  float breakMask = smoothstep(0.2, 0.55, vnoise(q * 2.4 + bandId));
  secondaryMask *= mix(0.35, 1.0, breakMask);
  residualMask *= mix(0.15, 0.85, vnoise(q * 3.1 - bandId));

  // Ripple front briefly sharpens local strands.
  float sharpen = clamp(rippleFront * 1.2, 0.0, 1.0);
  primaryCore = mix(primaryCore, primaryCore * 1.15, sharpen);
  float primary = primaryCore * primaryMask;
  float secondary = secondaryCore * secondaryMask;
  float residual = residualCore * residualMask * 0.85;
  float contours = clamp(primary + secondary * 0.7 + residual * 0.4, 0.0, 1.0);
  float bloom = primaryBloom * primaryMask * (0.22 + sharpen * 0.1);

  // --- Chromatic field on the SAME coupled coordinates (not screen sides) ---
  // Two offset low-freq lobes + light flow carry — violet/mint mingle across the aperture.
  float slowT = t * 0.028;
  vec2 chromaUvA = q * 1.7 + baseFlow * 0.22 + vec2(slowT * 0.85, -slowT * 0.65);
  vec2 chromaUvB = vec2(-q.y, q.x) * 1.45 + vec2(-0.62, 0.41) + vec2(-slowT * 0.55, slowT * 0.7);
  float broadA = chromaFbm(chromaUvA + vec2(0.27, -0.14));
  float broadB = chromaFbm(chromaUvB + vec2(-0.19, 0.33));
  float broadChroma = mix(broadA, broadB, 0.48);
  float localVariation = vnoise(q * 3.1 + field * 0.16 + vec2(-slowT * 0.35, slowT * 0.5));
  // Contour-index nudge so adjacent strands can differ and hues travel along a path.
  float strandNudge = (vnoise(vec2(bandId * 0.63, phase * 0.09 + slowT)) - 0.5) * 0.22;
  // Bias chroma slightly toward green so violet/mint both read clearly.
  float chroma = clamp(broadChroma * 0.68 + localVariation * 0.32 + strandNudge + 0.06, 0.0, 1.0);
  vec3 contourColor = mapChromaToPalette(chroma);
  // Lift line luminance so strands stay readable over the dark well.
  float lum = dot(contourColor, vec3(0.3, 0.55, 0.15));
  contourColor *= mix(1.22, 1.05, smoothstep(0.2, 0.55, lum));

  // Inky dark grey / blue-green surround; scanner well sits slightly darker.
  // Fine-tune: lower RGB = darker; lower wash coeffs = less lift from violet/mint.
  vec3 surroundVoid = hexToRgb(3.0, 6.0, 8.0);
  vec3 surroundCool = hexToRgb(7.0, 12.0, 15.0);
  vec3 surroundTeal = hexToRgb(5.0, 13.0, 12.0);
  vec3 wellVoid = hexToRgb(3.0, 6.0, 8.0);
  vec3 wellCool = hexToRgb(7.0, 12.0, 14.0);
  vec3 wellTeal = hexToRgb(6.0, 14.0, 13.0);
  vec3 mint = hexToRgb(100.0, 201.0, 177.0);
  vec3 violet = hexToRgb(92.0, 58.0, 148.0);

  float bgNoise = chromaFbm(q * 0.55 + vec2(slowT * 0.35, -slowT * 0.25));
  vec3 surroundBg = mix(surroundVoid, surroundCool, 0.5 + bgNoise * 0.22);
  surroundBg = mix(surroundBg, surroundTeal, 0.22 + (1.0 - chroma) * 0.1);
  surroundBg += violet * (0.01 + bgNoise * 0.008);
  surroundBg += mint * (0.008 + (1.0 - bgNoise) * 0.006);
  vec3 wellBg = mix(wellVoid, wellCool, 0.45 + bgNoise * 0.18);
  wellBg = mix(wellBg, wellTeal, 0.2);
  wellBg += violet * (0.007 + bgNoise * 0.005);
  wellBg += mint * (0.006 + (1.0 - bgNoise) * 0.004);
  vec3 bg = mix(surroundBg, wellBg, inScope);

  vec3 col = bg;
  float amp = uContourIntensity * uIntensity;
  // Contours remain readable in the well; quieter outside the rim.
  float contourGate = mix(0.4, 1.0, inScope);
  col += contourColor * (primary * 0.95 * amp * contourGate);
  col += contourColor * (secondary * 0.48 * amp * contourGate);
  col += contourColor * (residual * 0.22 * amp * contourGate);
  col += contourColor * (bloom * 0.32 * amp * contourGate);

  // Quiet atmospheric haze carrying both hues.
  float haze = vnoise(q * 1.2 + slowT * 0.5);
  col += contourColor * (haze * 0.04 * amp * max(contours, 0.15) * contourGate);

  float deformResponse = clamp(fieldDelta * 3.2, 0.0, 1.0);
  float frontLight = rippleFront * mix(0.35, 1.0, deformResponse);
  float fringeLight = outerFringe * mix(0.25, 0.85, deformResponse);
  float lockLight = initialFlash * 0.55 + selWell * 0.35 * deformResponse;

  float interrogate = max(leadEdge, wakeT * 0.9);
  float combined = interrogate + frontLight * 0.85 + lockLight * 0.4;
  float compressed = combined / (1.0 + combined * 0.7);
  float sweepShare = interrogate / max(combined, 0.001);
  float rippleShare = (frontLight * 0.85) / max(combined, 0.001);

  // Sweep brightens existing contour hue — restrained mint edge only.
  if (interrogate > 0.001) {
    float sweepAmt = compressed * sweepShare;
    col += contourColor * (contours * sweepAmt * uSweepContourBoost * 0.55);
    col += contourColor * (bloom * sweepAmt * 0.2);
    col += mint * (contours * leadEdge * uSweepMintShift * 0.35 * uMintIntensity);
    col += mint * (wakeT * uSweepWakeStrength * 0.035);
  }

  // Ripple amplifies embedded color; does not repaint the field mint.
  if (selGate > 0.001) {
    float ripAmt = compressed * rippleShare;
    col += contourColor * (frontLight * deformResponse * (0.12 + contours * 0.35));
    col += contourColor * (bloom * frontLight * 0.15);
    col += violet * (fringeLight * deformResponse * 0.04 * uVioletIntensity);
    col += mint * (frontLight * deformResponse * contours * 0.025 * uMintIntensity);
    col += contourColor * (initialFlash * 0.08);
    col += contourColor * (contours * selWell * 0.06);
    col += contourColor * (selCore * 0.04);
    col += mint * (ripAmt * deformResponse * contours * 0.015);
  }

  // Soft interior falloff — scanner circle stays slightly darker than the surround.
  col *= mix(1.0, 0.94, inScope);

  vec2 vigUv = uv * (1.0 - uv);
  float vig = vigUv.x * vigUv.y * 18.0;
  vig = pow(clamp(vig, 0.0, 1.0), 0.55);
  float vignette = mix(1.0, vig, 0.35 * uVignetteStrength * inScope);
  col *= vignette;
  col = mix(bg, col, 0.96);
  col = min(col, vec3(0.52));

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
