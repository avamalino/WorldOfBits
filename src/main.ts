// deno-lint-ignore-file
// @deno-types="npm:@types/leaflet"
//import leaflet from "leaflet";
import * as leaflet from "https://esm.sh/leaflet@1.9.4";
// Leaflet CSS is loaded via a <link> in index.html when running under Deno.
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

import catGif from "./cat-icegif-9.gif";
import miku from "./miku.png";
// Create basic UI elements via a small HTML template so layout and CSS
// take effect predictably.
document.body.innerHTML = `
  <h1>World of Bits Map</h1>
  <div id="map"></div>
  <div id="controlPanel"></div>
  <div id="statusPanel"></div>
`;

const mapDiv = document.getElementById("map") as HTMLDivElement;
mapDiv.id = "map";
document.body.appendChild(mapDiv);

const controlDiv = document.getElementById("controlPanel") as HTMLDivElement;
controlDiv.id = "controlPanel";
document.body.appendChild(controlDiv);

const statusDiv = document.getElementById("statusPanel") as HTMLDivElement;
statusDiv.id = "statusPanel";
document.body.appendChild(statusDiv);

//startingPos is in kona hawaii
const startingPos = { x: 19.63, y: -155.99 };
const ORIGIN_POS = leaflet.latLng(startingPos.x, startingPos.y);
const GAME_SIZE = 10;
const CACHE_SPAWN_PROBABILITY = 0.1;
const TILE_DEGREES = 0.0001; // approx degrees covered by one tile at zoom level 19
const GAMEPLAY_ZOOM_LEVEL = 19;

const achievementGif = document.createElement("img");
achievementGif.src = catGif; // replace with actual path
achievementGif.style.position = "absolute";
achievementGif.style.top = "50%";
achievementGif.style.left = "50%";
achievementGif.style.width = "300px"; // adjust size
achievementGif.style.height = "auto";
achievementGif.style.transform = "translate(-50%, -50%)";
achievementGif.style.zIndex = "1000";
achievementGif.style.display = "none"; // hidden by default
achievementGif.style.pointerEvents = "none"; // don't block map interaction
document.body.appendChild(achievementGif);
//user positions reflect the starting position until changed
let userX = startingPos.x;
let userY = startingPos.y;
//Making the map
const map = leaflet.map(mapDiv, {
  center: [startingPos.x, startingPos.y],
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  dragging: false,
  scrollWheelZoom: false,
}).setView([startingPos.x, startingPos.y], 13);

//Adding the tile layer to the map
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

//map.setMaxBounds(map.getBounds());

//using a miku png from https://ena.our-dogs.info/facts-pin.html
const mikuIcon = leaflet.icon({
  iconUrl: miku,
  iconSize: [56, 56], // size of the icon
  iconAnchor: [32, 32], // point of the icon which will correspond to marker's location
  popupAnchor: [0, -32], // point from which the popup should open relative to the iconAnchor
});

interface Cache {
  pos: [number, number]; //x,y
  value: number;
  rect: leaflet.Rectangle;
  label: leaflet.Marker;
}

//const caches: Cache[] = [];  //old
const caches = new Map<string, Cache>();
let playerHolding: number = 0;
let highestValue: number = 0;
//let selectedCache: [number, number] | null = null; //x,y of the current cache
const origin = ORIGIN_POS;
//
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

  rect.on("click", () => {
    if (playerHolding > highestValue) {
      highestValue = playerHolding;
    }
    //const cache = caches.find((c) => c.pos[0] === x && c.pos[1] === y); //old
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
      `Points: ${playerHolding}, Highest Value: ${highestValue}`;
  });
  const cache: Cache = { pos: [x, y], value, rect, label };
  caches.set(key, cache);
  rect.addTo(map);
  label.addTo(map);
  updateCacheAppearance(cache);
}

function checkAchievement() {
  if (highestValue === 64) {
    achievementGif.style.display = "block";
    setTimeout(() => {
      achievementGif.style.display = "none";
    }, 5000);
  }
}

const VIEW_RADIUS = 10;
const renderedCaches = new Set<string>();

function updateVisibleCaches() {
  const center = map.getCenter();
  const tileX = Math.floor((center.lat - origin.lat) / TILE_DEGREES);
  const tileY = Math.floor((center.lng - origin.lng) / TILE_DEGREES);
  //used to hold next caches that should be rendered
  const nextCaches = new Set<string>();

  for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
      const key = `${tileX + dx},${tileY + dy}`;
      nextCaches.add(key);

      //if key is within current caches, render it, otherwise its in old caches
      //so respawn it and its value back onto map
      if (caches.has(key)) {
        const cache = caches.get(key);
        if (!renderedCaches.has(key)) {
          cache?.rect.addTo(map);
          cache?.label.addTo(map);
        }
      } //if its not in caches at all then spawn a new cache
      else if (luck(key) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(tileX + dx, tileY + dy);
      }
    }
  }
  //for each key in old caches if its not in the next cahces
  for (const key of renderedCaches) {
    if (!nextCaches.has(key)) {
      const cache = caches.get(key);
      cache?.rect.remove();
      cache?.label.remove();
    }
  }
  renderedCaches.clear();
  for (const key of nextCaches) {
    renderedCaches.add(key);
  }
}

function isWithinRadius(cachePos: leaflet.LatLng): boolean {
  const playerPoint = leaflet.latLng(userX, userY);
  const distance = playerPoint.distanceTo(cachePos);
  return distance < 60;
}

function updateCacheAppearance(cache: Cache) {
  //const key = `${cache.pos[0]},${cache.pos[1]}`;
  const centerX = origin.lat + (cache.pos[0] + 0.5) * TILE_DEGREES;
  const centerY = origin.lng + (cache.pos[1] + 0.5) * TILE_DEGREES;
  const cacheCenter = leaflet.latLng(centerX, centerY);
  if (isWithinRadius(cacheCenter)) {
    cache.rect.setStyle({ color: "blue" });
  } else {
    cache.rect.setStyle({ color: "grey" });
  }
}

map.on("moveend", updateVisibleCaches);
updateVisibleCaches();

//Adding a marker to the map at the user's position
let playerMarker = leaflet.marker([userX, userY], { icon: mikuIcon }).addTo(
  map,
);

let playerPoints = 0;
statusDiv.innerHTML = `Points: ${playerPoints}, Highest Value: ${highestValue}`;

//wasd keys to move
document.addEventListener("keydown", (event) => {
  const stepSize = TILE_DEGREES;
  switch (event.key) {
    case "w":
      userX += stepSize;
      break;
    case "a":
      userY -= stepSize;
      break;
    case "s":
      userX -= stepSize;
      break;
    case "d":
      userY += stepSize;
      break;
    default:
      return; // Ignore other keys
  }
  for (const cache of caches.values()) {
    updateCacheAppearance(cache);
  }
  // Update the existing marker's position (don't create a new marker)
  playerMarker.setLatLng([userX, userY]);
  // Center map on new position
  map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);
});
