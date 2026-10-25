"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Background of componentry's Hero Geometric (https://componentry.dev/docs/components/hero-geometric): a dithered
// diagonal gradient with drifting noise. The original draws one shader plane through three.js + react-three-fiber;
// this runs the same fragment shader on a raw WebGL2 quad, so it adds no dependencies. The headline props are dropped.

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
in vec2 vUv;
out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float bayerDither4x4(vec2 uv) {
  int x = int(mod(uv.x, 4.0));
  int y = int(mod(uv.y, 4.0));
  int matrix[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return float(matrix[y * 4 + x]) / 16.0;
}

void main() {
  vec2 uv = vUv;
  float noise = snoise(uv * 1.5 + vec2(uTime * 0.05, uTime * 0.03)) * 0.25;
  float gradient = (uv.x + uv.y) * 0.5 * 1.2 + noise;

  vec3 deep = uColor1;
  vec3 pale = uColor2;
  vec3 soft = mix(deep, pale, 0.33);
  vec3 light = mix(deep, pale, 0.66);

  vec3 color;
  if (gradient < 0.3) color = deep;
  else if (gradient < 0.55) color = soft;
  else if (gradient < 0.8) color = light;
  else color = pale;

  float dither = bayerDither4x4(gl_FragCoord.xy);
  float threshold = fract(gradient * 4.0);
  if (gradient < 0.3 && threshold > dither * 0.5) color = soft;
  else if (gradient >= 0.3 && gradient < 0.55 && threshold > dither * 0.5) color = light;
  else if (gradient >= 0.55 && gradient < 0.8 && threshold > dither * 0.5) color = pale;

  float fadeMask = smoothstep(0.0, 0.25, length(uv));
  color = mix(vec3(1.0), color, fadeMask);
  float vignette = smoothstep(1.2, 0.3, length(uv - 0.5));
  color = mix(color, color * 0.95, (1.0 - vignette) * 0.3);

  fragColor = vec4(color, 1.0);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

export function HeroGeometricBackground({
  color1,
  color2,
  speed = 1,
  runFor,
  className,
}: {
  color1: string; // deep corner (bottom-left)
  color2: string; // pale corner (top-right)
  speed?: number;
  runFor?: number; // ms of drift before easing to a still frame; omit to loop forever
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    // preserveDrawingBuffer keeps the last frame readable, so liquidGL can refract it.
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!canvas || !gl) return; // no WebGL2: the wrapper's plain background shows instead

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShader));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    } catch (error) {
      console.error("HeroGeometricBackground: shader failed", error);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(gl.getUniformLocation(program, "uColor1"), hexToRgb(color1));
    gl.uniform3fv(gl.getUniformLocation(program, "uColor2"), hexToRgb(color2));
    const uTime = gl.getUniformLocation(program, "uTime");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    let elapsed = 0; // shader time shown in the current frame, ms
    let animating = !reduceMotion;

    const draw = () => {
      // 1 device pixel per CSS pixel, as in the original (dpr [1, 1]): the 4x4 dither stays crisp and cheap.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform1f(uTime, (elapsed / 1000) * speed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    // With runFor the drift decelerates linearly to a stop instead of halting: shader time = runFor * (p - p²/2).
    const loop = (now: number) => {
      const t = now - start;
      if (runFor === undefined) elapsed = t;
      else {
        const p = Math.min(1, t / runFor);
        elapsed = runFor * (p - (p * p) / 2);
        if (p === 1) animating = false;
      }
      draw();
      if (animating) raf = requestAnimationFrame(loop);
    };

    // Still frames (reduced motion, or settled) are redrawn only on resize.
    const resizeObserver = new ResizeObserver(() => !animating && draw());
    resizeObserver.observe(canvas);
    if (animating) raf = requestAnimationFrame(loop);
    else draw();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      // Free GPU objects but keep the context: a remount (React dev double-effect) reuses this same canvas.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [color1, color2, speed, runFor]);

  return <canvas ref={ref} aria-hidden="true" className={cn("block h-full w-full", className)} />;
}
