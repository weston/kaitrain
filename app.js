import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 30, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(20, 30, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// === GROUND ===
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x7CCD7C });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// === GRID ===
const gridHelper = new THREE.GridHelper(50, 25, 0x888888, 0xcccccc);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// === GAME STATE ===
const CELL_SIZE = 2;
const state = {
    selectedTrack: 'horizontal',
    tracks: new Map(), // key: "x,z", value: {type, mesh}
};

// === MATERIALS ===
const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x404040,
    metalness: 0.8,
    roughness: 0.2
});

const sleeperMaterial = new THREE.MeshStandardMaterial({
    color: 0x6B4423,
    roughness: 0.9
});

// === TRACK CREATION ===
function createHorizontalTrack() {
    const group = new THREE.Group();
    
    // More sleepers, closer together to match reference
    const sleeperGeometry = new THREE.BoxGeometry(1.0, 0.1, 0.2);
    const numSleepers = 12;
    const trackLength = CELL_SIZE * 0.95;
    
    for (let i = 0; i < numSleepers; i++) {
        const x = (i / (numSleepers - 1) - 0.5) * trackLength;
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(x, 0.05, 0);
        sleeper.castShadow = true;
        group.add(sleeper);
    }
    
    // Cylindrical rails like in the reference image
    const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, trackLength, 8);
    
    const rail1 = new THREE.Mesh(railGeometry, railMaterial);
    rail1.position.set(0, 0.12, -0.35);
    rail1.rotation.z = Math.PI / 2;
    rail1.castShadow = true;
    group.add(rail1);
    
    const rail2 = new THREE.Mesh(railGeometry, railMaterial);
    rail2.position.set(0, 0.12, 0.35);
    rail2.rotation.z = Math.PI / 2;
    rail2.castShadow = true;
    group.add(rail2);
    
    return group;
}

function createVerticalTrack() {
    const group = new THREE.Group();
    
    // More sleepers, closer together to match reference
    const sleeperGeometry = new THREE.BoxGeometry(0.2, 0.1, 1.0);
    const numSleepers = 12;
    const trackLength = CELL_SIZE * 0.95;
    
    for (let i = 0; i < numSleepers; i++) {
        const z = (i / (numSleepers - 1) - 0.5) * trackLength;
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(0, 0.05, z);
        sleeper.castShadow = true;
        group.add(sleeper);
    }
    
    // Cylindrical rails like in the reference image
    const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, trackLength, 8);
    
    const rail1 = new THREE.Mesh(railGeometry, railMaterial);
    rail1.position.set(-0.35, 0.12, 0);
    rail1.rotation.x = Math.PI / 2;
    rail1.castShadow = true;
    group.add(rail1);
    
    const rail2 = new THREE.Mesh(railGeometry, railMaterial);
    rail2.position.set(0.35, 0.12, 0);
    rail2.rotation.x = Math.PI / 2;
    rail2.castShadow = true;
    group.add(rail2);
    
    return group;
}

function createCornerTrack(type) {
    const group = new THREE.Group();
    
    // Match the curved track reference image
    const radius = CELL_SIZE;
    const railSpacing = 0.7; // Distance between the two rails
    
    // Determine the curve orientation based on corner type
    let startAngle, endAngle, offsetX, offsetZ;
    
    if (type === 'ne') { // north-east: connects up (north) and right (east)
        startAngle = 0;           // Start pointing east
        endAngle = Math.PI / 2;   // End pointing north
        offsetX = -radius;
        offsetZ = radius;
    } else if (type === 'nw') { // north-west: connects up (north) and left (west)
        startAngle = Math.PI / 2;   // Start pointing north
        endAngle = Math.PI;         // End pointing west
        offsetX = radius;
        offsetZ = radius;
    } else if (type === 'se') { // south-east: connects down (south) and right (east)
        startAngle = -Math.PI / 2;  // Start pointing south
        endAngle = 0;               // End pointing east
        offsetX = -radius;
        offsetZ = -radius;
    } else if (type === 'sw') { // south-west: connects down (south) and left (west)
        startAngle = Math.PI;       // Start pointing west
        endAngle = Math.PI * 3 / 2; // End pointing south
        offsetX = radius;
        offsetZ = -radius;
    }
    
    // Create sleepers along the curve (perpendicular to the curve direction)
    const numSleepers = 12;
    const sleeperGeometry = new THREE.BoxGeometry(0.2, 0.1, railSpacing + 0.3);
    
    for (let i = 0; i < numSleepers; i++) {
        const t = i / (numSleepers - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        
        const x = Math.cos(angle) * radius + offsetX;
        const z = Math.sin(angle) * radius + offsetZ;
        
        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.set(x, 0.05, z);
        sleeper.rotation.y = -angle; // Perpendicular to curve
        sleeper.castShadow = true;
        group.add(sleeper);
    }
    
    // Create smooth curved rails using TubeGeometry
    const segments = 32;
    
    // Inner rail (closer to center of curve)
    const innerPoints = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = startAngle + t * (endAngle - startAngle);
        const innerRadius = radius - railSpacing / 2;
        const x = Math.cos(angle) * innerRadius + offsetX;
        const z = Math.sin(angle) * innerRadius + offsetZ;
        innerPoints.push(new THREE.Vector3(x, 0.12, z));
    }
    
    const innerCurve = new THREE.CatmullRomCurve3(innerPoints);
    const innerGeometry = new THREE.TubeGeometry(innerCurve, segments, 0.05, 8, false);
    const innerRail = new THREE.Mesh(innerGeometry, railMaterial);
    innerRail.castShadow = true;
    group.add(innerRail);
    
    // Outer rail (farther from center of curve)
    const outerPoints = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = startAngle + t * (endAngle - startAngle);
        const outerRadius = radius + railSpacing / 2;
        const x = Math.cos(angle) * outerRadius + offsetX;
        const z = Math.sin(angle) * outerRadius + offsetZ;
        outerPoints.push(new THREE.Vector3(x, 0.12, z));
    }
    
    const outerCurve = new THREE.CatmullRomCurve3(outerPoints);
    const outerGeometry = new THREE.TubeGeometry(outerCurve, segments, 0.05, 8, false);
    const outerRail = new THREE.Mesh(outerGeometry, railMaterial);
    outerRail.castShadow = true;
    group.add(outerRail);
    
    return group;
}

// === TRACK PLACEMENT ===
function getTrackAt(gridX, gridZ) {
    const key = `${gridX},${gridZ}`;
    return state.tracks.get(key);
}

function determineCornerType(gridX, gridZ) {
    // Check adjacent cells to determine what type of corner this should be
    const north = getTrackAt(gridX, gridZ - 1);
    const south = getTrackAt(gridX, gridZ + 1);
    const east = getTrackAt(gridX + 1, gridZ);
    const west = getTrackAt(gridX - 1, gridZ);
    
    // Check which directions have tracks
    const hasNorth = north && north.type === 'vertical';
    const hasSouth = south && south.type === 'vertical';
    const hasEast = east && east.type === 'horizontal';
    const hasWest = west && west.type === 'horizontal';
    
    // Determine corner type based on connections
    if (hasNorth && hasEast) return 'ne';
    if (hasNorth && hasWest) return 'nw';
    if (hasSouth && hasEast) return 'se';
    if (hasSouth && hasWest) return 'sw';
    
    return null;
}

function updateTrackAt(gridX, gridZ) {
    const key = `${gridX},${gridZ}`;
    const track = state.tracks.get(key);
    if (!track) return;
    
    const worldX = gridX * CELL_SIZE;
    const worldZ = gridZ * CELL_SIZE;
    
    // Check if this should become a corner
    const cornerType = determineCornerType(gridX, gridZ);
    
    // Remove old mesh
    scene.remove(track.mesh);
    
    // Create new appropriate mesh
    let newMesh;
    if (cornerType) {
        newMesh = createCornerTrack(cornerType);
        track.type = 'corner-' + cornerType;
    } else {
        // Revert to original type if no longer a corner
        if (track.type.startsWith('corner-')) {
            // Determine original type from neighbors
            const hasHorizontal = getTrackAt(gridX - 1, gridZ) || getTrackAt(gridX + 1, gridZ);
            const hasVertical = getTrackAt(gridX, gridZ - 1) || getTrackAt(gridX, gridZ + 1);
            track.type = hasHorizontal ? 'horizontal' : 'vertical';
        }
        
        if (track.type === 'horizontal') {
            newMesh = createHorizontalTrack();
        } else if (track.type === 'vertical') {
            newMesh = createVerticalTrack();
        }
    }
    
    newMesh.position.set(worldX, 0, worldZ);
    scene.add(newMesh);
    track.mesh = newMesh;
}

function placeTrack(gridX, gridZ) {
    const key = `${gridX},${gridZ}`;
    const worldX = gridX * CELL_SIZE;
    const worldZ = gridZ * CELL_SIZE;
    
    // Remove existing track if present
    if (state.tracks.has(key)) {
        scene.remove(state.tracks.get(key).mesh);
        state.tracks.delete(key);
        
        // Update adjacent tracks
        updateTrackAt(gridX, gridZ - 1); // north
        updateTrackAt(gridX, gridZ + 1); // south
        updateTrackAt(gridX + 1, gridZ); // east
        updateTrackAt(gridX - 1, gridZ); // west
        return;
    }
    
    // Create new track
    let mesh;
    if (state.selectedTrack === 'horizontal') {
        mesh = createHorizontalTrack();
    } else {
        mesh = createVerticalTrack();
    }
    
    mesh.position.set(worldX, 0, worldZ);
    scene.add(mesh);
    
    state.tracks.set(key, {
        type: state.selectedTrack,
        mesh: mesh
    });
    
    // Update this track in case it should be a corner
    updateTrackAt(gridX, gridZ);
    
    // Update adjacent tracks in case they should become corners
    updateTrackAt(gridX, gridZ - 1); // north
    updateTrackAt(gridX, gridZ + 1); // south
    updateTrackAt(gridX + 1, gridZ); // east
    updateTrackAt(gridX - 1, gridZ); // west
}

function deleteTrack(gridX, gridZ) {
    const key = `${gridX},${gridZ}`;
    if (state.tracks.has(key)) {
        scene.remove(state.tracks.get(key).mesh);
        state.tracks.delete(key);
        
        // Update adjacent tracks
        updateTrackAt(gridX, gridZ - 1);
        updateTrackAt(gridX, gridZ + 1);
        updateTrackAt(gridX + 1, gridZ);
        updateTrackAt(gridX - 1, gridZ);
    }
}

// === RAYCASTING ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getGridPosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const gridX = Math.round(point.x / CELL_SIZE);
        const gridZ = Math.round(point.z / CELL_SIZE);
        return { gridX, gridZ };
    }
    return null;
}

// === EVENT HANDLERS ===
renderer.domElement.addEventListener('click', (event) => {
    if (event.button !== 0) return; // Only left click
    const pos = getGridPosition(event);
    if (pos) {
        placeTrack(pos.gridX, pos.gridZ);
    }
});

renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const pos = getGridPosition(event);
    if (pos) {
        deleteTrack(pos.gridX, pos.gridZ);
    }
});

// UI buttons
document.querySelectorAll('.track-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.track-btn[data-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedTrack = btn.dataset.type;
        document.getElementById('selected-track').textContent = 
            state.selectedTrack === 'horizontal' ? 'Horizontal' : 'Vertical';
    });
});

window.clearTracks = function() {
    state.tracks.forEach(track => {
        scene.remove(track.mesh);
    });
    state.tracks.clear();
};

// === ANIMATION LOOP ===
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// === WINDOW RESIZE ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start
animate();

