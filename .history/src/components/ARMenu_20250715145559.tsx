import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, RootState } from '@react-three/fiber';
import { Text, Box, Plane } from '@react-three/drei';
import { X, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { MenuItem } from '../types';

interface ARMenuProps {
  onClose: () => void;
  menuItems: MenuItem[];
}

function MenuItem3D({ item, position, onClick }: { item: MenuItem; position: [number, number, number]; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state: RootState) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.02;
    }
  });

  return (
    <group position={position}>
      <Box
        ref={meshRef}
        args={[0.15, 0.15, 0.15]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.1 : 1}
      >
        <meshStandardMaterial color={hovered ? '#F59E0B' : '#D97706'} />
      </Box>
      <Text
        position={[0, -0.15, 0]}
        fontSize={0.03}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {item.name}
      </Text>
      <Text
        position={[0, -0.2, 0]}
        fontSize={0.025}
        color="#F59E0B"
        anchorX="center"
        anchorY="middle"
      >
        ${item.price}
      </Text>
    </group>
  );
}

function ARScene({ menuItems, onItemClick }: { menuItems: MenuItem[]; onItemClick: (item: MenuItem) => void }) {
  const { scene } = useThree();

  useEffect(() => {
    const startARSession = async () => {
      try {
        if ('xr' in navigator && navigator.xr) {
          const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['plane-detection'],
            optionalFeatures: ['dom-overlay'],
          });
          
          const referenceSpace = await session.requestReferenceSpace('local');
          
          const onFrame = (time: number, frame: XRFrame) => {
            const pose = frame.getViewerPose(referenceSpace);
            if (pose) {
              // Handle plane detection
              const results = frame.getHitTestResults;
              // This is a simplified version - actual plane detection requires more complex setup
              console.log('AR frame detected', { time, results });
            }
          };
          
          session.requestAnimationFrame(onFrame);
        }
      } catch (error) {
        console.error('AR session failed:', error);
      }
    };

    startARSession();
  }, []);

  // Create virtual surface for demonstration
  useEffect(() => {
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#10B981', transparent: true, opacity: 0.3 })
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, -0.5, -1);
    scene.add(surface);

    return () => {
      scene.remove(surface);
    };
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Virtual table surface */}
      <Plane args={[1, 1]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -1]}>
        <meshStandardMaterial color="#10B981" transparent opacity={0.3} />
      </Plane>
      
      {/* Menu items arranged on the surface */}
      {menuItems.slice(0, 6).map((item, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = 0.3;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        return (
          <MenuItem3D
            key={index}
            item={item}
            position={[x, -0.3, -1 + z]}
            onClick={() => onItemClick(item)}
          />
        );
      })}
      
      {/* AR Menu Title */}
      <Text
        position={[0, 0.3, -1]}
        fontSize={0.08}
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

export default function ARMenu({ onClose, menuItems }: ARMenuProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item);
  };

  return (
    <div className="relative w-full h-full">
      {/* AR Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors duration-200"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-full">
          <span className="text-sm font-medium">Point camera at a flat surface</span>
        </div>
        <button className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-colors duration-200">
          <RotateCcw className="h-6 w-6" />
        </button>
      </div>

      {/* 3D AR Scene */}
      <Canvas
        camera={{ position: [0, 0, 0], fov: 75 }}
        style={{ background: 'transparent' }}
      >
        <ARScene menuItems={menuItems} onItemClick={handleItemClick} />
      </Canvas>

      {/* Item Details Overlay */}
      {selectedItem && (
        <div className="absolute bottom-4 left-4 right-4 bg-white bg-opacity-95 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-gray-900">{selectedItem.name}</h3>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-3">{selectedItem.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-amber-600">${selectedItem.price}</span>
            <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* AR Instructions */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full">
        <p className="text-sm text-center">Tap on menu items to view details</p>
      </div>
    </div>
  );
}