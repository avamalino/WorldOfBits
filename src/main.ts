// deno-lint-ignore-file
// @deno-types="npm:@types/leaflet"

import * as leaflet from "https://esm.sh/leaflet@1.9.4";
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images
import luck from "./_luck.ts";
import "./style.css"; // student-controlled page style

import catGif from "./cat-icegif-9.gif";
import miku from "./miku.png";

//constants & DOM //

document.body.innerHTML = `
  <h1>World of Bits Map</h1>
  <div id="map"></div>
  <div id="controlPanel"></div>
  <div id="statusPanel"></div>
  <button id="toggleMovementBtn" class="movement-toggle">
    Switch to GEO Mode
    </button>
`;
//div containers for map, controls, and status
const mapDiv = document.getElementById("map") as HTMLDivElement;
const controlDiv = document.getElementById("controlPanel") as HTMLDivElement;
const statusDiv = document.getElementById("statusPanel") as HTMLDivElement;

//startingPos is in kona hawaii once u switch to geo it'll be where you are
const startingPos = { lat: 19.63, lng: -155.99 };
const ORIGIN_POS = leaflet.latLng(startingPos.lat, startingPos.lng);
const CACHE_SPAWN_PROBABILITY = 0.1;
const TILE_DEGREES = 0.0001; // approx degrees covered by one tile at zoom level 19
const GAMEPLAY_ZOOM_LEVEL = 19;
const VIEW_RADIUS = 10;

//achievement gif setup //
const achievementGif = document.createElement("img");
achievementGif.src = catGif;
achievementGif.style.cssText = `
  position:absolute; top:50%; left:50%;
  width:300px; height:auto; transform:translate(-50%, -50%);
  z-index:1000; display:none; pointer-events:none;
`;
document.body.appendChild(achievementGif);

function checkAchievement() {
  if (highestValue === 64) {
    achievementGif.style.display = "block";
    setTimeout(() => {
      achievementGif.style.display = "none";
    }, 5000);
  }
}

// types //

//two types for caches and game state, holds position, value, box and label, and highest value
interface Cache {
  pos: [number, number]; //x,y
  value: number;
  rect: leaflet.Rectangle;
  label: leaflet.Marker;
}

interface GameState {
  playerPos: [number, number];
  playerHolding: number;
  caches: { [key: string]: { pos: [number, number]; value: number } };
  highestValue: number;
  movementMode: "WASD" | "GEO";
}

// Globals //

const caches = new Map<string, Cache>();
let playerHolding: number = 0;
let highestValue: number = 0;
let userX = startingPos.lat;
let userY = startingPos.lng;

let gameState: GameState | null = null;
const renderedCaches = new Set<string>();
let IS_RESTORING = false;

// map & markers //

//Making the map
const map = leaflet.map(mapDiv, {
  center: [startingPos.lat, startingPos.lng],
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  dragging: false,
  scrollWheelZoom: false,
}).setView([startingPos.lat, startingPos.lng], GAMEPLAY_ZOOM_LEVEL);

//Adding the tile layer to the map
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

//map.invalidateSize();

//using a miku png from https://ena.our-dogs.info/facts-pin.html
const mikuIcon = leaflet.icon({
  iconUrl: miku,
  iconSize: [56, 56], // size of the icon
  iconAnchor: [32, 32], // point of the icon which will correspond to marker's location
  popupAnchor: [0, -32], // point from which the popup should open relative to the iconAnchor
});
//Adding a marker to the map at the user's position
let playerMarker = leaflet.marker([userX, userY], { icon: mikuIcon }).addTo(
  map,
);

// --- Add Reset Button to your HTML ---
const resetBtn = document.createElement("button");
resetBtn.id = "resetBtn";
resetBtn.textContent = "Reset Game";
resetBtn.style.cssText = `
  margin-top: 10px;
  padding: 5px 10px;
`;
controlDiv.appendChild(resetBtn);

// --- Wire the Reset Button ---
resetBtn.addEventListener("click", resetGame);

// Movement Facade & Controllers //

interface MovementController {
  start(): void;
  stop(): void;
}

class WASDMovementController implements MovementController {
  private handler = (e: KeyboardEvent) => {
    if (e.key === "w") movePlayer({ dx: 0.0005, dy: 0 });
    if (e.key === "s") movePlayer({ dx: -0.0005, dy: 0 });
    if (e.key === "a") movePlayer({ dx: 0, dy: -0.0005 });
    if (e.key === "d") movePlayer({ dx: 0, dy: 0.0005 });
  };

  start() {
    document.addEventListener("keydown", this.handler);
  }

  stop() {
    document.removeEventListener("keydown", this.handler);
  }
}

class GEOMovementController implements MovementController {
  private watchId: number | null = null;

  start() {
    if (!("geolocation" in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition((pos) => {
      updatePlayerFromGPS(pos);
    }, (err) => {
      console.warn("Geolocation error:", err);
    }, { enableHighAccuracy: true, maximumAge: 1000 });
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

class MovementFacade {
  private current: MovementController;

  constructor(defaultController: MovementController) {
    this.current = defaultController;
    this.current.start();
  }

  setController(mc: MovementController) {
    this.current?.stop();
    this.current = mc;
    this.current.start();
  }

  getModeName(): "WASD" | "GEO" {
    return this.current instanceof WASDMovementController ? "WASD" : "GEO";
  }
}

let movement: MovementFacade; // globally accessible
// --- Reset Game Function ---
function resetGame() {
  // Clear localStorage
  localStorage.removeItem("worldOfBits");

  // Remove all caches from map
  for (const cache of caches.values()) {
    cache.rect.remove();
    cache.label.remove();
  }
  caches.clear();
  renderedCaches.clear();

  // Reset player state
  playerHolding = 0;
  highestValue = 0;

  // Reset movement to default (WASD)
  movement.setController(new WASDMovementController());
  gameState = {
    playerPos: [userX, userY],
    playerHolding: 0,
    caches: {},
    highestValue: 0,
    movementMode: "WASD",
  };

  // Reset player position
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userX = pos.coords.latitude;
        userY = pos.coords.longitude;
        playerMarker.setLatLng([userX, userY]);
        map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);
      },
      () => {
        userX = startingPos.lat;
        userY = startingPos.lng;
        playerMarker.setLatLng([userX, userY]);
        map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);
      },
      { enableHighAccuracy: true },
    );
  } else {
    userX = startingPos.lat;
    userY = startingPos.lng;
    playerMarker.setLatLng([userX, userY]);
    map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);
  }

  // Update status panel
  statusDiv.innerHTML =
    `Points: ${playerHolding}, Highest Value: ${highestValue}, Move with WASD`;

  // Update toggle button text
  updateToggleButtonText();

  // Reset visible caches
  updateVisibleCaches();

  console.log("Game has been reset.");
}
// game functions //
function updatePlayerFromGPS(gpsPos: GeolocationPosition) {
  const { latitude, longitude } = gpsPos.coords;
  userX = latitude;
  userY = longitude;

  playerMarker.setLatLng([userX, userY]);
  map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);

  for (const cache of caches.values()) {
    updateCacheAppearance(cache);
  }

  updateVisibleCaches();

  //if (gameState) {
  updateGameState();
  saveGameState(gameState!);
  //}
}

function movePlayer(direction: { dx: number; dy: number }) {
  const speed = 0.1;
  userX += direction.dx * speed;
  userY += direction.dy * speed;

  playerMarker.setLatLng([userX, userY]);
  map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);

  for (const cache of caches.values()) {
    updateCacheAppearance(cache);
  }

  updateVisibleCaches();

  if (gameState) {
    updateGameState();
    saveGameState(gameState);
  }
}

// create caches //

function spawnCache(x: number, y: number) {
  const key = `${x},${y}`; //key to identify each cache in map
  if (caches.has(key)) return;

  const bounds = leaflet.latLngBounds([
    [origin.lat + x * TILE_DEGREES, origin.lng + y * TILE_DEGREES],
    [origin.lat + (x + 1) * TILE_DEGREES, origin.lng + (y + 1) * TILE_DEGREES],
  ]);

  const center = bounds.getCenter();
  const value = 1 + Math.floor(luck([x, y].toString()) * 100) % 2; //get either #1 or 2
  const rect = leaflet.rectangle(bounds, { color: "blue", fillOpacity: 0.5 }); //blue rects

  const label = leaflet.marker(center, { //numbers within the rects
    icon: leaflet.divIcon({
      className: "label",
      html: String(value), //get either number 1 or 2
      iconSize: [30, 12],
      iconAnchor: [15, 6],
    }),
  });

  //what happens when you click the box on screen
  _clickRectangle(rect, x, y, key, label, value);
}

function spawnCacheFromData(x: number, y: number, value: number) {
  const key = `${x},${y}`;
  if (caches.has(key)) return;

  const bounds = leaflet.latLngBounds([
    [origin.lat + x * TILE_DEGREES, origin.lng + y * TILE_DEGREES],
    [origin.lat + (x + 1) * TILE_DEGREES, origin.lng + (y + 1) * TILE_DEGREES],
  ]);

  const center = bounds.getCenter();
  const rect = leaflet.rectangle(bounds, { color: "blue", fillOpacity: 0.5 });
  const label = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "label",
      html: String(value),
      iconSize: [30, 12],
      iconAnchor: [15, 6],
    }),
  });

  _clickRectangle(rect, x, y, key, label, value);
}

function updateCacheAppearance(cache: Cache) {
  const [x, y] = cache.pos;
  const topLeft: leaflet.LatLngTuple = [
    origin.lat + x * TILE_DEGREES,
    origin.lng + y * TILE_DEGREES,
  ];
  const bottomRight: leaflet.LatLngTuple = [
    origin.lat + (x + 1) * TILE_DEGREES,
    origin.lng + (y + 1) * TILE_DEGREES,
  ];
  cache.rect.setBounds([topLeft, bottomRight]);

  cache.label.setLatLng([
    origin.lat + (x + 0.5) * TILE_DEGREES,
    origin.lng + (y + 0.5) * TILE_DEGREES,
  ]);

  cache.label.setIcon(
    leaflet.divIcon({
      className: "label",
      html: String(cache.value),
      iconSize: [30, 12],
      iconAnchor: [15, 6],
    }),
  );
  const centerX = origin.lat + (cache.pos[0] + 0.5) * TILE_DEGREES;
  const centerY = origin.lng + (cache.pos[1] + 0.5) * TILE_DEGREES;
  const cacheCenter = leaflet.latLng(centerX, centerY);
  if (isWithinRadius(cacheCenter)) {
    cache.rect.setStyle({ color: "blue" });
  } else {
    cache.rect.setStyle({ color: "grey" });
  }
}

// visibility and spawn logic //
function updateVisibleCaches() {
  const center = map.getCenter();
  const tileX = Math.floor((center.lat - origin.lat) / TILE_DEGREES);
  const tileY = Math.floor((center.lng - origin.lng) / TILE_DEGREES);

  const nextCaches = new Set<string>();

  // Step 1: Add/render visible caches
  for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
      const key = `${tileX + dx},${tileY + dy}`;
      nextCaches.add(key);

      if (caches.has(key)) {
        const cache = caches.get(key)!;
        // Only add to map if not already rendered
        if (!renderedCaches.has(key)) {
          cache.rect.addTo(map);
          cache.label.addTo(map);
        }
      } else if (luck(key) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(tileX + dx, tileY + dy);
      }
    }
  }

  // Step 2: Remove caches no longer visible
  for (const key of renderedCaches) {
    if (!nextCaches.has(key)) {
      const cache = caches.get(key);
      cache?.rect.remove();
      cache?.label.remove();
    }
  }

  // Step 3: Update appearance only for caches currently rendered
  for (const key of nextCaches) {
    const cache = caches.get(key);
    if (!cache) continue;

    const cacheCenter = leaflet.latLng(
      origin.lat + (cache.pos[0] + 0.5) * TILE_DEGREES,
      origin.lng + (cache.pos[1] + 0.5) * TILE_DEGREES,
    );
    cache.rect.setStyle({
      color: isWithinRadius(cacheCenter) ? "blue" : "grey",
    });
  }

  // Step 4: Update renderedCaches set
  renderedCaches.clear();
  for (const key of nextCaches) renderedCaches.add(key);

  // Step 5: Free memory for caches that are no longer in view
  for (const key of caches.keys()) {
    if (!nextCaches.has(key)) {
      const cache = caches.get(key);
      cache?.rect.remove();
      cache?.label.remove();
      caches.delete(key);
    }
  }
}
//function updateVisibleCaches() {
//  const center = map.getCenter();
//  const tileX = Math.floor((center.lat - origin.lat) / TILE_DEGREES);
//  const tileY = Math.floor((center.lng - origin.lng) / TILE_DEGREES);
//  //used to hold next caches that should be rendered
//  const nextCaches = new Set<string>();
//  for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
//    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
//      const key = `${tileX + dx},${tileY + dy}`;
//      nextCaches.add(key);
//      //if key is within current caches, render it, otherwise its in old caches
//      //so respawn it and its value back onto map
//      if (caches.has(key)) {
//        const cache = caches.get(key);
//        if (!renderedCaches.has(key)) {
//          cache?.rect.addTo(map);
//          cache?.label.addTo(map);
//        }
//      } //if its not in caches at all then spawn a new cache
//      else if (luck(key) < CACHE_SPAWN_PROBABILITY) {
//        spawnCache(tileX + dx, tileY + dy);
//      }
//    }
//  }
//
//  // Update only visible caches' appearance
//  for (const key of nextCaches) {
//    const cache = caches.get(key);
//    if (!cache) continue;
//
//    const cacheCenter = leaflet.latLng(
//      origin.lat + (cache.pos[0] + 0.5) * TILE_DEGREES,
//      origin.lng + (cache.pos[1] + 0.5) * TILE_DEGREES,
//    );
//    if (isWithinRadius(cacheCenter)) {
//      cache.rect.setStyle({ color: "blue" });
//    } else {
//      cache.rect.setStyle({ color: "grey" });
//    }
//  }
//  //for each key in old caches if its not in the next cahces
//  for (const key of renderedCaches) {
//    if (!nextCaches.has(key)) {
//      const cache = caches.get(key);
//      cache?.rect.remove();
//      cache?.label.remove();
//      caches.delete(key);
//    }
//  }
//  renderedCaches.clear();
//  for (const key of nextCaches) {
//    renderedCaches.add(key);
//  }
//}

// range check //

function isWithinRadius(cachePos: leaflet.LatLng): boolean {
  const playerPoint = leaflet.latLng(userX, userY);
  const distance = playerPoint.distanceTo(cachePos);
  return distance < 60;
}

// save load //

function saveGameState(state: GameState): void {
  try {
    localStorage.setItem("worldOfBits", JSON.stringify(state));
    console.log("Game state saved.");
  } catch (e) {
    console.warn("Failed to save game state:", e);
  }
}

function loadGameState(): GameState | null {
  try {
    const savedState = localStorage.getItem("worldOfBits");
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (e) {
    console.warn("Failed to load game state:", e);
  }
  return null;
}

function updateGameState() {
  gameState!.playerPos = [userX, userY];
  gameState!.playerHolding = playerHolding;
  gameState!.highestValue = highestValue;

  const plainCaches: { [key: string]: Omit<Cache, "rect" | "label"> } = {};
  for (const [key, cache] of caches.entries()) {
    plainCaches[key] = {
      pos: cache.pos,
      value: cache.value,
    };
  }
  // @ts-ignore
  gameState!.caches = plainCaches;
}

// init //

function initGameWithGPS() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Set user's starting position
        userX = latitude;
        userY = longitude;

        // Set origin relative to user's location
        origin.lat = latitude;
        origin.lng = longitude;

        // Initialize game state
        initGame();
      },
      (err) => {
        console.warn("Geolocation failed, using default start:", err);
        userX = startingPos.lat;
        userY = startingPos.lng;
        origin.lat = startingPos.lat;
        origin.lng = startingPos.lng;
        initGame();
      },
      { enableHighAccuracy: true },
    );
  } else {
    console.warn("Geolocation not available, using default start.");
    userX = startingPos.lat;
    userY = startingPos.lng;
    origin.lat = startingPos.lat;
    origin.lng = startingPos.lng;
    initGame();
  }
}

// --- Refactored initGame ---
function initGame() {
  // Load saved game state, if any
  const loaded = loadGameState();
  gameState = loaded ?? {
    playerPos: [userX, userY],
    playerHolding: 0,
    caches: {},
    highestValue: 0,
    movementMode: "WASD",
  };

  // Restore saved state
  if (loaded) {
    IS_RESTORING = true;
    userX = loaded.playerPos[0];
    userY = loaded.playerPos[1];
    playerHolding = loaded.playerHolding;
    highestValue = loaded.highestValue;

    for (const [k, v] of Object.entries(loaded.caches)) {
      spawnCacheFromData(v.pos[0], v.pos[1], v.value);
    }
    IS_RESTORING = false;
  }

  // Initialize map marker at current position
  playerMarker = leaflet.marker([userX, userY], { icon: mikuIcon }).addTo(map);
  map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);

  // Initialize movement system
  movement = new MovementFacade(
    gameState.movementMode === "GEO"
      ? new GEOMovementController()
      : new WASDMovementController(),
  );

  // Update status panel
  statusDiv.innerHTML =
    `Points: ${playerHolding}, Highest Value: ${highestValue}, Move with ${movement.getModeName()}`;

  // Wire the toggle button
  wireToggleButton();

  // Update visible caches immediately
  updateVisibleCaches();
}

const toggleBtn = document.getElementById("toggleMovementBtn")!;

function wireToggleButton() {
  updateToggleButtonText();
  toggleBtn.addEventListener("click", () => {
    if (movement.getModeName() === "GEO") {
      movement.setController(new WASDMovementController());
      gameState!.movementMode = "WASD";
    } else {
      movement.setController(new GEOMovementController());
      gameState!.movementMode = "GEO";
    }
    updateToggleButtonText();
    updateGameState();
    saveGameState(gameState!);
  });
}

function updateToggleButtonText() {
  toggleBtn.textContent = movement.getModeName() === "GEO"
    ? "Switch to WASD Mode"
    : "Switch to GEO Mode";
}

//const toggleBtn = document.getElementById("toggleMovementBtn")!;
//
//toggleBtn.addEventListener("click", () => {
//  const isWASD = movement.getModeName() === "WASD";
//
//  if (isWASD) {
//    movement.setController(new GEOMovementController());
//    toggleBtn.textContent = "Switch to WASD Mode";
//    gameState!.movementMode = "GEO";
//  } else {
//    movement.setController(new WASDMovementController());
//    toggleBtn.textContent = "Switch to GEO Mode";
//    gameState!.movementMode = "WASD";
//  }
//
//  saveGameState(gameState!);
//});

const origin = ORIGIN_POS;
//
////load in game info
//
//
//const loaded = loadGameState();
//if (loaded) {
//  IS_RESTORING = true;
//
//  gameState = { ...loaded };
//  rebuildGameState(loaded);
//
//  if (loaded.movementMode === "GEO") {
//    movement.setController(new GEOMovementController());
//    //toggleBtn.textContent = "Switch to WASD Mode";
//  } else {
//    movement.setController(new WASDMovementController());
//    //toggleBtn.textContent = "Switch to GEO Mode";
//  }
//
//  updateToggleButtonText();
//  IS_RESTORING = false;
//  console.log("Restored saved game.");
//} else {
//  gameState = {
//    playerPos: [startingPos.lat, startingPos.lng],
//    playerHolding: 0,
//    caches: {},
//    highestValue: 0,
//    movementMode: "WASD",
//  };
//  movement.setController(new WASDMovementController());
//}
//

function _clickRectangle(
  rect: leaflet.Rectangle,
  x: number,
  y: number,
  key: string,
  label: leaflet.Marker,
  value: number,
) {
  const cache: Cache = { pos: [x, y], value, rect, label };
  caches.set(key, cache);
  rect.addTo(map);
  label.addTo(map);
  updateCacheAppearance(cache);

  rect.on("click", () => {
    if (playerHolding > highestValue) {
      highestValue = playerHolding;
    }
    const cacheCenter = leaflet.latLng(
      origin.lat + (x + 0.5) * TILE_DEGREES,
      origin.lng + (y + 0.5) * TILE_DEGREES,
    );
    if (!isWithinRadius(cacheCenter)) {
      alert("Too far away!");
      return;
    }

    const cache = caches.get(key);
    if (!cache) return;

    if (playerHolding === 0) {
      playerHolding = cache.value;
      cache.value = 0;
    } else {
      if (cache.value === 0) {
        cache.value = playerHolding;
        playerHolding = 0;
      } else if (cache.value != playerHolding) {
        alert("Non-pair numbers cannot be combined");
      } else {
        cache.value += playerHolding;
        playerHolding = 0;
        if (cache.value > highestValue) {
          highestValue = cache.value;
          checkAchievement();
        }
      }
    }
    cache.label.setIcon(
      leaflet.divIcon({
        className: "label",
        html: String(cache.value),
        iconSize: [30, 12],
        iconAnchor: [15, 6],
      }),
    );

    statusDiv.innerHTML =
      `Points: ${playerHolding}, Highest Value: ${highestValue}, Move with WASD`;

    updateGameState();
    saveGameState(gameState!);
  });
}

initGameWithGPS();
