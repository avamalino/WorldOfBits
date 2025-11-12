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
const GAME_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const TILE_DEGREES = 0.0001; // approx degrees covered by one tile at zoom level 19
const GAMEPLAY_ZOOM_LEVEL = 19;
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
  scrollWheelZoom: false,
}).setView([startingPos.x, startingPos.y], 13);

//Adding the tile layer to the map
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

map.setMaxBounds(map.getBounds());


//using a miku png from https://ena.our-dogs.info/facts-pin.html
const mikuIcon = leaflet.icon({
  iconUrl: miku,
  iconSize: [56, 56], // size of the icon
  iconAnchor: [16, 32], // point of the icon which will correspond to marker's location
  popupAnchor: [0, -32], // point from which the popup should open relative to the iconAnchor
});

function spawnCache(x: number, y: number) {
  const origin = ORIGIN_POS;
  const bounds = leaflet.latLngBounds([
    [origin.lat + x * TILE_DEGREES, origin.lng + y * TILE_DEGREES],
    [origin.lat + (x + 1) * TILE_DEGREES, origin.lng + (y + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    let pointValue = Math.floor(luck([x, y, "initialValue"].toString()) * 100);

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${x},${y}". It has value <span id ="value">${pointValue}</span?.</div>
      <button id="poke">poke</button>`;

    popupDiv
    .querySelector<HTMLButtonElement>("#poke")!
    .addEventListener("click", () => {
      pointValue = Math.floor(luck([x, y, Date.now().toString()].toString()) * 100);
      const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
      valueSpan.textContent = pointValue.toString();
    });

    return popupDiv;
  })
}

for (let i = -GAME_SIZE; i < GAME_SIZE; i++) {
  for (let j = -GAME_SIZE; j < GAME_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
//Adding a marker to the map at the user's position
leaflet.marker([userX, userY], { icon: mikuIcon }).addTo(map);
//
////wasd keys to move
//
//document.addEventListener("keydown", (event) => {
//  const stepSize = TILE_DEGREES;
//  switch (event.key) {
//    case "w":
//      userX += stepSize;
//      break;
//    case "a":
//      userY -= stepSize;
//      break;
//    case "s":
//      userX -= stepSize;
//      break;
//    case "d":
//      userY += stepSize;
//      break;
//    default:
//      return; // Ignore other keys
//  }
//  // Update marker position
//  leaflet.marker([userX, userY], { icon: mikuIcon }).addTo(map);
//  // Center map on new position
//  map.setView([userX, userY], GAMEPLAY_ZOOM_LEVEL);
//});
