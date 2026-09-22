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
    if (context.state === "suspended") {
      void context.resume();
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
