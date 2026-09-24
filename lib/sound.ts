type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

const SOUND_KEY = "ck-sound";

let context: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;
let stopActiveDrone: (() => void) | null = null;
let output: GainNode | null = null;
let recordDestination: MediaStreamAudioDestinationNode | null = null;

try {
  if (typeof window !== "undefined") {
    enabled = window.localStorage.getItem(SOUND_KEY) !== "off";
  }
} catch (error) {
  console.error("Sound preference could not be read", error);
}

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    window.localStorage.setItem(SOUND_KEY, value ? "on" : "off");
  } catch (error) {
    console.error("Sound preference could not be saved", error);
  }
}

function getContext() {
  if (!enabled || typeof window === "undefined") return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state !== "running" && context.state !== "closed") {
      context.resume().catch((error: unknown) => console.error("Audio context could not resume", error));
    }
    return context;
  } catch (error) {
    console.error("Audio context could not be created", error);
    return null;
  }
}

function getOutput(ctx: AudioContext) {
  if (!output) {
    output = ctx.createGain();
    output.connect(ctx.destination);
    try {
      recordDestination = ctx.createMediaStreamDestination();
      output.connect(recordDestination);
    } catch (error) {
      console.error("Audio recording destination could not be created", error);
    }
  }
  return output;
}

export function getSoundStream() {
  const ctx = getContext();
  if (!ctx) return null;
  getOutput(ctx);
  return recordDestination?.stream ?? null;
}

function getNoise(ctx: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

export function startDrone(duration: number) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.16, now + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(1800, now + duration);
  filter.connect(master);
  master.connect(getOutput(ctx));

  const oscillators = [
    { type: "sine" as OscillatorType, freq: 73.42, gain: 0.7 },
    { type: "triangle" as OscillatorType, freq: 110, gain: 0.35 },
    { type: "sine" as OscillatorType, freq: 146.83, gain: 0.25 },
    { type: "sine" as OscillatorType, freq: 220.5, gain: 0.12 },
  ].map(({ type, freq, gain }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.06, now + duration);
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g);
    g.connect(filter);
    osc.start(now);
    return osc;
  });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    oscillators.forEach((osc) => osc.stop(t + 1));
  };
  stopActiveDrone?.();
  stopActiveDrone = stop;
}

export function stopDrone() {
  stopActiveDrone?.();
  stopActiveDrone = null;
}

export function playRustle(strength = 1) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800 + Math.random() * 2400;
  band.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22 * strength, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22 + Math.random() * 0.1);
  source.connect(band);
  band.connect(gain);
  gain.connect(getOutput(ctx));
  source.start(now, Math.random());
  source.stop(now + 0.4);
}

export function playWhoosh() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(250, now);
  low.frequency.exponentialRampToValueAtTime(1400, now + 0.5);
  low.frequency.exponentialRampToValueAtTime(300, now + 1.1);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  source.connect(low);
  low.connect(gain);
  gain.connect(getOutput(ctx));
  source.start(now);
  source.stop(now + 1.3);
}

export function playChime() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 783.99, 1046.5, 1567.98, 2093].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = now + index * 0.07;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06 / (index * 0.5 + 1), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
    osc.connect(gain);
    gain.connect(getOutput(ctx));
    osc.start(start);
    osc.stop(start + 3.3);
  });
}

export function playCrackle(duration: number) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const noise = getNoise(ctx);

  const roar = ctx.createBufferSource();
  roar.buffer = noise;
  roar.loop = true;
  const roarFilter = ctx.createBiquadFilter();
  roarFilter.type = "lowpass";
  roarFilter.frequency.value = 520;
  const roarGain = ctx.createGain();
  roarGain.gain.setValueAtTime(0.0001, now);
  roarGain.gain.exponentialRampToValueAtTime(0.14, now + duration * 0.3);
  roarGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  roar.connect(roarFilter);
  roarFilter.connect(roarGain);
  roarGain.connect(getOutput(ctx));
  roar.start(now);
  roar.stop(now + duration + 0.1);

  const pops = Math.round(duration * 26);
  for (let i = 0; i < pops; i++) {
    const at = now + Math.random() * duration * 0.92;
    const envelope = Math.sin((Math.PI * (at - now)) / duration);
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1200 + Math.random() * 4200;
    band.Q.value = 1.4;
    const gain = ctx.createGain();
    const peak = (0.05 + Math.random() * 0.22) * Math.max(0.15, envelope);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.02 + Math.random() * 0.05);
    source.connect(band);
    band.connect(gain);
    gain.connect(getOutput(ctx));
    source.start(at, Math.random() * 1.5);
    source.stop(at + 0.09);
  }
}

function noiseLayer(
  ctx: AudioContext,
  options: { type: BiquadFilterType; from: number; to: number; peak: number; attack: number; duration: number; q?: number },
) {
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = options.type;
  filter.Q.value = options.q ?? 0.8;
  filter.frequency.setValueAtTime(options.from, now);
  filter.frequency.exponentialRampToValueAtTime(options.to, now + options.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.peak, now + options.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(getOutput(ctx));
  source.start(now);
  source.stop(now + options.duration + 0.1);
}

function tone(ctx: AudioContext, type: OscillatorType, from: number, to: number, peak: number, duration: number, delay = 0) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.4, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(getOutput(ctx));
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playPortalRumble(duration: number) {
  const ctx = getContext();
  if (!ctx) return;
  tone(ctx, "sine", 42, 64, 0.35, duration);
  tone(ctx, "triangle", 84, 130, 0.08, duration);
  noiseLayer(ctx, { type: "lowpass", from: 180, to: 900, peak: 0.22, attack: duration * 0.6, duration });
}

export function playTunnel(duration: number) {
  const ctx = getContext();
  if (!ctx) return;
  noiseLayer(ctx, { type: "lowpass", from: 120, to: 1400, peak: 0.34, attack: duration * 0.85, duration });
  noiseLayer(ctx, { type: "bandpass", from: 400, to: 1800, peak: 0.08, attack: duration * 0.9, duration, q: 0.7 });
  tone(ctx, "sine", 36, 58, 0.3, duration);
  tone(ctx, "sine", 72, 96, 0.05, duration);
}

export function playArrival() {
  const ctx = getContext();
  if (!ctx) return;
  tone(ctx, "sine", 55, 48, 0.3, 3.5);
  [392, 587.33, 783.99].forEach((freq, index) => tone(ctx, "sine", freq, freq, 0.05, 4, index * 0.12));
}

export function playSealCrack() {
  const ctx = getContext();
  if (!ctx) return;
  noiseLayer(ctx, { type: "highpass", from: 2400, to: 1200, peak: 0.35, attack: 0.005, duration: 0.25 });
  tone(ctx, "sine", 90, 40, 0.4, 0.6);
  [1318.5, 1975.5, 2637].forEach((freq, index) => tone(ctx, "sine", freq, freq, 0.05, 2.4, 0.08 + index * 0.05));
}

export function playDoorGrind(duration: number) {
  const ctx = getContext();
  if (!ctx) return;
  noiseLayer(ctx, { type: "lowpass", from: 260, to: 120, peak: 0.3, attack: 0.6, duration, q: 3 });
  tone(ctx, "sawtooth", 38, 30, 0.08, duration);
}
