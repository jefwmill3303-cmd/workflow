// ── WebGL chroma-key pipeline ─────────────────────────────────────────────────

export interface ChromaKeyParams {
  color: string;        // hex  e.g. '#00ff00'
  similarity: number;   // 0-1
  smoothness: number;   // 0-1
  spillSuppress: number; // 0-1
}

export interface ChromaKeyGL {
  canvas: HTMLCanvasElement;
  update: (video: HTMLVideoElement) => void;
  setParams: (params: ChromaKeyParams) => void;
  destroy: () => void;
}

export function createChromaKeyGL(width: number, height: number): ChromaKeyGL | null {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const glCtx = canvas.getContext('webgl');
  if (!glCtx) { console.warn('WebGL not available for chroma key'); return null; }
  const gl = glCtx; // narrowed to non-null

  // ── Shaders ────────────────────────────────────────────────────────────────
  const vsSource = `
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    varying   vec2 v_uv;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
      v_uv = a_uv;
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform vec3  u_key;
    uniform float u_sim;
    uniform float u_smooth;
    uniform float u_spill;
    varying vec2 v_uv;

    vec3 rgb2yuv(vec3 c) {
      float y  = dot(c, vec3(0.299, 0.587, 0.114));
      float cb = (c.b - y) * 0.565 + 0.5;
      float cr = (c.r - y) * 0.713 + 0.5;
      return vec3(y, cb, cr);
    }

    void main() {
      vec4  px   = texture2D(u_tex, v_uv);
      vec3  yuv  = rgb2yuv(px.rgb);
      vec3  kyuv = rgb2yuv(u_key);
      float d    = distance(yuv.yz, kyuv.yz);
      float a    = smoothstep(u_sim, u_sim + max(u_smooth, 0.001), d);

      vec3 rgb = px.rgb;
      if (u_spill > 0.0) {
        float spill = max(0.0, 1.0 - d / (u_sim + max(u_smooth, 0.001)));
        float luma  = dot(px.rgb, vec3(0.299, 0.587, 0.114));
        rgb = mix(px.rgb, vec3(luma), clamp(spill * u_spill * 2.0, 0.0, 1.0));
      }
      gl_FragColor = vec4(rgb, px.a * a);
    }
  `;

  function mkShader(type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Chroma key shader error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  const vs = mkShader(gl.VERTEX_SHADER,   vsSource);
  const fs = mkShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Chroma key link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  // ── Full-screen quad (interleaved pos + uv, stride=16) ────────────────────
  // UV mapping: v=1 at screen bottom, v=0 at screen top (HTML image orientation)
  const quad = new Float32Array([
    -1, -1,  0, 1,   // bottom-left  → texture bottom-left
     1, -1,  1, 1,   // bottom-right → texture bottom-right
    -1,  1,  0, 0,   // top-left     → texture top-left
     1,  1,  1, 0,   // top-right    → texture top-right
  ]);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

  const uvLoc = gl.getAttribLocation(prog, 'a_uv');
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

  // ── Texture ───────────────────────────────────────────────────────────────
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  // Default params (green screen)
  gl.uniform3f(gl.getUniformLocation(prog, 'u_key'),    0, 1, 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_sim'),    0.4);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_smooth'), 0.1);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_spill'),  0.5);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function hexToRgb(hex: string): [number, number, number] {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    ];
  }

  return {
    canvas,
    update(video: HTMLVideoElement) {
      if (video.readyState < 2) return;
      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    setParams(p: ChromaKeyParams) {
      gl.useProgram(prog);
      const [r, g, b] = hexToRgb(p.color);
      gl.uniform3f(gl.getUniformLocation(prog, 'u_key'),    r, g, b);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_sim'),    p.similarity);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_smooth'), p.smoothness);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_spill'),  p.spillSuppress);
    },
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
    },
  };
}
