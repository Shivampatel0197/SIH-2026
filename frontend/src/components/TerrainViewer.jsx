import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const TerrainViewer = ({ heightmapUrl, textureUrl, minElev, maxElev, flightSpeed, floodLevel, displacementScale }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const floodMeshRef = useRef(null);
  const materialRef = useRef(null);
  
  const keys = useRef({ w: false, a: false, s: false, d: false, q: false, e: false });
  const [altitudeHUD, setAltitudeHUD] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    const bgColor = 0x1a2639; // Deep atmospheric blue
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.002);
    sceneRef.current = scene;

    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    
    // Position camera slightly above the maximum expected terrain displacement
    camera.position.set(0, 100, 400);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Boost intensity
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    sunLight.position.set(100, 150, 80);
    scene.add(sunLight);

    // Load Textures & Build Terrain
    const textureLoader = new THREE.TextureLoader();
    let terrainMesh = null;
    
    Promise.all([
      textureLoader.loadAsync(textureUrl),
      textureLoader.loadAsync(heightmapUrl)
    ]).then(([colorMap, heightMap]) => {
      colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
      
      // Prevent texture spikes
      heightMap.generateMipmaps = true;
      heightMap.minFilter = THREE.LinearMipmapLinearFilter;
      heightMap.magFilter = THREE.LinearFilter;
      
      // Optimal Geometry Resolution
      const geometry = new THREE.PlaneGeometry(1000, 1000, 256, 256);
      geometry.rotateX(-Math.PI / 2);
      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        map: colorMap,
        displacementMap: heightMap,
        displacementScale: displacementScale,
        displacementBias: -2.0,
        wireframe: false,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: false
      });
      materialRef.current = material;

      terrainMesh = new THREE.Mesh(geometry, material);
      scene.add(terrainMesh);
      
      // 1. Create a flat water plane over the terrain bounds
      // Use 1200x1200 to fully cover the 1000x1000 terrain and prevent edges from showing
      const waterGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });

      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(0, 0, 0); // Center relative to terrain
      scene.add(waterMesh);
      floodMeshRef.current = waterMesh;
    });

    // Flight Controls Handlers
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keys.current.hasOwnProperty(key)) keys.current[key] = true;
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keys.current.hasOwnProperty(key)) keys.current[key] = false;
    };
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const handleMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.clientX, y: e.clientY }; };
    const handleMouseUp = () => isDragging = false;
    const handleMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        camera.rotation.y -= deltaX * 0.003;
        camera.rotation.x -= deltaY * 0.003;
        camera.rotation.z = 0;
      }
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    const clock = new THREE.Clock();
    let animationId;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const speed = flightSpeed * delta * 2;

      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const side = new THREE.Vector3().crossVectors(camera.up, direction).normalize();

      if (keys.current.w) camera.position.addScaledVector(direction, speed);
      if (keys.current.s) camera.position.addScaledVector(direction, -speed);
      if (keys.current.a) camera.position.addScaledVector(side, speed);
      if (keys.current.d) camera.position.addScaledVector(side, -speed);
      if (keys.current.q) camera.position.y += speed;
      if (keys.current.e) camera.position.y -= speed;

      // Anti-collision guard (mock surface level check)
      if (camera.position.y < 5) camera.position.y = 5;
      
      setAltitudeHUD(camera.position.y);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [textureUrl, heightmapUrl]); // Reload scene when maps change

  // Dynamic displacement scale update
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.displacementScale = displacementScale;
      materialRef.current.needsUpdate = true;
    }
  }, [displacementScale]);

  // 2. Tie the mesh height (Y-axis) directly to the slider value
  useEffect(() => {
    if (floodMeshRef.current) {
      // Map the slider ratio to the Three.js vertical coordinate space
      const ratio = Math.max(0, floodLevel - minElev) / (maxElev - minElev + 0.001);
      const baseOffset = -displacementScale * 0.15;
      floodMeshRef.current.position.y = baseOffset + ratio * (displacementScale * 0.5);
    }
  }, [floodLevel, minElev, maxElev, displacementScale]);

  return (
    <div className="w-full h-full relative" ref={mountRef}>
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 bg-black/60 px-4 py-3 rounded-lg border border-gray-700 text-xs font-mono backdrop-blur-md text-aerospace-cyan shadow-lg pointer-events-none">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <span className="text-gray-400">ALT (AGL):</span> 
          <span className="text-right">{altitudeHUD.toFixed(1)} m</span>
          
          <span className="text-gray-400">SPEED:</span> 
          <span className="text-right">{flightSpeed} m/s</span>
          
          <span className="text-gray-400">FLOOD LVL:</span> 
          <span className="text-right">{floodLevel.toFixed(1)} m</span>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700 text-gray-500 text-[10px]">
          [W,A,S,D] Move | [Q,E] Alt | [Drag] Look
        </div>
      </div>
      
      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 w-6 h-6 border-[1.5px] border-aerospace-cyan/40 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className="w-1 h-1 bg-aerospace-cyan/60 rounded-full"></div>
      </div>
    </div>
  );
};

export default TerrainViewer;
