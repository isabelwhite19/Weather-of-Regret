// ==========================================
// THE WEATHER OF REGRET - MOV Rain Overlay Version
// ==========================================

let rainVideo; // MOV video element for rain
let imgFrame, imgStreak;
let imgWindow, imgRust;
let cloudImgs = [];
let memoryImgs = [];
let bgMusic;    // lalaland.mp3
let rainSound;  // rain.mp3
let windSound;  // wind.wav

let currentAsset = null; 
let assetsLoaded = false;
let audioStarted = false; 
let nextSpawnTime = 0; 

async function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  textFont('Georgia');

  try {
    // 1. Load rain MOV video asynchronously (make sure rainonwindow.mov is uploaded)
    rainVideo = createVideo('rainonwindow.mov', () => {
      rainVideo.loop();
      rainVideo.volume(0); // Mute video's internal audio since we use rain.mp3 for sound
      rainVideo.hide();    // Hide the raw HTML video element so it only renders onto the canvas
    });

    // 2. Load structural and texture assets asynchronously
    imgFrame = await loadImage('blackframe.png');
    imgStreak = await loadImage('pencilstreak.png');
    imgWindow = await loadImage('windowpane.png');
    imgRust = await loadImage('rustsquare.png');

    // 3. Load clouds
    let c1 = await loadImage('cloud.png');
    let c2 = await loadImage('cloud.png');
    let c3 = await loadImage('cloud.png');
    cloudImgs.push(c1, c2, c3);

    // 4. Safely load memories 1 through 7
    let memoryPromises = [];
    for (let i = 1; i <= 7; i++) {
      memoryPromises.push(
        loadImage(`memory${i}.png`).catch(err => {
          console.warn(`Could not load memory${i}.png`);
          return null;
        })
      );
    }

    let loadedMemories = await Promise.all(memoryPromises);
    memoryImgs = loadedMemories.filter(img => img !== null);

    // 5. Safely initialize audio tracks as HTML5 elements
    bgMusic = createAudio('lalaland.mp3');
    bgMusic.elt.loop = true;
    bgMusic.volume(0.4);

    rainSound = createAudio('rain.mp3');
    rainSound.elt.loop = true;
    rainSound.volume(0.15); // Quiet rain ambiance

    windSound = createAudio('wind.wav');
    windSound.volume(0.35);

    assetsLoaded = true;
  } catch (err) {
    console.error("Error during setup initialization:", err);
  }
}

function draw() {
  // If assets are loading OR we are waiting for the click prompt to start audio
  if (!assetsLoaded || !audioStarted) {
    background(20, 22, 28);
    fill(220, 220, 240, 200);
    textAlign(CENTER, CENTER);
    textSize(18);
    
    if (!assetsLoaded) {
      text("Loading handmade assets...", width / 2, height / 2);
    } else {
      text("The Weather of Regret\n\n[ Click anywhere to enter & start audio ]", width / 2, height / 2);
    }
    return;
  }

  // 1. BASE BACKGROUND: Clean dark paper tone
  background(30, 32, 40);

  // 2. PAPER & TEXTURE BACKGROUND LAYER
  push();
  blendMode(BLEND);
  tint(255, 60);
  image(imgRust, width / 2, height / 2, width, height);
  pop();

  // 3. WEATHER / DYNAMIC VIDEO RAIN LAYER
  push();
  blendMode(SCREEN);
  tint(255, 60);
  // Renders the current frame of rainonwindow.mov onto the canvas
  image(rainVideo, width / 2, height / 2, width, height);
  
  tint(255, 40);
  image(imgStreak, width / 2, height / 2, width, height);
  pop();

  // 4. THREE SLOWLY DRIFTING CLOUD LAYERS
  push();
  blendMode(SCREEN);
  for (let i = 0; i < cloudImgs.length; i++) {
    let speedOffset = i * 150;
    let cX = map(noise(frameCount * 0.0002 + speedOffset), 0, 1, width * 0.15, width * 0.85);
    let cY = map(noise(frameCount * 0.0003 + 500 + speedOffset), 0, 1, height * 0.3, height * 0.7);
    
    let cloudAlpha = map(sin(frameCount * 0.0006 + i), -1, 1, 10, 35);
    tint(255, cloudAlpha); 
    image(cloudImgs[i], cX, cY, width * 0.8, height * 0.5);
  }
  pop();

  // 5. FULL-SCREEN WINDOWPANE LAYER
  push();
  blendMode(MULTIPLY);
  tint(255, 140);
  image(imgWindow, width / 2, height / 2, width, height);
  pop();

  // 6. THE ACTIVE MEMORY (Blended into atmosphere using SCREEN mode)
  if (currentAsset) {
    currentAsset.update();
    currentAsset.display();
  }

  // Check if 5 seconds have passed since last spawn
  if (millis() > nextSpawnTime && (!currentAsset || currentAsset.isDead())) {
    spawnNewMemory();
  }

  // 7. OUTER VIGNETTE FRAME
  push();
  blendMode(MULTIPLY);
  tint(255, 200);
  image(imgFrame, width / 2, height / 2, width, height);
  pop();

  // 8. INTERACTION HINT
  push();
  fill(220, 220, 240, 80);
  textAlign(CENTER, CENTER);
  textSize(12);
  text("move cursor gently to alter the wind & interact with memories", width / 2, height - 25);
  pop();
}

// Handle user interaction: safely start pre-loaded audio elements on click
function mousePressed() {
  if (assetsLoaded && !audioStarted) {
    if (bgMusic) bgMusic.play();
    if (rainSound) rainSound.play();
    
    audioStarted = true;
    spawnNewMemory(); 
    nextSpawnTime = millis() + 5000;
  }
}

// Function to choose a random memory image and schedule the next one in 5 seconds
function spawnNewMemory() {
  if (memoryImgs.length === 0) return;

  let chosenImg = random(memoryImgs);
  let startX = random(width * 0.3, width * 0.7);
  let startY = random(height * 0.55, height * 0.75);

  currentAsset = new DriftingAsset(chosenImg, 0.15, startX, startY);
  nextSpawnTime = millis() + 5000;
}

// ==========================================
// DRIFTING ASSET CLASS (Atmospherically Blended)
// ==========================================
class DriftingAsset {
  constructor(img, baseScale, startX, startY) {
    this.img = img;
    this.x = startX;
    this.y = startY;
    this.scale = baseScale * random(0.9, 1.1);

    this.noiseOffset = random(10000);
    this.lifespan = 450; 
    this.age = 0;
    this.currentAlpha = 0;
    this.maxAlpha = 200; 
    this.isHovered = false; 
  }

  update() {
    this.age++;

    let n = noise(this.noiseOffset + frameCount * 0.001);
    let driftX = map(n, 0, 1, -0.15, 0.15);
    let windX = map(mouseX, 0, width, -0.1, 0.1);

    this.x += driftX + windX;
    this.y -= 0.04; // Very slow upward drift

    // Gentle, gradual fade in and fade out
    let fadeInTime = 90;
    let fadeOutTime = 90;
    if (this.age < fadeInTime) {
      this.currentAlpha = map(this.age, 0, fadeInTime, 0, this.maxAlpha);
    } else if (this.age > this.lifespan - fadeOutTime) {
      this.currentAlpha = map(this.age, this.lifespan - fadeOutTime, this.lifespan, this.maxAlpha, 0);
    } else {
      this.currentAlpha = this.maxAlpha;
    }

    // Hover proximity check
    let d = dist(mouseX, mouseY, this.x, this.y);
    if (d < 120) {
      // Trigger wind sound on initial hover entry
      if (!this.isHovered) {
        this.isHovered = true;
        if (windSound) {
          windSound.time(0); // Rewind to start
          windSound.play();  // Play wind effect
        }
      }

      let angle = atan2(this.y - mouseY, this.x - mouseX);
      this.x += cos(angle) * 0.3;
      this.y += sin(angle) * 0.3;
    } else {
      // Reset hover state when cursor moves away
      this.isHovered = false;
    }
  }

  display() {
    if (!this.img) return;

    push();
    translate(this.x, this.y);
    blendMode(SCREEN); 
    tint(255, this.currentAlpha);

    let drawWidth = this.img.width * this.scale;
    let drawHeight = this.img.height * this.scale;

    image(this.img, 0, 0, drawWidth, drawHeight);
    pop();
  }

  isDead() {
    return this.age >= this.lifespan || this.y < -150;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}