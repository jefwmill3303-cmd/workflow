// ── Singleton Web Audio API engine ────────────────────────────────────────────

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

export interface TrackNodes {
  gainNode:     GainNode;
  analyserNode: AnalyserNode;
}

interface MediaAudioEntry {
  source:   MediaElementAudioSourceNode;
  fadeGain: GainNode;
  trackId:  string;
}

const trackNodesMap = new Map<string, TrackNodes>();
const mediaAudioMap = new Map<string, MediaAudioEntry>();

// ── Resume suspended context on first user gesture ────────────────────────────
export function resumeAudio(): void {
  const ctx = getCtx();
  if (ctx.state === 'suspended') void ctx.resume();
}

// ── Per-track nodes: volume GainNode + AnalyserNode for metering ──────────────
export function getOrCreateTrackNodes(trackId: string): TrackNodes {
  if (!trackNodesMap.has(trackId)) {
    const ctx          = getCtx();
    const gainNode     = ctx.createGain();
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize              = 256;
    analyserNode.smoothingTimeConstant = 0.55;
    gainNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);
    trackNodesMap.set(trackId, { gainNode, analyserNode });
  }
  return trackNodesMap.get(trackId)!;
}

// ── Connect a media element to the audio graph ────────────────────────────────
export function connectMediaElement(
  mediaId: string,
  element:  HTMLVideoElement | HTMLAudioElement,
  trackId:  string,
): void {
  if (mediaAudioMap.has(mediaId)) return; // already connected
  const ctx              = getCtx();
  const { gainNode: trackGain } = getOrCreateTrackNodes(trackId);
  const source   = ctx.createMediaElementSource(element);
  const fadeGain = ctx.createGain();
  source.connect(fadeGain);
  fadeGain.connect(trackGain);
  mediaAudioMap.set(mediaId, { source, fadeGain, trackId });
}

// ── Volume + mute control ─────────────────────────────────────────────────────
export function setTrackGain(trackId: string, volume: number, muted: boolean): void {
  const nodes = trackNodesMap.get(trackId);
  if (nodes) nodes.gainNode.gain.value = muted ? 0 : Math.max(0, volume);
}

// ── Per-clip fade gain ────────────────────────────────────────────────────────
export function setFadeGain(mediaId: string, gainValue: number): void {
  const entry = mediaAudioMap.get(mediaId);
  if (entry) entry.fadeGain.gain.value = Math.max(0, gainValue);
}

// ── RMS level for VU meter (0-1) ──────────────────────────────────────────────
export function getAnalyserLevel(trackId: string): number {
  const nodes = trackNodesMap.get(trackId);
  if (!nodes) return 0;
  const data = new Uint8Array(nodes.analyserNode.frequencyBinCount);
  nodes.analyserNode.getByteTimeDomainData(data);
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    const f = (data[i]! / 128) - 1;
    sumSq += f * f;
  }
  return Math.sqrt(sumSq / data.length);
}

// ── Decode and downsample audio waveform ──────────────────────────────────────
export async function decodeWaveform(url: string, numPoints = 2000): Promise<Float32Array> {
  const ctx     = getCtx();
  const buf     = await fetch(url).then((r) => r.arrayBuffer());
  const decoded = await ctx.decodeAudioData(buf);
  const channel = decoded.getChannelData(0);
  const step    = Math.max(1, Math.floor(channel.length / numPoints));
  const result  = new Float32Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    let peak = 0;
    const start = i * step;
    const end   = Math.min(start + step, channel.length);
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j] ?? 0);
      if (v > peak) peak = v;
    }
    result[i] = peak;
  }
  return result;
}
