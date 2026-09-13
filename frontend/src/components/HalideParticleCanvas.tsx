import React, { useEffect, useRef, useState } from 'react';

export type FormationType = 'anemone' | 'braid' | 'disc' | 'globe';

interface HalideParticleCanvasProps {
  formation: FormationType;
  onFormationChange?: (name: FormationType) => void;
  showHUD?: boolean;
}

const PARTICLE_COUNT = 70000;

export function HalideParticleCanvas({
  formation,
  onFormationChange,
  showHUD = false,
}: HalideParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fps, setFps] = useState(60);
  const [morphState, setMorphState] = useState({ progress: 1.0, active: formation });
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0, active: false });

  const stateRef = useRef({
    currentFormation: formation,
    targetFormation: formation,
    morphProgress: 1.0,
    startTime: performance.now(),
    bloomProgress: 0.0,
    pointer: { x: 0, y: 0, targetX: 0, targetY: 0, active: 0.0 },
    frameCount: 0,
    lastFpsUpdate: performance.now(),
  });

  useEffect(() => {
    if (formation !== stateRef.current.targetFormation) {
      stateRef.current.currentFormation = stateRef.current.targetFormation;
      stateRef.current.targetFormation = formation;
      stateRef.current.morphProgress = 0.0;
    }
  }, [formation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      console.warn('WebGL not supported for particle bloom');
      return;
    }

    const generateFormations = () => {
      const anemone = new Float32Array(PARTICLE_COUNT * 3);
      const braid = new Float32Array(PARTICLE_COUNT * 3);
      const disc = new Float32Array(PARTICLE_COUNT * 3);
      const globe = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const randoms = new Float32Array(PARTICLE_COUNT * 3);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const u = Math.random();
        const v = Math.random();

        randoms[i3] = (Math.random() - 0.5) * 2;
        randoms[i3 + 1] = (Math.random() - 0.5) * 2;
        randoms[i3 + 2] = (Math.random() - 0.5) * 2;

        // Color gradient: Cool Green/Cyan -> Violet/Purple
        const tColor = u;
        colors[i3] = 0.05 + 0.65 * tColor;
        colors[i3 + 1] = 0.85 - 0.50 * tColor;
        colors[i3 + 2] = 0.65 + 0.30 * tColor;

        // 1. ANEMONE (Star-burst / flower ring with hollow core)
        const theta1 = u * Math.PI * 2;
        const petalling = Math.cos(theta1 * 6) * 0.12;
        const r1 = 0.35 + petalling + Math.pow(v, 1.8) * 0.45;
        anemone[i3] = Math.cos(theta1) * r1;
        anemone[i3 + 1] = Math.sin(theta1) * r1;
        anemone[i3 + 2] = (Math.random() - 0.5) * 0.28 * Math.cos(theta1 * 3);

        // 2. BRAID (Double Helix strands with forensic cross rungs)
        const strand = i % 2 === 0 ? 1 : -1;
        const tBraid = (u - 0.5) * 2.2;
        const angleB = tBraid * 4.5 + (strand === 1 ? 0 : Math.PI);
        const rB = 0.32 + (v - 0.5) * 0.08;
        braid[i3] = Math.cos(angleB) * rB;
        braid[i3 + 1] = tBraid * 0.75;
        braid[i3 + 2] = Math.sin(angleB) * rB;

        // 3. DISC (Spinning galaxy / forensic vortex platter)
        const arms = 3;
        const armOffset = ((i % arms) * (Math.PI * 2)) / arms;
        const rDisc = Math.pow(u, 0.55) * 0.85 + 0.05;
        const spiralAngle = rDisc * 5.0 + armOffset + (v - 0.5) * 0.45;
        disc[i3] = Math.cos(spiralAngle) * rDisc;
        disc[i3 + 1] = Math.sin(spiralAngle) * rDisc * 0.75;
        disc[i3 + 2] = (Math.random() - 0.5) * 0.12 * (1.0 - rDisc * 0.6);

        // 4. GLOBE (Fibonacci spherical point cloud)
        const phi = Math.acos(1 - 2 * u);
        const thetaG = Math.PI * (1 + Math.sqrt(5)) * i;
        const rG = 0.62 + (v - 0.5) * 0.08;
        globe[i3] = rG * Math.sin(phi) * Math.cos(thetaG);
        globe[i3 + 1] = rG * Math.sin(phi) * Math.sin(thetaG);
        globe[i3 + 2] = rG * Math.cos(phi);
      }

      return { anemone, braid, disc, globe, colors, randoms };
    };

    const formations = generateFormations();

    const vsSource = `
      attribute vec3 aPosA;
      attribute vec3 aPosB;
      attribute vec3 aRandom;
      attribute vec3 aColor;

      uniform float uMorph;
      uniform float uTime;
      uniform float uBloom;
      uniform vec2 uPointer;
      uniform float uAspect;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float t = smoothstep(0.0, 1.0, uMorph);
        vec3 pos = mix(aPosA, aPosB, t);

        // Mid-point turbulence arc
        float midTurbulence = sin(uMorph * 3.14159) * 0.22;
        pos += aRandom * midTurbulence;

        // Opening Bloom expansion from dust
        float bloomFactor = clamp(uBloom, 0.001, 1.0);
        float bloomEase = 1.0 - pow(1.0 - bloomFactor, 3.0);
        pos *= (bloomEase + (1.0 - bloomEase) * (1.8 + aRandom.z * 1.2));

        // Breathing cycle
        float breath = 1.0 + sin(uTime * 1.6) * 0.025;
        pos.xy *= breath;

        // Gentle organic rotation
        float rotA = uTime * 0.12;
        mat2 rotMat = mat2(cos(rotA), -sin(rotA), sin(rotA), cos(rotA));
        pos.xy = rotMat * pos.xy;

        // Pointer proximity ripple / magnet
        vec2 pDiff = pos.xy - uPointer;
        pDiff.x *= uAspect;
        float pDist = length(pDiff);
        if (pDist < 0.38) {
          float pForce = (1.0 - pDist / 0.38);
          pos.xy += (pDiff / (pDist + 0.001)) * pForce * 0.06;
        }

        vec4 mvPosition = vec4(pos.x / uAspect, pos.y, pos.z, 1.0);
        gl_Position = mvPosition;

        gl_PointSize = (1.8 + aRandom.x * 0.6) * (1.2 + midTurbulence * 0.8);
        vColor = aColor;
        vAlpha = clamp(bloomFactor * (0.45 + abs(aRandom.y) * 0.45), 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float strength = smoothstep(0.5, 0.05, dist);
        gl_FragColor = vec4(vColor, vAlpha * strength * 0.85);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const bufferA = gl.createBuffer();
    const bufferB = gl.createBuffer();
    const bufferRandom = gl.createBuffer();
    const bufferColor = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferRandom);
    gl.bufferData(gl.ARRAY_BUFFER, formations.randoms, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
    gl.bufferData(gl.ARRAY_BUFFER, formations.colors, gl.STATIC_DRAW);

    const aPosALoc = gl.getAttribLocation(program, 'aPosA');
    const aPosBLoc = gl.getAttribLocation(program, 'aPosB');
    const aRandomLoc = gl.getAttribLocation(program, 'aRandom');
    const aColorLoc = gl.getAttribLocation(program, 'aColor');

    const uMorphLoc = gl.getUniformLocation(program, 'uMorph');
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uBloomLoc = gl.getUniformLocation(program, 'uBloom');
    const uPointerLoc = gl.getUniformLocation(program, 'uPointer');
    const uAspectLoc = gl.getUniformLocation(program, 'uAspect');

    gl.enableVertexAttribArray(aRandomLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferRandom);
    gl.vertexAttribPointer(aRandomLoc, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(aColorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
    gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(aPosALoc);
    gl.enableVertexAttribArray(aPosBLoc);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const getBufferData = (name: FormationType): Float32Array => {
      switch (name) {
        case 'anemone': return formations.anemone;
        case 'braid': return formations.braid;
        case 'disc': return formations.disc;
        case 'globe': return formations.globe;
        default: return formations.anemone;
      }
    };

    let lastA: FormationType | null = null;
    let lastB: FormationType | null = null;

    const updateBuffers = (nameA: FormationType, nameB: FormationType) => {
      if (nameA !== lastA) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferA);
        gl.bufferData(gl.ARRAY_BUFFER, getBufferData(nameA), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPosALoc, 3, gl.FLOAT, false, 0, 0);
        lastA = nameA;
      }
      if (nameB !== lastB) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferB);
        gl.bufferData(gl.ARRAY_BUFFER, getBufferData(nameB), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPosBLoc, 3, gl.FLOAT, false, 0, 0);
        lastB = nameB;
      }
    };

    updateBuffers(stateRef.current.currentFormation, stateRef.current.targetFormation);

    const resize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth * dpr;
      const height = canvas.clientHeight * dpr;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let animationFrameId: number;

    const render = (now: number) => {
      const state = stateRef.current;
      const elapsed = (now - state.startTime) * 0.001;

      if (state.bloomProgress < 1.0) {
        state.bloomProgress = Math.min(1.0, state.bloomProgress + 0.016);
      }

      if (state.morphProgress < 1.0) {
        state.morphProgress = Math.min(1.0, state.morphProgress + 0.018);
        if (state.morphProgress >= 1.0) {
          state.currentFormation = state.targetFormation;
        }
      }

      state.pointer.x += (state.pointer.targetX - state.pointer.x) * 0.08;
      state.pointer.y += (state.pointer.targetY - state.pointer.y) * 0.08;

      updateBuffers(state.currentFormation, state.targetFormation);

      const aspect = canvas.width / Math.max(canvas.height, 1);
      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform1f(uMorphLoc, state.morphProgress);
      gl.uniform1f(uBloomLoc, state.bloomProgress);
      gl.uniform2f(uPointerLoc, state.pointer.x, state.pointer.y);
      gl.uniform1f(uAspectLoc, aspect);

      gl.clearColor(0.02, 0.04, 0.07, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

      state.frameCount++;
      if (now - state.lastFpsUpdate >= 500) {
        setFps(Math.round((state.frameCount * 1000) / (now - state.lastFpsUpdate)));
        setMorphState({ progress: state.morphProgress, active: state.targetFormation });
        state.frameCount = 0;
        state.lastFpsUpdate = now;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.pointer.targetX = nx;
      stateRef.current.pointer.targetY = ny;
      setPointerPos({ x: e.clientX, y: e.clientY, active: true });
    };

    const handlePointerLeave = () => {
      stateRef.current.pointer.targetX = 0;
      stateRef.current.pointer.targetY = 0;
      setPointerPos((p) => ({ ...p, active: false }));
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      gl.deleteBuffer(bufferA);
      gl.deleteBuffer(bufferB);
      gl.deleteBuffer(bufferRandom);
      gl.deleteBuffer(bufferColor);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
        }}
      />

      {pointerPos.active && (
        <div
          className="fixed pointer-events-none z-40 h-3 w-3 rounded-full bg-cyan-400/40 blur-[2px] transition-transform duration-75 -translate-x-1/2 -translate-y-1/2"
          style={{ left: pointerPos.x, top: pointerPos.y }}
        />
      )}

      {showHUD && (
        <div className="absolute bottom-4 left-4 z-20 font-mono text-[10px] text-slate-400 bg-[#090d16]/80 backdrop-blur-md border border-[#1e2c40] rounded-xl px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            GPU Particle Engine HUD
          </div>
          <div>Particles: <span className="text-white font-semibold">{PARTICLE_COUNT.toLocaleString()}</span></div>
          <div>Framerate: <span className={fps >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{fps} FPS</span></div>
          <div>Formation: <span className="text-cyan-300 capitalize">{morphState.active}</span></div>
          <div>Morph Easing: <span className="text-slate-200">{Math.round(morphState.progress * 100)}%</span></div>
        </div>
      )}
    </div>
  );
}
