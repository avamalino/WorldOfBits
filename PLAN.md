# World of Bits instruction log and description

Game Design vision:
-The barebones game is going to resemble the 2048 game like the instructions say, but as I go along I want to change the images in the boxes to look like that one fruit stacking game because I think it would be fun.
Game Premise:
-You are going to be a pointer on the real life map. By being able to move around with the WASD keys you can move your player through the map. There will be squares filled with numberical values starting with 1's and 2's that you can merge with their pairs to create the next following number. Merging the pairs will add them together so 1+1=2, 4+4=16. You cannot merge numbers that are not the same. ie 1+2 /= 3.
-From your player position, there will only be so many squares that you are allowed to pick up in a certain radius around you. In later stages of the design I want to make it so that the squares outside said radius change to a different color to show that you are unable to pick them up at the current moment.

Technologies
-Everything will be written in TS with designs being done in CSS, no additional html code.
-Deno and Vite for building.

D3.a
-Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

Steps
D3.a
-delete everthing in main.ts []
-put a basic leaflet map on the screen []
-draw the player's location on the map []
-draw a rectangle representing one cell on the map[]
-use loops to draw a whole grid of cells on the map[]
-put numbers into each of the grids using a randomizer (luck function) []
-can click boxes to hold the number it contains in your hand []
-can click other boxes to deposit the number currently in your hand and update the number in the box by adding them together []
