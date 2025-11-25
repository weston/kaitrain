import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE = 16;
const CELL_SIZE = 2;
const TRACK_WIDTH = 0.3;
const RAIL_HEIGHT = 0.05;
const SLEEPER_HEIGHT = 0.1;

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
let trains = []; // { row, col, dir, engineType, cars, mesh, speed, moving }
let mode = 'track'; // 'track' or 'train'
let selectedType = 'straight-h';
let selectedEngine = null;
let selectedCars = [];
let isPlaying = false;
let soundEnabled = true;
let audioContext = null;

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
    // Mode button
    const modeBtn = document.getElementById('mode-btn');
    modeBtn.addEventListener('click', () => {
        if (mode === 'track') {
            mode = 'train';
            modeBtn.textContent = '🚂 Trains';
            modeBtn.classList.add('active');
            document.getElementById('track-items').style.display = 'none';
            document.getElementById('train-items').style.display = 'flex';
            selectedType = 'engine-steam';
            updateSelection();
        } else {
            mode = 'track';
            modeBtn.textContent = '🛤️ Tracks';
            modeBtn.classList.remove('active');
            document.getElementById('track-items').style.display = 'flex';
            document.getElementById('train-items').style.display = 'none';
            selectedType = 'straight-h';
            selectedEngine = null;
            selectedCars = [];
            updateSelection();
        }
    });

    // Play button
    const playBtn = document.getElementById('play-btn');
    playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playBtn.textContent = '⏸️';
            playBtn.classList.add('playing');
            playSound('start');
        } else {
            playBtn.textContent = '▶️';
            playBtn.classList.remove('playing');
        }
    });

    // Sound button
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });

    // Item buttons
    document.querySelectorAll('.item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            
            if (mode === 'track') {
                selectedType = type;
                updateSelection();
            } else {
                // Train mode
                if (type.startsWith('engine-')) {
                    selectedEngine = type;
                    selectedCars = [];
                } else if (type.startsWith('car-')) {
                    if (selectedCars.length < 2) {
                        selectedCars.push(type);
                    }
                }
                updateSelection();
            }
        });
    });

    updateSelection();
}

function updateSelection() {
    document.querySelectorAll('.item-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    if (mode === 'track') {
        const trackItems = document.getElementById('track-items');
        trackItems.querySelectorAll('.item-btn').forEach(btn => {
            if (btn.dataset.type === selectedType) {
                btn.classList.add('selected');
            }
        });
    } else {
        const trainItems = document.getElementById('train-items');
        trainItems.querySelectorAll('.item-btn').forEach(btn => {
            if (btn.dataset.type === selectedEngine) {
                btn.classList.add('selected');
            } else if (selectedCars.includes(btn.dataset.type)) {
                btn.classList.add('selected');
            }
        });
    }
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
    const intersects = raycaster.intersectObject(groundPlane);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const col = Math.floor(point.x / CELL_SIZE);
        const row = Math.floor(point.z / CELL_SIZE);
        
        if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
            if (mode === 'track') {
                placeTrack(row, col, selectedType);
            } else if (mode === 'train') {
                if (selectedEngine) {
                    placeTrain(row, col);
                }
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
    const trackLength = CELL_SIZE * 0.9;
    const sleeperCount = 5;
    const sleeperSpacing = trackLength / (sleeperCount - 1);
    const sleeperWidth = 0.15;
    const sleeperLength = TRACK_WIDTH * 3;

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
    // Curve geometry as per spec:
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
    const sleeperCount = 8;
    const sleeperWidth = 0.15;
    const sleeperLength = TRACK_WIDTH * 3;
    const sleeperGeometry = new THREE.BoxGeometry(sleeperLength, SLEEPER_HEIGHT, sleeperWidth);
    const sleeperMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    for (let i = 0; i < sleeperCount; i++) {
        const t = i / (sleeperCount - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        const x = centerX + R * Math.cos(angle);
        const z = centerZ + R * Math.sin(angle);
        
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(x, SLEEPER_HEIGHT / 2, z);
        sleeper.rotation.y = angle + Math.PI / 2;
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
    const innerRailGeometry = new THREE.BufferGeometry().setFromPoints(
        innerRailPoints.map(p => new THREE.Vector3(p.x, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, p.y))
    );
    const innerRail = new THREE.Line(innerRailGeometry, railMaterial);
    
    // Make it a tube instead of line for better visibility
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
    
    // DEBUG: Add spheres at endpoints to verify alignment
    const debugMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const debugGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    
    // Calculate endpoint positions on the rails (at radius R)
    const startX = centerX + R * Math.cos(startAngle);
    const startZ = centerZ + R * Math.sin(startAngle);
    const endX = centerX + R * Math.cos(endAngle);
    const endZ = centerZ + R * Math.sin(endAngle);
    
    const sphere1 = new THREE.Mesh(debugGeometry, debugMaterial);
    sphere1.position.set(startX, SLEEPER_HEIGHT + RAIL_HEIGHT, startZ);
    group.add(sphere1);
    
    const sphere2 = new THREE.Mesh(debugGeometry, debugMaterial);
    sphere2.position.set(endX, SLEEPER_HEIGHT + RAIL_HEIGHT, endZ);
    group.add(sphere2);
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

function createTrainMesh(engineType, cars = []) {
    const trainGroup = new THREE.Group();
    
    // Create engine
    let engineMesh;
    if (engineType === 'engine-steam') {
        engineMesh = createSteamEngine();
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
    
    // Main body (dark red)
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);
    
    // Boiler (round front)
    const boilerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12);
    const boilerMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const boiler = new THREE.Mesh(boilerGeometry, boilerMaterial);
    boiler.position.set(0, 0.3, 0.5);
    boiler.rotation.x = Math.PI / 2;
    boiler.castShadow = true;
    group.add(boiler);
    
    // Chimney
    const chimneyGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8);
    const chimneyMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
    chimney.position.set(0, 0.65, 0.2);
    chimney.castShadow = true;
    group.add(chimney);
    
    // Wheels
    addWheels(group);
    
    return group;
}

function createDieselEngine() {
    const group = new THREE.Group();
    
    // Main body (orange/yellow)
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.45, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF8C00 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.325;
    body.castShadow = true;
    group.add(body);
    
    // Cab (darker top)
    const cabGeometry = new THREE.BoxGeometry(0.6, 0.25, 0.4);
    const cabMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.y = 0.575;
    cab.castShadow = true;
    group.add(cab);
    
    // Front window (blue)
    const windowGeometry = new THREE.BoxGeometry(0.55, 0.2, 0.05);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(0, 0.575, 0.405);
    group.add(window);
    
    // Wheels
    addWheels(group);
    
    return group;
}

function createBulletEngine() {
    const group = new THREE.Group();
    
    // Streamlined body (white/blue)
    const bodyGeometry = new THREE.BoxGeometry(0.55, 0.5, 0.9);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.35;
    body.castShadow = true;
    group.add(body);
    
    // Blue stripe
    const stripeGeometry = new THREE.BoxGeometry(0.56, 0.15, 0.9);
    const stripeMaterial = new THREE.MeshLambertMaterial({ color: 0x0066CC });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.y = 0.3;
    group.add(stripe);
    
    // Pointed nose
    const noseGeometry = new THREE.ConeGeometry(0.25, 0.4, 8);
    const noseMaterial = new THREE.MeshLambertMaterial({ color: 0x0066CC });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0.35, 0.65);
    nose.rotation.x = Math.PI / 2;
    nose.castShadow = true;
    group.add(nose);
    
    // Wheels
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
        window1.position.set(0, 0.4, -0.2 + i * 0.3);
        window1.position.x = 0.28;
        window1.rotation.y = Math.PI / 2;
        group.add(window1);
        
        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(0, 0.4, -0.2 + i * 0.3);
        window2.position.x = -0.28;
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

function placeTrack(row, col, type) {
    // Remove existing item in cell
    if (grid[row][col].mesh) {
        scene.remove(grid[row][col].mesh);
    }
    
    // Create and place track
    const trackMesh = createTrackMesh(type);
    trackMesh.position.set(
        col * CELL_SIZE + CELL_SIZE / 2,
        0,
        row * CELL_SIZE + CELL_SIZE / 2
    );
    scene.add(trackMesh);
    
    grid[row][col] = {
        kind: type.startsWith('tree') || type.startsWith('station') ? 'decoration' : 'track',
        trackType: type,
        mesh: trackMesh
    };
    
    playSound('place');
}

function placeTrain(row, col) {
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
    const trainMesh = createTrainMesh(selectedEngine, selectedCars);
    
    // Determine initial direction based on track type
    let initialDir = DIR.RIGHT;
    if (cell.trackType === 'straight-v') {
        initialDir = DIR.DOWN;
    }
    
    // Position and orient train
    trainMesh.position.set(
        col * CELL_SIZE + CELL_SIZE / 2,
        0,
        row * CELL_SIZE + CELL_SIZE / 2
    );
    trainMesh.rotation.y = getRotationForDirection(initialDir);
    scene.add(trainMesh);
    
    trains.push({
        row,
        col,
        dir: initialDir,
        engineType: selectedEngine,
        cars: [...selectedCars],
        mesh: trainMesh,
        speed: 0.5, // cells per second
        progress: 0, // 0 to 1 within current cell
        moving: false
    });
    
    playSound('place');
    
    // Reset selection for next placement
    selectedEngine = null;
    selectedCars = [];
    updateSelection();
}

function getRotationForDirection(dir) {
    switch(dir) {
        case DIR.UP: return Math.PI;
        case DIR.RIGHT: return -Math.PI / 2;
        case DIR.DOWN: return 0;
        case DIR.LEFT: return Math.PI / 2;
    }
    return 0;
}

// ============================================================================
// TRAIN MOVEMENT
// ============================================================================

function stepTrains(delta) {
    if (!isPlaying) return;
    
    trains.forEach(train => {
        const cell = grid[train.row][train.col];
        if (!cell || cell.kind !== 'track') {
            return; // Train is stuck
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

function moveTrainToNextCell(train) {
    const cell = grid[train.row][train.col];
    const trackType = cell.trackType;
    
    // Determine next direction and cell
    const next = getNextCell(train.row, train.col, train.dir, trackType);
    
    if (!next) {
        // No valid next cell, stop
        train.progress = 0;
        return;
    }
    
    // Check if next cell has track
    const nextCell = grid[next.row][next.col];
    if (!nextCell || nextCell.kind !== 'track') {
        train.progress = 0;
        return;
    }
    
    // Move train
    train.row = next.row;
    train.col = next.col;
    train.dir = next.dir;
}

function getNextCell(row, col, dir, trackType) {
    // Returns { row, col, dir } or null
    
    if (trackType === 'straight-h') {
        if (dir === DIR.LEFT) {
            return { row, col: col - 1, dir: DIR.LEFT };
        } else if (dir === DIR.RIGHT) {
            return { row, col: col + 1, dir: DIR.RIGHT };
        }
    } else if (trackType === 'straight-v') {
        if (dir === DIR.UP) {
            return { row: row - 1, col, dir: DIR.UP };
        } else if (dir === DIR.DOWN) {
            return { row: row + 1, col, dir: DIR.DOWN };
        }
    } else if (trackType === 'curve-tl') {
        if (dir === DIR.DOWN) {
            return { row, col: col + 1, dir: DIR.RIGHT };
        } else if (dir === DIR.LEFT) {
            return { row: row - 1, col, dir: DIR.UP };
        }
    } else if (trackType === 'curve-tr') {
        if (dir === DIR.DOWN) {
            return { row, col: col - 1, dir: DIR.LEFT };
        } else if (dir === DIR.RIGHT) {
            return { row: row - 1, col, dir: DIR.UP };
        }
    } else if (trackType === 'curve-bl') {
        if (dir === DIR.UP) {
            return { row, col: col + 1, dir: DIR.RIGHT };
        } else if (dir === DIR.LEFT) {
            return { row: row + 1, col, dir: DIR.DOWN };
        }
    } else if (trackType === 'curve-br') {
        if (dir === DIR.UP) {
            return { row, col: col - 1, dir: DIR.LEFT };
        } else if (dir === DIR.RIGHT) {
            return { row: row + 1, col, dir: DIR.DOWN };
        }
    }
    
    return null;
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
        if (train.dir === DIR.LEFT) {
            x = cellCenterX + CELL_SIZE / 2 - train.progress * CELL_SIZE;
        } else if (train.dir === DIR.RIGHT) {
            x = cellCenterX - CELL_SIZE / 2 + train.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(train.dir);
    } else if (trackType === 'straight-v') {
        if (train.dir === DIR.UP) {
            z = cellCenterZ + CELL_SIZE / 2 - train.progress * CELL_SIZE;
        } else if (train.dir === DIR.DOWN) {
            z = cellCenterZ - CELL_SIZE / 2 + train.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(train.dir);
    } else if (trackType.startsWith('curve-')) {
        // Curve interpolation
        const R = CELL_SIZE / 2;
        let centerX, centerZ, startAngle, angleSpan;
        
        if (trackType === 'curve-tl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ - R;
            if (train.dir === DIR.RIGHT) {
                // Coming from left edge, going to bottom edge
                startAngle = Math.PI;
                angleSpan = -Math.PI / 2;
            } else {
                // Coming from bottom edge, going to right edge
                startAngle = Math.PI / 2;
                angleSpan = Math.PI / 2;
            }
        } else if (trackType === 'curve-tr') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ - R;
            if (train.dir === DIR.LEFT) {
                // Coming from right edge, going to bottom edge
                startAngle = 0;
                angleSpan = Math.PI / 2;
            } else {
                // Coming from bottom edge, going to left edge
                startAngle = Math.PI / 2;
                angleSpan = -Math.PI / 2;
            }
        } else if (trackType === 'curve-bl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ + R;
            if (train.dir === DIR.RIGHT) {
                // Coming from left edge, going to top edge
                startAngle = Math.PI;
                angleSpan = Math.PI / 2;
            } else {
                // Coming from top edge, going to right edge
                startAngle = -Math.PI / 2;
                angleSpan = -Math.PI / 2;
            }
        } else if (trackType === 'curve-br') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ + R;
            if (train.dir === DIR.LEFT) {
                // Coming from right edge, going to top edge
                startAngle = 0;
                angleSpan = -Math.PI / 2;
            } else {
                // Coming from top edge, going to left edge
                startAngle = -Math.PI / 2;
                angleSpan = Math.PI / 2;
            }
        }
        
        const currentAngle = startAngle + angleSpan * train.progress;
        x = centerX + R * Math.cos(currentAngle);
        z = centerZ + R * Math.sin(currentAngle);
        rotation = currentAngle + Math.PI / 2;
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

