import { useState, useEffect } from 'react';
import { ChefHat, Utensils, Eye, ShoppingCart } from 'lucide-react';
import SimpleCameraAR from './components/SimpleCameraAR';
import MenuCard from './components/MenuCard';
import LoadingSpinner from './components/LoadingSpinner';
import { menuItems } from './data/menuData';
import { MenuItem } from './types';

function App() {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isARActive, setIsARActive] = useState(false);
  const [isCheckingAR, setIsCheckingAR] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    const checkARSupport = async () => {
      try {
        // Check if camera is available (which most devices have)
        const hasCamera = await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            stream.getTracks().forEach(track => track.stop());
            return true;
          })
          .catch(() => false);
        
        setIsARSupported(hasCamera);
      } catch (error) {
        console.error('Camera check failed:', error);
        setIsARSupported(false);
      } finally {
        setIsCheckingAR(false);
      }
    };

    checkARSupport();
  }, []);

  const startAR = async () => {
    try {
      setIsARActive(true);
    } catch (error) {
      console.error('Failed to start AR session:', error);
      alert('Camera not available. Please allow camera access.');
    }
  };

  const stopAR = async () => {
    try {
      setIsARActive(false);
    } catch (error) {
      console.error('Failed to stop AR session:', error);
      setIsARActive(false);
    }
  };

  if (isARActive) {
    return (
      <div className="fixed inset-0 bg-black">
        <SimpleCameraAR onClose={stopAR} menuItems={menuItems} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <ChefHat className="h-8 w-8 text-amber-600" />
              <h1 className="text-2xl font-bold text-gray-900">AR Bistro</h1>
            </div>
            <div className="flex items-center space-x-4">
              {!isCheckingAR && isARSupported && (
                <button
                  onClick={startAR}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
                >
                  <Eye className="h-5 w-5" />
                  <span>Camera AR</span>
                </button>
              )}
              <Utensils className="h-6 w-6 text-gray-700" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Experience Our Menu in <span className="text-amber-600">Augmented Reality</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Use your device camera to see virtual dishes placed on any flat surface
          </p>
          {isCheckingAR ? (
            <LoadingSpinner size="lg" message="Checking camera access..." />
          ) : isARSupported ? (
            <button
              onClick={startAR}
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Start Camera AR
            </button>
          ) : (
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800">
                Camera access required for AR experience. Please allow camera access and refresh the page.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Menu Grid */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-12 text-center">Our Menu</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item, index) => (
              <MenuCard
                key={index}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <ChefHat className="h-8 w-8 text-amber-400" />
            <span className="text-2xl font-bold">AR Bistro</span>
          </div>
          <p className="text-gray-400">
            The future of dining is here. Experience our menu in augmented reality.
          </p>
        </div>
      </footer>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{selectedItem.name}</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="h-48 bg-gradient-to-br from-amber-200 to-orange-300 rounded-lg mb-4 flex items-center justify-center">
              <Utensils className="h-16 w-16 text-amber-600" />
            </div>
            <p className="text-gray-600 mb-4">{selectedItem.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-amber-600">${selectedItem.price}</span>
              <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;