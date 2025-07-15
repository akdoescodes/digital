import { useRef, useEffect, useState, useCallback } from 'react';
import { X, RotateCcw, Camera, Target, Scan, Zap } from 'lucide-react';
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
  timestamp: number;
}

interface SurfacePoint {
  x: number;
  y: number;
  confidence: number;
  depth: number;
}

export default function SimpleCameraAR({ onClose, menuItems }: SimpleCameraARProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem>(menuItems[0]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [surfacePoints, setSurfacePoints] = useState<SurfacePoint[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [surfaceConfidence, setSurfaceConfidence] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // Advanced computer vision surface detection
  const detectSurfaces = useCallback((imageData: ImageData) => {
    const { data, width, height } = imageData;
    const surfaces: SurfacePoint[] = [];
    const gridSize = 16; // Process every 16th pixel for performance
    
    // Convert to grayscale and detect edges using Sobel operator
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      grayscale[i / 4] = gray;
    }
    
    // Sobel edge detection for surface boundaries
    for (let y = gridSize; y < height - gridSize; y += gridSize) {
      for (let x = gridSize; x < width - gridSize; x += gridSize) {
        const idx = y * width + x;
        
        // Sobel X kernel
        const gx = (
          -1 * grayscale[idx - width - 1] + 1 * grayscale[idx - width + 1] +
          -2 * grayscale[idx - 1] + 2 * grayscale[idx + 1] +
          -1 * grayscale[idx + width - 1] + 1 * grayscale[idx + width + 1]
        );
        
        // Sobel Y kernel  
        const gy = (
          -1 * grayscale[idx - width - 1] + -2 * grayscale[idx - width] + -1 * grayscale[idx - width + 1] +
          1 * grayscale[idx + width - 1] + 2 * grayscale[idx + width] + 1 * grayscale[idx + width + 1]
        );
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Low edge magnitude indicates flat surface
        if (magnitude < 30) {
          // Additional texture analysis for surface validation
          let textureVariance = 0;
          let sampleCount = 0;
          
          for (let dy = -8; dy <= 8; dy += 4) {
            for (let dx = -8; dx <= 8; dx += 4) {
              const sampleIdx = (y + dy) * width + (x + dx);
              if (sampleIdx >= 0 && sampleIdx < grayscale.length) {
                textureVariance += Math.abs(grayscale[sampleIdx] - grayscale[idx]);
                sampleCount++;
              }
            }
          }
          
          textureVariance /= sampleCount;
          
          // Low texture variance = flat surface
          if (textureVariance < 20) {
            const confidence = Math.max(0, Math.min(1, (40 - textureVariance) / 40));
            surfaces.push({
              x: x / width,
              y: y / height,
              confidence,
              depth: 1 - (magnitude / 255) // Rough depth estimation
            });
          }
        }
      }
    }
    
    return surfaces;
  }, []);

  // Real-time surface tracking
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    
    if (!ctx || !overlayCtx) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Detect surfaces every few frames for performance
    if (frameCount % 3 === 0) {
      const detectedSurfaces = detectSurfaces(imageData);
      setSurfacePoints(detectedSurfaces);
      
      // Calculate overall confidence
      const avgConfidence = detectedSurfaces.length > 0 
        ? detectedSurfaces.reduce((sum, p) => sum + p.confidence, 0) / detectedSurfaces.length
        : 0;
      setSurfaceConfidence(avgConfidence);
    }
    
    // Clear overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Draw surface detection overlay
    if (surfacePoints.length > 0) {
      // Draw detected surface points
      surfacePoints.forEach(point => {
        const x = point.x * overlayCanvas.width;
        const y = point.y * overlayCanvas.height;
        const alpha = point.confidence;
        
        overlayCtx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.6})`;
        overlayCtx.fillRect(x - 2, y - 2, 4, 4);
      });
      
      // Draw surface boundary if enough points detected
      if (surfacePoints.length > 20 && surfaceConfidence > 0.3) {
        // Group nearby points into clusters (simplified clustering)
        const clusters: SurfacePoint[][] = [];
        const processed = new Set<number>();
        
        surfacePoints.forEach((point, i) => {
          if (processed.has(i)) return;
          
          const cluster: SurfacePoint[] = [point];
          processed.add(i);
          
          surfacePoints.forEach((otherPoint, j) => {
            if (i === j || processed.has(j)) return;
            
            const distance = Math.sqrt(
              Math.pow(point.x - otherPoint.x, 2) + 
              Math.pow(point.y - otherPoint.y, 2)
            );
            
            if (distance < 0.1) { // Within 10% of screen
              cluster.push(otherPoint);
              processed.add(j);
            }
          });
          
          if (cluster.length > 3) {
            clusters.push(cluster);
          }
        });
        
        // Draw cluster boundaries
        clusters.forEach((cluster: SurfacePoint[]) => {
          if (cluster.length < 4) return;
          
          overlayCtx.strokeStyle = `rgba(0, 255, 0, ${surfaceConfidence})`;
          overlayCtx.lineWidth = 2;
          overlayCtx.setLineDash([5, 5]);
          
          overlayCtx.beginPath();
          cluster.forEach((point: SurfacePoint, i: number) => {
            const x = point.x * overlayCanvas.width;
            const y = point.y * overlayCanvas.height;
            
            if (i === 0) {
              overlayCtx.moveTo(x, y);
            } else {
              overlayCtx.lineTo(x, y);
            }
          });
          overlayCtx.closePath();
          overlayCtx.stroke();
          overlayCtx.setLineDash([]);
        });
      }
    }
    
    // Draw scanning effect
    if (isScanning) {
      const scanLine = (Date.now() % 2000) / 2000;
      overlayCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
      overlayCtx.lineWidth = 2;
      overlayCtx.beginPath();
      overlayCtx.moveTo(0, scanLine * overlayCanvas.height);
      overlayCtx.lineTo(overlayCanvas.width, scanLine * overlayCanvas.height);
      overlayCtx.stroke();
    }
    
    setFrameCount(prev => prev + 1);
  }, [detectSurfaces, surfacePoints, surfaceConfidence, isScanning, frameCount]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      processFrame();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (!isLoading && cameraStream) {
      animate();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoading, cameraStream, processFrame]);

  // Camera setup with proper orientation
  useEffect(() => {
    let mounted = true;
    let streamRef: MediaStream | null = null;
    
    const startCamera = async () => {
      if (!mounted) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30 }
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
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
        
        if (mounted) {
          setIsLoading(false);
          setIsScanning(true);
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
  }, []);

  // Handle screen touch to place items
  const handleScreenTouch = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (surfaceConfidence < 0.4) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Check if touch is near a detected surface
    const touchPoint = { x: x / 100, y: y / 100 };
    const nearSurface = surfacePoints.some(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - touchPoint.x, 2) + 
        Math.pow(point.y - touchPoint.y, 2)
      );
      return distance < 0.1 && point.confidence > 0.5;
    });
    
    if (!nearSurface) return;
    
    const newItem: PlacedItem = {
      id: Date.now().toString(),
      item: selectedItem,
      position: { x, y },
      scale: 1,
      rotation: Math.random() * 360,
      timestamp: Date.now()
    };
    
    setPlacedItems(prev => [...prev, newItem]);
  }, [surfaceConfidence, surfacePoints, selectedItem]);

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
      />
      
      {/* Hidden canvas for processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
      
      {/* Overlay canvas for surface detection visualization */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg">Initializing Advanced AR...</p>
            <p className="text-sm text-gray-400 mt-2">Loading computer vision engine</p>
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
          {isScanning && (
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse flex items-center">
              <Scan className="h-3 w-3 mr-1" />
              SCANNING
            </div>
          )}
          {surfaceConfidence > 0.4 && (
            <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
              <Target className="h-3 w-3 mr-1" />
              SURFACE DETECTED ({Math.round(surfaceConfidence * 100)}%)
            </div>
          )}
          <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
            <span className="text-sm font-medium">
              {surfaceConfidence > 0.4 ? 'Tap on highlighted areas' : 'Scanning for surfaces...'}
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
            onClick={() => setIsScanning(!isScanning)}
            className={`p-3 rounded-full transition-colors duration-200 shadow-lg ${
              isScanning ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            <Zap className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Interactive overlay for placing items */}
      <div 
        className={`absolute inset-0 ${surfaceConfidence > 0.4 ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
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
            {/* Enhanced 3D Cube */}
            <div className="relative">
              {/* Cube shadow */}
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-20 h-6 bg-black bg-opacity-40 rounded-full blur-md"></div>
              
              {/* 3D Cube with better depth */}
              <div className="relative w-12 h-12 mx-auto animate-bounce">
                <div 
                  className="absolute inset-0 rounded-lg border-2 border-white/40 shadow-2xl"
                  style={{ 
                    backgroundColor: getItemColor(placedItem.item.category),
                    transform: 'rotateX(15deg) rotateY(25deg)',
                    boxShadow: `0 0 20px ${getItemColor(placedItem.item.category)}40, inset 0 0 20px rgba(255,255,255,0.2)`
                  }}
                >
                  {/* Top face */}
                  <div 
                    className="absolute inset-0 rounded-lg opacity-80"
                    style={{ 
                      backgroundColor: getItemColor(placedItem.item.category),
                      filter: 'brightness(1.2)',
                      transform: 'translateY(-8px) rotateX(90deg)',
                      transformOrigin: 'top'
                    }}
                  ></div>
                  
                  {/* Right face */}
                  <div 
                    className="absolute inset-0 rounded-lg opacity-60"
                    style={{ 
                      backgroundColor: getItemColor(placedItem.item.category),
                      filter: 'brightness(0.8)',
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
      </div>

      {/* Menu selector at bottom */}
      {surfaceConfidence > 0.2 && (
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
            Selected: {selectedItem.name} • {placedItems.length} items placed • {surfacePoints.length} surface points detected
          </div>
        </div>
      )}

      {/* Real-time surface info */}
      {surfacePoints.length === 0 && !isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="bg-black bg-opacity-70 text-white px-6 py-4 rounded-lg backdrop-blur-sm border border-white/20">
            <Scan className="h-8 w-8 mx-auto mb-2 text-blue-400 animate-spin" />
            <p className="text-sm font-medium">Scanning for flat surfaces...</p>
            <p className="text-xs opacity-75 mt-1">Point camera at table, floor, or desk</p>
            <div className="mt-2 text-xs text-gray-400">
              Surface Detection: Computer Vision Engine Active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
