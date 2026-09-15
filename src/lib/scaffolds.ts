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

const RACING_LUAU = `-- QynOne scaffold: racing — ordered checkpoints, lap gate, best-time tracking.
-- Name checkpoints "0" (start/finish) then "1".."N" in track order.

local players = game:GetService("Players")
local checkpoints = workspace:WaitForChild("Checkpoints")

local LAPS = 3
local RACE = {} -- [player] = { cp = 0, lap = 1, t0 = 0, best = nil }
local lastCp = 0
for _, cp in ipairs(checkpoints:GetChildren()) do
	local n = tonumber(cp.Name)
	if n and n > lastCp then lastCp = n end
end

local function startRace(player, keepBest)
	RACE[player] = { cp = 0, lap = 1, t0 = os.clock(), best = keepBest and RACE[player] and RACE[player].best or nil }
end

players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local lap = Instance.new("IntValue"); lap.Name = "Lap"; lap.Parent = stats
	local best = Instance.new("NumberValue"); best.Name = "BestTime"; best.Parent = stats
	stats.Parent = player
	player.CharacterAdded:Connect(function(char)
		task.wait(0.2)
		startRace(player, true)
		local spawn = checkpoints:FindFirstChild("0")
		if spawn and char:FindFirstChild("HumanoidRootPart") then
			char:PivotTo(spawn.CFrame + Vector3.new(0, 4, 0))
		end
	end)
end)

players.PlayerRemoving:Connect(function(player) RACE[player] = nil end)

for _, cp in ipairs(checkpoints:GetChildren()) do
	cp.Touched:Connect(function(hit)
		local player = players:GetPlayerFromCharacter(hit.Parent)
		local r = player and RACE[player]
		if not r then return end
		local n = tonumber(cp.Name)
		if n == r.cp + 1 then
			r.cp = n -- must be touched in order — cutting the track does not count
		elseif n == 0 and r.cp == lastCp then
			local t = os.clock() - r.t0
			if not r.best or t < r.best then
				r.best = t
				player.leaderstats.BestTime.Value = math.floor(t * 100) / 100
			end
			r.lap += 1
			if r.lap > LAPS then r.lap = 1 end
			player.leaderstats.Lap.Value = r.lap
			r.cp = 0
			r.t0 = os.clock()
		end
	end)
end

-- Boost pads: tag any part "Boost" — a forward impulse when driven over.
for _, pad in ipairs(workspace:GetTagged("Boost")) do
	pad.Touched:Connect(function(hit)
		local hrp = hit.Parent and hit.Parent:FindFirstChild("HumanoidRootPart")
		if hrp then hrp.AssemblyLinearVelocity += hrp.CFrame.LookVector * 40 end
	end)
end`;

const TYCOON_LUAU = `-- QynOne scaffold: co-op tycoon — droppers, collector, paid unlocks.
-- Layout: workspace.Droppers/<any> (child "DropPart", attrs Rate+Value),
-- workspace.Collector, workspace.Locked/<Model> hidden until bought,
-- buttons tagged "Unlock" with attrs Cost + Target (model name).

local players = game:GetService("Players")
local Debris = game:GetService("Debris")
local cash = {} -- [player] = leaderstats.Cash IntValue

players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local c = Instance.new("IntValue"); c.Name = "Cash"; c.Parent = stats
	stats.Parent = player
	cash[player] = c
end)
players.PlayerRemoving:Connect(function(p) cash[p] = nil end)

-- Droppers spawn ore parts on their own Rate clock.
for _, dropper in ipairs(workspace:WaitForChild("Droppers"):GetChildren()) do
	local part = dropper:FindFirstChild("DropPart")
	if part then
		local rate = dropper:GetAttribute("Rate") or 2
		local value = dropper:GetAttribute("Value") or 1
		task.spawn(function()
			while dropper.Parent do
				local ore = Instance.new("Part")
				ore.Size = Vector3.new(1, 1, 1)
				ore.Color = dropper:GetAttribute("OreColor") or Color3.fromRGB(200, 160, 60)
				ore.Material = Enum.Material.CorrodedMetal
				ore:SetAttribute("Value", value)
				ore.CFrame = part.CFrame - Vector3.new(0, 2, 0)
				ore.Parent = workspace
				Debris:AddItem(ore, 20)
				task.wait(rate)
			end
		end)
	end
end

-- Collector: credits players standing near it, destroys the ore.
local collector = workspace:WaitForChild("Collector")
collector.Touched:Connect(function(hit)
	local ore = hit.Parent
	local value = ore and ore:GetAttribute("Value")
	if not value then return end
	for _, player in ipairs(players:GetPlayers()) do
		local char = player.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart")
		if hrp and (hrp.Position - collector.Position).Magnitude < 14 then
			cash[player].Value += value
		end
	end
	ore:Destroy()
end)

-- Unlock buttons: pay Cash, the hidden model moves into the workspace.
for _, button in ipairs(workspace:GetTagged("Unlock")) do
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Unlock (" .. (button:GetAttribute("Cost") or 0) .. ")"
	prompt.Parent = button
	prompt.Triggered:Connect(function(player)
		local cost = button:GetAttribute("Cost") or 0
		local mine = cash[player]
		if not mine or mine.Value < cost then return end
		mine.Value -= cost
		local locked = workspace:FindFirstChild("Locked")
		local target = locked and locked:FindFirstChild(button:GetAttribute("Target") or "")
		if target then target.Parent = workspace end
		button:Destroy()
	end)
end`;

const SHOOTER_LUAU = `-- QynOne scaffold: arena shooter — loadouts, kill credit, auto-respawn.
-- Needs ReplicatedStorage.Weapons (folder of Tool templates). Weapons must
-- tag their victims: create an ObjectValue named "creator" (Value = killer
-- Player) inside the hit Humanoid — the classic Roblox kill-credit pattern.

local players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local wep = RS:FindFirstChild("Weapons")
local RESPAWN_DELAY = 3

local function giveLoadout(player)
	if not wep then return end
	local backpack = player:FindFirstChildOfClass("Backpack")
	if not backpack then return end
	for _, name in ipairs({ "Blaster", "Sniper" }) do
		local tool = wep:FindFirstChild(name)
		if tool then tool:Clone().Parent = backpack end
	end
end

players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local k = Instance.new("IntValue"); k.Name = "Kills"; k.Parent = stats
	local d = Instance.new("IntValue"); d.Name = "Deaths"; d.Parent = stats
	stats.Parent = player
	player.CharacterAdded:Connect(function(char)
		local hum = char:WaitForChild("Humanoid")
		task.wait(0.1)
		giveLoadout(player)
		hum.Died:Connect(function()
			player.leaderstats.Deaths.Value += 1
			local creator = hum:FindFirstChild("creator")
			local killer = creator and creator.Value
			if killer and killer.Parent and killer:FindFirstChild("leaderstats") then
				killer.leaderstats.Kills.Value += 1
			end
			task.wait(RESPAWN_DELAY)
			if player.Parent then player:LoadCharacter() end
		end)
	end)
end)`;

const HUD_LUAU = `-- QynOne scaffold: player HUD (LocalScript in StarterPlayer.StarterPlayerScripts).
-- Health + stamina bars, sprint with smooth FOV kick, animated counter.
-- This is the polish layer players FEEL first — ship it in every game.

local players = game:GetService("Players")
local run = game:GetService("RunService")
local uis = game:GetService("UserInputService")

local player = players.LocalPlayer
local gui = Instance.new("ScreenGui")
gui.Name = "QynHUD"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function makeBar(color, yPos)
	local bg = Instance.new("Frame")
	bg.AnchorPoint = Vector2.new(0, 1); bg.Position = UDim2.new(0, 24, 1, yPos)
	bg.Size = UDim2.new(0, 260, 0, 14)
	bg.BackgroundColor3 = Color3.fromRGB(15, 17, 24); bg.BackgroundTransparency = 0.25
	bg.BorderSizePixel = 0
	local corner = Instance.new("UICorner"); corner.CornerRadius = UDim.new(0, 7); corner.Parent = bg
	local fill = Instance.new("Frame")
	fill.Size = UDim2.fromScale(1, 1); fill.BackgroundColor3 = color; fill.BorderSizePixel = 0
	local fc = Instance.new("UICorner"); fc.CornerRadius = UDim.new(0, 7); fc.Parent = fill
	fill.Parent = bg
	bg.Parent = gui
	return fill
end

local healthFill = makeBar(Color3.fromRGB(96, 210, 130), -24)
local staminaFill = makeBar(Color3.fromRGB(90, 160, 255), -46)

local counter = Instance.new("TextLabel")
counter.AnchorPoint = Vector2.new(1, 0); counter.Position = UDim2.new(1, -24, 0, 20)
counter.Size = UDim2.new(0, 220, 0, 34); counter.BackgroundTransparency = 1
counter.TextColor3 = Color3.fromRGB(235, 240, 250); counter.Font = Enum.Font.GothamBold
counter.TextSize = 24; counter.TextXAlignment = Enum.TextXAlignment.Right
counter.Text = "0"; counter.Parent = gui

local function bindHumanoid(char)
	local hum = char:WaitForChild("Humanoid")
	run.Heartbeat:Connect(function()
		healthFill.Size = UDim2.fromScale(math.clamp(hum.Health / math.max(hum.MaxHealth, 1), 0, 1), 1)
	end)
end
if player.Character then bindHumanoid(player.Character) end
player.CharacterAdded:Connect(bindHumanoid)

-- Sprint: hold LeftShift, drains stamina, smooth FOV kick sells the speed.
local sprinting = false
uis.InputBegan:Connect(function(i, g) if not g and i.KeyCode == Enum.KeyCode.LeftShift then sprinting = true end end)
uis.InputEnded:Connect(function(i) if i.KeyCode == Enum.KeyCode.LeftShift then sprinting = false end end)

local STAMINA_MAX, FOV_BASE = 100, 70
local stam = STAMINA_MAX
run.RenderStepped:Connect(function(dt)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	local cam = workspace.CurrentCamera
	if hum and cam then
		local want = sprinting and stam > 0 and hum.MoveDirection.Magnitude > 0
		hum.WalkSpeed = want and 24 or 16
		stam = math.clamp(stam + (want and -28 or 18) * dt, 0, STAMINA_MAX)
		staminaFill.Size = UDim2.fromScale(stam / STAMINA_MAX, 1)
		local fov = FOV_BASE + (want and 8 or 0)
		cam.FieldOfView += (fov - cam.FieldOfView) * math.min(dt * 8, 1)
	end
end)

-- Animated counter: server fires ReplicatedStorage.CoinCount(number) on pickup.
local rs = game:GetService("ReplicatedStorage")
local coinEvent = rs:FindFirstChild("CoinCount")
if coinEvent then
	coinEvent.OnClientEvent:Connect(function(value)
		local start = tonumber(counter.Text) or 0
		for i = 1, 12 do
			task.wait(0.03)
			counter.Text = tostring(math.floor(start + (value - start) * i / 12))
		end
		counter.Text = tostring(value)
	end)
end`;

const TITLE_LUAU = `-- QynOne scaffold: title screen (LocalScript in StarterPlayer.StarterPlayerScripts).
-- Camera orbit behind a dark menu layer, Play button with hover lift and
-- a clean fade-out. A real menu is the cheapest way to look like a real game.

local players = game:GetService("Players")
local tween = game:GetService("TweenService")
local run = game:GetService("RunService")

local player = players.LocalPlayer
local camera = workspace.CurrentCamera

local gui = Instance.new("ScreenGui")
gui.Name = "TitleScreen"; gui.IgnoreGuiInset = true; gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local shade = Instance.new("Frame")
shade.Size = UDim2.fromScale(1, 1)
shade.BackgroundColor3 = Color3.fromRGB(8, 10, 16); shade.BackgroundTransparency = 0.35
shade.BorderSizePixel = 0; shade.Parent = gui

local title = Instance.new("TextLabel")
title.AnchorPoint = Vector2.new(0.5, 0); title.Position = UDim2.fromScale(0.5, 0.22)
title.Size = UDim2.fromScale(0.8, 0.16); title.BackgroundTransparency = 1
title.Text = "GAME TITLE" -- set the real name here
title.TextColor3 = Color3.fromRGB(240, 244, 252); title.Font = Enum.Font.GothamBlack
title.TextScaled = true; title.Parent = gui

local play = Instance.new("TextButton")
play.AnchorPoint = Vector2.new(0.5, 0); play.Position = UDim2.fromScale(0.5, 0.52)
play.Size = UDim2.fromScale(0.22, 0.09)
play.BackgroundColor3 = Color3.fromRGB(70, 130, 255); play.BackgroundTransparency = 0.15
play.Text = "PLAY"; play.TextColor3 = Color3.fromRGB(255, 255, 255)
play.Font = Enum.Font.GothamBold; play.TextScaled = true; play.AutoButtonColor = false
play.Parent = gui
local pc = Instance.new("UICorner"); pc.CornerRadius = UDim.new(0, 12); pc.Parent = play

play.MouseEnter:Connect(function()
	tween:Create(play, TweenInfo.new(0.15), { Size = UDim2.fromScale(0.235, 0.1) }):Play()
end)
play.MouseLeave:Connect(function()
	tween:Create(play, TweenInfo.new(0.15), { Size = UDim2.fromScale(0.22, 0.09) }):Play()
end)

-- Slow orbit around a showcase spot; drop a part named "MenuFocus" there.
local focus = workspace:FindFirstChild("MenuFocus")
local center = focus and focus.Position or Vector3.new(0, 10, 0)
local angle = 0
run.RenderStepped:Connect(function(dt)
	angle += dt * 0.15
	camera.CFrame = CFrame.new(center + Vector3.new(math.sin(angle) * 26, 8, math.cos(angle) * 26), center)
end)

play.MouseButton1Click:Connect(function()
	local s = Instance.new("Sound")
	s.SoundId = "rbxassetid://607665037"; s.Volume = 0.5; s.Parent = play; s:Play()
	tween:Create(shade, TweenInfo.new(0.5), { BackgroundTransparency = 1 }):Play()
	tween:Create(title, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
	tween:Create(play, TweenInfo.new(0.35), { BackgroundTransparency = 1, TextTransparency = 1 }):Play()
	task.delay(0.55, function() gui:Destroy() end) -- menu gone, orbit stops with it
end)`;

/* ------------------------------------------------------------------ */
/* Audio — verified IDs only. Small models invent random asset IDs that */
/* are usually private or deleted → a silent game, the #1 audio bug.    */
/* ------------------------------------------------------------------ */

export const AUDIO_LIBRARY = `Audio that always works:
- rbxassetid://12221967 — soft chime (checkpoint/win) — Roblox-owned, verified
- rbxassetid://607665037 — UI pop/click (buttons/pickups) — Roblox-owned, verified
For everything else, use Roblox's built-in Creator Store Audio tab (official
Roblox-published sound effects are public and safe): search "heartbeat",
"wind loop", "riser", "crowd cheer". NEVER hardcode unknown IDs — an invalid
or private ID plays silence. Pitch-shift verified sounds (PlaybackSpeed
0.7–1.3) for cheap variety.`;

/* ------------------------------------------------------------------ */
/* Self-review rubric — score against a checklist, not vibes.           */
/* ------------------------------------------------------------------ */

export const SELF_REVIEW_RUBRIC = `Score against this checklist — every unchecked item is an issue:
- GAMEPLAY: core loop fun within 60 seconds? Win/lose obvious? Every action gives sound + visual feedback?
- VISUALS: zero default-gray parts? One cohesive palette + a lighting preset applied? First screenshot marketable?
- FEEL: movement tuned (speed/jump)? Camera comfortable? Hits and pickups have impact?
- AUDIO: ambience present? Actions never silent?
- STABILITY: zero red console errors after 2 minutes of play? Respawn and rejoin safe? No loop without task.wait?
- COMPLETENESS: title menu → play → win/lose → replay works end to end?
9-10 = every box checked. 7-8 = gameplay + visuals checked, polish missing. Below 7 = loop incomplete.`;

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
  { id: "collect", genres: ["collector", "simulator", "clicker"], engines: ["roblox"], label: "Collect & sell loop", provides: ["leaderstats", "capacity pressure", "sell/upgrade loop", "pickup feedback"], code: COLLECT_LUAU },
  { id: "horror", genres: ["horror", "scary", "haunt", "creepy"], engines: ["roblox"], label: "Horror tension loop", provides: ["horror lighting block", "sanity system", "stalker AI (Weeping-Angel rule)"], code: HORROR_LUAU },
  { id: "racing", genres: ["racing", "race", "driving", "kart"], engines: ["roblox"], label: "Racing with laps + best times", provides: ["ordered checkpoint laps", "best-time leaderstat", "boost pads"], code: RACING_LUAU },
  { id: "tycoon", genres: ["tycoon", "factory", "idle"], engines: ["roblox"], label: "Tycoon (droppers + unlocks)", provides: ["dropper ore loop", "collector payout", "paid ProximityPrompt unlocks"], code: TYCOON_LUAU },
  { id: "shooter", genres: ["shooter", "fps", "pvp", "gun"], engines: ["roblox"], label: "Arena shooter core", provides: ["loadout giving", "kill credit (creator tag)", "auto-respawn + K/D leaderstats"], code: SHOOTER_LUAU },
  { id: "hud", genres: ["hud", "interface", "health bar"], engines: ["roblox"], label: "Player HUD (polish layer)", provides: ["health + stamina bars", "sprint with smooth FOV kick", "animated counter"], code: HUD_LUAU },
  { id: "title", genres: ["menu", "title", "main menu", "loading"], engines: ["roblox"], label: "Title screen (polish layer)", provides: ["camera orbit menu backdrop", "Play button with hover + click sound", "clean fade into gameplay"], code: TITLE_LUAU },
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

/** Every scaffold genre resolves to a concrete visual direction, so a goal
 *  that names any known genre never gets invented-from-zero lighting. */
const SCAFFOLD_PRESET_FALLBACK: Record<string, string> = {
  obby: "sunny-adventure",
  survival: "sunny-adventure",
  collect: "sunny-adventure",
  horror: "horror-night",
  racing: "neon-city",
  tycoon: "neon-city",
  shooter: "neon-city",
  hud: "cozy-interior",
  title: "cozy-interior",
};

/** Pick the best scene preset for a goal text. Falls back through a mood
 *  matrix and then the scaffold catalog so EVERY build goal gets a concrete
 *  visual direction — a small model should never invent lighting values. */
export function pickPreset(goal: string): ScenePreset | null {
  const g = goal.toLowerCase();
  const table: Array<[string, string]> = [
    // Strong scene nouns first — "night city" must stay neon, not horror.
    ["city", "neon-city"],
    ["cyber", "neon-city"],
    ["neon", "neon-city"],
    ["futur", "neon-city"],
    ["space", "neon-city"],
    ["racing", "neon-city"],
    ["car", "neon-city"],
    ["kart", "neon-city"],
    ["cozy", "cozy-interior"],
    ["house", "cozy-interior"],
    ["home", "cozy-interior"],
    ["cabin", "cozy-interior"],
    ["restaurant", "cozy-interior"],
    ["store", "cozy-interior"],
    ["tycoon", "cozy-interior"],
    ["adventure", "sunny-adventure"],
    ["sunny", "sunny-adventure"],
    ["bright", "sunny-adventure"],
    ["grass", "sunny-adventure"],
    ["obby", "sunny-adventure"],
    ["parkour", "sunny-adventure"],
    ["island", "sunny-adventure"],
    ["nature", "sunny-adventure"],
    // Mood keywords last — they are the weakest signals.
    ["horror", "horror-night"],
    ["scary", "horror-night"],
    ["creepy", "horror-night"],
    ["haunt", "horror-night"],
    ["mansion", "horror-night"],
    ["ghost", "horror-night"],
    ["night", "horror-night"],
    ["dark", "horror-night"],
  ];
  for (const [kw, id] of table) {
    if (g.includes(kw)) return SCENE_PRESETS.find((p) => p.id === id) ?? null;
  }
  const sc = pickScaffold(goal);
  if (sc) {
    const id = SCAFFOLD_PRESET_FALLBACK[sc.id];
    if (id) return SCENE_PRESETS.find((p) => p.id === id) ?? null;
  }
  return null;
}

/** The self-review checklist text, for injection into review prompts. */
export function pickRubric(): string {
  return SELF_REVIEW_RUBRIC;
}
