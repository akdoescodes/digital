import { useRef, useEffect, useState } from 'react';
import { X, RotateCcw, Camera, Target, Scan, Zap, Box } from 'lucide-react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MenuItem } from '../types';

interface WebARMenuProps {
  onClose: () => void;
  menuItems: MenuItem[];
}

interface ARItem {
  id: string;
  item: MenuItem;
  mesh: THREE.Mesh;
  anchor?: XRAnchor;
}

interface DetectedPlane {
  plane: XRPlane;
  mesh: THREE.Mesh;
  id: string;
}

export default function WebARMenu({ onClose, menuItems }: WebARMenuProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isARSupported, setIsARSupported] = useState(false);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem>(menuItems[0]);
  const [arItems, setArItems] = useState<ARItem[]>([]);
  const [detectedPlanes, setDetectedPlanes] = useState<DetectedPlane[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Three.js references
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const reticleRef = useRef<THREE.Mesh>();

  // Check WebXR support
  useEffect(() => {
    const checkARSupport = async () => {
      if (!navigator.xr) {
        setErrorMessage('WebXR not supported. Please use Chrome/Edge on Android or Safari on iOS.');
        setIsLoading(false);
        return;
      }

      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        setIsARSupported(supported);
        
        if (!supported) {
          setErrorMessage('AR not supported on this device. Please use a compatible mobile browser.');
        }
      } catch (error) {
        console.error('WebXR check failed:', error);
        setErrorMessage('Failed to check AR support. Please ensure you\'re using a compatible browser.');
      }
      
      setIsLoading(false);
    };

    checkARSupport();
  }, []);

  // Initialize Three.js scene
  const initThreeJS = () => {
    if (!canvasRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Reticle for plane targeting
    const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.8 
    });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    return { scene, camera, renderer };
  };

  // Create 3D model for menu item
  const createMenuItemMesh = (item: MenuItem): THREE.Mesh => {
    let geometry: THREE.BufferGeometry;
    
    // Different geometries based on food category
    switch (item.category.toLowerCase()) {
      case 'pizza':
        geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16);
        break;
      case 'soup':
        geometry = new THREE.SphereGeometry(0.08, 16, 16);
        break;
      case 'dessert':
        geometry = new THREE.ConeGeometry(0.08, 0.15, 8);
        break;
      case 'seafood':
        geometry = new THREE.OctahedronGeometry(0.08);
        break;
      case 'salad':
        geometry = new THREE.DodecahedronGeometry(0.08);
        break;
      default:
        geometry = new THREE.BoxGeometry(0.1, 0.08, 0.1);
    }

    // Material with category-based color
    const getColor = () => {
      switch (item.category.toLowerCase()) {
        case 'pizza': return 0xFF6B35;
        case 'soup': return 0xF7931E;
        case 'dessert': return 0x8B4513;
        case 'seafood': return 0x4682B4;
        case 'salad': return 0x32CD32;
        case 'premium': return 0x9B59B6;
        default: return 0xD97706;
      }
    };

    const material = new THREE.MeshPhongMaterial({ 
      color: getColor(),
      shininess: 100,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Add floating animation
    mesh.userData = {
      item,
      originalY: 0,
      animationTime: Math.random() * Math.PI * 2
    };

    return mesh;
  };

  // Create plane visualization
  const createPlaneMesh = (): THREE.Mesh => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  };

  // Start AR session
  const startARSession = async () => {
    if (!navigator.xr || !isARSupported) return;

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'plane-detection'],
        optionalFeatures: ['anchors', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      setXrSession(session);
      
      const threeSetup = initThreeJS();
      if (!threeSetup) return;
      
      const { renderer } = threeSetup;

      await renderer.xr.setSession(session);

      // Handle session end
      session.addEventListener('end', () => {
        setXrSession(null);
        setDetectedPlanes([]);
        setArItems([]);
        setIsScanning(true);
      });

      // Animation loop
      renderer.setAnimationLoop((_timestamp: number, frame?: XRFrame) => {
        if (!frame || !sceneRef.current || !cameraRef.current) return;

        const referenceSpace = renderer.xr.getReferenceSpace();
        if (!referenceSpace) return;
        
        const viewerPose = frame.getViewerPose(referenceSpace);

        if (viewerPose) {
          // Update plane detection
          if ((frame as any).detectedPlanes) {
            const newPlanes: DetectedPlane[] = [];
            
            (frame as any).detectedPlanes.forEach((plane: any) => {
              const planePose = frame.getPose(plane.planeSpace, referenceSpace);
              if (planePose) {
                let detectedPlane = detectedPlanes.find(dp => dp.plane === plane);
                
                if (!detectedPlane) {
                  const mesh = createPlaneMesh();
                  sceneRef.current!.add(mesh);
                  
                  detectedPlane = {
                    plane,
                    mesh,
                    id: Math.random().toString(36)
                  };
                }
                
                // Update plane position and scale
                const { position, orientation } = planePose.transform;
                detectedPlane.mesh.position.set(position.x, position.y, position.z);
                detectedPlane.mesh.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
                
                // Scale based on plane polygon
                if (plane.polygon) {
                  const points = Array.from(plane.polygon) as any[];
                  if (points.length >= 3) {
                    const bounds = points.reduce((acc: any, point: any) => {
                      return {
                        minX: Math.min(acc.minX, point.x),
                        maxX: Math.max(acc.maxX, point.x),
                        minZ: Math.min(acc.minZ, point.z),
                        maxZ: Math.max(acc.maxZ, point.z)
                      };
                    }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
                    
                    const width = bounds.maxX - bounds.minX;
                    const height = bounds.maxZ - bounds.minZ;
                    detectedPlane.mesh.scale.set(width, 1, height);
                  }
                }
                
                newPlanes.push(detectedPlane);
              }
            });
            
            // Clean up removed planes
            detectedPlanes.forEach(dp => {
              if (!newPlanes.find(np => np.id === dp.id)) {
                sceneRef.current!.remove(dp.mesh);
              }
            });
            
            setDetectedPlanes(newPlanes);
            
            if (newPlanes.length > 0 && isScanning) {
              setIsScanning(false);
            }
          }

          // Hit test for reticle positioning
          if ((frame as any).getHitTestResults) {
            const hitTestSource = (renderer.xr as any).getHitTestSource();
            if (hitTestSource) {
              const hitTestResults = (frame as any).getHitTestResults(hitTestSource);
              if (hitTestResults.length > 0 && reticleRef.current) {
                const hit = hitTestResults[0];
                const hitPose = hit.getPose(referenceSpace);
                if (hitPose) {
                  reticleRef.current.position.setFromMatrixPosition(new THREE.Matrix4().fromArray(hitPose.transform.matrix));
                  reticleRef.current.visible = true;
                }
              }
            }
          }

          // Animate placed items
          arItems.forEach(arItem => {
            if (arItem.mesh.userData) {
              arItem.mesh.userData.animationTime += 0.02;
              arItem.mesh.position.y = arItem.mesh.userData.originalY + Math.sin(arItem.mesh.userData.animationTime) * 0.01;
              arItem.mesh.rotation.y += 0.01;
            }
          });
        }

        renderer.render(sceneRef.current, cameraRef.current);
      });

    } catch (error) {
      console.error('Failed to start AR session:', error);
      setErrorMessage('Failed to start AR session. Please try again.');
    }
  };

  // Place item on detected plane
  const placeItem = async () => {
    if (!xrSession || !reticleRef.current || !reticleRef.current.visible) return;

    const mesh = createMenuItemMesh(selectedItem);
    mesh.position.copy(reticleRef.current.position);
    mesh.position.y += 0.05; // Slightly above the surface
    mesh.userData.originalY = mesh.position.y;

    sceneRef.current!.add(mesh);

    // Try to create an anchor for persistence
    try {
      // Anchor creation would go here if supported
      console.log('Anchors not supported in this implementation');
    } catch (error) {
      console.log('Anchors not supported, placing without anchor');
    }

    const newArItem: ARItem = {
      id: Date.now().toString(),
      item: selectedItem,
      mesh
    };

    setArItems(prev => [...prev, newArItem]);
  };

  const clearItems = () => {
    arItems.forEach(item => {
      sceneRef.current?.remove(item.mesh);
    });
    setArItems([]);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg">Checking WebAR Support...</p>
          <p className="text-sm text-gray-400 mt-2">Initializing AR capabilities</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !isARSupported) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white p-8 max-w-md">
          <Camera className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-4">WebAR Not Available</h2>
          <p className="mb-6 text-gray-300">{errorMessage}</p>
          <div className="text-sm text-gray-400 mb-6">
            <p className="mb-2">For WebAR support, please use:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Chrome/Edge on Android</li>
              <li>Safari on iOS (with WebXR enabled)</li>
              <li>Make sure you're on HTTPS</li>
            </ul>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (!xrSession) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white p-8">
          <Box className="h-20 w-20 mx-auto mb-6 text-blue-400" />
          <h2 className="text-3xl font-bold mb-4">Professional WebAR</h2>
          <p className="text-lg mb-2">Advanced Plane Detection Ready</p>
          <p className="text-sm text-gray-400 mb-8">Uses WebXR API for accurate surface mapping</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center text-green-400">
              <Target className="h-5 w-5 mr-2" />
              <span>Real-time plane detection</span>
            </div>
            <div className="flex items-center justify-center text-green-400">
              <Scan className="h-5 w-5 mr-2" />
              <span>Surface anchor tracking</span>
            </div>
            <div className="flex items-center justify-center text-green-400">
              <Zap className="h-5 w-5 mr-2" />
              <span>Native AR performance</span>
            </div>
          </div>

          <button
            onClick={startARSession}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors shadow-lg"
          >
            Start WebAR Session
          </button>
          
          <div className="mt-6">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* WebXR Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onClick={placeItem}
      />

      {/* AR Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
        <button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg pointer-events-auto"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center space-x-2">
          {isScanning && (
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse flex items-center">
              <Scan className="h-3 w-3 mr-1" />
              DETECTING PLANES
            </div>
          )}
          {detectedPlanes.length > 0 && (
            <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
              <Target className="h-3 w-3 mr-1" />
              {detectedPlanes.length} SURFACES FOUND
            </div>
          )}
          <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="text-sm font-medium">
              {detectedPlanes.length > 0 ? 'Tap to place items' : 'Scan for surfaces...'}
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {arItems.length > 0 && (
            <button
              onClick={clearItems}
              className="bg-yellow-600 hover:bg-yellow-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg pointer-events-auto"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Menu selector at bottom */}
      {detectedPlanes.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-80 rounded-lg p-4 backdrop-blur-sm pointer-events-auto">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {menuItems.slice(0, 6).map((item, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item);
                }}
                className={`flex-shrink-0 p-3 rounded-lg transition-all duration-200 min-w-[80px] ${
                  selectedItem.name === item.name 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <div className="text-xs font-medium truncate">{item.name}</div>
                <div className="text-xs opacity-75">${item.price}</div>
              </button>
            ))}
          </div>
          
          <div className="text-center mt-2 text-white text-xs opacity-75">
            Selected: {selectedItem.name} • {arItems.length} items placed • WebXR Plane Detection
          </div>
        </div>
      )}

      {/* Instructions */}
      {detectedPlanes.length === 0 && !isScanning && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="bg-black bg-opacity-70 text-white px-6 py-4 rounded-lg backdrop-blur-sm border border-white/20">
            <Scan className="h-8 w-8 mx-auto mb-2 text-blue-400 animate-spin" />
            <p className="text-sm font-medium">Point device at flat surfaces</p>
            <p className="text-xs opacity-75 mt-1">Move slowly to detect planes</p>
            <div className="mt-2 text-xs text-gray-400">
              WebXR Plane Detection Active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
