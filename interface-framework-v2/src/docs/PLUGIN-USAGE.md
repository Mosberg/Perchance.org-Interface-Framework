# Interface Framework v2

Universal OSRS-style interface runtime for Perchance generators.

This framework is designed to normalize very different payloads into one interactive UI shell:
- Chat and character chat generators.
- RPG and simulation generators.
- Guessing games and quiz interfaces.
- Story generators.
- Text-to-image and visual output generators.

## 1. Import plugin in Perchance

```perchance
interfaceFrameworkV2 = {import:interface-framework-v2}
```

## 2. Include CSS + JS + mount node

```html
<link rel="stylesheet" href="[interfaceFrameworkV2.styleUrl]">
<div id="[interfaceFrameworkV2.mountId]"></div>
<script src="[interfaceFrameworkV2.scriptUrl]"></script>
<script src="[interfaceFrameworkV2.presetsScriptUrl]"></script>
<script>
  window.ifw2 = window.createInterfaceFrameworkV2({
    mount: "#[interfaceFrameworkV2.mountId]",
    mode: "universal",
    title: "My Generator",
    subtitle: "Powered by interface-framework-v2"
  });
</script>
```

## 3. Use ready-made presets for specific generator links

You can create adapters directly for these links:
- `https://perchance.org/ai-chat`
- `https://perchance.org/ai-character-chat`
- `https://perchance.org/ai-rpg`

```html
<script>
  const adapter = window.interfaceFrameworkV2Presets.createPresetForLink(
    "https://perchance.org/ai-chat"
  );

  window.ifw2 = window.createInterfaceFrameworkV2({
    mount: "#[interfaceFrameworkV2.mountId]",
    adapter
  });
</script>
```

You can also instantiate each preset explicitly:

```js
const aiChatAdapter = window.interfaceFrameworkV2Presets.createAiChatAdapter();

const aiCharacterChatAdapter =
  window.interfaceFrameworkV2Presets.createAiCharacterChatAdapter({
    seedSkeletonWhenMissing: true
  });

const aiRpgAdapter = window.interfaceFrameworkV2Presets.createAiRpgAdapter();
```

## 4. Push generator payloads

```html
<script>
  window.ifw2.setData({
    title: "Adventure Runtime",
    mode: "ai-rpg",
    status: "Session live",
    stats: { hp: 87, maxHp: 99, prayer: 60, maxPrayer: 99, run: 76, spec: 50 },
    messages: [
      { role: "system", content: "Adventure initialized." },
      { role: "assistant", content: "You enter a fog-covered harbor." }
    ],
    actions: [
      { id: "walk-here", label: "Walk" },
      { id: "inspect-target", label: "Inspect" },
      { id: "focus-chat", label: "Reply" }
    ],
    inventory: [
      { name: "Rune scimitar", qty: 1 },
      { name: "Shark", qty: 8 }
    ],
    images: [
      { url: "https://example.com/result.png", label: "Render A" }
    ]
  }, "generator-update");
</script>
```

## 5. Adapter contract

You can pass a custom adapter to orchestrate transformations and action handling:

```js
const app = window.createInterfaceFrameworkV2({
  mount: "#ifw2-root",
  adapter: {
    name: "my-generator-adapter",
    pollMs: 0,
    transform(input, helpers) {
      return helpers.normalizeInput(input);
    },
    onAction(actionId, payload, api) {
      if (actionId === "reroll-image") {
        return { status: "Reroll requested" };
      }
      return null;
    },
    onChat(message, channel, api) {
      return {
        messages: [{ role: "assistant", content: `Echo: ${message}` }]
      };
    },
    onTabChange(group, tabId, api) {
      return null;
    }
  }
});
```

## 6. AI-character-chat compatibility

The runtime includes a helper to generate a safe table skeleton under `data.data`.

```js
const skeleton = window.ifw2.createAiCharacterChatSkeleton({
  characterName: "Guide",
  threadTitle: "Main Thread"
});
```

The helper includes these required tables:
- `characters`
- `threads`
- `messages`
- `misc`
- `summaries`
- `memories`
- `lore`
- `textEmbeddingCache`
- `textCompressionCache`

## 7. Generator fit examples

The framework can support generators like:
- `https://perchance.org/ai-chat`
- `https://perchance.org/ai-character-chat`
- `https://perchance.org/ai-rpg`
- `https://perchance.org/ai-games`
- `https://perchance.org/ai-story-generator`
- `https://perchance.org/ai-text-to-image-generator`
- `https://perchance.org/geography-guesser`
- `https://perchance.org/guess-the-city`
- `https://perchance.org/guess-the-film`
- `https://perchance.org/interactive-rpg`
- `https://perchance.org/scratchgames`
- `https://perchance.org/warrior-cats-interactive`

Any generator can integrate by mapping its payload fields into the adapter contract.
