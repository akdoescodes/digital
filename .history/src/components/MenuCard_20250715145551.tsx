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
      className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
    >
      <div className="h-48 bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center">
        <Utensils className="h-16 w-16 text-amber-600" />
      </div>
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
          <span className="text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
            {item.category}
          </span>
        </div>
        
        <p className="text-gray-600 mb-4 line-clamp-3">{item.description}</p>
        
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-amber-600">${item.price}</span>
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
            ))}
          </div>
        </div>
        
        <button className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-medium transition-colors duration-200">
          View in AR
        </button>
      </div>
    </div>
  );
}