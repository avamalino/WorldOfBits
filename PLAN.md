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
-delete everthing in main.ts [x]
-put a basic leaflet map on the screen [x]
-draw the player's location on the map [x] (made it miku)
-draw a rectangle representing one cell on the map[x]
-use loops to draw a whole grid of cells on the map[x]
-put numbers into each of the grids using a randomizer (luck function) [x]
-can click boxes to hold the number it contains in your hand [x]
-can click other boxes to deposit the number currently in your hand and update the number in the box by adding them together [x]
-if box value is 0 you may put your current holding into it [x]

D3.b
-add wasd keys to move character [x]
-have map camera move with character [x]
-add radius to character and have boxes outside of radius turn grey/red [x]
-Only have boxes within the radius be accessible to the player [x]
-When outside of the radius, remove the cache from the array (make this easier later, just add it to another array that will hold value and stuff but not appear on screen)(map) [x]
-when adding together tokens, their value increases [x]
-victory threshold 2048 if i wanna stick to the normal game, or 256 if i wanna make it simple[x]

D3.c
-implement a dynamic memory system that records position and current values of cells [x]
-when moving out of a certain visible radius, don't display the cell but make sure the value of that cell is remembered for when you go back (memento pattern) [x]
