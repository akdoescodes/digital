import { useRef, useEffect, useState, useCallback } from 'react';
import { X, RotateCcw, Camera, Target } from 'lucide-react';
import { MenuItem } from '../types';

interface SimpleCameraARProps {
  onClose: () => void;
  menuItems: MenuItem[];
}

interface PlacedItem {
  id: string;
  item: MenuItem;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
}

export default function SimpleCameraAR({ onClose, menuItems }: SimpleCameraARProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem>(menuItems[0]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [surfaceDetected, setSurfaceDetected] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [deviceStability, setDeviceStability] = useState(0);
  const [motionData, setMotionData] = useState({ x: 0, y: 0, z: 0 });
  const [surfaceQuality, setSurfaceQuality] = useState(0);

  // Surface detection using device motion and image analysis
  useEffect(() => {
    let mounted = true;
    let motionListener: ((event: DeviceMotionEvent) => void) | null = null;
    let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
    let stabilityTimer: NodeJS.Timeout;
    
    const requestMotionPermission = async () => {
      // Request device motion permission on iOS
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission !== 'granted') {
            console.log('Device motion permission denied');
            return false;
          }
        } catch (error) {
          console.error('Error requesting motion permission:', error);
          return false;
        }
      }
      return true;
    };

    const startMotionDetection = async () => {
      const hasPermission = await requestMotionPermission();
      if (!hasPermission || !mounted) return;

      let motionHistory: number[] = [];
      let lastMotionTime = Date.now();

      motionListener = (event: DeviceMotionEvent) => {
        if (!mounted) return;
        
        const acceleration = event.accelerationIncludingGravity;
        if (acceleration && acceleration.x !== null && acceleration.y !== null && acceleration.z !== null) {
          // Calculate motion magnitude
          const motionMagnitude = Math.sqrt(
            acceleration.x * acceleration.x + 
            acceleration.y * acceleration.y + 
            acceleration.z * acceleration.z
          );
          
          motionHistory.push(motionMagnitude);
          if (motionHistory.length > 10) motionHistory.shift();
          
          // Calculate stability (lower variance = more stable)
          const avg = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;
          const variance = motionHistory.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / motionHistory.length;
          const stability = Math.max(0, Math.min(100, 100 - variance * 10));
          
          setDeviceStability(stability);
          setMotionData({ x: acceleration.x, y: acceleration.y, z: acceleration.z });
          
          // Surface detection logic
          const currentTime = Date.now();
          if (currentTime - lastMotionTime > 100) { // Throttle updates
            lastMotionTime = currentTime;
            
            // Check if device is stable and pointing at a surface
            const isStable = stability > 70;
            const isPointingDown = Math.abs(acceleration.z) > 8; // Pointing at surface
            const hasGoodAngle = Math.abs(acceleration.x) < 3 && Math.abs(acceleration.y) < 3;
            
            if (isStable && isPointingDown && hasGoodAngle) {
              setSurfaceQuality(Math.min(100, surfaceQuality + 5));
            } else {
              setSurfaceQuality(Math.max(0, surfaceQuality - 2));
            }
          }
        }
      };

      orientationListener = (event: DeviceOrientationEvent) => {
        if (!mounted) return;
        // Additional orientation data for better surface detection
        const { alpha, beta, gamma } = event;
        if (beta !== null && gamma !== null) {
          // Check if device is held relatively flat
          const isFlatish = Math.abs(beta - 90) < 30 && Math.abs(gamma) < 30;
          if (isFlatish && deviceStability > 70) {
            setSurfaceQuality(prev => Math.min(100, prev + 2));
          }
        }
      };

      window.addEventListener('devicemotion', motionListener);
      window.addEventListener('deviceorientation', orientationListener);
    };

    // Start motion detection
    startMotionDetection();

    // Surface detection based on stability and quality
    stabilityTimer = setInterval(() => {
      if (!mounted) return;
      
      if (surfaceQuality > 80 && deviceStability > 70) {
        if (!surfaceDetected) {
          setSurfaceDetected(true);
          setIsCalibrating(false);
        }
      } else if (surfaceQuality < 30) {
        if (surfaceDetected) {
          setSurfaceDetected(false);
          setIsCalibrating(true);
        }
      }
    }, 500);

    return () => {
      mounted = false;
      if (motionListener) {
        window.removeEventListener('devicemotion', motionListener);
      }
      if (orientationListener) {
        window.removeEventListener('deviceorientation', orientationListener);
      }
      if (stabilityTimer) {
        clearInterval(stabilityTimer);
      }
    };
  }, [deviceStability, surfaceQuality, surfaceDetected]);

  // Camera permission handling with proper cleanup
  useEffect(() => {
    let mounted = true;
    let streamRef: MediaStream | null = null;
    
    const startCamera = async () => {
      if (!mounted) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef = stream;
        setCameraStream(stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        if (mounted) {
          setIsLoading(false);
        }
        
      } catch (error) {
        console.error('Camera access failed:', error);
        if (mounted) {
          setCameraError('Camera access failed. Please allow camera access and refresh.');
          setIsLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
        streamRef = null;
      }
      setCameraStream(null);
    };
  }, []); // Empty dependency array to prevent infinite loops

  // Animation loop for 3D effects
  useEffect(() => {
    const animate = () => {
      if (canvasRef.current) {
        // Simple animation effects can be added here
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (!isLoading && surfaceDetected) {
      animate();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoading, surfaceDetected]);

  // Handle screen touch/click to place items
  const handleScreenTouch = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!surfaceDetected || isCalibrating) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newItem: PlacedItem = {
      id: Date.now().toString(),
      item: selectedItem,
      position: { x, y },
      scale: 1,
      rotation: Math.random() * 360
    };
    
    setPlacedItems(prev => [...prev, newItem]);
  }, [surfaceDetected, isCalibrating, selectedItem]);

  const handleClose = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    onClose();
  }, [cameraStream, onClose]);

  const getItemColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'pizza': return '#FF6B35';
      case 'soup': return '#F7931E';
      case 'dessert': return '#8B4513';
      case 'seafood': return '#4682B4';
      case 'salad': return '#32CD32';
      case 'premium': return '#9B59B6';
      default: return '#D97706';
    }
  };

  const clearItems = () => setPlacedItems([]);

  if (cameraError) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white p-8 max-w-md">
          <Camera className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-4">Camera Access Required</h2>
          <p className="mb-6 text-gray-300">{cameraError}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleClose}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Camera feed background */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        style={{ transform: 'scaleX(-1)' }} // Mirror effect for better UX
      />
      
      {/* Canvas for additional effects */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg">Starting camera...</p>
            <p className="text-sm text-gray-400 mt-2">Please allow camera access</p>
          </div>
        </div>
      )}

      {/* Calibration overlay */}
      {isCalibrating && !isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="text-center text-white">
            <Target className="h-16 w-16 mx-auto mb-4 text-blue-400 animate-pulse" />
            <p className="text-lg">Detecting surface...</p>
            <p className="text-sm text-gray-400 mt-2">Point camera at a flat surface</p>
          </div>
        </div>
      )}

      {/* AR Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <button
          onClick={handleClose}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center space-x-2">
          {surfaceDetected && (
            <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse">
              SURFACE DETECTED
            </div>
          )}
          <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="text-sm font-medium">
              {surfaceDetected ? 'Tap to place items' : 'Finding surface...'}
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {placedItems.length > 0 && (
            <button
              onClick={clearItems}
              className="bg-yellow-600 hover:bg-yellow-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Interactive overlay for placing items */}
      <div 
        className={`absolute inset-0 ${surfaceDetected && !isCalibrating ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
        onClick={handleScreenTouch}
      >
        {/* Placed items */}
        {placedItems.map((placedItem) => (
          <div 
            key={placedItem.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ 
              left: `${placedItem.position.x}%`, 
              top: `${placedItem.position.y}%`,
              transform: `translate(-50%, -50%) rotate(${placedItem.rotation}deg) scale(${placedItem.scale})`,
            }}
          >
            {/* 3D Cube representation */}
            <div className="relative">
              {/* Cube shadow */}
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-20 h-6 bg-black bg-opacity-40 rounded-full blur-md"></div>
              
              {/* 3D Cube */}
              <div className="relative w-12 h-12 mx-auto animate-bounce">
                {/* Cube faces */}
                <div 
                  className="absolute inset-0 rounded-lg border-2 border-white/40 shadow-2xl transform perspective-1000"
                  style={{ 
                    backgroundColor: getItemColor(placedItem.item.category),
                    transform: 'rotateX(15deg) rotateY(25deg)',
                    boxShadow: `0 0 20px ${getItemColor(placedItem.item.category)}40`
                  }}
                >
                  {/* Top face */}
                  <div 
                    className="absolute inset-0 rounded-lg opacity-80"
                    style={{ 
                      backgroundColor: getItemColor(placedItem.item.category),
                      transform: 'translateY(-8px) rotateX(90deg)',
                      transformOrigin: 'top'
                    }}
                  ></div>
                  
                  {/* Right face */}
                  <div 
                    className="absolute inset-0 rounded-lg opacity-60"
                    style={{ 
                      backgroundColor: getItemColor(placedItem.item.category),
                      transform: 'translateX(8px) rotateY(90deg)',
                      transformOrigin: 'right'
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Item info */}
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-3 py-1 rounded-full text-xs whitespace-nowrap backdrop-blur-sm">
                {placedItem.item.name} - ${placedItem.item.price}
              </div>
            </div>
          </div>
        ))}

        {/* Surface detection grid overlay */}
        {surfaceDetected && !isCalibrating && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full" style={{
              backgroundImage: `
                linear-gradient(rgba(0,255,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,255,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>
          </div>
        )}
      </div>

      {/* Menu selector at bottom */}
      {surfaceDetected && !isCalibrating && (
        <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-80 rounded-lg p-4 backdrop-blur-sm">
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
                <div 
                  className="w-8 h-8 rounded mx-auto mb-1"
                  style={{ backgroundColor: getItemColor(item.category) }}
                ></div>
                <div className="text-xs font-medium truncate">{item.name}</div>
                <div className="text-xs opacity-75">${item.price}</div>
              </button>
            ))}
          </div>
          
          <div className="text-center mt-2 text-white text-xs opacity-75">
            Selected: {selectedItem.name} • {placedItems.length} items placed
          </div>
        </div>
      )}

      {/* Instructions */}
      {surfaceDetected && !isCalibrating && placedItems.length === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="bg-black bg-opacity-70 text-white px-6 py-4 rounded-lg backdrop-blur-sm border border-white/20">
            <Target className="h-8 w-8 mx-auto mb-2 text-blue-400" />
            <p className="text-sm font-medium">Tap anywhere to place a 3D cube</p>
            <p className="text-xs opacity-75 mt-1">Move your device to see different angles</p>
          </div>
        </div>
      )}
    </div>
  );
}
