import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "people-rating-sound-enabled";

function getStoredSoundEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (storedValue === "false") {
    return false;
  }

  return true;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function useSoundscape() {
  const [soundEnabled, setSoundEnabled] = useState(getStoredSoundEnabled);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const contextRef = useRef(null);
  const masterGainRef = useRef(null);
  const ambientNodesRef = useRef(null);
  const hoverStampRef = useRef(0);
  const soundEnabledRef = useRef(soundEnabled);

  function ensureAudioGraph() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      const context = new AudioContextClass();
      const masterGain = context.createGain();

      masterGain.gain.value = 0;
      masterGain.connect(context.destination);

      contextRef.current = context;
      masterGainRef.current = masterGain;
    }

    return contextRef.current;
  }

  function scheduleGainRamp(gainNode, value, time = 0.28) {
    if (!gainNode || !contextRef.current) {
      return;
    }

    const now = contextRef.current.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(value, now + time);
  }

  function startAmbient() {
    const context = ensureAudioGraph();
    const masterGain = masterGainRef.current;

    if (!context || !masterGain || ambientNodesRef.current) {
      return;
    }

    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 680;
    lowpass.Q.value = 0.7;

    const ambientGain = context.createGain();
    ambientGain.gain.value = 0;

    const oscA = context.createOscillator();
    oscA.type = "triangle";
    oscA.frequency.value = 110;

    const oscB = context.createOscillator();
    oscB.type = "sine";
    oscB.frequency.value = 164.81;
    oscB.detune.value = 7;

    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 329.63;

    const shimmerGain = context.createGain();
    shimmerGain.gain.value = 0.0018;

    const pulseLfo = context.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = 0.07;

    const pulseDepth = context.createGain();
    pulseDepth.gain.value = 0.014;

    const filterLfo = context.createOscillator();
    filterLfo.type = "sine";
    filterLfo.frequency.value = 0.035;

    const filterDepth = context.createGain();
    filterDepth.gain.value = 170;

    oscA.connect(ambientGain);
    oscB.connect(ambientGain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ambientGain);
    ambientGain.connect(lowpass);
    lowpass.connect(masterGain);

    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(ambientGain.gain);
    filterLfo.connect(filterDepth);
    filterDepth.connect(lowpass.frequency);

    oscA.start();
    oscB.start();
    shimmer.start();
    pulseLfo.start();
    filterLfo.start();

    ambientNodesRef.current = {
      oscillators: [oscA, oscB, shimmer, pulseLfo, filterLfo],
      gains: [ambientGain, shimmerGain, pulseDepth, filterDepth],
      filters: [lowpass],
      ambientGain,
    };

    scheduleGainRamp(masterGain, 0.11, 0.9);
    scheduleGainRamp(ambientGain, 0.065, 1.4);
  }

  function stopAmbient() {
    const masterGain = masterGainRef.current;
    const ambientNodes = ambientNodesRef.current;

    if (!masterGain) {
      return;
    }

    scheduleGainRamp(masterGain, 0, 0.32);

    if (!ambientNodes || !contextRef.current) {
      ambientNodesRef.current = null;
      return;
    }

    const stopAt = contextRef.current.currentTime + 0.42;

    ambientNodes.oscillators.forEach((node) => {
      try {
        node.stop(stopAt);
      } catch {}
    });

    window.setTimeout(() => {
      ambientNodes.gains.forEach((node) => {
        try {
          node.disconnect();
        } catch {}
      });
      ambientNodes.filters.forEach((node) => {
        try {
          node.disconnect();
        } catch {}
      });
    }, 520);

    ambientNodesRef.current = null;
  }

  function unlockSound() {
    const context = ensureAudioGraph();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    setSoundUnlocked(true);

    if (soundEnabledRef.current) {
      startAmbient();
    }
  }

  function playTone({
    type = "sine",
    frequency = 440,
    duration = 0.16,
    gain = 0.05,
    detune = 0,
    attack = 0.01,
    release = 0.14,
    filterFrequency = 1800,
    destinationGain = null,
  }) {
    const context = ensureAudioGraph();
    const masterGain = destinationGain || masterGainRef.current;

    if (!context || !masterGain || !soundEnabledRef.current) {
      return;
    }

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detune, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, now);
    filter.Q.setValueAtTime(0.45, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration + release + 0.02);
  }

  function playChord(frequencies, options = {}) {
    frequencies.forEach((frequency, index) => {
      playTone({
        ...options,
        frequency,
        detune: index * 4,
      });
    });
  }

  function playHover(kind = "default") {
    const now = performance.now();

    if (now - hoverStampRef.current < 90) {
      return;
    }

    hoverStampRef.current = now;

    if (kind === "rate") {
      playTone({
        type: "sine",
        frequency: 620,
        duration: 0.06,
        gain: 0.018,
        filterFrequency: 2200,
      });
      return;
    }

    if (kind === "action") {
      playTone({
        type: "triangle",
        frequency: 470,
        duration: 0.08,
        gain: 0.02,
        filterFrequency: 2100,
      });
      return;
    }

    if (kind === "inspect") {
      playTone({
        type: "sine",
        frequency: 360,
        duration: 0.06,
        gain: 0.012,
        filterFrequency: 1800,
      });
    }
  }

  function playSlider(value, max) {
    const normalized = clamp(value / max, 0, 1);

    playTone({
      type: "triangle",
      frequency: 240 + normalized * 280,
      duration: 0.05,
      gain: 0.028,
      filterFrequency: 1900 + normalized * 900,
    });
  }

  function playStep(direction = "next") {
    playTone({
      type: "triangle",
      frequency: direction === "previous" ? 260 : 320,
      duration: 0.09,
      gain: 0.026,
      filterFrequency: 1800,
    });
  }

  function playStart() {
    playChord([261.63, 329.63, 392], {
      type: "sine",
      duration: 0.18,
      gain: 0.024,
      filterFrequency: 2200,
    });
  }

  function playReveal() {
    playChord([293.66, 440, 587.33], {
      type: "triangle",
      duration: 0.2,
      gain: 0.028,
      filterFrequency: 2400,
    });
    window.setTimeout(() => {
      playTone({
        type: "sine",
        frequency: 783.99,
        duration: 0.18,
        gain: 0.03,
        filterFrequency: 2800,
      });
    }, 110);
  }

  function playExport() {
    playChord([349.23, 523.25], {
      type: "sine",
      duration: 0.12,
      gain: 0.022,
      filterFrequency: 2300,
    });
  }

  function playReset() {
    playTone({
      type: "triangle",
      frequency: 210,
      duration: 0.14,
      gain: 0.02,
      filterFrequency: 1200,
    });
  }

  function toggleSound() {
    setSoundEnabled((current) => {
      const next = !current;
      soundEnabledRef.current = next;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }

      if (next) {
        unlockSound();
      } else {
        stopAmbient();
      }

      return next;
    });
  }

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    function handleGestureUnlock() {
      unlockSound();
    }

    window.addEventListener("pointerdown", handleGestureUnlock, {
      passive: true,
    });
    window.addEventListener("keydown", handleGestureUnlock);

    return () => {
      window.removeEventListener("pointerdown", handleGestureUnlock);
      window.removeEventListener("keydown", handleGestureUnlock);
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled) {
      stopAmbient();
      return;
    }

    if (soundUnlocked) {
      startAmbient();
    }
  }, [soundEnabled, soundUnlocked]);

  useEffect(
    () => () => {
      stopAmbient();
      if (contextRef.current?.state !== "closed") {
        contextRef.current?.close().catch(() => {});
      }
    },
    [],
  );

  return {
    soundEnabled,
    soundUnlocked,
    toggleSound,
    unlockSound,
    playExport,
    playHover,
    playReset,
    playReveal,
    playSlider,
    playStart,
    playStep,
  };
}
