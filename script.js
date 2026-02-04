// ===== CONFIG =====
const MIN_CONFIDENCE = 0.7;
const DETECTION_INTERVAL_MS = 120;

const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const gestureEl = document.getElementById('gesture');

let model = null;
let isRunning = false;
let animationId = null;
let particles = [];
let textMessage = '';
let lastTextTime = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 4 + 1;
    this.speedX = (Math.random() - 0.5) * 3;
    this.speedY = (Math.random() - 0.5) * 3;
    this.color = color;
    this.life = 0;
    this.maxLife = Math.random() * 60 + 40;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life++;
    return this.life <= this.maxLife;
  }
  draw() {
    const alpha = 1 - this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }}

function spawnParticles(count, x, y, color = '#fff') {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update()) {
      particles.splice(i, 1);
    } else {
      particles[i].draw();
    }
  }

  if (textMessage && Date.now() - lastTextTime < 3000) {
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.fillText(textMessage, canvas.width / 2, canvas.height / 2);
  }

  if (isRunning) {
    animationId = requestAnimationFrame(draw);
  }
}

function classifyGesture(boundingBoxes) {
  if (!boundingBoxes || boundingBoxes.length === 0) return 'none';
  const box = boundingBoxes[0];
  const { x, y, width, height, score } = box;
  if (score < MIN_CONFIDENCE) return 'none';

  const aspect = width / height;
  const area = width * height;

  if (aspect > 1.2 && area > 5000) return 'open';
  if (aspect < 0.8 && area < 3000) return 'fist';
  if (aspect > 1.1 && y < canvas.height * 0.3) return 'vsign';
  if (area > 4000 && y > canvas.height * 0.6) return 'pinch';
  return 'none';
}
function handleDetections(detections) {
  const gesture = classifyGesture(detections);
  gestureEl.textContent = `Gesture: ${gesture.charAt(0).toUpperCase() + gesture.slice(1)}`;

  if (gesture === 'open') {
    textMessage = '';
    spawnParticles(250, canvas.width/2, canvas.height/2, `hsl(${Math.random()*360}, 70%, 60%)`);
  } else if (gesture === 'fist') {
    textMessage = 'SATURN RING';
    lastTextTime = Date.now();
    spawnParticles(200, canvas.width/2, canvas.height/2, '#4FC3F7');
  } else if (gesture === 'vsign') {
    textMessage = 'I LOVE YOU';
    lastTextTime = Date.now();
    spawnParticles(180, canvas.width/2, canvas.height/2, '#FFD700');
  } else if (gesture === 'pinch') {
    textMessage = 'KEEP IT 100';
    lastTextTime = Date.now();
    spawnParticles(160, canvas.width/2, canvas.height/2, '#FF69B4');
  }
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
      audio: false 
    });
    video.srcObject = stream;
    await new Promise(r => video.onloadedmetadata = r);

    statusEl.textContent = "Loading AI...";
    model = await handTrack.load({
      maxFaces: 1,
      detectionConfidence: 0.7,
      iouThreshold: 0.5,
      architecture: 'SSD Mobilenet V1'
    });

    statusEl.textContent = "Show your hand!";
    startDetection();
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = `❌ Camera failed.<br>Use Chrome/Safari & allow camera.`;
    statusEl.style.color = 'red';
  }
}

function startDetection() {
  if (!model || !isRunning) return;  async function detect() {
    if (video.videoWidth) {
      const predictions = await model.detect(video);
      handleDetections(predictions);
    }
    setTimeout(detect, DETECTION_INTERVAL_MS);
  }
  detect();
}

function requestCamera() {
  if (isRunning) return;
  statusEl.textContent = "Starting...";
  setupCamera().then(() => {
    isRunning = true;
    draw();
    document.getElementById('controls').innerHTML = `
      <button onclick="togglePause()">⏸️ Pause</button>
      <button onclick="reset()">🔄 Reset</button>
    `;
  });
}

function togglePause() {
  isRunning = !isRunning;
  if (isRunning) {
    draw();
    statusEl.textContent = "Resumed";
  } else {
    cancelAnimationFrame(animationId);
    statusEl.textContent = "Paused";
  }
}

function reset() {
  particles = [];
  textMessage = '';
  gestureEl.textContent = "Gesture: —";
  statusEl.textContent = "Reset.";
}

// Prevent mobile scroll/zoom
document.body.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
document.body.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
