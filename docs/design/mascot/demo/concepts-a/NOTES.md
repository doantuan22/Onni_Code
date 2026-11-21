# Mascot v2 Concepts A — Generation Notes & Recommendation

## Generated Assets

| File | Creature / Concept | Dimensions | Status |
| --- | --- | --- | --- |
| `concept-1.png` | Chibi Robot-Fox | 1024x1024 PNG (64x64 pixel-art style) | Generated via `image-generator` (converted from `.jpg` artifact to lossless `.png`) |
| `concept-2.png` | Chibi Cyber-Kitten | 1024x1024 PNG (64x64 pixel-art style) | Generated via `image-generator` (converted from `.jpg` artifact to lossless `.png`) |
| `concept-3.png` | Chibi Visor Desk-Bot ("Onni-Bot") | 1024x1024 PNG (64x64 pixel-art style) | Generated via `image-generator` (converted from `.jpg` artifact to lossless `.png`) |
| `sheet.png` | 5-Pose Sprite Sheet (Concept 3) | — | **Not generated** — `image-generator` hit `429 Too Many Requests` / `RESOURCE_EXHAUSTED` on `gemini-3.1-flash-image` (quota resets at `2026-11-21T06:37:50Z`). Not faked with code-drawn grids per brief/order. |

---

## Recommendation: **Concept 3 — Chibi Visor Desk-Bot ("Onni-Bot")**

**Why Concept 3 wins for OnniCode:**
1. **Cleanest pixel craft & outline integrity:** Every silhouette edge has an unbroken 1px dark navy (`#0A1A2F`) outline with crisp square pixels and zero stray edge artifacts (unlike `concept-1.png`, where the upper edge of the glowing tail tip lacks a dark outline).
2. **Unmistakable "local coding cockpit" identity:** Rather than a generic animal mascot, Onni-Bot pairs cute bunny-cat ears and a cozy azure scarf with a dark navy visor screen and tilted amber antenna — immediately reading as a friendly AI desktop companion.
3. **Best scalability & light/dark UI contrast:** Its bold white helmet-head pops cleanly against dark `#0A1A2F` surfaces while its 1px navy outline keeps it crisp on light surfaces. Even at 32px–48px UI empty-state/status sizes, the visor screen gives high-contrast room for expressive states (`working`, `success`, `error`, `sleep`) without losing facial readability.
4. **Cohesive brand motif integration:** The azure scarf features a clean circular chest badge carrying OnniCode's white `<` chevron mark, with amber (`#FFB020`) used sparingly on the antenna tip.

**Runner-up:** **Concept 2 (Chibi Cyber-Kitten)** — also very charming with strong coding personality (headset, amber spark tail, `<` hoodie emblem) and clean outlines; slightly busier at small sizes due to the dark-on-dark headset/ear contrast.

---

## Prompts Used

### Concept 1 — Chibi Robot-Fox (`concept-1.png`)
> Generate a single cute chibi pixel-art mascot image (hero idle pose).
> - Subject: An adorable kawaii chibi robot-fox coding companion mascot, big oversized head (chibi 1:1 head-to-body ratio), small plump cute body, fluffy oversized pixel fox tail with a sky-blue glowing tip, standing in a friendly front-facing hero idle pose with one tiny paw raised in a cute wave.
> - Face: Big shiny expressive kawaii anime pixel eyes (dark navy irises with bright azure and crisp white catchlights), rosy little sky-blue cheek blushes, cute tiny smiling mouth.
> - Details & Brand Motif: Sleek white and sky-blue (#5CA8FF) fur/chassis with deep navy (#0A1A2F) ear tips and hoodie-like collar, azure (#0B6BFF) vest/chest panel featuring a crisp small pixel '<' left-chevron emblem in the center, and a tiny warm amber (#FFB020) collar bell/gem accent.
> - Color Palette: Strictly limited cohesive palette centered on deep navy (#0A1A2F), vibrant azure (#0B6BFF), soft sky blue (#5CA8FF), crisp white (#FFFFFF), and a tiny amber (#FFB020) accent.
> - Style & Technical constraints: 64x64 retro-modern indie game pixel art sprite style rendered crisply at high resolution, clean 1px dark navy outline, crisp hard pixel edges, zero anti-aliasing, zero smooth gradients, zero blur, zero text, centered with generous padding on a completely flat solid pure magenta (#FF00FF) background for chroma-keying.

### Concept 2 — Chibi Cyber-Kitten (`concept-2.png`)
> Generate a single cute chibi pixel-art mascot image (hero idle pose).
> - Subject: An adorable plump kawaii chibi cyber-kitten coding companion mascot, big round head with cute pointed cat ears, short stubby limbs, curled cable-like cat tail ending in a tiny glowing warm amber (#FFB020) spark tip, sitting/standing in a charming front-facing hero idle pose.
> - Face: Huge sparkling kawaii pixel eyes with glossy white highlights, sweet little cat ':3' smile, soft white face with deep navy (#0A1A2F) hood/ear markings.
> - Details & Brand Motif: Wearing a cute mini coding headset with an amber (#FFB020) side LED dot, a cozy azure (#0B6BFF) and sky-blue (#5CA8FF) hoodie/scarf, and a crisp pixel '<' left-chevron badge on its chest.
> - Color Palette: Strictly limited cohesive palette centered on deep navy (#0A1A2F), vibrant azure (#0B6BFF), soft sky blue (#5CA8FF), crisp white (#FFFFFF), and a small amber (#FFB020) accent.
> - Style & Technical constraints: 64x64 modern kawaii pixel art sprite style rendered crisply at high resolution, clean 1px dark navy outline, crisp hard pixel edges, zero anti-aliasing, zero smooth gradients, zero blur, zero text, centered with generous padding on a completely flat solid pure magenta (#FF00FF) background for chroma-keying.

### Concept 3 — Chibi Visor Desk-Bot "Onni-Bot" (`concept-3.png`)
> Generate a single cute chibi pixel-art mascot image (hero idle pose).
> - Subject: An adorable kawaii chibi round desktop companion robot (inspired by cute retro pocket pets / Astro Bot), oversized rounded white helmet-head with cute bunny-cat antenna ears tipped in azure (#0B6BFF), short cute rounded body, standing in a cheerful front-facing hero idle pose.
> - Face: Glossy deep navy (#0A1A2F) rounded screen visor face displaying big bright expressive sky-blue (#5CA8FF) and white kawaii pixel eyes with happy curved highlights and a tiny cheerful pixel smile, plus soft glowing cheek dots.
> - Details & Brand Motif: Wearing a cozy azure (#0B6BFF) scarf/capelet with a small crisp white/sky-blue '<' left-chevron pin on the chest, and a tiny warm amber (#FFB020) power-core gem or antenna tip accent.
> - Color Palette: Strictly limited cohesive palette centered on deep navy (#0A1A2F), vibrant azure (#0B6BFF), soft sky blue (#5CA8FF), crisp white (#FFFFFF), and a small amber (#FFB020) accent.
> - Style & Technical constraints: 64x64 indie game pixel art sprite style rendered crisply at high resolution, clean 1px dark navy outline, crisp hard pixel edges, zero anti-aliasing, zero smooth gradients, zero blur, zero text, centered with generous padding on a completely flat solid pure magenta (#FF00FF) background for chroma-keying.

### Planned 5-Pose Sheet Prompt for Concept 3 (`sheet.png` — blocked by quota)
> Using the exact character design, proportions, palette, and pixel-art style from `concept-3.png`:
> Generate a horizontal 5-pose pixel-art sprite sheet (5 distinct full-body poses arranged neatly side-by-side in a single horizontal row with generous even spacing between sprites, on a completely flat solid pure magenta #FF00FF background).
> Keep the EXACT same "Onni-Bot" chibi mascot across all 5 poses: rounded white helmet-head with azure-tipped bunny-cat ears, tilted amber-tipped top antenna, deep navy (#0A1A2F) rounded visor screen face, azure (#0B6BFF) scarf/capelet with the tiny white/sky-blue '<' chevron chest pin, and 1px dark navy outline.
> The 5 poses from left to right (NO text labels, NO boxes, NO grid lines):
> 1. IDLE: Standing front-facing cheerful hero pose, big shiny sky-blue pixel eyes, tiny happy smile, arms relaxed at sides (matching the reference).
> 2. WORKING: Typing/focused pose — slightly leaning forward with tiny hands tapping on a mini glowing azure pixel keyboard/laptop hovering in front, focused bright pixel eyes, amber antenna glowing brightly.
> 3. SUCCESS: Jumping/cheering celebration pose — both little arms raised joyfully in the air, happy curved `^ ^` pixel eyes and wide happy smile, tiny pixel sparkles (sky-blue and amber) around it.
> 4. ERROR: Worried/dizzy alert pose — slightly slumped/tilted nervously with tiny hands near cheeks, worried `> <` or dizzy swirl pixel eyes and wavy worried mouth, a tiny amber pixel exclamation spark above its ear/antenna.
> 5. SLEEP: Cozy sleeping pose — sitting/curled down comfortably wrapped in its azure scarf, peaceful closed `- -` curved pixel eyes, tiny pixel `z Z` floating in sky-blue/white above its head, antenna drooped slightly.
> Style & Technical constraints: 64x64 sprite style per character rendered crisply in a wide horizontal 16:9 or 21:9 image so all 5 poses fit comfortably side-by-side without overlapping or cropping. Clean 1px dark navy (#0A1A2F) outline, crisp hard pixels, zero anti-aliasing, zero smooth gradients, zero blur, zero text labels, completely flat solid #FF00FF magenta background.
