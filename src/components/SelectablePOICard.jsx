import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, Clock, Euro, CheckCircle, Plus } from 'lucide-react';

const SelectablePOICard = ({ poi, onSelect, isSelected = false, isLoading = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleSelect = () => {
    if (!isLoading && !isSelected) {
      onSelect(poi);
    }
  };

  // Get type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'restaurant':
        return '🍽️';
      case 'beach':
        return '🏖️';
      case 'attraction':
        return '🏛️';
      case 'shopping':
        return '🛍️';
      case 'hotel':
        return '🏨';
      case 'bar':
        return '🍺';
      case 'museum':
        return '🏛️';
      case 'park':
        return '🌳';
      default:
        return '📍';
    }
  };

  // Get type color
  const getTypeColor = (type) => {
    switch (type) {
      case 'restaurant':
        return 'bg-orange-500/20 text-orange-300';
      case 'beach':
        return 'bg-blue-500/20 text-blue-300';
      case 'attraction':
        return 'bg-purple-500/20 text-purple-300';
      case 'shopping':
        return 'bg-pink-500/20 text-pink-300';
      case 'hotel':
        return 'bg-green-500/20 text-green-300';
      case 'bar':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'museum':
        return 'bg-indigo-500/20 text-indigo-300';
      case 'park':
        return 'bg-emerald-500/20 text-emerald-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <motion.div
      className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-300 ${
        isSelected
          ? 'bg-green-500/20 border-2 border-green-400'
          : 'bg-white/5 border border-white/10 hover:border-white/20'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSelect}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          className="absolute top-2 right-2 text-green-400"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <CheckCircle size={20} />
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        </div>
      )}

      {/* POI Type Badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mb-3 ${getTypeColor(poi.type)}`}>
        <span className="text-sm">{getTypeIcon(poi.type)}</span>
        {poi.type}
      </div>

      {/* POI Name */}
      <h3 className="font-bold text-lg text-[#E8D5A4] mb-2 leading-tight">
        {poi.name}
      </h3>

      {/* POI Description */}
      <p className="text-[#F4E1C1]/80 text-sm mb-3 line-clamp-3 leading-relaxed">
        {poi.description}
      </p>

      {/* POI Details */}
      <div className="space-y-2 mb-4">
        {/* Rating */}
        {poi.details?.rating && (
          <div className="flex items-center gap-1 text-xs text-[#F4E1C1]/70">
            <Star size={12} className="text-yellow-400" />
            <span>{poi.details.rating}</span>
          </div>
        )}

        {/* Price Range */}
        {poi.details?.priceRange && (
          <div className="flex items-center gap-1 text-xs text-[#F4E1C1]/70">
            <Euro size={12} />
            <span>{poi.details.priceRange}</span>
          </div>
        )}

        {/* Opening Hours */}
        {poi.details?.openingHours && (
          <div className="flex items-center gap-1 text-xs text-[#F4E1C1]/70">
            <Clock size={12} />
            <span className="truncate">{poi.details.openingHours}</span>
          </div>
        )}

        {/* Location */}
        {poi.location?.address && (
          <div className="flex items-center gap-1 text-xs text-[#F4E1C1]/70">
            <MapPin size={12} />
            <span className="truncate">{poi.location.address}</span>
          </div>
        )}
      </div>

      {/* Highlights */}
      {poi.highlights && poi.highlights.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {poi.highlights.slice(0, 3).map((highlight, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white/5 rounded-full text-xs text-[#F4E1C1]/60 truncate"
              >
                {highlight}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Selection Button */}
      <motion.div
        className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl transition-all duration-300 ${
          isSelected
            ? 'bg-green-500/30 text-green-300'
            : isHovered
            ? 'bg-[#E8D5A4]/20 text-[#E8D5A4]'
            : 'bg-white/10 text-white/80'
        }`}
        animate={{
          scale: isHovered ? 1.05 : 1,
        }}
      >
        {isSelected ? (
          <>
            <CheckCircle size={16} />
            <span className="font-medium text-sm">Selected</span>
          </>
        ) : (
          <>
            <Plus size={16} />
            <span className="font-medium text-sm">Add to Plan</span>
          </>
        )}
      </motion.div>

      {/* Best Time to Visit */}
      {poi.bestTimeToVisit && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-[#F4E1C1]/60">
            <span className="font-medium">Best time:</span> {poi.bestTimeToVisit}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default SelectablePOICard; 