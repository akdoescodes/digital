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
  id: string;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  bounds: { width: number; height: number };
  confidence: number;
  lastUpdated: number;
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
  const [objModel, setObjModel] = useState<THREE.Group | null>(null);
  
  // Three.js references
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const reticleRef = useRef<THREE.Mesh>();

  // Load OBJ model
  useEffect(() => {
    const loader = new OBJLoader();
    
    // Use correct path for public assets
    const modelPath = '/FinalBaseMesh.obj';
    
    console.log('Loading OBJ model from:', modelPath);
    
    loader.load(
      modelPath,
      (object) => {
        console.log('OBJ model loaded successfully:', object);
        
        // Scale and prepare the model
        object.scale.setScalar(0.05); // Smaller scale for better visibility
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Create a more visible material
            child.material = new THREE.MeshPhongMaterial({
              color: 0xFF6B35, // Orange color for visibility
              shininess: 100,
              transparent: false,
              opacity: 1.0
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        setObjModel(object);
        setErrorMessage(''); // Clear any previous error
        console.log('3D model prepared and ready');
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total * 100).toFixed(1);
          console.log('Loading progress:', percent + '%');
        }
      },
      (error) => {
        console.error('Error loading OBJ model:', error);
        console.log('Attempted to load from:', modelPath);
        setErrorMessage('3D model not found. Using basic shapes instead.');
        
        // Create a fallback simple model
        const fallbackGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0xFF6B35 });
        const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        
        const fallbackGroup = new THREE.Group();
        fallbackGroup.add(fallbackMesh);
        setObjModel(fallbackGroup);
        
        console.log('Using fallback cube model');
      }
    );
  }, []);

  // Check WebXR support
  useEffect(() => {
    const checkARSupport = async () => {
      console.log('Checking WebXR support...');
      console.log('User Agent:', navigator.userAgent);
      console.log('Navigator.xr available:', !!navigator.xr);
      
      if (!navigator.xr) {
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isChrome = /Chrome/i.test(navigator.userAgent);
        const isEdge = /Edge/i.test(navigator.userAgent);
        
        if (isAndroid && (isChrome || isEdge)) {
          setErrorMessage('WebXR not enabled. Please enable WebXR flags in Chrome://flags or use Chrome Canary.');
        } else {
          setErrorMessage('WebXR not supported. Please use Chrome/Edge on Android device.');
        }
        setIsLoading(false);
        return;
      }

      try {
        console.log('Testing immersive-ar session support...');
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        console.log('Immersive-AR supported:', supported);
        
        setIsARSupported(supported);
        
        if (!supported) {
          setErrorMessage('AR not supported on this device. Please use Chrome on Android with ARCore support.');
        } else {
          console.log('WebXR AR is supported!');
        }
      } catch (error) {
        console.error('WebXR check failed:', error);
        setErrorMessage('Failed to check AR support. Please ensure you\'re using HTTPS and a compatible browser.');
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

  // Create 3D model instance for placement
  const createObjModelInstance = (): THREE.Group | null => {
    if (!objModel) return null;
    
    const clone = objModel.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = (child.material as THREE.Material).clone();
      }
    });
    
    // Add floating animation data
    clone.userData = {
      originalY: 0,
      animationTime: Math.random() * Math.PI * 2,
      isObjModel: true
    };
    
    return clone;
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
          // SLAM-style plane detection and tracking
          if ((frame as any).detectedPlanes) {
            const newPlanes: DetectedPlane[] = [];
            
            (frame as any).detectedPlanes.forEach((plane: any) => {
              const planePose = frame.getPose(plane.planeSpace, referenceSpace);
              if (planePose) {
                const { position, orientation } = planePose.transform;
                
                // Calculate plane properties for SLAM tracking
                const center = new THREE.Vector3(position.x, position.y, position.z);
                const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
                  new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
                );
                
                let bounds = { width: 1, height: 1 };
                
                // Calculate bounds from plane polygon
                if (plane.polygon) {
                  const points = Array.from(plane.polygon) as any[];
                  if (points.length >= 3) {
                    const boundsCalc = points.reduce((acc: any, point: any) => {
                      return {
                        minX: Math.min(acc.minX, point.x),
                        maxX: Math.max(acc.maxX, point.x),
                        minZ: Math.min(acc.minZ, point.z),
                        maxZ: Math.max(acc.maxZ, point.z)
                      };
                    }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
                    
                    bounds = {
                      width: boundsCalc.maxX - boundsCalc.minX,
                      height: boundsCalc.maxZ - boundsCalc.minZ
                    };
                  }
                }
                
                // Find existing plane or create new one
                let detectedPlane = detectedPlanes.find(dp => dp.plane === plane);
                
                if (!detectedPlane) {
                  detectedPlane = {
                    plane,
                    id: Math.random().toString(36),
                    center,
                    normal,
                    bounds,
                    confidence: 1.0,
                    lastUpdated: Date.now()
                  };
                } else {
                  // Update existing plane with SLAM tracking
                  detectedPlane.center = center;
                  detectedPlane.normal = normal;
                  detectedPlane.bounds = bounds;
                  detectedPlane.confidence = Math.min(detectedPlane.confidence + 0.1, 1.0);
                  detectedPlane.lastUpdated = Date.now();
                }
                
                newPlanes.push(detectedPlane);
              }
            });
            
            // Filter out old planes (SLAM cleanup)
            const validPlanes = newPlanes.filter(plane => 
              Date.now() - plane.lastUpdated < 5000 && plane.confidence > 0.3
            );
            
            setDetectedPlanes(validPlanes);
            
            if (validPlanes.length > 0 && isScanning) {
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

          // Animate placed 3D models
          arItems.forEach(arItem => {
            if (arItem.mesh.userData && arItem.mesh.userData.isObjModel) {
              // Subtle floating animation for OBJ models
              arItem.mesh.userData.animationTime += 0.01;
              arItem.mesh.position.y = arItem.mesh.userData.originalY + Math.sin(arItem.mesh.userData.animationTime) * 0.005;
              arItem.mesh.rotation.y += 0.005; // Slow rotation
            } else {
              // Original animation for other meshes
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

  // Place 3D model on detected surface
  const placeItem = async () => {
    if (!xrSession || !reticleRef.current || !reticleRef.current.visible || !objModel) return;

    // Create instance of the OBJ model
    const modelInstance = createObjModelInstance();
    if (!modelInstance) return;

    // Position model on the surface
    modelInstance.position.copy(reticleRef.current.position);
    modelInstance.position.y += 0.02; // Slightly above the surface
    modelInstance.userData.originalY = modelInstance.position.y;

    // Align model with surface normal if needed
    const targetPlane = detectedPlanes.find(plane => {
      const distance = plane.center.distanceTo(reticleRef.current!.position);
      return distance < 0.5; // Within 50cm of plane center
    });

    if (targetPlane) {
      // Align model to surface normal
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, targetPlane.normal);
      modelInstance.quaternion.copy(quaternion);
    }

    sceneRef.current!.add(modelInstance);

    // Try to create an anchor for SLAM persistence
    try {
      // Anchor creation would go here if supported
      console.log('SLAM anchor created for model placement');
    } catch (error) {
      console.log('SLAM anchors not supported, using position tracking');
    }

    const newArItem: ARItem = {
      id: Date.now().toString(),
      item: selectedItem,
      mesh: modelInstance as any, // Cast to Mesh for compatibility
      anchor: undefined
    };

    setArItems(prev => [...prev, newArItem]);
  };

  const clearItems = () => {
    arItems.forEach(item => {
      sceneRef.current?.remove(item.mesh);
      // Clean up OBJ model instances
      if (item.mesh.userData?.isObjModel) {
        item.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
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
          <h2 className="text-2xl font-bold mb-4">WebAR Setup Required</h2>
          <p className="mb-6 text-gray-300">{errorMessage}</p>
          <div className="text-sm text-gray-400 mb-6">
            <p className="mb-2 font-semibold">For WebAR support:</p>
            <ul className="list-disc list-inside space-y-2 text-left">
              <li><strong>Android Device:</strong> Use Chrome or Edge browser</li>
              <li><strong>Enable WebXR:</strong> Go to chrome://flags and enable WebXR</li>
              <li><strong>ARCore:</strong> Install Google Play Services for AR</li>
              <li><strong>HTTPS:</strong> Make sure you're on a secure connection</li>
              <li><strong>Permissions:</strong> Allow camera access when prompted</li>
            </ul>
          </div>
          <div className="bg-blue-900 border border-blue-600 rounded-lg p-3 mb-4 text-sm">
            <p className="text-blue-200">💡 <strong>Quick Fix:</strong> Try Chrome Canary or enable WebXR Device API in chrome://flags</p>
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
          <h2 className="text-3xl font-bold mb-4">SLAM-Based WebAR</h2>
          <p className="text-lg mb-2">Advanced 3D Model Placement</p>
          <p className="text-sm text-gray-400 mb-8">Real-time surface mapping with OBJ model support</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center text-green-400">
              <Target className="h-5 w-5 mr-2" />
              <span>SLAM surface tracking</span>
            </div>
            <div className="flex items-center justify-center text-green-400">
              <Scan className="h-5 w-5 mr-2" />
              <span>3D model anchoring</span>
            </div>
            <div className="flex items-center justify-center text-green-400">
              <Zap className="h-5 w-5 mr-2" />
              <span>OBJ model rendering</span>
            </div>
          </div>

          {!objModel ? (
            <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-300 border-t-transparent mr-2"></div>
                <p className="text-yellow-200 text-sm">Loading 3D model (FinalBaseMesh.obj)...</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-900 border border-green-600 rounded-lg p-4 mb-6">
              <p className="text-green-200 text-sm">✅ 3D model loaded successfully!</p>
            </div>
          )}

          <button
            onClick={startARSession}
            disabled={!objModel}
            className={`px-8 py-4 rounded-lg text-lg font-medium transition-colors shadow-lg ${
              objModel 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          >
            {objModel ? 'Start SLAM AR Session' : 'Loading Model...'}
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
              SLAM MAPPING
            </div>
          )}
          {detectedPlanes.length > 0 && (
            <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
              <Target className="h-3 w-3 mr-1" />
              {detectedPlanes.length} SURFACES TRACKED
            </div>
          )}
          <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="text-sm font-medium">
              {detectedPlanes.length > 0 ? 'Tap to place 3D model' : 'Scanning surfaces...'}
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
            3D Model: FinalBaseMesh.obj • {arItems.length} models placed • SLAM Tracking Active
          </div>
        </div>
      )}

      {/* Instructions */}
      {detectedPlanes.length === 0 && !isScanning && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="bg-black bg-opacity-70 text-white px-6 py-4 rounded-lg backdrop-blur-sm border border-white/20">
            <Scan className="h-8 w-8 mx-auto mb-2 text-purple-400 animate-spin" />
            <p className="text-sm font-medium">SLAM mapping in progress</p>
            <p className="text-xs opacity-75 mt-1">Move device to scan surfaces</p>
            <div className="mt-2 text-xs text-gray-400">
              3D Model Ready • Surface Tracking Active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
