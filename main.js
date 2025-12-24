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
let trains = []; // { segments: [{ type, mesh, row, col, dir, enterDir, progress }], speed, moving, stopped }
let selectedTool = 'straight'; // 'straight', 'curve', 'crossing', 'tunnel', 'engine-steam', 'engine-diesel', 'delete'
let isPlaying = false;
let soundEnabled = true;
let audioContext = null;
let steamEngineSound = null;
let dingSound = null;
let crossings = []; // { row, col, mesh, arms: [arm1, arm2], active: bool, dingSound: Audio }
let snowParticles = null; // Snow particle system

const SEGMENT_SPACING = 0.9; // Distance between segments
const ENGINE_TO_CAR_SPACING = 1.05; // Extra space between engine and first car

// Default layout (set to null to start empty, or paste layout data here)
const DEFAULT_LAYOUT = {
    "tracks": [
        { "row": 1, "col": 1, "trackType": "curve-br" },
        { "row": 1, "col": 2, "trackType": "curve-bl" },
        { "row": 1, "col": 3, "trackType": "curve-br" },
        { "row": 1, "col": 4, "trackType": "curve-bl" },
        { "row": 1, "col": 5, "trackType": "curve-br" },
        { "row": 1, "col": 6, "trackType": "curve-bl" },
        { "row": 1, "col": 7, "trackType": "curve-br" },
        { "row": 1, "col": 8, "trackType": "curve-bl" },
        { "row": 1, "col": 9, "trackType": "curve-br" },
        { "row": 1, "col": 10, "trackType": "curve-bl" },
        { "row": 1, "col": 11, "trackType": "curve-br" },
        { "row": 1, "col": 12, "trackType": "curve-bl" },
        { "row": 1, "col": 13, "trackType": "curve-br" },
        { "row": 1, "col": 14, "trackType": "straight-h" },
        { "row": 1, "col": 15, "trackType": "curve-bl" },
        { "row": 2, "col": 1, "trackType": "straight-v" },
        { "row": 2, "col": 2, "trackType": "curve-tr" },
        { "row": 2, "col": 3, "trackType": "curve-tl" },
        { "row": 2, "col": 4, "trackType": "curve-tr" },
        { "row": 2, "col": 5, "trackType": "curve-tl" },
        { "row": 2, "col": 6, "trackType": "curve-tr" },
        { "row": 2, "col": 7, "trackType": "curve-tl" },
        { "row": 2, "col": 8, "trackType": "curve-tr" },
        { "row": 2, "col": 9, "trackType": "curve-tl" },
        { "row": 2, "col": 10, "trackType": "curve-tr" },
        { "row": 2, "col": 11, "trackType": "curve-tl" },
        { "row": 2, "col": 12, "trackType": "curve-tr" },
        { "row": 2, "col": 13, "trackType": "curve-tl" },
        { "row": 2, "col": 15, "trackType": "straight-v" },
        { "row": 3, "col": 1, "trackType": "straight-v" },
        { "row": 3, "col": 8, "trackType": "curve-br" },
        { "row": 3, "col": 9, "trackType": "curve-bl" },
        { "row": 3, "col": 15, "trackType": "straight-v" },
        { "row": 4, "col": 1, "trackType": "straight-v" },
        { "row": 4, "col": 5, "trackType": "curve-br" },
        { "row": 4, "col": 6, "trackType": "curve-bl" },
        { "row": 4, "col": 7, "trackType": "curve-br" },
        { "row": 4, "col": 8, "trackType": "curve-tl" },
        { "row": 4, "col": 9, "trackType": "curve-tr" },
        { "row": 4, "col": 10, "trackType": "straight-h" },
        { "row": 4, "col": 11, "trackType": "straight-h" },
        { "row": 4, "col": 12, "trackType": "crossing-h" },
        { "row": 4, "col": 14, "trackType": "straight-h" },
        { "row": 4, "col": 15, "trackType": "curve-tl" },
        { "row": 5, "col": 1, "trackType": "curve-tr" },
        { "row": 5, "col": 2, "trackType": "straight-h" },
        { "row": 5, "col": 3, "trackType": "straight-h" },
        { "row": 5, "col": 4, "trackType": "straight-h" },
        { "row": 5, "col": 5, "trackType": "curve-tl" },
        { "row": 5, "col": 6, "trackType": "straight-v" },
        { "row": 5, "col": 7, "trackType": "straight-v" },
        { "row": 5, "col": 13, "trackType": "curve-br" },
        { "row": 5, "col": 14, "trackType": "curve-bl" },
        { "row": 6, "col": 1, "trackType": "curve-br" },
        { "row": 6, "col": 2, "trackType": "straight-h" },
        { "row": 6, "col": 3, "trackType": "straight-h" },
        { "row": 6, "col": 4, "trackType": "straight-h" },
        { "row": 6, "col": 5, "trackType": "straight-h" },
        { "row": 6, "col": 6, "trackType": "curve-tl" },
        { "row": 6, "col": 7, "trackType": "straight-v" },
        { "row": 6, "col": 8, "trackType": "curve-br" },
        { "row": 6, "col": 9, "trackType": "straight-h" },
        { "row": 6, "col": 10, "trackType": "crossing-h" },
        { "row": 6, "col": 12, "trackType": "curve-bl" },
        { "row": 6, "col": 13, "trackType": "straight-v" },
        { "row": 6, "col": 14, "trackType": "straight-v" },
        { "row": 7, "col": 1, "trackType": "straight-v" },
        { "row": 7, "col": 3, "trackType": "curve-br" },
        { "row": 7, "col": 4, "trackType": "straight-h" },
        { "row": 7, "col": 5, "trackType": "straight-h" },
        { "row": 7, "col": 6, "trackType": "straight-h" },
        { "row": 7, "col": 7, "trackType": "curve-tl" },
        { "row": 7, "col": 8, "trackType": "straight-v" },
        { "row": 7, "col": 12, "trackType": "straight-v" },
        { "row": 7, "col": 13, "trackType": "straight-v" },
        { "row": 7, "col": 14, "trackType": "straight-v" },
        { "row": 8, "col": 1, "trackType": "straight-v" },
        { "row": 8, "col": 3, "trackType": "curve-tr" },
        { "row": 8, "col": 4, "trackType": "straight-h" },
        { "row": 8, "col": 5, "trackType": "straight-h" },
        { "row": 8, "col": 6, "trackType": "straight-h" },
        { "row": 8, "col": 7, "trackType": "curve-bl" },
        { "row": 8, "col": 8, "trackType": "straight-v" },
        { "row": 8, "col": 12, "trackType": "straight-v" },
        { "row": 8, "col": 13, "trackType": "straight-v" },
        { "row": 8, "col": 14, "trackType": "straight-v" },
        { "row": 9, "col": 1, "trackType": "crossing-v" },
        { "row": 9, "col": 7, "trackType": "straight-v" },
        { "row": 9, "col": 8, "trackType": "straight-v" },
        { "row": 9, "col": 9, "trackType": "curve-br" },
        { "row": 9, "col": 10, "trackType": "curve-bl" },
        { "row": 9, "col": 12, "trackType": "curve-tr" },
        { "row": 9, "col": 13, "trackType": "curve-tl" },
        { "row": 9, "col": 14, "trackType": "straight-v" },
        { "row": 10, "col": 7, "trackType": "straight-v" },
        { "row": 10, "col": 8, "trackType": "straight-v" },
        { "row": 10, "col": 9, "trackType": "straight-v" },
        { "row": 10, "col": 10, "trackType": "straight-v" },
        { "row": 10, "col": 14, "trackType": "straight-v" },
        { "row": 11, "col": 1, "trackType": "straight-v" },
        { "row": 11, "col": 3, "trackType": "curve-br" },
        { "row": 11, "col": 4, "trackType": "straight-h" },
        { "row": 11, "col": 5, "trackType": "straight-h" },
        { "row": 11, "col": 6, "trackType": "straight-h" },
        { "row": 11, "col": 7, "trackType": "curve-tl" },
        { "row": 11, "col": 8, "trackType": "straight-v" },
        { "row": 11, "col": 9, "trackType": "straight-v" },
        { "row": 11, "col": 10, "trackType": "straight-v" },
        { "row": 11, "col": 14, "trackType": "straight-v" },
        { "row": 12, "col": 1, "trackType": "straight-v" },
        { "row": 12, "col": 3, "trackType": "straight-v" },
        { "row": 12, "col": 8, "trackType": "straight-v" },
        { "row": 12, "col": 9, "trackType": "straight-v" },
        { "row": 12, "col": 10, "trackType": "straight-v" },
        { "row": 12, "col": 14, "trackType": "straight-v" },
        { "row": 13, "col": 1, "trackType": "straight-v" },
        { "row": 13, "col": 3, "trackType": "curve-tr" },
        { "row": 13, "col": 4, "trackType": "straight-h" },
        { "row": 13, "col": 5, "trackType": "straight-h" },
        { "row": 13, "col": 6, "trackType": "straight-h" },
        { "row": 13, "col": 7, "trackType": "straight-h" },
        { "row": 13, "col": 8, "trackType": "curve-tl" },
        { "row": 13, "col": 9, "trackType": "straight-v" },
        { "row": 13, "col": 10, "trackType": "straight-v" },
        { "row": 13, "col": 14, "trackType": "straight-v" },
        { "row": 14, "col": 1, "trackType": "curve-tr" },
        { "row": 14, "col": 2, "trackType": "straight-h" },
        { "row": 14, "col": 3, "trackType": "crossing-h" },
        { "row": 14, "col": 5, "trackType": "crossing-h" },
        { "row": 14, "col": 7, "trackType": "straight-h" },
        { "row": 14, "col": 8, "trackType": "straight-h" },
        { "row": 14, "col": 9, "trackType": "curve-tl" },
        { "row": 14, "col": 10, "trackType": "curve-tr" },
        { "row": 14, "col": 11, "trackType": "straight-h" },
        { "row": 14, "col": 12, "trackType": "crossing-h" },
        { "row": 14, "col": 14, "trackType": "curve-tl" }
    ],
    "trains": [],
    "crossings": [
        { "row": 14, "col": 12, "horizontal": true },
        { "row": 14, "col": 5, "horizontal": true },
        { "row": 14, "col": 3, "horizontal": true },
        { "row": 6, "col": 10, "horizontal": true },
        { "row": 9, "col": 1, "horizontal": false },
        { "row": 4, "col": 12, "horizontal": true }
    ]
};

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

    // Make exportLayout available globally for console access
    window.exportLayout = exportLayout;

    // Load default layout if provided
    if (DEFAULT_LAYOUT) {
        loadLayout(DEFAULT_LAYOUT);
    }

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

    // Add snow effects
    createFallingSnow(groundSize);
}

function createFallingSnow(groundSize) {
    const particleCount = 1000;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Random position across the ground area, starting at various heights
        positions[i3] = Math.random() * groundSize;
        positions[i3 + 1] = Math.random() * 20 + 10; // Height between 10 and 30
        positions[i3 + 2] = Math.random() * groundSize;

        // Random fall speed (slow)
        velocities[i3] = (Math.random() - 0.5) * 0.1; // Slight horizontal drift
        velocities[i3 + 1] = -0.05 - Math.random() * 0.05; // Slow downward fall
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1; // Slight horizontal drift
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    snowParticles = new THREE.Points(geometry, material);
    snowParticles.userData.velocities = velocities;
    scene.add(snowParticles);
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
        // Check for train hits (check all segment meshes)
        const trainMeshes = [];
        trains.forEach(t => {
            t.segments.forEach(seg => trainMeshes.push(seg.mesh));
        });
        const trainIntersects = raycaster.intersectObjects(trainMeshes, true);

        if (trainIntersects.length > 0) {
            // Find which train was clicked
            const clickedMesh = trainIntersects[0].object;
            let clickedSegmentMesh = clickedMesh;

            // Traverse up to find the segment mesh
            while (clickedSegmentMesh.parent && !trains.some(t =>
                t.segments.some(seg => seg.mesh === clickedSegmentMesh)
            )) {
                clickedSegmentMesh = clickedSegmentMesh.parent;
            }

            // Delete the train
            const trainIndex = trains.findIndex(t =>
                t.segments.some(seg => seg.mesh === clickedSegmentMesh)
            );
            if (trainIndex !== -1) {
                // Remove all segment meshes
                trains[trainIndex].segments.forEach(seg => scene.remove(seg.mesh));
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

    // In car-passenger or car-caboose mode, check for trains to attach car to
    if (selectedTool === 'car-passenger' || selectedTool === 'car-caboose') {
        // Check for train hits (check all segment meshes)
        const trainMeshes = [];
        trains.forEach(t => {
            t.segments.forEach(seg => trainMeshes.push(seg.mesh));
        });
        const trainIntersects = raycaster.intersectObjects(trainMeshes, true);

        if (trainIntersects.length > 0) {
            // Find which train was clicked
            const clickedMesh = trainIntersects[0].object;
            let clickedSegmentMesh = clickedMesh;

            // Traverse up to find the segment mesh
            while (clickedSegmentMesh.parent && !trains.some(t =>
                t.segments.some(seg => seg.mesh === clickedSegmentMesh)
            )) {
                clickedSegmentMesh = clickedSegmentMesh.parent;
            }

            // Add car to the train
            const trainIndex = trains.findIndex(t =>
                t.segments.some(seg => seg.mesh === clickedSegmentMesh)
            );
            if (trainIndex !== -1) {
                addCarToTrain(trains[trainIndex], selectedTool); // Use selectedTool to get the car type
                return;
            }
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
            } else if (selectedTool === 'crossing') {
                placeCrossing(row, col);
            } else if (selectedTool === 'tunnel') {
                placeTunnel(row, col);
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
    } else if (type === 'crossing-h' || type === 'crossing-v') {
        createLevelCrossing(group, type === 'crossing-h');
    } else if (type === 'tunnel-h' || type === 'tunnel-v') {
        createTunnelTrack(group, type === 'tunnel-h');
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
    const sleeperLength = SLEEPER_LENGTH;

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

function createTunnelTrack(group, horizontal) {
    // Create the base straight track first
    createStraightTrack(group, horizontal);

    // Add tunnel covering
    const trackLength = CELL_SIZE * 0.99;
    const tunnelHeight = 1.1;
    const tunnelWidth = 1.0;
    const wallThickness = 0.18;

    // Main tunnel material (dark stone)
    const tunnelMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.95,
        metalness: 0.02
    });

    if (horizontal) {
        // Left wall
        const leftWallGeometry = new THREE.BoxGeometry(trackLength, tunnelHeight, wallThickness);
        const leftWall = new THREE.Mesh(leftWallGeometry, tunnelMaterial);
        leftWall.position.set(0, tunnelHeight / 2, -tunnelWidth / 2);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        group.add(leftWall);

        // Right wall
        const rightWallGeometry = new THREE.BoxGeometry(trackLength, tunnelHeight, wallThickness);
        const rightWall = new THREE.Mesh(rightWallGeometry, tunnelMaterial);
        rightWall.position.set(0, tunnelHeight / 2, tunnelWidth / 2);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        group.add(rightWall);

        // Arched roof - smoother curve with more segments
        const segments = 12;
        for (let i = 0; i < segments; i++) {
            const angle1 = (Math.PI / segments) * i;
            const angle2 = (Math.PI / segments) * (i + 1);

            const archSegmentGeometry = new THREE.BoxGeometry(
                trackLength,
                wallThickness,
                (tunnelWidth / 2) * (angle2 - angle1) + 0.01
            );
            const archSegment = new THREE.Mesh(archSegmentGeometry, tunnelMaterial);

            const avgAngle = (angle1 + angle2) / 2;
            archSegment.position.set(
                0,
                tunnelHeight + Math.sin(avgAngle) * (tunnelWidth / 2),
                Math.cos(avgAngle) * (tunnelWidth / 2)
            );
            archSegment.rotation.x = -avgAngle;
            archSegment.castShadow = true;
            archSegment.receiveShadow = true;
            group.add(archSegment);
        }

    } else {
        // Vertical orientation
        // Left wall (west)
        const leftWallGeometry = new THREE.BoxGeometry(wallThickness, tunnelHeight, trackLength);
        const leftWall = new THREE.Mesh(leftWallGeometry, tunnelMaterial);
        leftWall.position.set(-tunnelWidth / 2, tunnelHeight / 2, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        group.add(leftWall);

        // Right wall (east)
        const rightWallGeometry = new THREE.BoxGeometry(wallThickness, tunnelHeight, trackLength);
        const rightWall = new THREE.Mesh(rightWallGeometry, tunnelMaterial);
        rightWall.position.set(tunnelWidth / 2, tunnelHeight / 2, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        group.add(rightWall);

        // Arched roof - smoother curve
        const segments = 12;
        for (let i = 0; i < segments; i++) {
            const angle1 = (Math.PI / segments) * i;
            const angle2 = (Math.PI / segments) * (i + 1);

            const archSegmentGeometry = new THREE.BoxGeometry(
                (tunnelWidth / 2) * (angle2 - angle1) + 0.01,
                wallThickness,
                trackLength
            );
            const archSegment = new THREE.Mesh(archSegmentGeometry, tunnelMaterial);

            const avgAngle = (angle1 + angle2) / 2;
            archSegment.position.set(
                Math.cos(avgAngle) * (tunnelWidth / 2),
                tunnelHeight + Math.sin(avgAngle) * (tunnelWidth / 2),
                0
            );
            archSegment.rotation.z = avgAngle;
            archSegment.castShadow = true;
            archSegment.receiveShadow = true;
            group.add(archSegment);
        }
    }
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

    // Rails (curved) - using ExtrudeGeometry for flat tops
    const railMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.7,
        roughness: 0.3
    });

    // Create a rectangular cross-section shape for the rail (flat top)
    // Match the straight track rail dimensions: 0.1 wide × RAIL_HEIGHT (0.05) tall
    const railWidth = 0.1;
    const railHeight = RAIL_HEIGHT;
    const railCrossSection = new THREE.Shape();
    railCrossSection.moveTo(-railHeight / 2, -railWidth / 2);
    railCrossSection.lineTo(railHeight / 2, -railWidth / 2);
    railCrossSection.lineTo(railHeight / 2, railWidth / 2);
    railCrossSection.lineTo(-railHeight / 2, railWidth / 2);
    railCrossSection.lineTo(-railHeight / 2, -railWidth / 2);

    // Inner rail
    const innerRailCurve = new THREE.EllipseCurve(
        centerX, centerZ,
        R - TRACK_WIDTH / 2, R - TRACK_WIDTH / 2,
        startAngle, endAngle,
        false,
        0
    );
    const innerRailPoints = innerRailCurve.getPoints(segments);
    const innerRailPath = new THREE.CatmullRomCurve3(
        innerRailPoints.map(p => new THREE.Vector3(p.x, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, p.y))
    );

    const innerRailGeometry = new THREE.ExtrudeGeometry(railCrossSection, {
        steps: segments,
        bevelEnabled: false,
        extrudePath: innerRailPath
    });
    const innerRailMesh = new THREE.Mesh(innerRailGeometry, railMaterial);
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
    const outerRailPath = new THREE.CatmullRomCurve3(
        outerRailPoints.map(p => new THREE.Vector3(p.x, SLEEPER_HEIGHT + RAIL_HEIGHT / 2, p.y))
    );

    const outerRailGeometry = new THREE.ExtrudeGeometry(railCrossSection, {
        steps: segments,
        bevelEnabled: false,
        extrudePath: outerRailPath
    });
    const outerRailMesh = new THREE.Mesh(outerRailGeometry, railMaterial);
    outerRailMesh.castShadow = true;
    group.add(outerRailMesh);
}

function createLevelCrossing(group, horizontal) {
    // Double length track
    const trackLength = CELL_SIZE * 2 * 0.99;
    const sleeperCount = 10;
    const sleeperSpacing = trackLength / (sleeperCount - 1);
    const sleeperWidth = 0.15;
    const sleeperLength = SLEEPER_LENGTH;

    // Sleepers
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

    // Rails
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

    // ROAD CROSSING THE TRACKS
    // Gray pavement with yellow warning stripes
    const pavementMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.9
    });
    const yellowStripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        roughness: 0.8
    });
    const blackStripeMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9
    });

    // Main road surface (perpendicular to tracks)
    const roadWidth = 1.6;
    const roadGeometry = new THREE.BoxGeometry(
        horizontal ? trackLength : roadWidth,
        0.03,
        horizontal ? roadWidth : trackLength
    );
    const roadSurface = new THREE.Mesh(roadGeometry, pavementMaterial);
    roadSurface.position.set(0, 0.02, 0);
    roadSurface.receiveShadow = true;
    group.add(roadSurface);

    // Yellow and black diagonal warning stripes on the road
    const stripeWidth = 0.15;
    const stripeCount = 12;

    for (let i = 0; i < stripeCount; i++) {
        const isYellow = i % 2 === 0;
        const stripeGeometry = new THREE.BoxGeometry(
            horizontal ? stripeWidth : roadWidth * 0.9,
            0.031,
            horizontal ? roadWidth * 0.9 : stripeWidth
        );
        const stripe = new THREE.Mesh(stripeGeometry, isYellow ? yellowStripeMaterial : blackStripeMaterial);

        if (horizontal) {
            stripe.position.set(-trackLength / 2 + (i + 0.5) * (trackLength / stripeCount), 0.021, 0);
        } else {
            stripe.position.set(0, 0.021, -trackLength / 2 + (i + 0.5) * (trackLength / stripeCount));
        }
        group.add(stripe);
    }

    // CROSSING SIGNALS
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5,
        roughness: 0.6
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });
    const blackMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a
    });

    const lights = [];

    // Create signals on both sides
    if (horizontal) {
        // Left side signal (moved farther left, opposite to arm direction)
        const poleLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), poleMaterial);
        poleLeft.position.set(-1.0, 0.6, -0.9);
        poleLeft.castShadow = true;
        group.add(poleLeft);

        // Crossbuck sign (X shape)
        const crossbuckLeft = new THREE.Group();
        const signBoard1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.02), whiteMaterial);
        signBoard1.rotation.z = Math.PI / 4;
        const signBoard2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.02), whiteMaterial);
        signBoard2.rotation.z = -Math.PI / 4;
        const signBorder1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.015), blackMaterial);
        signBorder1.rotation.z = Math.PI / 4;
        signBorder1.position.z = -0.01;
        const signBorder2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.015), blackMaterial);
        signBorder2.rotation.z = -Math.PI / 4;
        signBorder2.position.z = -0.01;
        crossbuckLeft.add(signBorder1, signBorder2, signBoard1, signBoard2);
        crossbuckLeft.position.set(-1.0, 0.9, -0.9);
        group.add(crossbuckLeft);

        // Flashing lights housing
        const lightBoxLeft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8),
            blackMaterial
        );
        lightBoxLeft.position.set(-1.0, 1.15, -0.9);
        group.add(lightBoxLeft);

        // Red lights (will flash) - facing track side
        const lightLeft1Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightLeft1Front.position.set(-1.0, 1.22, -0.82);
        lightLeft1Front.rotation.y = Math.PI;
        group.add(lightLeft1Front);
        lights.push(lightLeft1Front);

        const lightLeft2Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightLeft2Front.position.set(-1.0, 1.08, -0.82);
        lightLeft2Front.rotation.y = Math.PI;
        group.add(lightLeft2Front);
        lights.push(lightLeft2Front);

        // Red lights - facing road side (opposite direction)
        const lightLeft1Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightLeft1Back.position.set(-1.0, 1.22, -0.98);
        lightLeft1Back.rotation.y = 0;
        group.add(lightLeft1Back);
        lights.push(lightLeft1Back);

        const lightLeft2Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightLeft2Back.position.set(-1.0, 1.08, -0.98);
        lightLeft2Back.rotation.y = 0;
        group.add(lightLeft2Back);
        lights.push(lightLeft2Back);

        // Right side signal (mirror, symmetric to left post)
        const poleRight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), poleMaterial);
        poleRight.position.set(1.0, 0.6, 0.9);
        poleRight.castShadow = true;
        group.add(poleRight);

        const crossbuckRight = crossbuckLeft.clone();
        crossbuckRight.position.set(1.0, 0.9, 0.9);
        group.add(crossbuckRight);

        const lightBoxRight = lightBoxLeft.clone();
        lightBoxRight.position.set(1.0, 1.15, 0.9);
        group.add(lightBoxRight);

        // Right side lights - facing track side
        const lightRight1Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightRight1Front.position.set(1.0, 1.22, 0.82);
        lightRight1Front.rotation.y = 0;
        group.add(lightRight1Front);
        lights.push(lightRight1Front);

        const lightRight2Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightRight2Front.position.set(1.0, 1.08, 0.82);
        lightRight2Front.rotation.y = 0;
        group.add(lightRight2Front);
        lights.push(lightRight2Front);

        // Right side lights - facing road side (opposite direction)
        const lightRight1Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightRight1Back.position.set(1.0, 1.22, 0.98);
        lightRight1Back.rotation.y = Math.PI;
        group.add(lightRight1Back);
        lights.push(lightRight1Back);

        const lightRight2Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightRight2Back.position.set(1.0, 1.08, 0.98);
        lightRight2Back.rotation.y = Math.PI;
        group.add(lightRight2Back);
        lights.push(lightRight2Back);
    } else {
        // Vertical orientation (track runs vertically)
        const poleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), poleMaterial);
        poleTop.position.set(-0.9, 0.6, -1.0);
        poleTop.castShadow = true;
        group.add(poleTop);

        const crossbuckTop = new THREE.Group();
        const signBoard1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.02), whiteMaterial);
        signBoard1.rotation.z = Math.PI / 4;
        const signBoard2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.02), whiteMaterial);
        signBoard2.rotation.z = -Math.PI / 4;
        const signBorder1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.015), blackMaterial);
        signBorder1.rotation.z = Math.PI / 4;
        signBorder1.position.z = -0.01;
        const signBorder2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.015), blackMaterial);
        signBorder2.rotation.z = -Math.PI / 4;
        signBorder2.position.z = -0.01;
        crossbuckTop.add(signBorder1, signBorder2, signBoard1, signBoard2);
        crossbuckTop.rotation.y = Math.PI / 2; // Rotate to face the road in vertical orientation
        crossbuckTop.position.set(-0.9, 0.9, -1.0);
        group.add(crossbuckTop);

        const lightBoxTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8),
            blackMaterial
        );
        lightBoxTop.position.set(-0.9, 1.15, -1.0);
        group.add(lightBoxTop);

        // Top pole lights - facing track side
        const lightTop1Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightTop1Front.position.set(-0.82, 1.22, -1.0);
        lightTop1Front.rotation.y = Math.PI / 2;
        group.add(lightTop1Front);
        lights.push(lightTop1Front);

        const lightTop2Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightTop2Front.position.set(-0.82, 1.08, -1.0);
        lightTop2Front.rotation.y = Math.PI / 2;
        group.add(lightTop2Front);
        lights.push(lightTop2Front);

        // Top pole lights - facing road side (opposite direction)
        const lightTop1Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightTop1Back.position.set(-0.98, 1.22, -1.0);
        lightTop1Back.rotation.y = -Math.PI / 2;
        group.add(lightTop1Back);
        lights.push(lightTop1Back);

        const lightTop2Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightTop2Back.position.set(-0.98, 1.08, -1.0);
        lightTop2Back.rotation.y = -Math.PI / 2;
        group.add(lightTop2Back);
        lights.push(lightTop2Back);

        const poleBottom = poleTop.clone();
        poleBottom.position.set(0.9, 0.6, 1.0);
        group.add(poleBottom);

        const crossbuckBottom = crossbuckTop.clone();
        crossbuckBottom.rotation.y = Math.PI / 2; // Rotate to face the road in vertical orientation
        crossbuckBottom.position.set(0.9, 0.9, 1.0);
        group.add(crossbuckBottom);

        const lightBoxBottom = lightBoxTop.clone();
        lightBoxBottom.position.set(0.9, 1.15, 1.0);
        group.add(lightBoxBottom);

        // Bottom pole lights - facing track side
        const lightBottom1Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightBottom1Front.position.set(0.82, 1.22, 1.0);
        lightBottom1Front.rotation.y = -Math.PI / 2;
        group.add(lightBottom1Front);
        lights.push(lightBottom1Front);

        const lightBottom2Front = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightBottom2Front.position.set(0.82, 1.08, 1.0);
        lightBottom2Front.rotation.y = -Math.PI / 2;
        group.add(lightBottom2Front);
        lights.push(lightBottom2Front);

        // Bottom pole lights - facing road side (opposite direction)
        const lightBottom1Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightBottom1Back.position.set(0.98, 1.22, 1.0);
        lightBottom1Back.rotation.y = Math.PI / 2;
        group.add(lightBottom1Back);
        lights.push(lightBottom1Back);

        const lightBottom2Back = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0
            })
        );
        lightBottom2Back.position.set(0.98, 1.08, 1.0);
        lightBottom2Back.rotation.y = Math.PI / 2;
        group.add(lightBottom2Back);
        lights.push(lightBottom2Back);
    }

    // BARRIER ARMS that block the road
    const barrierArmMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });
    const barrierRedStripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        roughness: 0.3
    });

    const arms = [];

    if (horizontal) {
        // Left side arm
        const armLeftGroup = new THREE.Group();
        const armLeftBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.08), barrierArmMaterial);
        armLeftBar.position.set(0.6, 0, 0);

        // Red stripes
        for (let i = 0; i < 4; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.061, 0.081),
                barrierRedStripeMaterial
            );
            stripe.position.set(0.2 + i * 0.28, 0, 0);
            armLeftGroup.add(stripe);
        }

        armLeftGroup.add(armLeftBar);
        armLeftGroup.position.set(-1.0, 0.7, -0.9);
        armLeftGroup.rotation.z = Math.PI / 2; // Start in up position (vertical)
        armLeftGroup.userData.upRotation = Math.PI / 2; // Up position (vertical)
        armLeftGroup.userData.horizontalRotation = 0; // Horizontal pointing right (train present)
        group.add(armLeftGroup);
        arms.push(armLeftGroup);

        // Right side arm
        const armRightGroup = new THREE.Group();
        const armRightBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.08), barrierArmMaterial);
        armRightBar.position.set(0.6, 0, 0);

        for (let i = 0; i < 4; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.061, 0.081),
                barrierRedStripeMaterial
            );
            stripe.position.set(0.2 + i * 0.28, 0, 0);
            armRightGroup.add(stripe);
        }

        armRightGroup.add(armRightBar);
        armRightGroup.position.set(1.0, 0.7, 0.9);
        armRightGroup.rotation.z = Math.PI / 2; // Start in up position (vertical)
        armRightGroup.userData.upRotation = Math.PI / 2; // Up position (vertical)
        armRightGroup.userData.horizontalRotation = Math.PI; // Horizontal pointing left (train present, opposite direction)
        group.add(armRightGroup);
        arms.push(armRightGroup);
    } else {
        // Top side arm (vertical orientation means track runs vertically)
        // Wrap in a parent group to apply 90-degree rotation to the entire assembly
        const armTopWrapper = new THREE.Group();
        const armTopGroup = new THREE.Group();
        const armTopBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.08), barrierArmMaterial);
        armTopBar.position.set(0.6, 0, 0);

        for (let i = 0; i < 4; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.061, 0.081),
                barrierRedStripeMaterial
            );
            stripe.position.set(0.2 + i * 0.28, 0, 0);
            armTopGroup.add(stripe);
        }

        armTopGroup.add(armTopBar);
        armTopGroup.rotation.z = Math.PI / 2; // Start in up position (vertical)
        armTopGroup.userData.upRotation = Math.PI / 2; // Up position (vertical)
        armTopGroup.userData.horizontalRotation = 0; // Horizontal pointing right (train present)
        armTopWrapper.add(armTopGroup);
        armTopWrapper.position.set(-0.9, 0.7, -1.0);
        armTopWrapper.rotation.y = -Math.PI / 2; // Rotate entire assembly 90 degrees
        group.add(armTopWrapper);
        arms.push(armTopGroup);

        // Bottom side arm
        const armBottomWrapper = new THREE.Group();
        const armBottomGroup = new THREE.Group();
        const armBottomBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.08), barrierArmMaterial);
        armBottomBar.position.set(0.6, 0, 0);

        for (let i = 0; i < 4; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.061, 0.081),
                barrierRedStripeMaterial
            );
            stripe.position.set(0.2 + i * 0.28, 0, 0);
            armBottomGroup.add(stripe);
        }

        armBottomGroup.add(armBottomBar);
        armBottomGroup.rotation.z = Math.PI / 2; // Start in up position (vertical)
        armBottomGroup.userData.upRotation = Math.PI / 2; // Up position (vertical)
        armBottomGroup.userData.horizontalRotation = Math.PI; // Horizontal pointing left (train present, opposite direction)
        armBottomWrapper.add(armBottomGroup);
        armBottomWrapper.position.set(0.9, 0.7, 1.0);
        armBottomWrapper.rotation.y = -Math.PI / 2; // Rotate entire assembly 90 degrees
        group.add(armBottomWrapper);
        arms.push(armBottomGroup);
    }

    // Store lights and arms for animation
    group.userData.lights = lights;
    group.userData.arms = arms;
    group.userData.horizontal = horizontal;
    group.userData.lightState = 0; // For alternating flash
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

function createEngineMesh(engineType) {
    // Create engine mesh (no longer a group with cars)
    let engineMesh;
    if (engineType === 'engine-steam') {
        engineMesh = createSteamEngine();
        // Add smoke particle system
        const smokeSystem = createSmokeParticles();
        smokeSystem.position.set(0, 0.91, 0.42); // Position at the top of smokestack
        engineMesh.add(smokeSystem);
        engineMesh.userData.smokeSystem = smokeSystem;
    } else if (engineType === 'engine-diesel') {
        engineMesh = createDieselEngine();
    } else if (engineType === 'engine-bullet') {
        engineMesh = createBulletEngine();
    }

    return engineMesh;
}

function createCarMesh(carType) {
    if (carType === 'car-passenger') {
        return createPassengerCar();
    } else if (carType === 'car-freight') {
        return createFreightCar();
    } else if (carType === 'car-caboose') {
        return createCaboose();
    }
    return null;
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

    // Lift entire car higher
    const verticalOffset = 0.10;

    // Body (light blue)
    const bodyGeometry = new THREE.BoxGeometry(0.55, 0.45, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.325 + verticalOffset;
    body.castShadow = true;
    group.add(body);

    // Windows (darker blue squares) - slightly outside body to avoid z-fighting
    const windowGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.02);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x4682B4 });
    const bodyHalfWidth = 0.55 / 2; // Body is 0.55 wide, so edge is at ±0.275
    const windowXPos = bodyHalfWidth + 0.001; // Position slightly outside to prevent flickering

    // Position windows evenly along body length (body is 0.8 long, from -0.4 to +0.4)
    const windowZPositions = [-0.25, 0, 0.25]; // Keep windows within body bounds

    for (let i = 0; i < 3; i++) {
        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
        window1.position.set(windowXPos, 0.4 + verticalOffset, windowZPositions[i]);
        window1.rotation.y = Math.PI / 2;
        group.add(window1);

        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(-windowXPos, 0.4 + verticalOffset, windowZPositions[i]);
        window2.rotation.y = -Math.PI / 2;
        group.add(window2);
    }

    // Wheels - narrower gauge (closer together side-to-side), but wider for visibility
    const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12); // Slightly narrower to avoid body overlap
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const wheelPositions = [
        [-0.21, 0.12 + verticalOffset, 0.2],   // Front left - moved out slightly to avoid z-fighting
        [0.21, 0.12 + verticalOffset, 0.2],    // Front right - moved out slightly to avoid z-fighting
        [-0.21, 0.12 + verticalOffset, -0.2],  // Rear left - moved out slightly to avoid z-fighting
        [0.21, 0.12 + verticalOffset, -0.2]    // Rear right - moved out slightly to avoid z-fighting
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
    });

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

function createCaboose() {
    const group = new THREE.Group();

    // Same vertical offset as passenger car
    const verticalOffset = 0.10;

    // Main body (red)
    const bodyGeometry = new THREE.BoxGeometry(0.55, 0.35, 0.8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xCC0000 }); // Classic caboose red
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.275 + verticalOffset;
    body.castShadow = true;
    group.add(body);

    // Cupola (observation deck on top)
    const cupolaGeometry = new THREE.BoxGeometry(0.35, 0.20, 0.40);
    const cupolaMaterial = new THREE.MeshLambertMaterial({ color: 0xAA0000 }); // Darker red
    const cupola = new THREE.Mesh(cupolaGeometry, cupolaMaterial);
    cupola.position.y = 0.55 + verticalOffset;
    cupola.castShadow = true;
    group.add(cupola);

    // Cupola windows (small windows all around)
    const cupolaWindowGeometry = new THREE.BoxGeometry(0.10, 0.10, 0.02);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold/yellow windows

    // Front and back cupola windows
    const frontCupolaWindow = new THREE.Mesh(cupolaWindowGeometry, windowMaterial);
    frontCupolaWindow.position.set(0, 0.55 + verticalOffset, 0.21);
    group.add(frontCupolaWindow);

    const backCupolaWindow = new THREE.Mesh(cupolaWindowGeometry, windowMaterial);
    backCupolaWindow.position.set(0, 0.55 + verticalOffset, -0.21);
    group.add(backCupolaWindow);

    // Side cupola windows
    const leftCupolaWindow = new THREE.Mesh(cupolaWindowGeometry, windowMaterial);
    leftCupolaWindow.position.set(-0.176, 0.55 + verticalOffset, 0);
    leftCupolaWindow.rotation.y = Math.PI / 2;
    group.add(leftCupolaWindow);

    const rightCupolaWindow = new THREE.Mesh(cupolaWindowGeometry, windowMaterial);
    rightCupolaWindow.position.set(0.176, 0.55 + verticalOffset, 0);
    rightCupolaWindow.rotation.y = Math.PI / 2;
    group.add(rightCupolaWindow);

    // Main body windows (side windows)
    const bodyWindowGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.02);
    const bodyHalfWidth = 0.55 / 2;
    const windowXPos = bodyHalfWidth + 0.001;

    const windowZPositions = [0.25, -0.25]; // Front and back windows

    for (let i = 0; i < windowZPositions.length; i++) {
        const window1 = new THREE.Mesh(bodyWindowGeometry, windowMaterial);
        window1.position.set(windowXPos, 0.3 + verticalOffset, windowZPositions[i]);
        window1.rotation.y = Math.PI / 2;
        group.add(window1);

        const window2 = new THREE.Mesh(bodyWindowGeometry, windowMaterial);
        window2.position.set(-windowXPos, 0.3 + verticalOffset, windowZPositions[i]);
        window2.rotation.y = -Math.PI / 2;
        group.add(window2);
    }

    // Rear platform/railing
    const platformGeometry = new THREE.BoxGeometry(0.50, 0.03, 0.15);
    const platformMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(0, 0.13 + verticalOffset, -0.475);
    group.add(platform);

    // Railing posts
    const railingPostGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
    const railingMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold railing

    const leftPost = new THREE.Mesh(railingPostGeometry, railingMaterial);
    leftPost.position.set(-0.20, 0.25 + verticalOffset, -0.475);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(railingPostGeometry, railingMaterial);
    rightPost.position.set(0.20, 0.25 + verticalOffset, -0.475);
    group.add(rightPost);

    // Wheels - same as passenger car
    const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const wheelPositions = [
        [-0.21, 0.12 + verticalOffset, 0.2],
        [0.21, 0.12 + verticalOffset, 0.2],
        [-0.21, 0.12 + verticalOffset, -0.2],
        [0.21, 0.12 + verticalOffset, -0.2]
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
    });

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
// CAR ATTACHMENT
// ============================================================================

function addCarToTrain(train, carType) {
    // Get the last segment of the train
    const lastSegment = train.segments[train.segments.length - 1];

    // Create new car mesh
    const carMesh = createCarMesh(carType);

    // Calculate initial position for the new car (behind last segment)
    // Use different spacing for first car vs subsequent cars
    const segmentIndex = train.segments.length;
    const spacing = (segmentIndex === 1) ? ENGINE_TO_CAR_SPACING : SEGMENT_SPACING;
    const targetDistanceBehind = spacing / CELL_SIZE; // in cell units

    let targetProgress = lastSegment.progress - targetDistanceBehind;
    let targetRow = lastSegment.row;
    let targetCol = lastSegment.col;
    let targetEnterDir = lastSegment.enterDir;
    let targetDir = lastSegment.dir;

    // If target progress is negative, we need to go back to previous cell(s)
    while (targetProgress < 0) {
        targetProgress += 1.0;

        // Move back one cell
        const prevState = getPreviousState(targetRow, targetCol, targetEnterDir);
        if (!prevState) {
            // Can't go further back, just use current position
            targetProgress = 0;
            break;
        }

        targetRow = prevState.row;
        targetCol = prevState.col;
        targetEnterDir = prevState.enterDir;
        targetDir = prevState.dir;
    }

    const newSegment = {
        type: carType,
        mesh: carMesh,
        row: targetRow,
        col: targetCol,
        dir: targetDir,
        enterDir: targetEnterDir,
        progress: targetProgress
    };

    // Position the car mesh at the calculated position
    scene.add(carMesh);
    updateSegmentPosition(newSegment);

    // Add to train segments
    train.segments.push(newSegment);

    // Play sound feedback
    playSound('place');
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
        // Check if this is a crossing
        if (cell.trackType && cell.trackType.startsWith('crossing-')) {
            const crossingMesh = cell.mesh;
            const isHorizontal = cell.trackType === 'crossing-h';

            // Get the starting cell of the crossing
            const startRow = cell.crossingRow !== undefined ? cell.crossingRow : row;
            const startCol = cell.crossingCol !== undefined ? cell.crossingCol : col;

            // Find and remove from crossings array
            const crossingIndex = crossings.findIndex(c =>
                c.row === startRow && c.col === startCol && c.mesh === crossingMesh
            );
            if (crossingIndex !== -1) {
                const crossing = crossings[crossingIndex];
                // Stop any playing sound
                if (crossing.dingSound && !crossing.dingSound.paused) {
                    crossing.dingSound.pause();
                }
                crossings.splice(crossingIndex, 1);
            }

            // Remove mesh from scene
            scene.remove(crossingMesh);

            // Clear both cells of the crossing
            grid[startRow][startCol] = { kind: null };
            const endRow = isHorizontal ? startRow : startRow + 1;
            const endCol = isHorizontal ? startCol + 1 : startCol;
            if (endRow < GRID_SIZE && endCol < GRID_SIZE) {
                grid[endRow][endCol] = { kind: null };
            }

            // Remove any trains at either location
            trains = trains.filter(train => {
                const engineSeg = train.segments[0];
                if ((engineSeg.row === startRow && engineSeg.col === startCol) ||
                    (engineSeg.row === endRow && engineSeg.col === endCol)) {
                    // Remove all segment meshes
                    train.segments.forEach(seg => scene.remove(seg.mesh));
                    return false;
                }
                return true;
            });
        } else {
            // Regular track
            if (cell.mesh) {
                scene.remove(cell.mesh);
            }
            grid[row][col] = { kind: null };

            // Remove any trains at this location
            trains = trains.filter(train => {
                const engineSeg = train.segments[0];
                if (engineSeg.row === row && engineSeg.col === col) {
                    // Remove all segment meshes
                    train.segments.forEach(seg => scene.remove(seg.mesh));
                    return false;
                }
                return true;
            });
        }

        playSound('place');
        updateSteamEngineSound();
    }
}

function getTrackAt(row, col) {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return null;
    }
    const cell = grid[row][col];
    if (cell && cell.kind === 'track') {
        return cell;
    }
    return null;
}

function placeCrossing(row, col) {
    // Determine orientation based on neighbors
    const north = getTrackAt(row - 1, col);
    const south = getTrackAt(row + 1, col);
    const east = getTrackAt(row, col + 1);
    const west = getTrackAt(row, col - 1);

    const hasVertical = (north && north.trackType && north.trackType.includes('-v')) ||
        (south && south.trackType && south.trackType.includes('-v'));
    const hasHorizontal = (east && east.trackType && east.trackType.includes('-h')) ||
        (west && west.trackType && west.trackType.includes('-h'));

    let horizontal = !hasVertical; // Default to horizontal unless vertical tracks detected
    if (hasHorizontal && !hasVertical) horizontal = true;

    const trackType = horizontal ? 'crossing-h' : 'crossing-v';

    // Check if there's space for 2-cell crossing
    const nextRow = horizontal ? row : row + 1;
    const nextCol = horizontal ? col + 1 : col;

    if (nextRow >= GRID_SIZE || nextCol >= GRID_SIZE) {
        console.log('Not enough space for crossing');
        return;
    }

    // Check if second cell already has a crossing
    const nextCell = grid[nextRow][nextCol];
    if (nextCell && nextCell.trackType && nextCell.trackType.startsWith('crossing-')) {
        console.log('Cannot place crossing here - already occupied by another crossing');
        return;
    }

    // Remove existing tracks in both cells (but be careful with crossings)
    const currentCell = grid[row][col];
    if (currentCell && currentCell.mesh) {
        // If current cell is part of a crossing, delete the whole crossing first
        if (currentCell.trackType && currentCell.trackType.startsWith('crossing-')) {
            deleteTrack(row, col);
        } else {
            scene.remove(currentCell.mesh);
        }
    }

    if (nextCell && nextCell.mesh) {
        // If next cell is part of a crossing, delete it
        if (nextCell.trackType && nextCell.trackType.startsWith('crossing-')) {
            deleteTrack(nextRow, nextCol);
        } else {
            scene.remove(nextCell.mesh);
        }
    }

    // Create crossing
    const crossingMesh = createTrackMesh(trackType);

    // Position at the center of the two cells
    const centerX = (col + nextCol) * CELL_SIZE / 2 + CELL_SIZE / 2;
    const centerZ = (row + nextRow) * CELL_SIZE / 2 + CELL_SIZE / 2;

    crossingMesh.position.set(centerX, 0, centerZ);
    scene.add(crossingMesh);

    // Mark both cells as having this crossing
    grid[row][col] = {
        kind: 'track',
        trackType: trackType,
        mesh: crossingMesh,
        isCrossingStart: true,
        crossingRow: row,
        crossingCol: col
    };
    grid[nextRow][nextCol] = {
        kind: 'track',
        trackType: trackType,
        mesh: crossingMesh,
        isCrossingEnd: true,
        crossingRow: row,
        crossingCol: col
    };

    // Create dedicated ding sound for this crossing
    const crossingDingSound = new Audio('./sounds/dingding.mp3');
    crossingDingSound.volume = 0.7;
    crossingDingSound.loop = true;
    crossingDingSound.load();

    // Add to crossings array for animation
    crossings.push({
        row: row,
        col: col,
        mesh: crossingMesh,
        active: false,
        dingSound: crossingDingSound,
        horizontal: horizontal,
        lightTimer: 0,
        deactivateTimer: 0
    });

    playSound('place');
}

function placeTunnel(row, col) {
    const cell = grid[row][col];

    // Must be on a straight track (not curve, crossing, or empty)
    if (!cell || cell.kind !== 'track') {
        console.log('No track at this location');
        return;
    }

    if (cell.trackType !== 'straight-h' && cell.trackType !== 'straight-v') {
        console.log('Tunnel can only be placed on straight tracks');
        return;
    }

    // Determine orientation
    const isHorizontal = cell.trackType === 'straight-h';
    const trackType = isHorizontal ? 'tunnel-h' : 'tunnel-v';

    // Remove existing track
    if (cell.mesh) {
        scene.remove(cell.mesh);
    }

    // Create tunnel track
    const tunnelMesh = createTrackMesh(trackType);
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const z = row * CELL_SIZE + CELL_SIZE / 2;
    tunnelMesh.position.set(x, 0, z);
    scene.add(tunnelMesh);

    // Update grid
    grid[row][col] = {
        kind: 'track',
        trackType: trackType,
        mesh: tunnelMesh
    };

    playSound('place');
}

function placeTrain(row, col, engineType) {
    const cell = grid[row][col];

    // Must be on a track
    if (!cell || cell.kind !== 'track') {
        return;
    }

    // Remove any existing train at this location
    trains = trains.filter(train => {
        const engineSeg = train.segments[0];
        if (engineSeg.row === row && engineSeg.col === col) {
            // Remove all segment meshes
            train.segments.forEach(seg => scene.remove(seg.mesh));
            return false;
        }
        return true;
    });

    // Create engine mesh
    const engineMesh = createEngineMesh(engineType);

    // Determine initial direction based on track type
    let initialDir = DIR.RIGHT;
    let initialEnterDir = DIR.RIGHT; // Same as travel direction
    if (cell.trackType === 'straight-v' || cell.trackType === 'crossing-v' || cell.trackType === 'tunnel-v') {
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

    if (cell.trackType === 'straight-h' || cell.trackType === 'crossing-h' || cell.trackType === 'tunnel-h') {
        if (initialEnterDir === DIR.RIGHT) {
            startX = cellCenterX - CELL_SIZE / 2; // Left edge
        } else if (initialEnterDir === DIR.LEFT) {
            startX = cellCenterX + CELL_SIZE / 2; // Right edge
        }
    } else if (cell.trackType === 'straight-v' || cell.trackType === 'crossing-v' || cell.trackType === 'tunnel-v') {
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

    engineMesh.position.set(startX, 0.08, startZ);
    engineMesh.rotation.y = getRotationForDirection(initialEnterDir);
    scene.add(engineMesh);

    // Create train with segments array
    trains.push({
        segments: [{
            type: engineType,
            mesh: engineMesh,
            row,
            col,
            dir: initialDir,
            enterDir: initialEnterDir,
            progress: 0
        }],
        speed: 1.5, // cells per second
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
        // Update smoke particles for steam engines (on engine segment)
        const engineSeg = train.segments[0];
        if (engineSeg.mesh.userData.smokeSystem) {
            const shouldEmitSmoke = isPlaying && !train.stopped;
            // Check if engine is in a tunnel
            const cell = grid[engineSeg.row][engineSeg.col];
            const isInTunnel = cell && (cell.trackType === 'tunnel-h' || cell.trackType === 'tunnel-v');
            updateSmokeParticles(engineSeg.mesh.userData.smokeSystem, delta, shouldEmitSmoke, isInTunnel);
        }

        if (!isPlaying) return;

        // Don't move if train has stopped at end of track
        if (train.stopped) {
            return;
        }

        // Move engine segment (leader)
        const engineCell = grid[engineSeg.row][engineSeg.col];
        if (!engineCell || engineCell.kind !== 'track') {
            return; // Train is stuck
        }

        engineSeg.progress += train.speed * delta;

        if (engineSeg.progress >= 1.0) {
            // Move engine to next cell
            engineSeg.progress = 0;
            moveSegmentToNextCell(engineSeg, train);
        }

        // Update engine position
        updateSegmentPosition(engineSeg);

        // Move each car segment to follow the one in front
        for (let i = 1; i < train.segments.length; i++) {
            const segment = train.segments[i];
            const leadSegment = train.segments[i - 1];

            // Follow the lead segment (pass segment index for spacing calculation)
            followLeadSegment(segment, leadSegment, train, i);
            updateSegmentPosition(segment);
        }
    });
}

function updateSmokeParticles(smokeSystem, delta, shouldEmit, isInTunnel) {
    if (!smokeSystem) return;

    const positions = smokeSystem.geometry.attributes.position.array;
    const velocities = smokeSystem.userData.velocities;
    const lifetimes = smokeSystem.userData.lifetimes;
    const particleCount = positions.length / 3;

    // Tunnel ceiling height (relative to smoke system origin)
    const tunnelCeilingHeight = 0.2; // Approximately 1.1 tunnel height - 0.91 smokestack position

    // Update existing particles
    for (let i = 0; i < particleCount; i++) {
        if (lifetimes[i] > 0) {
            // Update position
            positions[i * 3] += velocities[i].x * delta;
            positions[i * 3 + 1] += velocities[i].y * delta;
            positions[i * 3 + 2] += velocities[i].z * delta;

            // Cap smoke at tunnel ceiling if in tunnel
            if (isInTunnel && positions[i * 3 + 1] > tunnelCeilingHeight) {
                positions[i * 3 + 1] = tunnelCeilingHeight;
                // Spread smoke horizontally instead when hitting ceiling
                velocities[i].y = 0;
                velocities[i].x *= 1.5;
                velocities[i].z *= 1.5;
            }

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

function moveSegmentToNextCell(segment, train) {
    const cell = grid[segment.row][segment.col];
    const trackType = cell.trackType;

    // Determine next state using enterDir (direction from previous cell)
    const next = getNextState(segment.row, segment.col, segment.enterDir, trackType);

    if (!next) {
        // No valid next cell, stop the train
        segment.progress = 1.0; // Keep at end of current cell
        train.stopped = true;
        updateSteamEngineSound();
        return;
    }

    // Check if next cell has track
    const nextCell = grid[next.row][next.col];
    if (!nextCell || nextCell.kind !== 'track') {
        // Reached end of track, stop the train
        segment.progress = 1.0; // Keep at end of current cell
        train.stopped = true;
        updateSteamEngineSound();
        return;
    }

    // Move segment and update both dir and enterDir
    segment.row = next.row;
    segment.col = next.col;
    segment.dir = next.exitDir;         // direction leaving this cell
    segment.enterDir = next.nextEnterDir; // direction entering the new cell (same as exitDir)
}

function followLeadSegment(segment, leadSegment, train, segmentIndex) {
    // Use different spacing for first car vs subsequent cars
    // First car (index 1) gets ENGINE_TO_CAR_SPACING, others get SEGMENT_SPACING
    const spacing = (segmentIndex === 1) ? ENGINE_TO_CAR_SPACING : SEGMENT_SPACING;
    const targetDistanceBehind = spacing / CELL_SIZE; // in cell units

    // Calculate the "virtual progress" this segment should have
    // by looking at where the lead segment is
    let targetProgress = leadSegment.progress - targetDistanceBehind;
    let targetRow = leadSegment.row;
    let targetCol = leadSegment.col;
    let targetEnterDir = leadSegment.enterDir;
    let targetDir = leadSegment.dir;

    // If target progress is negative, we need to go back to previous cell(s)
    while (targetProgress < 0) {
        targetProgress += 1.0;

        // Move back one cell
        const prevState = getPreviousState(targetRow, targetCol, targetEnterDir);
        if (!prevState) {
            // Can't go further back, just stay at current position
            return;
        }

        targetRow = prevState.row;
        targetCol = prevState.col;
        targetEnterDir = prevState.enterDir;
        targetDir = prevState.dir;
    }

    // Update segment to target position
    segment.row = targetRow;
    segment.col = targetCol;
    segment.progress = targetProgress;
    segment.enterDir = targetEnterDir;
    segment.dir = targetDir;
}

function getPreviousState(row, col, enterDir) {
    // Get the cell we came from based on enterDir
    let prevRow = row;
    let prevCol = col;
    let prevExitDir = enterDir; // The direction we exited the previous cell

    // Reverse the enterDir to find where we came from
    if (enterDir === DIR.UP) {
        prevRow = row + 1; // came from below
    } else if (enterDir === DIR.DOWN) {
        prevRow = row - 1; // came from above
    } else if (enterDir === DIR.LEFT) {
        prevCol = col + 1; // came from right
    } else if (enterDir === DIR.RIGHT) {
        prevCol = col - 1; // came from left
    }

    // Check if previous cell exists and has track
    if (prevRow < 0 || prevRow >= GRID_SIZE || prevCol < 0 || prevCol >= GRID_SIZE) {
        return null;
    }

    const prevCell = grid[prevRow][prevCol];
    if (!prevCell || prevCell.kind !== 'track') {
        return null;
    }

    // Determine what enterDir was for the previous cell
    // We exited in prevExitDir direction, so we need to find what enterDir would lead to that exit
    const trackType = prevCell.trackType;
    let prevEnterDir = null;

    // For straight tracks
    if (trackType === 'straight-h' || trackType === 'crossing-h' || trackType === 'tunnel-h') {
        prevEnterDir = prevExitDir; // same direction
    } else if (trackType === 'straight-v' || trackType === 'crossing-v' || trackType === 'tunnel-v') {
        prevEnterDir = prevExitDir; // same direction
    } else if (trackType.startsWith('curve-')) {
        // For curves, we need to find which enterDir leads to our exitDir
        // This is the inverse of the curve mapping
        if (trackType === 'curve-tl') {
            if (prevExitDir === DIR.LEFT) prevEnterDir = DIR.DOWN;
            else if (prevExitDir === DIR.UP) prevEnterDir = DIR.RIGHT;
        } else if (trackType === 'curve-tr') {
            if (prevExitDir === DIR.RIGHT) prevEnterDir = DIR.DOWN;
            else if (prevExitDir === DIR.UP) prevEnterDir = DIR.LEFT;
        } else if (trackType === 'curve-bl') {
            if (prevExitDir === DIR.LEFT) prevEnterDir = DIR.UP;
            else if (prevExitDir === DIR.DOWN) prevEnterDir = DIR.RIGHT;
        } else if (trackType === 'curve-br') {
            if (prevExitDir === DIR.RIGHT) prevEnterDir = DIR.UP;
            else if (prevExitDir === DIR.DOWN) prevEnterDir = DIR.LEFT;
        }
    }

    if (prevEnterDir === null) {
        return null;
    }

    return {
        row: prevRow,
        col: prevCol,
        enterDir: prevEnterDir,
        dir: prevExitDir
    };
}

// Connectivity logic using enterDir as direction from previous cell
function getNextState(row, col, enterDir, trackType) {
    // Returns { row, col, exitDir, nextEnterDir } or null

    let exitDir = null;
    let nextRow = row;
    let nextCol = col;

    if (trackType === 'straight-h' || trackType === 'crossing-h' || trackType === 'tunnel-h') {
        if (enterDir === DIR.RIGHT) {
            exitDir = DIR.RIGHT;
            nextCol = col + 1;
        } else if (enterDir === DIR.LEFT) {
            exitDir = DIR.LEFT;
            nextCol = col - 1;
        }
    } else if (trackType === 'straight-v' || trackType === 'crossing-v' || trackType === 'tunnel-v') {
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

function updateSegmentPosition(segment) {
    const cell = grid[segment.row][segment.col];
    if (!cell || cell.kind !== 'track') return;

    const trackType = cell.trackType;

    const cellCenterX = segment.col * CELL_SIZE + CELL_SIZE / 2;
    const cellCenterZ = segment.row * CELL_SIZE + CELL_SIZE / 2;

    let x = cellCenterX;
    let z = cellCenterZ;
    let rotation = segment.mesh.rotation.y;

    if (trackType === 'straight-h' || trackType === 'crossing-h' || trackType === 'tunnel-h') {
        if (segment.enterDir === DIR.LEFT) {
            x = cellCenterX + CELL_SIZE / 2 - segment.progress * CELL_SIZE;
        } else if (segment.enterDir === DIR.RIGHT) {
            x = cellCenterX - CELL_SIZE / 2 + segment.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(segment.enterDir);
    } else if (trackType === 'straight-v' || trackType === 'crossing-v' || trackType === 'tunnel-v') {
        if (segment.enterDir === DIR.UP) {
            z = cellCenterZ + CELL_SIZE / 2 - segment.progress * CELL_SIZE;
        } else if (segment.enterDir === DIR.DOWN) {
            z = cellCenterZ - CELL_SIZE / 2 + segment.progress * CELL_SIZE;
        }
        rotation = getRotationForDirection(segment.enterDir);
    } else if (trackType.startsWith('curve-')) {
        const R = CELL_SIZE / 2;
        let centerX, centerZ, startAngle, endAngle;

        if (trackType === 'curve-tl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ - R;

            if (segment.enterDir === DIR.DOWN) {
                // Travel TOP -> LEFT: angle 0 to PI/2
                startAngle = 0;
                endAngle = Math.PI / 2;
            } else if (segment.enterDir === DIR.RIGHT) {
                // Travel LEFT -> TOP: angle PI/2 to 0 (reverse)
                startAngle = Math.PI / 2;
                endAngle = 0;
            }
        } else if (trackType === 'curve-tr') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ - R;

            if (segment.enterDir === DIR.DOWN) {
                // Travel TOP -> RIGHT: angle PI to PI/2 (reverse)
                startAngle = Math.PI;
                endAngle = Math.PI / 2;
            } else if (segment.enterDir === DIR.LEFT) {
                // Travel RIGHT -> TOP: angle PI/2 to PI
                startAngle = Math.PI / 2;
                endAngle = Math.PI;
            }
        } else if (trackType === 'curve-bl') {
            centerX = cellCenterX - R;
            centerZ = cellCenterZ + R;

            if (segment.enterDir === DIR.UP) {
                // Travel BOTTOM -> LEFT: angle 0 to -PI/2 (reverse)
                startAngle = 0;
                endAngle = -Math.PI / 2;
            } else if (segment.enterDir === DIR.RIGHT) {
                // Travel LEFT -> BOTTOM: angle -PI/2 to 0
                startAngle = -Math.PI / 2;
                endAngle = 0;
            }
        } else if (trackType === 'curve-br') {
            centerX = cellCenterX + R;
            centerZ = cellCenterZ + R;

            if (segment.enterDir === DIR.UP) {
                // Travel BOTTOM -> RIGHT: angle PI to 3*PI/2
                startAngle = Math.PI;
                endAngle = Math.PI * 1.5;
            } else if (segment.enterDir === DIR.LEFT) {
                // Travel RIGHT -> BOTTOM: angle 3*PI/2 to PI (reverse)
                startAngle = Math.PI * 1.5;
                endAngle = Math.PI;
            }
        }

        if (startAngle === undefined || endAngle === undefined) {
            x = cellCenterX;
            z = cellCenterZ;
            rotation = getRotationForDirection(segment.enterDir);
        } else {
            const dAngle = endAngle - startAngle;
            const currentAngle = startAngle + dAngle * segment.progress;

            x = centerX + R * Math.cos(currentAngle);
            z = centerZ + R * Math.sin(currentAngle);

            // Tangent following actual direction of travel (handle both CW / CCW)
            const sign = dAngle >= 0 ? 1 : -1;
            const dx = -Math.sin(currentAngle) * sign;
            const dz = Math.cos(currentAngle) * sign;
            rotation = Math.atan2(dx, dz);
        }
    }

    segment.mesh.position.x = x;
    segment.mesh.position.z = z;
    segment.mesh.rotation.y = rotation;
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
    steamEngineSound.volume = 0.1;

    // Load crossing ding sound
    dingSound = new Audio('./sounds/dingding.mp3');
    dingSound.volume = 1;
    dingSound.load(); // Preload the audio
    dingSound.addEventListener('error', (e) => {
        console.error('Failed to load dingding.mp3.mov:', e);
    });
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
        train.segments[0].type === 'engine-steam' && !train.stopped
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
// CROSSING ANIMATION
// ============================================================================

function updateCrossings(delta) {
    if (!isPlaying) return;

    crossings.forEach(crossing => {
        // Check if any train is ON this crossing
        let trainOnCrossing = false;

        // Crossing occupies 2 cells
        const crossingRow1 = crossing.row;
        const crossingCol1 = crossing.col;
        const crossingRow2 = crossing.horizontal ? crossingRow1 : crossingRow1 + 1;
        const crossingCol2 = crossing.horizontal ? crossingCol1 + 1 : crossingCol1;

        trains.forEach(train => {
            // Check if any segment is on either of the crossing's two cells
            if (!train.stopped) {
                train.segments.forEach(segment => {
                    if ((segment.row === crossingRow1 && segment.col === crossingCol1) ||
                        (segment.row === crossingRow2 && segment.col === crossingCol2)) {
                        trainOnCrossing = true;
                    }
                });
            }
        });

        // Activate crossing when train is on it
        if (trainOnCrossing) {
            if (!crossing.active) {
                activateCrossing(crossing);
            }
            crossing.deactivateTimer = 0; // Reset timer while train is present
        } else if (crossing.active) {
            // Start deactivation timer when train leaves
            if (!crossing.deactivateTimer) crossing.deactivateTimer = 0;
            crossing.deactivateTimer += delta;

            // Wait 1 second after train leaves before turning off
            if (crossing.deactivateTimer >= 1.0) {
                deactivateCrossing(crossing);
                crossing.deactivateTimer = 0;
            }
        }

        // Animate flashing lights
        if (crossing.active && crossing.mesh.userData.lights) {
            // Update light state timer
            if (!crossing.lightTimer) crossing.lightTimer = 0;
            crossing.lightTimer += delta;

            // Flash lights alternately every 0.5 seconds
            if (crossing.lightTimer >= 0.5) {
                crossing.lightTimer = 0;
                crossing.mesh.userData.lightState = 1 - crossing.mesh.userData.lightState;

                // Alternate between top and bottom lights
                crossing.mesh.userData.lights.forEach((light, index) => {
                    if (index % 2 === crossing.mesh.userData.lightState) {
                        light.material.emissiveIntensity = 1.0;
                    } else {
                        light.material.emissiveIntensity = 0.1;
                    }
                });
            }
        } else if (!crossing.active && crossing.mesh.userData.lights) {
            // Turn off all lights
            crossing.mesh.userData.lights.forEach(light => {
                light.material.emissiveIntensity = 0;
            });
            crossing.lightTimer = 0;
        }

        // Animate barrier arms
        if (crossing.mesh.userData.arms) {
            const rotationSpeed = 1.5; // radians per second

            crossing.mesh.userData.arms.forEach(arm => {
                // When train present (active): arms go horizontal (facing opposite directions)
                // When no train: arms point up (vertical)
                const targetRotation = crossing.active ? arm.userData.horizontalRotation : arm.userData.upRotation;
                const currentRotation = arm.rotation.z;

                // Determine direction based on which target we're moving toward
                if (Math.abs(targetRotation - currentRotation) > 0.01) {
                    if (currentRotation < targetRotation) {
                        // Rotate positive
                        arm.rotation.z = Math.min(currentRotation + rotationSpeed * delta, targetRotation);
                    } else {
                        // Rotate negative
                        arm.rotation.z = Math.max(currentRotation - rotationSpeed * delta, targetRotation);
                    }
                }
            });
        }
    });
}

function activateCrossing(crossing) {
    crossing.active = true;

    // Start ding sound (loop it)
    if (soundEnabled && crossing.dingSound) {
        crossing.dingSound.currentTime = 0;
        crossing.dingSound.play().catch(err => console.error('Failed to start crossing ding sound:', err));
    }
}

function deactivateCrossing(crossing) {
    crossing.active = false;

    // Stop ding sound
    if (crossing.dingSound && !crossing.dingSound.paused) {
        crossing.dingSound.pause();
        crossing.dingSound.currentTime = 0;
    }
}

function playDingSound() {
    if (!soundEnabled || !dingSound) {
        console.log('Cannot play ding sound - soundEnabled:', soundEnabled, 'dingSound:', dingSound);
        return;
    }

    // Reset to beginning and play
    try {
        dingSound.currentTime = 0;
        dingSound.play().catch(err => console.error('Ding sound play failed:', err));
    } catch (err) {
        console.error('Error playing ding sound:', err);
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
    updateCrossings(delta);
    updateSnow(delta);
    renderer.render(scene, camera);
}

function updateSnow(delta) {
    if (!snowParticles) return;

    const positions = snowParticles.geometry.attributes.position;
    const velocities = snowParticles.userData.velocities;
    const groundSize = GRID_SIZE * CELL_SIZE;

    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;

        // Update position based on velocity
        positions.array[i3] += velocities[i3] * delta * 10;
        positions.array[i3 + 1] += velocities[i3 + 1] * delta * 10;
        positions.array[i3 + 2] += velocities[i3 + 2] * delta * 10;

        // Reset particle if it falls below ground or goes out of bounds
        if (positions.array[i3 + 1] < 0 ||
            positions.array[i3] < 0 || positions.array[i3] > groundSize ||
            positions.array[i3 + 2] < 0 || positions.array[i3 + 2] > groundSize) {
            // Reset to top with random position
            positions.array[i3] = Math.random() * groundSize;
            positions.array[i3 + 1] = 20 + Math.random() * 10;
            positions.array[i3 + 2] = Math.random() * groundSize;
        }
    }

    positions.needsUpdate = true;
}

// ============================================================================
// LAYOUT EXPORT/IMPORT
// ============================================================================

function exportLayout() {
    const layout = {
        tracks: [],
        trains: [],
        crossings: []
    };

    // Export tracks
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = grid[r][c];
            if (cell && cell.kind === 'track' && cell.trackType) {
                // Skip crossing end cells (they're part of the start cell)
                if (!cell.isCrossingEnd) {
                    layout.tracks.push({
                        row: r,
                        col: c,
                        trackType: cell.trackType
                    });
                }
            }
        }
    }

    // Export trains
    trains.forEach(train => {
        const engineSeg = train.segments[0];
        const trainData = {
            row: engineSeg.row,
            col: engineSeg.col,
            engineType: engineSeg.type,
            dir: engineSeg.dir,
            enterDir: engineSeg.enterDir,
            cars: train.segments.slice(1).map(seg => seg.type)
        };
        layout.trains.push(trainData);
    });

    // Export crossings (they're already in the tracks, but we need to mark them)
    crossings.forEach(crossing => {
        layout.crossings.push({
            row: crossing.row,
            col: crossing.col,
            horizontal: crossing.horizontal
        });
    });

    console.log('LAYOUT_DATA:', JSON.stringify(layout, null, 2));
    return layout;
}

// Make exportLayout available globally for console access
window.exportLayout = exportLayout;

function loadLayout(layoutData) {
    // Clear existing layout
    trains.forEach(train => {
        train.segments.forEach(seg => scene.remove(seg.mesh));
    });
    trains = [];
    crossings = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] && grid[r][c].mesh) {
                scene.remove(grid[r][c].mesh);
            }
            grid[r][c] = { kind: null };
        }
    }

    // Create a set of crossing cells to skip when placing tracks
    const crossingCells = new Set();
    if (layoutData.crossings) {
        layoutData.crossings.forEach(crossing => {
            crossingCells.add(`${crossing.row},${crossing.col}`);
            const nextRow = crossing.horizontal ? crossing.row : crossing.row + 1;
            const nextCol = crossing.horizontal ? crossing.col + 1 : crossing.col;
            crossingCells.add(`${nextRow},${nextCol}`);
        });
    }

    // Load tracks (skip crossing cells, they'll be loaded separately)
    if (layoutData.tracks) {
        layoutData.tracks.forEach(track => {
            const cellKey = `${track.row},${track.col}`;
            if (!crossingCells.has(cellKey)) {
                placeTrackPiece(track.row, track.col, track.trackType);
            }
        });
    }

    // Load crossings (need to recreate them properly)
    if (layoutData.crossings) {
        layoutData.crossings.forEach(crossing => {
            // Place the crossing (it will handle removing any existing tracks)
            placeCrossing(crossing.row, crossing.col);
        });
    }

    // Load trains
    if (layoutData.trains) {
        layoutData.trains.forEach(trainData => {
            // Place the engine
            placeTrain(trainData.row, trainData.col, trainData.engineType);
            const train = trains[trains.length - 1];

            // Update train direction and position
            if (train) {
                train.segments[0].dir = trainData.dir;
                train.segments[0].enterDir = trainData.enterDir;

                // Update mesh rotation to match direction
                train.segments[0].mesh.rotation.y = getRotationForDirection(trainData.enterDir);

                // Add cars
                trainData.cars.forEach(carType => {
                    addCarToTrain(train, carType);
                });

                // Update all segment positions after adding cars
                train.segments.forEach(seg => {
                    updateSegmentPosition(seg);
                });
            }
        });
    }
}

// ============================================================================
// START
// ============================================================================

init();
