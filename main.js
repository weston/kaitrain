import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE = 16;
const CELL_SIZE = 2;
const TRACK_WIDTH = 0.4;
const RAIL_HEIGHT = 0.05;
const SLEEPER_HEIGHT = 0.1;
const SLEEPER_LENGTH = 0.8; // Fixed length, not dependent on track width

// Directions
const DIR = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

let scene, camera, renderer, controls;
let groundPlane, gridHelper;
let grid = []; // grid[row][col] = { kind, trackType, mesh, ... }
let trains = []; // { row, col, dir, enterDir, engineType, cars, mesh, speed, progress, moving, stopped }
let selectedTool = 'straight'; // 'straight', 'curve', 'engine-steam', 'engine-diesel', 'delete'
let isPlaying = false;
let soundEnabled = true;
let audioContext = null;
let steamEngineSound = null;

// Raycaster for picking
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    initGrid();
    initScene();
    initUI();
    initAudio();
    animate();
}

function initGrid() {
    for (let r = 0; r < GRID_SIZE; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = { kind: null };
        }
    }
}

function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 60);

    // Camera
    const container = document.getElementById('canvas-container');
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.set(GRID_SIZE * CELL_SIZE * 0.8, GRID_SIZE * CELL_SIZE * 0.6, GRID_SIZE * CELL_SIZE * 0.8);
    camera.lookAt(GRID_SIZE * CELL_SIZE / 2, 0, GRID_SIZE * CELL_SIZE / 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(20, 30, 20);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -GRID_SIZE * CELL_SIZE;
    sunLight.shadow.camera.right = GRID_SIZE * CELL_SIZE;
    sunLight.shadow.camera.top = GRID_SIZE * CELL_SIZE;
    sunLight.shadow.camera.bottom = -GRID_SIZE * CELL_SIZE;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // Ground
    const groundSize = GRID_SIZE * CELL_SIZE;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x5FAD56 });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(groundSize / 2, 0, groundSize / 2);
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Grid helper
    gridHelper = new THREE.GridHelper(groundSize, GRID_SIZE, 0x444444, 0x888888);
    gridHelper.position.set(groundSize / 2, 0.01, groundSize / 2);
    scene.add(gridHelper);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 10;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2.2; // Don't go under ground
    controls.target.set(groundSize / 2, 0, groundSize / 2);
    controls.update();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Handle pointer events for placing
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================================================
// UI
// ============================================================================

function initUI() {
    // Play button
    const playBtn = document.getElementById('play-btn');
    playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playBtn.textContent = '⏸️';
            playBtn.classList.add('playing');
            playSound('start');
            updateSteamEngineSound();
        } else {
            playBtn.textContent = '▶️';
            playBtn.classList.remove('playing');
            updateSteamEngineSound();
        }
    });

    // Sound button
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
        updateSteamEngineSound();
    });

    // Item buttons
    document.querySelectorAll('.item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedTool = btn.dataset.type;
            updateSelection();
        });
    });

    updateSelection();
}

function updateSelection() {
    document.querySelectorAll('.item-btn').forEach(btn => {
        if (btn.dataset.type === selectedTool) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// ============================================================================
// POINTER / TAP HANDLING
// ============================================================================

function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerDownPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function onPointerUp(event) {
    if (!pointerDownPos) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const upX = event.clientX - rect.left;
    const upY = event.clientY - rect.top;
    const dx = upX - pointerDownPos.x;
    const dy = upY - pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only count as a tap if pointer didn't move much
    if (dist < 10) {
        pointer.x = ((upX / renderer.domElement.clientWidth) * 2) - 1;
        pointer.y = (-(upY / renderer.domElement.clientHeight) * 2) + 1;
        handleTap();
    }

    pointerDownPos = null;
}

function handleTap() {
    raycaster.setFromCamera(pointer, camera);

    // In delete mode, check for trains first
    if (selectedTool === 'delete') {
        // Check for train hits
        const trainMeshes = trains.map(t => t.mesh);
        const trainIntersects = raycaster.intersectObjects(trainMeshes, true);

        if (trainIntersects.length > 0) {
            // Find which train was clicked
            const clickedMesh = trainIntersects[0].object;
            let clickedTrainMesh = clickedMesh;

            // Traverse up to find the train group
            while (clickedTrainMesh.parent && !trains.some(t => t.mesh === clickedTrainMesh)) {
                clickedTrainMesh = clickedTrainMesh.parent;
            }

            // Delete the train
            const trainIndex = trains.findIndex(t => t.mesh === clickedTrainMesh);
            if (trainIndex !== -1) {
                scene.remove(trains[trainIndex].mesh);
                trains.splice(trainIndex, 1);
                playSound('place');
                updateSteamEngineSound();
                return;
            }
        }

        // Check for track hits
        const trackMeshes = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (grid[r][c].mesh) {
                    trackMeshes.push(grid[r][c].mesh);
                }
            }
        }
        const trackIntersects = raycaster.intersectObjects(trackMeshes, true);

        if (trackIntersects.length > 0) {
            const point = trackIntersects[0].point;
            const col = Math.floor(point.x / CELL_SIZE);
            const row = Math.floor(point.z / CELL_SIZE);

            if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                deleteTrack(row, col);
            }
            return;
        }
    }

    // Use ground plane intersection
    const intersects = raycaster.intersectObject(groundPlane);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const col = Math.floor(point.x / CELL_SIZE);
        const row = Math.floor(point.z / CELL_SIZE);

        if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
            if (selectedTool === 'straight' || selectedTool === 'curve') {
                placeTrackSmart(row, col, selectedTool);
            } else if (selectedTool === 'engine-steam' || selectedTool === 'engine-diesel') {
                placeTrain(row, col, selectedTool);
            } else if (selectedTool === 'delete') {
                deleteTrack(row, col);
            }
        }
    }
}

// ============================================================================
// TRACK CREATION
// ============================================================================

function createTrackMesh(type) {
    const group = new THREE.Group();

    if (type === 'straight-h' || type === 'straight-v') {
        createStraightTrack(group, type === 'straight-h');
    } else if (type.startsWith('curve-')) {
        createCurvedTrack(group, type);
    } else if (type === 'tree') {
        createTree(group);
    } else if (type === 'station') {
        createStation(group);
    }

    return group;
}

function createStraightTrack(group, horizontal) {
    const trackLength = CELL_SIZE * 0.99;
    const sleeperCount = 5;
    const sleeperSpacing = trackLength / (sleeperCount - 1);
    const sleeperWidth = 0.15;
    const sleeperLength = SLEEPER_LENGTH

    // Sleepers (brown wooden ties)
    const sleeperGeometry = new THREE.BoxGeometry(
        horizontal ? sleeperWidth : sleeperLength,
        SLEEPER_HEIGHT,
        horizontal ? sleeperLength : sleeperWidth
    );
    const sleeperMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

    for (let i = 0; i < sleeperCount; i++) {
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.castShadow = true;
        sleeper.receiveShadow = true;

        if (horizontal) {
            sleeper.position.set(
                -trackLength / 2 + i * sleeperSpacing,
                SLEEPER_HEIGHT / 2,
                0
            );
        } else {
            sleeper.position.set(
                0,
                SLEEPER_HEIGHT / 2,
                -trackLength / 2 + i * sleeperSpacing
            );
        }
        group.add(sleeper);
    }

    // Rails (metal)
    const railGeometry = new THREE.BoxGeometry(
        horizontal ? trackLength : 0.1,
        RAIL_HEIGHT,
        horizontal ? 0.1 : trackLength
    );
    const railMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.7,
        roughness: 0.3
    });

    const rail1 = new THREE.Mesh(railGeometry, railMaterial);
    const rail2 = new THREE.Mesh(railGeometry, railMaterial);

    if (horizontal) {
        rail1.position.set(0, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, -TRACK_WIDTH / 2);
        rail2.position.set(0, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, TRACK_WIDTH / 2);
    } else {
        rail1.position.set(-TRACK_WIDTH / 2, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, 0);
        rail2.position.set(TRACK_WIDTH / 2, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, 0);
    }

    rail1.castShadow = true;
    rail2.castShadow = true;
    group.add(rail1, rail2);
}

function createCurvedTrack(group, type) {
    // Curve geometry:
    // - Radius R = CELL_SIZE / 2
    // - Each curve lives in one cell, centered at (0,0) in local space
    // - Circle center is at the INSIDE CORNER

    const R = CELL_SIZE / 2;
    const segments = 16;

    let centerX, centerZ, startAngle, endAngle;

    if (type === 'curve-tl') {
        // Inside corner: top-left
        centerX = -R;
        centerZ = -R;
        startAngle = 0;
        endAngle = Math.PI / 2;
    } else if (type === 'curve-tr') {
        // Inside corner: top-right
        centerX = R;
        centerZ = -R;
        startAngle = Math.PI / 2;
        endAngle = Math.PI;
    } else if (type === 'curve-bl') {
        // Inside corner: bottom-left
        centerX = -R;
        centerZ = R;
        startAngle = -Math.PI / 2;
        endAngle = 0;
    } else if (type === 'curve-br') {
        // Inside corner: bottom-right
        centerX = R;
        centerZ = R;
        startAngle = Math.PI;
        endAngle = Math.PI * 1.5;
    }

    // Sleepers along the curve
    const sleeperCount = 6;
    const sleeperWidth = 0.15;
    const sleeperLength = SLEEPER_LENGTH
    // Create sleeper with length along Z-axis to match straight track orientation
    const sleeperGeometry = new THREE.BoxGeometry(sleeperWidth, SLEEPER_HEIGHT, sleeperLength);
    const sleeperMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

    for (let i = 0; i < sleeperCount; i++) {
        const t = i / (sleeperCount - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        const x = centerX + R * Math.cos(angle);
        const z = centerZ + R * Math.sin(angle);

        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(x, SLEEPER_HEIGHT / 2, z);
        // Sleeper length is along Z-axis, rotate to point radially (perpendicular to rails)
        sleeper.rotation.y = Math.PI / 2 - angle;
        sleeper.castShadow = true;
        sleeper.receiveShadow = true;
        group.add(sleeper);
    }

    // Rails (curved)
    const railMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.7,
        roughness: 0.3
    });

    // Inner rail
    const innerRailCurve = new THREE.EllipseCurve(
        centerX, centerZ,
        R - TRACK_WIDTH / 2, R - TRACK_WIDTH / 2,
        startAngle, endAngle,
        false,
        0
    );
    const innerRailPoints = innerRailCurve.getPoints(segments);
    const innerRailShape = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(innerRailPoints.map(p => new THREE.Vector3(p.x, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, p.y))),
        segments,
        0.05,
        8,
        false
    );
    const innerRailMesh = new THREE.Mesh(innerRailShape, railMaterial);
    innerRailMesh.castShadow = true;
    group.add(innerRailMesh);

    // Outer rail
    const outerRailCurve = new THREE.EllipseCurve(
        centerX, centerZ,
        R + TRACK_WIDTH / 2, R + TRACK_WIDTH / 2,
        startAngle, endAngle,
        false,
        0
    );
    const outerRailPoints = outerRailCurve.getPoints(segments);
    const outerRailShape = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outerRailPoints.map(p => new THREE.Vector3(p.x, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, p.y))),
        segments,
        0.05,
        8,
        false
    );
    const outerRailMesh = new THREE.Mesh(outerRailShape, railMaterial);
    outerRailMesh.castShadow = true;
    group.add(outerRailMesh);
}

function createTree(group) {
    // Simple tree: brown trunk + green cone
    const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.4;
    trunk.castShadow = true;
    group.add(trunk);

    const foliageGeometry = new THREE.ConeGeometry(0.6, 1.2, 8);
    const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 1.4;
    foliage.castShadow = true;
    group.add(foliage);
}

function createStation(group) {
    // Simple station building
    const buildingGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.8);
    const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xDC143C });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.y = 0.4;
    building.castShadow = true;
    group.add(building);

    // Roof
    const roofGeometry = new THREE.ConeGeometry(0.9, 0.4, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.0;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
}

// ============================================================================
// TRAIN CREATION
// ============================================================================

function createSmokeParticles() {
    const particleCount = 50;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const lifetimes = [];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        velocities.push({ x: 0, y: 0, z: 0 });
        lifetimes.push(0);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const smokeMaterial = new THREE.PointsMaterial({
        color: 0xcccccc,
        size: 0.20,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    const smokeSystem = new THREE.Points(particles, smokeMaterial);
    smokeSystem.userData.velocities = velocities;
    smokeSystem.userData.lifetimes = lifetimes;
    smokeSystem.userData.particleIndex = 0;
    smokeSystem.userData.timeSinceLastEmit = 0;

    return smokeSystem;
}

function createTrainMesh(engineType, cars = []) {
    const trainGroup = new THREE.Group();

    // Create engine
    let engineMesh;
    if (engineType === 'engine-steam') {
        engineMesh = createSteamEngine();
        // Add smoke particle system
        const smokeSystem = createSmokeParticles();
        smokeSystem.position.set(0, 0.91, 0.42); // Position at the top of smokestack
        trainGroup.add(smokeSystem);
        trainGroup.userData.smokeSystem = smokeSystem;
    } else if (engineType === 'engine-diesel') {
        engineMesh = createDieselEngine();
    } else if (engineType === 'engine-bullet') {
        engineMesh = createBulletEngine();
    }

    trainGroup.add(engineMesh);

    // Create cars behind engine
    let offset = -0.9; // Start behind engine
    for (const carType of cars) {
        let carMesh;
        if (carType === 'car-passenger') {
            carMesh = createPassengerCar();
        } else if (carType === 'car-freight') {
            carMesh = createFreightCar();
        }
        carMesh.position.z = offset;
        trainGroup.add(carMesh);
        offset -= 0.9;
    }

    return trainGroup;
}

function createSteamEngine() {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.4,
        roughness: 0.6
    });
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xe74c3c, // red body
        metalness: 0.3,
        roughness: 0.6
    });
    const cabMat = new THREE.MeshStandardMaterial({
        color: 0x3498db, // blue cab
        metalness: 0.3,
        roughness: 0.6
    });
    const roofMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.4,
        roughness: 0.7
    });
    const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x2c3e50, // dark wheels
        metalness: 0.5,
        roughness: 0.4
    });
    const wheelCenterMat = new THREE.MeshStandardMaterial({
        color: 0xf1c40f, // yellow centers
        metalness: 0.8,
        roughness: 0.3
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x9fd6ff,
        metalness: 1.0,
        roughness: 0.15,
        transparent: true,
        opacity: 0.75
    });

    const halfGauge = TRACK_WIDTH / 2;
    const wheelX = halfGauge + 0.02;

    // Frame / deck
    const frameGeom = new THREE.BoxGeometry(0.5, 0.08, 0.9);
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(0, 0.11, 0);
    frame.castShadow = true;
    group.add(frame);

    // Box "boiler" / front body
    const bodyGeom = new THREE.BoxGeometry(0.46, 0.22, 0.46);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set(0, 0.26, 0.12);
    body.castShadow = true;
    group.add(body);

    // Small top strip to make it a bit more interesting
    const bodyTopGeom = new THREE.BoxGeometry(0.40, 0.06, 0.40);
    const bodyTop = new THREE.Mesh(bodyTopGeom, bodyMat);
    bodyTop.position.set(0, 0.32, 0.12);
    bodyTop.castShadow = true;
    group.add(bodyTop);

    // Stack (kept, but simple and centered)
    const stackGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.22, 14);
    const stack = new THREE.Mesh(stackGeom, frameMat);
    stack.position.set(0, 0.50, 0.26);
    stack.castShadow = true;
    group.add(stack);

    // Simple dome
    const domeGeom = new THREE.BoxGeometry(0.14, 0.10, 0.14);
    const dome = new THREE.Mesh(domeGeom, wheelCenterMat);
    dome.position.set(0, 0.38, -0.02);
    dome.castShadow = true;
    group.add(dome);

    // Cab
    const cabGeom = new THREE.BoxGeometry(0.46, 0.26, 0.32);
    const cab = new THREE.Mesh(cabGeom, cabMat);
    cab.position.set(0, 0.31, -0.32);
    cab.castShadow = true;
    group.add(cab);

    const roofGeom = new THREE.BoxGeometry(0.52, 0.04, 0.38);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 0.49, -0.32);
    roof.castShadow = true;
    group.add(roof);

    // Windows
    const sideWindowGeom = new THREE.BoxGeometry(0.02, 0.16, 0.18);
    const leftWin = new THREE.Mesh(sideWindowGeom, glassMat);
    leftWin.position.set(-0.24, 0.32, -0.32);
    group.add(leftWin);

    const rightWin = leftWin.clone();
    rightWin.position.x = 0.24;
    group.add(rightWin);

    const rearWindowGeom = new THREE.BoxGeometry(0.24, 0.16, 0.02);
    const rearWin = new THREE.Mesh(rearWindowGeom, glassMat);
    rearWin.position.set(0, 0.32, -0.46);
    group.add(rearWin);

    // Wheels (no rods, no extras)
    const wheelRadius = 0.11;
    const wheelThickness = 0.05;
    const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 20);
    const centerGeom = new THREE.CylinderGeometry(0.045, 0.045, wheelThickness * 1.1, 12);

    const wheelZs = [0.04, -0.20]; // two axles

    wheelZs.forEach(z => {
        const leftWheel = new THREE.Mesh(wheelGeom, wheelMat);
        leftWheel.position.set(-wheelX, 0.15, z);
        leftWheel.rotation.z = Math.PI / 2;
        leftWheel.castShadow = true;
        group.add(leftWheel);

        const rightWheel = leftWheel.clone();
        rightWheel.position.x = wheelX;
        group.add(rightWheel);

        const leftCenter = new THREE.Mesh(centerGeom, wheelCenterMat);
        leftCenter.position.copy(leftWheel.position);
        leftCenter.rotation.z = Math.PI / 2;
        group.add(leftCenter);

        const rightCenter = leftCenter.clone();
        rightCenter.position.x = wheelX;
        group.add(rightCenter);
    });

    // Tiny front wheels (optional but attached properly)
    const pilotRadius = 0.08;
    const pilotGeom = new THREE.CylinderGeometry(pilotRadius, pilotRadius, wheelThickness * 0.8, 16);
    const pilotLeft = new THREE.Mesh(pilotGeom, wheelMat);
    pilotLeft.position.set(-wheelX, 0.14, 0.40);
    pilotLeft.rotation.z = Math.PI / 2;
    pilotLeft.castShadow = true;
    group.add(pilotLeft);

    const pilotRight = pilotLeft.clone();
    pilotRight.position.x = wheelX;
    group.add(pilotRight);

    // No rods, no couplers, no headlight -> nothing can float off the body

    return group;
}

function createDieselEngine() {
    const group = new THREE.Group();

    const chassisGeometry = new THREE.BoxGeometry(0.7, 0.15, 0.95);
    const chassisMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
    chassis.position.y = 0.15;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF9C20 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.35;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cabGeometry = new THREE.BoxGeometry(0.4, 0.32, 0.45);
    const cabMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.set(0, 0.51, -0.05);
    cab.castShadow = true;
    cab.receiveShadow = true;
    group.add(cab);

    const frontWindowGeometry = new THREE.BoxGeometry(0.36, 0.18, 0.03);
    const frontWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    const frontWindow = new THREE.Mesh(frontWindowGeometry, frontWindowMaterial);
    frontWindow.position.set(0, 0.52, 0.44);
    group.add(frontWindow);

    const sideWindowGeometry = new THREE.BoxGeometry(0.12, 0.16, 0.03);
    const sideWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x6FB9E9 });

    const leftSideWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
    leftSideWindow.position.set(-0.22, 0.52, -0.05);
    leftSideWindow.rotation.y = Math.PI / 2;
    group.add(leftSideWindow);

    const rightSideWindow = leftSideWindow.clone();
    rightSideWindow.position.x = 0.22;
    group.add(rightSideWindow);

    const doorGeometry = new THREE.BoxGeometry(0.02, 0.26, 0.22);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0xE67A00 });

    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-0.31, 0.35, 0);
    group.add(leftDoor);

    const rightDoor = leftDoor.clone();
    rightDoor.position.x = 0.31;
    group.add(rightDoor);

    const ventGeometry = new THREE.BoxGeometry(0.02, 0.14, 0.3);
    const ventMaterial = new THREE.MeshLambertMaterial({ color: 0xCC6E00 });

    for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.set(-0.31, 0.42, -0.25 + i * 0.16);
        group.add(vent);
    }

    const roofGeometry = new THREE.BoxGeometry(0.58, 0.07, 0.78);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xF0A840 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.58;
    group.add(roof);

    const exhaustGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.18, 12);
    const exhaustMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.set(-0.12, 0.70, -0.15);
    exhaust.rotation.z = Math.PI / 2;
    group.add(exhaust);

    const exhaust2 = exhaust.clone();
    exhaust2.position.z = 0.0;
    group.add(exhaust2);

    const lightGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
    const lightMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFAA });

    const frontLightLeft = new THREE.Mesh(lightGeometry, lightMaterial);
    frontLightLeft.position.set(-0.12, 0.30, 0.51);
    frontLightLeft.rotation.x = Math.PI / 2;
    group.add(frontLightLeft);

    const frontLightRight = frontLightLeft.clone();
    frontLightRight.position.x = 0.12;
    group.add(frontLightRight);

    const rearLightLeft = frontLightLeft.clone();
    rearLightLeft.position.set(-0.12, 0.30, -0.51);
    group.add(rearLightLeft);

    const rearLightRight = frontLightRight.clone();
    rearLightRight.position.z = -0.51;
    group.add(rearLightRight);

    const railingGeometry = new THREE.BoxGeometry(0.02, 0.22, 0.7);
    const railingMaterial = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });

    const leftRail = new THREE.Mesh(railingGeometry, railingMaterial);
    leftRail.position.set(-0.36, 0.26, 0);
    group.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.x = 0.36;
    group.add(rightRail);

    const bufferGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
    const bufferMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });

    const frontBufferLeft = new THREE.Mesh(bufferGeometry, bufferMaterial);
    frontBufferLeft.position.set(-0.18, 0.18, 0.51);
    frontBufferLeft.rotation.x = Math.PI / 2;
    group.add(frontBufferLeft);

    const frontBufferRight = frontBufferLeft.clone();
    frontBufferRight.position.x = 0.18;
    group.add(frontBufferRight);

    const rearBufferLeft = frontBufferLeft.clone();
    rearBufferLeft.position.z = -0.51;
    group.add(rearBufferLeft);

    const rearBufferRight = frontBufferRight.clone();
    rearBufferRight.position.z = -0.51;
    group.add(rearBufferRight);

    const couplerGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.08);
    const couplerMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });

    const frontCoupler = new THREE.Mesh(couplerGeometry, couplerMaterial);
    frontCoupler.position.set(0, 0.16, 0.55);
    group.add(frontCoupler);

    const rearCoupler = frontCoupler.clone();
    rearCoupler.position.z = -0.55;
    group.add(rearCoupler);

    addWheels(group);

    return group;
}

function createBulletEngine() {
    const group = new THREE.Group();

    const lowerBodyGeometry = new THREE.BoxGeometry(0.55, 0.30, 0.9);
    const lowerBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const lowerBody = new THREE.Mesh(lowerBodyGeometry, lowerBodyMaterial);
    lowerBody.position.y = 0.32;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    group.add(lowerBody);

    const roofGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.9, 18, 1, true);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 0.52;
    group.add(roof);

    const stripeGeometry = new THREE.BoxGeometry(0.56, 0.12, 0.9);
    const stripeMaterial = new THREE.MeshLambertMaterial({ color: 0x0066CC });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.y = 0.30;
    group.add(stripe);

    const lowerStripeGeometry = new THREE.BoxGeometry(0.56, 0.06, 0.9);
    const lowerStripeMaterial = new THREE.MeshLambertMaterial({ color: 0x004488 });
    const lowerStripe = new THREE.Mesh(lowerStripeGeometry, lowerStripeMaterial);
    lowerStripe.position.y = 0.21;
    group.add(lowerStripe);

    const noseGeometry = new THREE.ConeGeometry(0.275, 0.45, 20);
    const noseMaterial = new THREE.MeshLambertMaterial({ color: 0x0066CC });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0.38, 0.70);
    nose.rotation.x = Math.PI / 2;
    nose.castShadow = true;
    group.add(nose);

    const noseCapGeometry = new THREE.SphereGeometry(0.12, 16, 12);
    const noseCapMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const noseCap = new THREE.Mesh(noseCapGeometry, noseCapMaterial);
    noseCap.position.set(0, 0.40, 0.89);
    group.add(noseCap);

    const frontWindowGeometry = new THREE.BoxGeometry(0.30, 0.16, 0.03);
    const frontWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x222233 });
    const frontWindow = new THREE.Mesh(frontWindowGeometry, frontWindowMaterial);
    frontWindow.position.set(0, 0.48, 0.80);
    group.add(frontWindow);

    const sideWindowGeometry = new THREE.BoxGeometry(0.06, 0.10, 0.02);
    const sideWindowMaterial = new THREE.MeshLambertMaterial({ color: 0x2E3B61 });

    const windowZPositions = [-0.30, -0.16, -0.02, 0.12, 0.26];
    windowZPositions.forEach(z => {
        const left = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
        left.position.set(-0.26, 0.45, z);
        left.rotation.y = Math.PI / 2;
        group.add(left);

        const right = left.clone();
        right.position.x = 0.26;
        group.add(right);
    });

    const doorGeometry = new THREE.BoxGeometry(0.02, 0.24, 0.22);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0xE0E0E0 });

    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-0.30, 0.33, -0.05);
    group.add(leftDoor);

    const rightDoor = leftDoor.clone();
    rightDoor.position.x = 0.30;
    group.add(rightDoor);

    const roofBoxGeometry = new THREE.BoxGeometry(0.20, 0.05, 0.25);
    const roofBoxMaterial = new THREE.MeshLambertMaterial({ color: 0xDDDDDD });
    const roofBox = new THREE.Mesh(roofBoxGeometry, roofBoxMaterial);
    roofBox.position.set(0, 0.65, -0.10);
    group.add(roofBox);

    const pantographBaseGeometry = new THREE.BoxGeometry(0.12, 0.02, 0.16);
    const pantographBaseMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const pantographBase = new THREE.Mesh(pantographBaseGeometry, pantographBaseMaterial);
    pantographBase.position.set(0, 0.69, -0.10);
    group.add(pantographBase);

    const pantographArmGeometry = new THREE.BoxGeometry(0.02, 0.10, 0.02);
    const pantographArmMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const arm1 = new THREE.Mesh(pantographArmGeometry, pantographArmMaterial);
    arm1.position.set(-0.04, 0.74, -0.10);
    arm1.rotation.z = Math.PI / 6;
    group.add(arm1);

    const arm2 = arm1.clone();
    arm2.position.x = 0.04;
    arm2.rotation.z = -Math.PI / 6;
    group.add(arm2);

    const pantographBarGeometry = new THREE.BoxGeometry(0.16, 0.02, 0.02);
    const pantographBarMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const pantographBar = new THREE.Mesh(pantographBarGeometry, pantographBarMaterial);
    pantographBar.position.set(0, 0.79, -0.10);
    group.add(pantographBar);

    const lightGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12);
    const lightMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFCC });

    const frontLightLeft = new THREE.Mesh(lightGeometry, lightMaterial);
    frontLightLeft.position.set(-0.10, 0.34, 0.86);
    frontLightLeft.rotation.x = Math.PI / 2;
    group.add(frontLightLeft);

    const frontLightRight = frontLightLeft.clone();
    frontLightRight.position.x = 0.10;
    group.add(frontLightRight);

    const rearLightLeft = frontLightLeft.clone();
    rearLightLeft.position.set(-0.10, 0.34, -0.86);
    group.add(rearLightLeft);

    const rearLightRight = frontLightRight.clone();
    rearLightRight.position.z = -0.86;
    group.add(rearLightRight);

    const undercarriageGeometry = new THREE.BoxGeometry(0.50, 0.10, 0.85);
    const undercarriageMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const undercarriage = new THREE.Mesh(undercarriageGeometry, undercarriageMaterial);
    undercarriage.position.y = 0.18;
    group.add(undercarriage);

    addWheels(group);

    return group;
}


function createPassengerCar() {
    const group = new THREE.Group();

    // Body (light blue)
    const bodyGeometry = new THREE.BoxGeometry(0.55, 0.45, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.325;
    body.castShadow = true;
    group.add(body);

    // Windows (darker blue squares)
    const windowGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.02);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x4682B4 });
    for (let i = 0; i < 3; i++) {
        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
        window1.position.set(0.28, 0.4, -0.2 + i * 0.3);
        window1.rotation.y = Math.PI / 2;
        group.add(window1);

        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(-0.28, 0.4, -0.2 + i * 0.3);
        window2.rotation.y = -Math.PI / 2;
        group.add(window2);
    }

    // Wheels
    addWheels(group);

    return group;
}

function createFreightCar() {
    const group = new THREE.Group();

    // Body (brown box)
    const bodyGeometry = new THREE.BoxGeometry(0.55, 0.45, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.325;
    body.castShadow = true;
    group.add(body);

    // Door lines
    const doorGeometry = new THREE.BoxGeometry(0.02, 0.4, 0.3);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const door1 = new THREE.Mesh(doorGeometry, doorMaterial);
    door1.position.set(0.28, 0.325, 0);
    group.add(door1);

    const door2 = new THREE.Mesh(doorGeometry, doorMaterial);
    door2.position.set(-0.28, 0.325, 0);
    group.add(door2);

    // Wheels
    addWheels(group);

    return group;
}

function addWheels(group) {
    const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const positions = [
        [-0.3, 0.12, 0.25],
        [0.3, 0.12, 0.25],
        [-0.3, 0.12, -0.25],
        [0.3, 0.12, -0.25]
    ];

    positions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
    });
}

// ============================================================================
// PLACEMENT
// ============================================================================

// Helper: Find a neighboring track cell
// Returns { row, col, incomingDir } or null
function findNeighborTrack(row, col) {
    // Check neighbors in priority order: UP, RIGHT, DOWN, LEFT
    const neighbors = [
        { row: row - 1, col: col, dir: DIR.DOWN },   // UP neighbor, incoming from DOWN
        { row: row, col: col + 1, dir: DIR.LEFT },   // RIGHT neighbor, incoming from LEFT
        { row: row + 1, col: col, dir: DIR.UP },     // DOWN neighbor, incoming from UP
        { row: row, col: col - 1, dir: DIR.RIGHT }   // LEFT neighbor, incoming from RIGHT
    ];

    const trackNeighbors = [];

    for (const n of neighbors) {
        if (n.row >= 0 && n.row < GRID_SIZE && n.col >= 0 && n.col < GRID_SIZE) {
            const cell = grid[n.row][n.col];
            if (cell.kind === 'track') {
                trackNeighbors.push(n);
            }
        }
    }

    if (trackNeighbors.length === 0) {
        return null;
    } else if (trackNeighbors.length === 1) {
        return trackNeighbors[0];
    } else {
        // Multiple neighbors: use first in priority order
        return trackNeighbors[0];
    }
}

// Smart placement based on mode
function placeTrackSmart(row, col, mode) {
    const cell = grid[row][col];

    if (mode === 'straight') {
        // If there's already a straight track, rotate it
        if (cell.kind === 'track' && cell.trackType && cell.trackType.startsWith('straight-')) {
            const newType = cell.trackType === 'straight-h' ? 'straight-v' : 'straight-h';
            placeTrackPiece(row, col, newType);
            return;
        }

        // Only place if cell is empty
        if (cell.kind === 'track') {
            return; // Don't overwrite non-straight tracks
        }

        const neighbor = findNeighborTrack(row, col);

        if (!neighbor) {
            // No neighbor: place first track (default to horizontal)
            placeTrackPiece(row, col, 'straight-h');
            return;
        }

        const incomingDir = neighbor.dir;
        let trackType;

        if (incomingDir === DIR.LEFT || incomingDir === DIR.RIGHT) {
            trackType = 'straight-h';
        } else { // UP or DOWN
            trackType = 'straight-v';
        }

        placeTrackPiece(row, col, trackType);

    } else if (mode === 'curve') {
        // Mode B: Curve
        // Simply cycle through all 4 curve types
        const allCurves = ['curve-tl', 'curve-tr', 'curve-bl', 'curve-br'];

        // Check if this cell already has a curve
        if (cell.kind === 'track' && cell.trackType && cell.trackType.startsWith('curve-')) {
            // Cycle to next curve
            const currentType = cell.trackType;
            const currentIndex = allCurves.indexOf(currentType);

            let nextIndex;
            if (currentIndex === -1) {
                nextIndex = 0;
            } else {
                // Go to next curve in the list, wrap around
                nextIndex = (currentIndex + 1) % allCurves.length;
            }

            placeTrackPiece(row, col, allCurves[nextIndex]);
        } else {
            // Place first curve
            placeTrackPiece(row, col, allCurves[0]);
        }
    }
}

// Actually create and place the track piece
function placeTrackPiece(row, col, trackType) {
    // Remove existing item in cell
    if (grid[row][col].mesh) {
        scene.remove(grid[row][col].mesh);
    }

    // Create and place track
    const trackMesh = createTrackMesh(trackType);
    trackMesh.position.set(
        col * CELL_SIZE + CELL_SIZE / 2,
        0,
        row * CELL_SIZE + CELL_SIZE / 2
    );
    scene.add(trackMesh);

    grid[row][col] = {
        kind: 'track',
        trackType: trackType,
        mesh: trackMesh
    };

    playSound('place');
}

function deleteTrack(row, col) {
    const cell = grid[row][col];

    // Only delete if there's a track
    if (cell && cell.kind === 'track') {
        // Remove the mesh from scene
        if (cell.mesh) {
            scene.remove(cell.mesh);
        }

        // Reset the cell
        grid[row][col] = { kind: null };

        // Remove any trains at this location
        trains = trains.filter(train => {
            if (train.row === row && train.col === col) {
                scene.remove(train.mesh);
                return false;
            }
            return true;
        });

        playSound('place');
        updateSteamEngineSound();
    }
}

function placeTrain(row, col, engineType) {
    const cell = grid[row][col];

    // Must be on a track
    if (!cell || cell.kind !== 'track') {
        return;
    }

    // Remove any existing train at this location
    trains = trains.filter(train => {
        if (train.row === row && train.col === col) {
            scene.remove(train.mesh);
            return false;
        }
        return true;
    });

    // Create train
    const trainMesh = createTrainMesh(engineType, []);

    // Determine initial direction based on track type
    let initialDir = DIR.RIGHT;
    let initialEnterDir = DIR.RIGHT; // Same as travel direction
    if (cell.trackType === 'straight-v') {
        initialDir = DIR.DOWN;
        initialEnterDir = DIR.DOWN;
    } else if (cell.trackType.startsWith('curve-')) {
        // For curves, pick a consistent entry side:
        // tl/tr: come from top (DOWN), bl/br: come from bottom (UP)
        if (cell.trackType === 'curve-tl' || cell.trackType === 'curve-tr') {
            initialEnterDir = DIR.DOWN;
            initialDir = DIR.DOWN;
        } else if (cell.trackType === 'curve-bl' || cell.trackType === 'curve-br') {
            initialEnterDir = DIR.UP;
            initialDir = DIR.UP;
        }
    }

    // Position train roughly at "start" of that cell
    const cellCenterX = col * CELL_SIZE + CELL_SIZE / 2;
    const cellCenterZ = row * CELL_SIZE + CELL_SIZE / 2;
    const R = CELL_SIZE / 2;
    let startX = cellCenterX;
    let startZ = cellCenterZ;

    if (cell.trackType === 'straight-h') {
        if (initialEnterDir === DIR.RIGHT) {
            startX = cellCenterX - CELL_SIZE / 2; // Left edge
        } else if (initialEnterDir === DIR.LEFT) {
            startX = cellCenterX + CELL_SIZE / 2; // Right edge
        }
    } else if (cell.trackType === 'straight-v') {
        if (initialEnterDir === DIR.DOWN) {
            startZ = cellCenterZ - CELL_SIZE / 2; // Top edge
        } else if (initialEnterDir === DIR.UP) {
            startZ = cellCenterZ + CELL_SIZE / 2; // Bottom edge
        }
    } else if (cell.trackType.startsWith('curve-')) {
        if (cell.trackType === 'curve-tl') {
            const centerX = cellCenterX - R;
            const centerZ = cellCenterZ - R;
            // start at top edge: angle 0
            startX = centerX + R * Math.cos(0);
            startZ = centerZ + R * Math.sin(0);
        } else if (cell.trackType === 'curve-tr') {
            const centerX = cellCenterX + R;
            const centerZ = cellCenterZ - R;
            // start at top edge: angle Math.PI
            startX = centerX + R * Math.cos(Math.PI);
            startZ = centerZ + R * Math.sin(Math.PI);
        } else if (cell.trackType === 'curve-bl') {
            const centerX = cellCenterX - R;
            const centerZ = cellCenterZ + R;
            // start at bottom edge: angle 0
            startX = centerX + R * Math.cos(0);
            startZ = centerZ + R * Math.sin(0);
        } else if (cell.trackType === 'curve-br') {
            const centerX = cellCenterX + R;
            const centerZ = cellCenterZ + R;
            // start at bottom edge: angle Math.PI
            startX = centerX + R * Math.cos(Math.PI);
            startZ = centerZ + R * Math.sin(Math.PI);
        }
    }

    trainMesh.position.set(startX, 0.08, startZ);
    trainMesh.rotation.y = getRotationForDirection(initialEnterDir);
    scene.add(trainMesh);

    trains.push({
        row,
        col,
        dir: initialDir,
        enterDir: initialEnterDir,
        engineType: engineType,
        cars: [],
        mesh: trainMesh,
        speed: 1.5, // cells per second
        progress: 0, // 0 to 1 within current cell
        moving: false,
        stopped: false
    });

    playSound('place');
    updateSteamEngineSound();
}

// IMPORTANT: fixed to match actual geometry (front = +Z at rotation 0)
function getRotationForDirection(dir) {
    switch (dir) {
        case DIR.DOWN:  // +Z
            return 0;
        case DIR.UP:    // -Z
            return Math.PI;
        case DIR.RIGHT: // +X
            return Math.PI / 2;
        case DIR.LEFT:  // -X
            return -Math.PI / 2;
    }
    return 0;
}

// ============================================================================
// TRAIN MOVEMENT
// ============================================================================

function stepTrains(delta) {
    trains.forEach(train => {
        // Update smoke particles for steam engines
        if (train.mesh.userData.smokeSystem) {
            const shouldEmitSmoke = isPlaying && !train.stopped;
            updateSmokeParticles(train.mesh.userData.smokeSystem, delta, shouldEmitSmoke);
        }

        if (!isPlaying) return;

        const cell = grid[train.row][train.col];
        if (!cell || cell.kind !== 'track') {
            return; // Train is stuck
        }

        // Don't move if train has stopped at end of track
        if (train.stopped) {
            return;
        }

        train.progress += train.speed * delta;

        if (train.progress >= 1.0) {
            // Move to next cell
            train.progress = 0;
            moveTrainToNextCell(train);
        }

        // Interpolate position
        updateTrainPosition(train);
    });
}

function updateSmokeParticles(smokeSystem, delta, shouldEmit) {
    if (!smokeSystem) return;

    const positions = smokeSystem.geometry.attributes.position.array;
    const velocities = smokeSystem.userData.velocities;
    const lifetimes = smokeSystem.userData.lifetimes;
    const particleCount = positions.length / 3;

    // Update existing particles
    for (let i = 0; i < particleCount; i++) {
        if (lifetimes[i] > 0) {
            // Update position
            positions[i * 3] += velocities[i].x * delta;
            positions[i * 3 + 1] += velocities[i].y * delta;
            positions[i * 3 + 2] += velocities[i].z * delta;

            // Decrease lifetime
            lifetimes[i] -= delta;

            // Reset dead particles
            if (lifetimes[i] <= 0) {
                positions[i * 3] = 0;
                positions[i * 3 + 1] = 0;
                positions[i * 3 + 2] = 0;
            }
        }
    }

    // Emit new particles
    if (shouldEmit) {
        smokeSystem.userData.timeSinceLastEmit += delta;

        if (smokeSystem.userData.timeSinceLastEmit >= 0.1) { // Emit every 0.1 seconds
            smokeSystem.userData.timeSinceLastEmit = 0;

            const idx = smokeSystem.userData.particleIndex;

            // Reset particle at smokestack position
            positions[idx * 3] = (Math.random() - 0.5) * 0.05;
            positions[idx * 3 + 1] = 0;
            positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.05;

            // Set velocity (upward with slight randomness)
            velocities[idx].x = (Math.random() - 0.5) * 0.1;
            velocities[idx].y = 0.3 + Math.random() * 0.2;
            velocities[idx].z = (Math.random() - 0.5) * 0.1;

            // Set lifetime
            lifetimes[idx] = 1.5 + Math.random() * 0.5;

            // Move to next particle
            smokeSystem.userData.particleIndex = (idx + 1) % particleCount;
        }
    }

    smokeSystem.geometry.attributes.position.needsUpdate = true;
}

function moveTrainToNextCell(train) {
    const cell = grid[train.row][train.col];
    const trackType = cell.trackType;

    // Determine next state using enterDir (direction from previous cell)
    const next = getNextState(train.row, train.col, train.enterDir, trackType);

    if (!next) {
        // No valid next cell, stop the train
        train.progress = 1.0; // Keep at end of current cell
        train.stopped = true;
        updateSteamEngineSound();
        return;
    }

    // Check if next cell has track
    const nextCell = grid[next.row][next.col];
    if (!nextCell || nextCell.kind !== 'track') {
        // Reached end of track, stop the train
        train.progress = 1.0; // Keep at end of current cell
        train.stopped = true;
        updateSteamEngineSound();
        return;
    }

    // Move train and update both dir and enterDir
    train.row = next.row;
    train.col = next.col;
    train.dir = next.exitDir;         // direction leaving this cell
    train.enterDir = next.nextEnterDir; // direction entering the new cell (same as exitDir)
}

// Connectivity logic using enterDir as direction from previous cell
function getNextState(row, col, enterDir, trackType) {
    // Returns { row, col, exitDir, nextEnterDir } or null

    let exitDir = null;
    let nextRow = row;
    let nextCol = col;

    if (trackType === 'straight-h') {
        if (enterDir === DIR.RIGHT) {
            exitDir = DIR.RIGHT;
            nextCol = col + 1;
        } else if (enterDir === DIR.LEFT) {
            exitDir = DIR.LEFT;
            nextCol = col - 1;
        }
    } else if (trackType === 'straight-v') {
        if (enterDir === DIR.DOWN) {
            exitDir = DIR.DOWN;
            nextRow = row + 1;
        } else if (enterDir === DIR.UP) {
            exitDir = DIR.UP;
            nextRow = row - 1;
        }
    } else if (trackType === 'curve-tl') {
        // Connects TOP edge to LEFT edge
        // DOWN (entering from top) -> LEFT (exit to left)
        if (enterDir === DIR.DOWN) {
            exitDir = DIR.LEFT;
            nextCol = col - 1;
        }
        // RIGHT (entering from left) -> UP (exit to top)
        else if (enterDir === DIR.RIGHT) {
            exitDir = DIR.UP;
            nextRow = row - 1;
        }
    } else if (trackType === 'curve-tr') {
        // Connects TOP edge to RIGHT edge
        // DOWN (entering from top) -> RIGHT (exit to right)
        if (enterDir === DIR.DOWN) {
            exitDir = DIR.RIGHT;
            nextCol = col + 1;
        }
        // LEFT (entering from right) -> UP (exit to top)
        else if (enterDir === DIR.LEFT) {
            exitDir = DIR.UP;
            nextRow = row - 1;
        }
    } else if (trackType === 'curve-bl') {
        // Connects BOTTOM edge to LEFT edge
        // UP (entering from bottom) -> LEFT (exit to left)
        if (enterDir === DIR.UP) {
            exitDir = DIR.LEFT;
            nextCol = col - 1;
        }
        // RIGHT (entering from left) -> DOWN (exit to bottom)
        else if (enterDir === DIR.RIGHT) {
            exitDir = DIR.DOWN;
            nextRow = row + 1;
        }
    } else if (trackType === 'curve-br') {
        // Connects BOTTOM edge to RIGHT edge
        // UP (entering from bottom) -> RIGHT (exit to right)
        if (enterDir === DIR.UP) {
            exitDir = DIR.RIGHT;
            nextCol = col + 1;
        }
        // LEFT (entering from right) -> DOWN (exit to bottom)
        else if (enterDir === DIR.LEFT) {
            exitDir = DIR.DOWN;
            nextRow = row + 1;
        }
    }

    if (exitDir === null) {
        return null; // Invalid enterDir for this track type
    }

    const nextEnterDir = exitDir;
    return { row: nextRow, col: nextCol, exitDir, nextEnterDir };
}

function updateTrainPosition(train) {
    const cell = grid[train.row][train.col];
    const trackType = cell.trackType;

    const cellCenterX = train.col * CELL_SIZE + CELL_SIZE / 2;
    const cellCenterZ = train.row * CELL_SIZE + CELL_SIZE / 2;

    let x = cellCenterX;
    let z = cellCenterZ;
    let rotation = train.mesh.rotation.y;

    if (trackType === 'straight-h') {
        if (train.enterDir === DIR.LEFT) {
            x = cellCenterX + CELL_SIZE / 2 - train.progress * CELL_SIZE;
        } else if (train.enterDir === DIR.RIGHT) {
            x = cellCenterX - CELL_SIZE / 2 + train.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(train.enterDir);
    } else if (trackType === 'straight-v') {
        if (train.enterDir === DIR.UP) {
            z = cellCenterZ + CELL_SIZE / 2 - train.progress * CELL_SIZE;
        } else if (train.enterDir === DIR.DOWN) {
            z = cellCenterZ - CELL_SIZE / 2 + train.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(train.enterDir);
    } else if (trackType.startsWith('curve-')) {
        const R = CELL_SIZE / 2;
        let centerX, centerZ, startAngle, endAngle;

        if (trackType === 'curve-tl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ - R;

            if (train.enterDir === DIR.DOWN) {
                // Travel TOP -> LEFT: angle 0 to PI/2
                startAngle = 0;
                endAngle = Math.PI / 2;
            } else if (train.enterDir === DIR.RIGHT) {
                // Travel LEFT -> TOP: angle PI/2 to 0 (reverse)
                startAngle = Math.PI / 2;
                endAngle = 0;
            }
        } else if (trackType === 'curve-tr') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ - R;

            if (train.enterDir === DIR.DOWN) {
                // Travel TOP -> RIGHT: angle PI to PI/2 (reverse)
                startAngle = Math.PI;
                endAngle = Math.PI / 2;
            } else if (train.enterDir === DIR.LEFT) {
                // Travel RIGHT -> TOP: angle PI/2 to PI
                startAngle = Math.PI / 2;
                endAngle = Math.PI;
            }
        } else if (trackType === 'curve-bl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ + R;

            if (train.enterDir === DIR.UP) {
                // Travel BOTTOM -> LEFT: angle 0 to -PI/2 (reverse)
                startAngle = 0;
                endAngle = -Math.PI / 2;
            } else if (train.enterDir === DIR.RIGHT) {
                // Travel LEFT -> BOTTOM: angle -PI/2 to 0
                startAngle = -Math.PI / 2;
                endAngle = 0;
            }
        } else if (trackType === 'curve-br') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ + R;

            if (train.enterDir === DIR.UP) {
                // Travel BOTTOM -> RIGHT: angle PI to 3*PI/2
                startAngle = Math.PI;
                endAngle = Math.PI * 1.5;
            } else if (train.enterDir === DIR.LEFT) {
                // Travel RIGHT -> BOTTOM: angle 3*PI/2 to PI (reverse)
                startAngle = Math.PI * 1.5;
                endAngle = Math.PI;
            }
        }

        if (startAngle === undefined || endAngle === undefined) {
            x = cellCenterX;
            z = cellCenterZ;
            rotation = getRotationForDirection(train.enterDir);
        } else {
            const dAngle = endAngle - startAngle;
            const currentAngle = startAngle + dAngle * train.progress;

            x = centerX + R * Math.cos(currentAngle);
            z = centerZ + R * Math.sin(currentAngle);

            // Tangent following actual direction of travel (handle both CW / CCW)
            const sign = dAngle >= 0 ? 1 : -1;
            const dx = -Math.sin(currentAngle) * sign;
            const dz = Math.cos(currentAngle) * sign;
            rotation = Math.atan2(dx, dz);
        }
    }

    train.mesh.position.x = x;
    train.mesh.position.z = z;
    train.mesh.rotation.y = rotation;
}

// ============================================================================
// AUDIO
// ============================================================================

function initAudio() {
    // Create audio context on first user interaction
    document.addEventListener('pointerdown', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });

    // Load steam engine sound
    steamEngineSound = new Audio('./sounds/steamengine.mp3');
    steamEngineSound.loop = true;
    steamEngineSound.volume = 0.5;
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    if (type === 'place') {
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'start') {
        oscillator.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }
}

function updateSteamEngineSound() {
    if (!steamEngineSound) return;

    // Check if there are any steam engines on the tracks that are moving (not stopped)
    const hasMovingSteamEngine = trains.some(train =>
        train.engineType === 'engine-steam' && !train.stopped
    );

    if (soundEnabled && isPlaying && hasMovingSteamEngine) {
        // Play sound if not already playing
        if (steamEngineSound.paused) {
            steamEngineSound.play().catch(err => console.log('Audio play failed:', err));
        }
    } else {
        // Pause sound
        if (!steamEngineSound.paused) {
            steamEngineSound.pause();
        }
    }
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

let lastTime = 0;

function animate(time = 0) {
    requestAnimationFrame(animate);

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    controls.update();
    stepTrains(delta);
    renderer.render(scene, camera);
}

// ============================================================================
// START
// ============================================================================

init();
