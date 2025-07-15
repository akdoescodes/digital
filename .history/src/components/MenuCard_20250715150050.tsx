import { Utensils, Star } from 'lucide-react';
import { MenuItem } from '../types';

interface MenuCardProps {
  item: MenuItem;
  onClick: () => void;
}

export default function MenuCard({ item, onClick }: MenuCardProps) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View ${item.name} in AR for $${item.price}`}
      className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
    >
      <div className="h-48 bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-300/30 to-orange-400/30 group-hover:scale-110 transition-transform duration-500"></div>
        <Utensils className="h-16 w-16 text-amber-600 z-10 group-hover:animate-float" aria-hidden="true" />
      </div>
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-amber-700 transition-colors duration-200">{item.name}</h3>
          <span className="text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded-full group-hover:bg-amber-200 transition-colors duration-200">
            {item.category}
          </span>
        </div>
        
        <p className="text-gray-600 mb-4 line-clamp-3 group-hover:text-gray-700 transition-colors duration-200">{item.description}</p>
        
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors duration-200" aria-label={`Price: $${item.price}`}>${item.price}</span>
          <div className="flex items-center space-x-1" aria-label="5 star rating">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 text-yellow-400 fill-current group-hover:text-yellow-500 transition-colors duration-200" aria-hidden="true" />
            ))}
          </div>
        </div>
        
        <button 
          className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          aria-label={`View ${item.name} in augmented reality`}
        >
          View in AR
        </button>
      </div>
    </div>
  );
}