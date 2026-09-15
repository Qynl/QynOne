/* The craft curriculum — first-principles knowledge that transfers.     */
/*                                                                       */
/* Presets give a model fish. This teaches the knots. Every section is   */
/* written so a small model can DERIVE good values for any theme, mood   */
/* or genre it has never seen, instead of copying canned numbers.        */
/* It rides into engine-build context compactly and is pullable via the  */
/* /craft tool whenever deeper reasoning is needed mid-build.            */

/* ------------------------------------------------------------------ */
/* Derived lighting — how to compute a coherent scene from the mood     */
/* ------------------------------------------------------------------ */

export const CRAFT_LIGHTING = `LIGHTING — derive it, don't guess it:
1. Pick the sun angle from the story: dawn 5-7, noon 12-14, golden hour 17-18,
   dusk 18.5-19.5, night 0. ClockTime IS the sun position on Roblox.
2. Set FogEnd from intended visibility: arena ~150-250, open world 500-1000,
   horror 40-80 (fear = not seeing far). FogColor = the darkest color that
   dominates your palette — fog fades INTO the mood, never white unless snow.
3. Brightness follows mood: cozy 1.5-2, adventure 2-2.5, dramatic 1-1.5,
   horror 0.6-1. Indoor scenes: brightness matters less than point lights.
4. Rules that make it look composed, not random:
   - ONE dominant light direction + soft fill. Never equal lights from all sides.
   - Contrast = story. Keep the brightest area where you want the player to look.
   - Add exactly one Atmosphere; Density 0.25-0.45. Higher = hazier/dreamier.
   - Color temperature: warm sources (lamps ~RGB 255,190,120) against cool
     shadows (~RGB 30,35,50) reads as cinematic at any setting.`;

/* ------------------------------------------------------------------ */
/* Derived color — one palette logic for any theme                      */
/* ------------------------------------------------------------------ */

export const CRAFT_COLOR = `COLOR — the 60/30/10 rule, derivable for any theme:
1. NAME the mood in one word (cozy, dreadful, electric, innocent).
2. Pick a base hue that matches it (cozy→orange/brown, dreadful→desaturated
   blue-violet, electric→cyan/magenta, innocent→warm greens/yellows).
3. Build the palette: 60% dominant surfaces (walls, ground), 30% secondary
   (large props, roofs), 10% accent (lights, collectibles, callouts).
4. Desaturate the base, saturate only the accent. A palette where everything
   glows reads as cheap; one thing that glows reads as designed.
5. Derive shades: dark side = base color * 0.3-0.5 with hue shifted 10-20°
   toward blue; light side = toward the accent. Same hue family = cohesion.
6. Player-facing signal colors stay consistent across the whole game:
   damage = red family, interactables = accent color, safe = warm light.
Never use more than ~5 named colors. If two parts fight for attention,
one of them is wrong.`;

/* ------------------------------------------------------------------ */
/* Derived sound — building an audio bed without random asset IDs       */
/* ------------------------------------------------------------------ */

export const CRAFT_AUDIO = `SOUND — every interaction gets a voice, every space gets a bed:
1. AMBIENCE: one looping bed per biome/room. Rule: pick the two sounds a
   person would literally hear there (wind + birds; hum + distant chatter;
   drips + creaks). Keep both quiet — ambience is felt, not heard.
2. FEEDBACK SFX: map actions to sound classes — pickup=short bright pop,
   damage=low thud, UI=soft tick, success=rising chime, danger=low drone.
   Consistent classes teach the player the game's language.
3. Verified public IDs: rbxassetid://12221967 (soft chime) and
   rbxassetid://607665037 (pop/click). For the rest use Roblox's official
   Creator Store audio only — NEVER hardcode unknown IDs (they play silence).
4. VARIETY FOR FREE: pitch-shift (PlaybackSpeed 0.7-1.3) instead of adding
   more files. Randomize ±0.08 on repeats so loops don't grate.
5. MIXING: ambience 0.15-0.3 volume, feedback 0.4-0.6, music 0.2-0.35.
   If a sound must be noticed (danger stinger), it wins by contrast, not volume.`;

/* ------------------------------------------------------------------ */
/* Derived UI/HUD — hierarchy rules that work on any game               */
/* ------------------------------------------------------------------ */

export const CRAFT_UI = `HUD/UI — hierarchy before decoration:
1. List what the player must know AT ALL TIMES (health, objective, core
   currency). That list is the HUD. Everything else is a menu, not a HUD.
2. Corners have jobs: bottom-left = vitals, bottom-right = controls/ammo,
   top = objective or timer, top-right = meta stats. Consistency = comfort.
3. Readability rules: dark translucent backing (transparency 0.2-0.35)
   behind any text on a bright scene; 4px+ padding; one font family;
   bold for numbers, regular for labels.
4. Motion = meaning: numbers count up to their new value (never snap),
   bars lerp, panels slide in 0.2-0.35s with ease-out. Nothing teleports.
5. Color the HUD from the game's own palette (accent for highlights,
   base colors for chrome). The HUD belongs to the world, not the engine.
6. Juice list (ship all of it): button hover lift, click sound, screen
   nudge on damage, subtle FOV kick on sprint/speed, pickup flash.`;

/* ------------------------------------------------------------------ */
/* Derived gameplay feel — the loop that makes small games feel big     */
/* ------------------------------------------------------------------ */

export const CRAFT_GAMEPLAY = `GAME FEEL — the 60-second test a build must pass:
1. The core verb (jump, shoot, collect, drive) must feel good BEFORE content
   exists: tuned WalkSpeed/JumpPower, snappy input (no delayed response),
   camera that doesn't fight the player.
2. Every 30-60 seconds the player should: earn something, see something
   change, or face something new. Map your loop onto that rhythm.
3. Difficulty curve: first challenge teaches (impossible to fail), second
   tests (possible to fail), third demands (mastery). Celebrate each tier
   with audio + visual payoff.
4. Failure is feedback: death/reset shows what went wrong (red flash,
   sound, camera) and puts the player back in within 3 seconds.
5. Juice table — hits/pickups/actions get: sound + particle/flash + slight
   camera or scale response. Two of three minimum on important actions.
6. Onboarding with zero tutorial text: first 10 seconds, the only possible
   action is the core verb, and doing it gives a reward sound.`;

/* ------------------------------------------------------------------ */
/* Evidence-driven critique — judge the build, not the intention        */
/* ------------------------------------------------------------------ */

export const CRAFT_CRITIQUE = `CRITIQUE PROTOCOL — evidence, not assumptions:
After building a scene/system, verify it like a stranger would:
1. RUN it. Read the console: every red line is a bug, every warning is debt.
2. SCREENSHOT inspection, question by question: What is this scene's ONE
   focal point? Where does the eye go first — is that where gameplay is?
   How many colors can I count (over ~5 = chaos)? Any part still engine-gray
   (default color/Plastic = unfinished)? Is the light direction consistent?
3. PLAY the loop for 60 seconds as a hostile player: can I get stuck? Does
   anything repeat annoyingly? Is reward feedback instant?
4. If a question fails, the fix is concrete: reposition lights toward the
   focal point, reduce palette, rescale proportions, add the missing sound.
5. Re-verify after the fix — never mark improved without re-observing.
Opinions are cheap; a screenshot with a noted defect is a work order.`;

export const CRAFT_SECTIONS: Array<{ id: string; title: string; body: string }> = [
  { id: "lighting", title: "Lighting", body: CRAFT_LIGHTING },
  { id: "color", title: "Color", body: CRAFT_COLOR },
  { id: "audio", title: "Sound", body: CRAFT_AUDIO },
  { id: "ui", title: "HUD/UI", body: CRAFT_UI },
  { id: "gameplay", title: "Game feel", body: CRAFT_GAMEPLAY },
  { id: "critique", title: "Critique", body: CRAFT_CRITIQUE },
];

/** The compact version injected at build kickoff: the mindset, not the manual. */
export function craftKickoff(): string {
  return [
    "CRAFT MINDSET — you derive quality from principles, not canned values:",
    "• LIGHT: one dominant direction + warm/cool contrast; fog sets visibility and mood; the brightest area marks the focal point.",
    "• COLOR: name the mood, then 60/30/10 — desaturated base, saturated single accent, ≤5 named colors, consistent signal colors.",
    "• SOUND: one quiet ambience bed per space + a consistent feedback class per action; verified IDs only (12221967 chime, 607665037 pop; Creator Store for the rest); pitch-shift for variety.",
    "• HUD: only always-needed info on screen, fixed corner jobs, count-up numbers, everything eases.",
    "• FEEL: the core verb tuned before content; earn/see/face something every 30-60s; failure is instant, visible feedback.",
    "• VERIFY LIKE A STRANGER: run it, screenshot it, count colors, find the focal point, hunt engine-gray parts, then fix and re-verify. Full manual: /craft.",
  ].join("\n");
}
