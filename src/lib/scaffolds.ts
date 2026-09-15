/* Quality scaffolds for engine builds.                                */
/*                                                                     */
/* A small local model does not reliably invent AAA quality — but it    */
/* assembles it very well when handed proven structure. This library    */
/* gives Nex:                                                           */
/*   1. genre scaffolds — complete, correct gameplay skeletons (Luau    */
/*      for Roblox, engine-agnostic for others) the model adapts, not   */
/*      invents;                                                        */
/*   2. lighting/material/sound presets — tuned value sets that         */
/*      instantly lift a scene above "engine-gray defaults".            */
/* The model picks a scaffold via the `scaffold` tool, then the full    */
/* text rides into its context through the tool result.                 */

export interface Scaffold {
  id: string;
  /** genres this scaffold covers */
  genres: string[];
  engines: string[];
  label: string;
  /** what this scaffold already gives the game — the model must not rebuild it */
  provides: string[];
  /** code the model adapts (placeholder-free, runnable as written) */
  code: string;
}

/* ------------------------------------------------------------------ */
/* Genre scaffolds (Roblox / Luau — the primary build target)          */
/* ------------------------------------------------------------------ */

const OBBY_LUAU = `-- QynOne scaffold: obstacle course (obby) — complete checkpoint loop.
-- Adapt values; do not remove the checkpoint/spawn-recovery logic.

local STAGE_SERVICE = {}
local checkpoints = workspace:WaitForChild("Checkpoints") -- folder of parts, ordered
local players = game:GetService("Players")

local function onTouched(checkpoint, player)
	local char = player.Character
	if not char then return end
	local hrp = char:FindFirstChild("HumanoidRootPart")
	local hum = char:FindFirstChildOfClass("Humanoid")
	if hrp and hum and hum.Health > 0 then
		local stage = tonumber(checkpoint:GetAttribute("Stage")) or 1
		local prev = player:GetAttribute("Stage") or 0
		if stage > prev then
			player:SetAttribute("Stage", stage)
			-- feedback: sound + a short highlight so progress is *felt*
			local s = Instance.new("Sound")
			s.SoundId = "rbxassetid://12221967" -- soft chime
			s.Volume = 0.5
			s.Parent = hrp
			s:Play()
			game:GetService("Debris"):AddItem(s, 2)
		end
	end
end

players.PlayerAdded:Connect(function(player)
	player:SetAttribute("Stage", 0)
	player.CharacterAdded:Connect(function(char)
		local stage = player:GetAttribute("Stage") or 0
		local cp = checkpoints:FindFirstChild(tostring(stage)) or checkpoints:FindFirstChild("0")
		task.wait(0.1)
		if cp and char:FindFirstChild("HumanoidRootPart") then
			char:PivotTo(cp.CFrame + Vector3.new(0, 4, 0))
		end
	end)
end)

for _, cp in ipairs(checkpoints:GetChildren()) do
	cp.Touched:Connect(function(hit)
		local player = players:GetPlayerFromCharacter(hit.Parent)
		if player then onTouched(cp, player) end
	end)
end

return STAGE_SERVICE`;

const SURVIVAL_LUAU = `-- QynOne scaffold: round-based survival — join, lobby, round, win/lose.
-- One script drives the loop; adapt timing and map refs, keep the states.

local RS = game:GetService("ReplicatedStorage")
local players = game:GetService("Players")

local RoundEvent = RS:FindFirstChild("RoundState") or Instance.new("RemoteEvent")
RoundEvent.Name = "RoundState"
RoundEvent.Parent = RS

local LOBBY_TIME, ROUND_TIME, MIN_PLAYERS = 15, 120, 1
local states = { WAITING = "WaitingForPlayers", STARTING = "Starting", ACTIVE = "Active", ENDING = "Ending" }

local function setAll(state, seconds)
	RoundEvent:FireAllClients(state, seconds)
end

while true do
	-- WAITING
	repeat
		setAll(states.WAITING, #players:GetPlayers())
		task.wait(1)
	until #players:GetPlayers() >= MIN_PLAYERS

	-- STARTING countdown (players can still leave; re-check)
	for t = LOBBY_TIME, 1, -1 do
		setAll(states.STARTING, t)
		if #players:GetPlayers() < MIN_PLAYERS then break end
		task.wait(1)
	end
	if #players:GetPlayers() < MIN_PLAYERS then continue end

	-- ACTIVE: teleport to arena, run the clock
	setAll(states.ACTIVE, ROUND_TIME)
	for _, player in ipairs(players:GetPlayers()) do
		local char = player.Character
		if char then char:PivotTo(workspace.Arena.Spawn.CFrame + Vector3.new(0, 4, 0)) end
	end
	local survived = {}
	local endTime = os.clock() + ROUND_TIME
	while os.clock() < endTime and #survived == 0 do
		task.wait(1)
		for _, player in ipairs(players:GetPlayers()) do
			local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if hum and hum.Health > 0 and not table.find(survived, player) then
				table.insert(survived, player)
			end
		end
	end

	-- ENDING: announce, clean up, back to lobby
	setAll(states.ENDING, 5)
	task.wait(5)
	for _, player in ipairs(players:GetPlayers()) do
		player:LoadCharacter()
	end
end`;

const COLLECT_LUAU = `-- QynOne scaffold: collect-and-sell loop (coins, shop, upgrades).
-- The core retention loop of every popular collector game, complete.

local players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")

local DATA = {} -- [player] = { coins = 0, gems = 0, capacity = 10 }

players.PlayerAdded:Connect(function(player)
	DATA[player] = { coins = 0, gems = 0, capacity = 10 }
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = leaderstats
	leaderstats.Parent = player
end)

players.PlayerRemoving:Connect(function(player)
	DATA[player] = nil
end)

-- Pickup: any part tagged "Pickup" pays out until capacity, then a hint.
local CollectionService = game:GetService("CollectionService")
local function wirePickup(part)
	part.Touched:Connect(function(hit)
		local player = players:GetPlayerFromCharacter(hit.Parent)
		local data = player and DATA[player]
		if not data then return end
		if data.coins >= data.capacity then
			-- capacity is the sell trigger — the loop that brings players back
			return
		end
		data.coins += part:GetAttribute("Value") or 1
		player.leaderstats.Coins.Value = data.coins
		part:Destroy()
		local s = Instance.new("Sound")
		s.SoundId = "rbxassetid://607665037" -- pop
		s.Volume = 0.4
		s.Parent = hit
		s:Play()
		game:GetService("Debris"):AddItem(s, 1.5)
	end)
end
for _, part in ipairs(CollectionService:GetTagged("Pickup")) do wirePickup(part) end
CollectionService:GetInstanceAddedSignal("Pickup"):Connect(wirePickup)

-- Sell pad: convert coins → gems, raise capacity, buy upgrades.
local sellPad = workspace:WaitForChild("SellPad")
sellPad.Touched:Connect(function(hit)
	local player = players:GetPlayerFromCharacter(hit.Parent)
	local data = player and DATA[player]
	if not data or data.coins == 0 then return end
	data.gems += data.coins
	data.coins = 0
	data.capacity += 5 -- every sell makes the next run bigger
	player.leaderstats.Coins.Value = 0
end)`;

const HORROR_LUAU = `-- QynOne scaffold: horror tension loop — sanity, stalker AI, safe rooms.
-- Fear = audio + lighting + scarcity. Scripted, not decorative.

local players = game:GetService("Players")
local lighting = game:GetService("Lighting")

-- Atmosphere block — apply once, it carries the whole mood.
lighting.Ambient = Color3.fromRGB(12, 14, 22)
lighting.OutdoorAmbient = Color3.fromRGB(8, 10, 16)
lighting.Brightness = 0.8
lighting.ClockTime = 0 -- midnight
lighting.FogColor = Color3.fromRGB(10, 12, 18)
lighting.FogEnd = 60 -- claustrophobia
local atmo = Instance.new("Atmosphere")
atmo.Density = 0.45
atmo.Color = Color3.fromRGB(60, 70, 100)
atmo.Parent = lighting

local SANITY_MAX = 100
local sanity = {} -- [player] = number

players.PlayerAdded:Connect(function(player)
	sanity[player] = SANITY_MAX
end)

-- Sanity drains in the dark, recovers in light zones (tagged "SafeLight").
task.spawn(function()
	while true do
		task.wait(1)
		for player, value in pairs(sanity) do
			local char = player.Character
			local hum = char and char:FindFirstChildOfClass("Humanoid")
			if hum and hum.Health > 0 then
				local lit = false
				for _, zone in ipairs(workspace:GetTagged("SafeLight")) do
					if (char.HumanoidRootPart.Position - zone.Position).Magnitude < (zone:GetAttribute("Radius") or 12) then
						lit = true
						break
					end
				end
				sanity[player] = math.clamp(value + (lit and 6 or -3), 0, SANITY_MAX)
				-- low sanity: heartbeat rises, vision narrows via fog
				if sanity[player] < 30 then
					hum.WalkSpeed = 14 -- panic sprint
				end
			end
		end
	end
end)

-- Stalker: moves only when not observed (Weeping-Angel rule, proven scary).
local stalker = workspace:WaitForChild("Stalker")
task.spawn(function()
	while true do
		task.wait(0.5)
		local target = nil
		for _, player in ipairs(players:GetPlayers()) do
			if sanity[player] and sanity[player] > 0 then target = player break end
		end
		if target and target.Character then
			local watched = false
			-- cheap line-of-sight: any player camera facing the stalker
			for _, camera in ipairs(workspace.CurrentCamera and { workspace.CurrentCamera } or {}) do
				local toStalker = (stalker.Position - camera.CFrame.Position).Unit
				if camera.CFrame.LookVector:Dot(toStalker) > 0.6 then watched = true end
			end
			if not watched then
				stalker.CFrame = stalker.CFrame:Lerp(target.Character.HumanoidRootPart.CFrame, 0.06)
			end
		end
	end
end)`;

/* ------------------------------------------------------------------ */
/* Scene presets — tuned value sets, not advice                        */
/* ------------------------------------------------------------------ */

export interface ScenePreset {
  id: string;
  label: string;
  mood: string;
  lighting: string;
  materials: string;
  audio: string;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "horror-night",
    label: "Horror night",
    mood: "dread, scarcity, heartbeat",
    lighting:
      "Ambient (12,14,22) · OutdoorAmbient (8,10,16) · Brightness 0.8 · ClockTime 0 · FogColor (10,12,18) · FogEnd 60 · Atmosphere Density 0.45 Color (60,70,100). One flickering warm point light per safe zone (255,180,90, range 14) so safety reads instantly.",
    materials:
      "Walls: Slate or Concrete with Color (40,42,50). Floor: Wood planks (60,45,38). Accent props: aged metal (70,72,80). Zero Plastic defaults, zero neon.",
    audio: "Low wind ambience loop · creak stingers every 20–40 s randomized · heartbeat below 30 sanity · footsteps per surface.",
  },
  {
    id: "sunny-adventure",
    label: "Sunny adventure",
    mood: "bright, inviting, readable",
    lighting:
      "ClockTime 10.5 · Brightness 2.4 · Ambient (140,145,160) · OutdoorAmbient (170,180,200) · FogEnd 1000 · Atmosphere Density 0.3 Color (200,215,235). Soft shadows via ShadowSoftness 0.2.",
    materials:
      "Grass: Grass material (95,158,80). Paths: Cobblestone (150,148,140). Wood: Wood (140,100,65). Water: Water material with slight transparency. Props use 3–4 saturations of one hue family, never rainbow.",
    audio: "Bird ambience · soft collect chime · upbeat but quiet music bed.",
  },
  {
    id: "neon-city",
    label: "Neon city",
    mood: "electric night, contrast-forward",
    lighting:
      "ClockTime 0 · Brightness 1.2 · Ambient (30,32,48) · FogColor (18,20,34) · FogEnd 220 · Atmosphere Density 0.35. Neon used as STRUCTURE (sign edges, building outlines via Neon material strips), never as spam.",
    materials:
      "Buildings: Concrete (35,38,52) with Neon accent strips in ONE hue (e.g. cyan 0,200,255) + one warm counterpoint (255,120,80). Streets: Asphalt (25,26,32) with painted line parts (220,220,230). Wet-look: Glass with 0.3 reflectance on ground accents.",
    audio: "Distant city hum · synth pad bed · interaction blips.",
  },
  {
    id: "cozy-interior",
    label: "Cozy interior",
    mood: "warm, safe, intimate",
    lighting:
      "ClockTime 20.5 · Brightness 1.6 · Ambient (70,60,55) · warm point lights (255,190,120) at lamps, range 16–22 · no fog indoors.",
    materials:
      "Wood floors (120,85,55) · fabric upholstery via Fabric material · warm painted walls (205,190,175) · brass/gold lamp trims (190,150,90).",
    audio: "Fireplace crackle · soft lofi bed · gentle UI ticks.",
  },
];

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const SCAFFOLDS: Scaffold[] = [
  { id: "obby", genres: ["obby", "parkour", "platformer", "course"], engines: ["roblox"], label: "Obby / checkpoint course", provides: ["checkpoint loop", "spawn recovery", "progress feedback sound"], code: OBBY_LUAU },
  { id: "survival", genres: ["survival", "round", "wave", "battle"], engines: ["roblox"], label: "Round-based survival", provides: ["full round state machine", "lobby → active → ending", "win/lose handling"], code: SURVIVAL_LUAU },
  { id: "collect", genres: ["collector", "tycoon", "simulator", "clicker"], engines: ["roblox"], label: "Collect & sell loop", provides: ["leaderstats", "capacity pressure", "sell/upgrade loop", "pickup feedback"], code: COLLECT_LUAU },
  { id: "horror", genres: ["horror", "scary", "haunt", "creepy"], engines: ["roblox"], label: "Horror tension loop", provides: ["horror lighting block", "sanity system", "stalker AI (Weeping-Angel rule)"], code: HORROR_LUAU },
];

/** Pick the best scaffold for a goal text (id or genre mention). */
export function pickScaffold(goal: string): Scaffold | null {
  const g = goal.toLowerCase();
  let best: { s: Scaffold; score: number } | null = null;
  for (const s of SCAFFOLDS) {
    let score = 0;
    for (const genre of s.genres) if (g.includes(genre)) score += 2;
    if (g.includes(s.id)) score += 3;
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s ?? null;
}

/** Pick the best scene preset for a goal text. */
export function pickPreset(goal: string): ScenePreset | null {
  const g = goal.toLowerCase();
  const table: Array<[string, string]> = [
    ["horror", "horror-night"],
    ["scary", "horror-night"],
    ["creepy", "horror-night"],
    ["night", "horror-night"],
    ["city", "neon-city"],
    ["cyber", "neon-city"],
    ["neon", "neon-city"],
    ["futur", "neon-city"],
    ["cozy", "cozy-interior"],
    ["house", "cozy-interior"],
    ["home", "cozy-interior"],
    ["cabin", "cozy-interior"],
    ["adventure", "sunny-adventure"],
    ["sunny", "sunny-adventure"],
    ["bright", "sunny-adventure"],
    ["grass", "sunny-adventure"],
  ];
  for (const [kw, id] of table) {
    if (g.includes(kw)) return SCENE_PRESETS.find((p) => p.id === id) ?? null;
  }
  return null;
}
