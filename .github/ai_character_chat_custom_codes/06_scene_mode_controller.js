const CC_SCENE_RULES = [
  {
    pattern: /\b(storm|thunder|lightning|hurricane|rain)\b/i,
    scene: {
      background: {
        url: "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1600&q=80",
        filter: "grayscale(0.2) contrast(1.2) brightness(0.8)",
      },
      music: {
        url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_79f5f45fe4.mp3?filename=rain-ambient-110397.mp3",
        volume: 0.2,
      },
    },
  },
  {
    pattern: /\b(sunset|golden hour|dusk|twilight)\b/i,
    scene: {
      background: {
        url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
        filter: "saturate(1.15) contrast(1.05)",
      },
      music: {
        url: "https://cdn.pixabay.com/download/audio/2021/08/08/audio_5f5f4fbb67.mp3?filename=calm-meditation-ambience-6583.mp3",
        volume: 0.18,
      },
    },
  },
  {
    pattern: /\b(neon|cyberpunk|city lights)\b/i,
    scene: {
      background: {
        url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
        filter: "hue-rotate(235deg) saturate(1.35) brightness(0.9)",
      },
      music: {
        url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_ec29310f42.mp3?filename=synthwave-126172.mp3",
        volume: 0.16,
      },
    },
  },
];

oc.thread.on("MessageAdded", function ({ message }) {
  if (message.author !== "ai") return;

  const text = message.content || "";
  const match = CC_SCENE_RULES.find((r) => r.pattern.test(text));
  if (!match) return;

  message.scene = {
    background: {
      url: match.scene.background.url,
      filter: match.scene.background.filter,
    },
    music: {
      url: match.scene.music.url,
      volume: match.scene.music.volume,
    },
  };
});
