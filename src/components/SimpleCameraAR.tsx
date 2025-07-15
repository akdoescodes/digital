import { useRef, useEffect, useState } from 'react';
import { X, RotateCcw, Camera } from 'lucide-react';
import { MenuItem } from '../types';

interface SimpleCameraARProps {
  onClose: () => void;
  menuItems: MenuItem[];
}

export default function SimpleCameraAR({ onClose, menuItems }: SimpleCameraARProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem>(menuItems[0]);
  const [itemPosition, setItemPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Camera access failed:', error);
        setCameraError('Camera access denied. Please allow camera access and refresh.');
        setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle click/touch to place items
  const handleScreenTouch = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setItemPosition({ x, y });
  };

  const handleClose = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  const getItemColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'pizza': return '#FF6B35';
      case 'soup': return '#F7931E';
      case 'dessert': return '#8B4513';
      case 'seafood': return '#4682B4';
      case 'salad': return '#32CD32';
      default: return '#D97706';
    }
  };

  if (cameraError) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white p-8">
          <Camera className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-4">Camera Access Required</h2>
          <p className="mb-6">{cameraError}</p>
          <button
            onClick={handleClose}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg"
          >
            Close
          </button>
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
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Starting camera...</p>
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
        <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-full backdrop-blur-sm">
          <span className="text-sm font-medium">Tap screen to place items</span>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg"
        >
          <RotateCcw className="h-6 w-6" />
        </button>
      </div>

      {/* Interactive overlay for placing items */}
      <div 
        className="absolute inset-0 cursor-crosshair"
        onClick={handleScreenTouch}
      >
        {/* Virtual 3D-like dish representation */}
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
          style={{ 
            left: `${itemPosition.x}%`, 
            top: `${itemPosition.y}%`,
          }}
        >
          {/* 3D-like dish */}
          <div className="relative">
            {/* Shadow */}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-black bg-opacity-30 rounded-full blur-sm"></div>
            
            {/* Main dish */}
            <div 
              className="w-12 h-12 rounded-full shadow-lg border-4 border-white/30 animate-bounce"
              style={{ backgroundColor: getItemColor(selectedItem.category) }}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-transparent"></div>
            </div>
            
            {/* Item label */}
            <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs whitespace-nowrap">
              {selectedItem.name} - ${selectedItem.price}
            </div>
          </div>
        </div>
      </div>

      {/* Menu selector at bottom */}
      <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 rounded-lg p-4 backdrop-blur-sm">
        <div className="flex space-x-2 overflow-x-auto">
          {menuItems.slice(0, 6).map((item, index) => (
            <button
              key={index}
              onClick={() => setSelectedItem(item)}
              className={`flex-shrink-0 p-3 rounded-lg transition-all duration-200 ${
                selectedItem.name === item.name 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <div className="text-xs font-medium">{item.name}</div>
              <div className="text-xs opacity-75">${item.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* AR Feature Indicator */}
      <div className="absolute top-20 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
        CAMERA AR
      </div>
    </div>
  );
}
