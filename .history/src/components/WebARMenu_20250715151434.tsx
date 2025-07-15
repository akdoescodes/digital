import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { X, RotateCcw, Camera } from 'lucide-react';
import * as THREE from 'three';
import { MenuItem } from '../types';

interface WebARMenuProps {
  onClose: () => void;
  menuItems: MenuItem[];
}

function MenuItem3D({ item, position }: { item: MenuItem; position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state: any) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  // Different shapes for different food categories
  const getShape = () => {
    switch (item.category.toLowerCase()) {
      case 'pizza':
        return <cylinderGeometry args={[0.2, 0.2, 0.05, 8]} />;
      case 'soup':
        return <sphereGeometry args={[0.15]} />;
      case 'dessert':
        return <coneGeometry args={[0.15, 0.3, 8]} />;
      default:
        return <boxGeometry args={[0.2, 0.15, 0.2]} />;
    }
  };

  const getColor = () => {
    switch (item.category.toLowerCase()) {
      case 'pizza': return '#FF6B35';
      case 'soup': return '#F7931E';
      case 'dessert': return '#8B4513';
      case 'seafood': return '#4682B4';
      case 'salad': return '#32CD32';
      default: return '#D97706';
    }
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.2 : 1}
      >
        {getShape()}
        <meshStandardMaterial color={getColor()} />
      </mesh>
      
      <Text
        position={[0, -0.3, 0]}
        fontSize={0.08}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {item.name}
      </Text>
      
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.06}
        color="#F59E0B"
        anchorX="center"
        anchorY="middle"
      >
        ${item.price}
      </Text>
    </group>
  );
}

function ARScene({ menuItems }: { menuItems: MenuItem[] }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      {/* Virtual table surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -2]}>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial 
          color="#8B4513" 
          transparent 
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Menu items arranged in a circle */}
      {menuItems.slice(0, 8).map((item, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const radius = 0.8;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius - 2;
        
        return (
          <MenuItem3D
            key={index}
            item={item}
            position={[x, -0.2, z]}
          />
        );
      })}
      
      {/* Center title */}
      <Text
        position={[0, 0.5, -2]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        AR Bistro Menu
      </Text>
    </>
  );
}

export default function WebARMenu({ onClose, menuItems }: WebARMenuProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', // Use back camera if available
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

  const handleClose = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    onClose();
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
          <span className="text-sm font-medium">Point camera at a flat surface</span>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-colors duration-200 shadow-lg"
        >
          <RotateCcw className="h-6 w-6" />
        </button>
      </div>

      {/* 3D AR Scene Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas
          camera={{ position: [0, 2, 5], fov: 60 }}
          style={{ background: 'transparent' }}
        >
          <ARScene menuItems={menuItems} />
        </Canvas>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-full backdrop-blur-sm">
        <p className="text-sm text-center">Move your phone to see 3D menu items on the table</p>
      </div>

      {/* AR Feature Indicator */}
      <div className="absolute top-20 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
        AR ACTIVE
      </div>
    </div>
  );
}
