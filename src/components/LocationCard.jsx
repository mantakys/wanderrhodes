import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ChevronIcon = ({ isExpanded }) => (
  <motion.div
    animate={{ rotate: isExpanded ? 180 : 0 }}
    transition={{ duration: 0.3 }}
    className="ml-1"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </motion.div>
);

const LocationCard = ({ location }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeData, setPlaceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isExpanded && !placeData && !isLoading && !error) {
      const fetchPlaceData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const endpoint = '/api/place-photo';
          
          // Use precise query with location context for Rhodes
          const query = `${location.name}, Rhodes, Greece`;
          
          console.log(`🔍 Searching for photo: ${query}`);
          
          const res = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
            signal: AbortSignal.timeout(15000) // 15 second timeout
          });
          
          if (!res.ok) {
            if (res.status === 404) {
              throw new Error('No photos found for this location.');
            } else {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          }

          const data = await res.json();
          console.log(`✅ Successfully found photo for: ${location.name}`);
          setPlaceData(data);
        } catch (err) {
          const errorMessage = err.name === 'TimeoutError' 
            ? 'Request timed out. Please try again later.'
            : err.message;
          setError(errorMessage);
          console.error(`Failed to fetch place data for ${location.name}:`, err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchPlaceData();
    }
  }, [isExpanded, location.name, location.location.address, placeData, isLoading, error]);

  const displayName = placeData?.name || location.name;
  const displayAddress = placeData?.address || location.location.address;

  return (
    <motion.div
      layout
      className={`relative bg-black/50 rounded-lg shadow-lg p-4 mb-4 backdrop-blur-md border border-white/10 ${!isExpanded ? 'cursor-pointer' : 'cursor-default'}`}
      whileHover={!isExpanded ? { scale: 1.02, transition: { duration: 0.2 } } : {}}
      onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      transition={{ layout: { duration: 0.3, type: 'spring' } }}
    >
      <motion.div layout="position">
        {/* Basic Info (Always Visible) */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-[#E8D5A4]">{displayName}</h3>
            <p className="text-sm text-[#F4E1C1]/80 capitalize">{location.type}</p>
          </div>
          {location.details?.rating && (
            <div className="bg-[#E8D5A4]/20 text-[#E8D5A4] px-2 py-1 rounded-md text-sm font-bold">
              {location.details.rating} ★
            </div>
          )}
        </div>

        {/* Travel distance/time chip */}
        {location.travel && (location.travel.durationMinutes || location.travel.distanceMeters) && (
          <div className="mt-2 text-xs text-[#F4E1C1]/80 flex gap-2 items-center">
            {location.travel.durationMinutes && (
              <span>{Math.round(location.travel.durationMinutes)} min</span>
            )}
            {location.travel.distanceMeters && (
              <span>· {(location.travel.distanceMeters / 1000).toFixed(1)} km</span>
            )}
          </div>
        )}

        <p className="text-[#F4E1C1]/90 mt-2 text-sm">{location.description}</p>
      </motion.div>
      
      {!isExpanded && (
        <motion.div
          layout="position"
          className="flex items-center justify-center text-xs font-semibold text-[#E8D5A4]/70 mt-4"
        >
          <span>Click to expand</span>
          <ChevronIcon isExpanded={isExpanded} />
        </motion.div>
      )}

      {/* Expandable Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.3 } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.3 } }}
            className="mt-4 overflow-hidden"
          >
            <div className="border-t border-white/20 pt-4">
              
              {/* Image Gallery */}
              <div className="mb-4">
                {isLoading && (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-[#F4E1C1]/70">Loading photo...</p>
                  </div>
                )}
                {error && !isLoading && (
                  <div className="h-48 flex flex-col items-center justify-center gap-2">
                    <p className="text-red-400/80 text-sm text-center px-4">{error}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setError(null);
                        setPlaceData(null);
                        // This will trigger the useEffect to retry
                      }}
                      className="text-[#E8D5A4] hover:text-[#F4E1C1] text-sm underline transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {placeData?.photoUrl && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-48 flex items-center justify-center overflow-hidden rounded-lg bg-black/30"
                  >
                    <img
                      src={`/api/photo-proxy?url=${encodeURIComponent(placeData.photoUrl)}`}
                      alt={`Photo of ${displayName}`}
                      className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg"
                      onError={(e) => {
                        console.error('Image failed to load:', placeData.photoUrl);
                        // Hide the image and show an error message
                        e.target.style.display = 'none';
                        const errorDiv = e.target.parentElement.querySelector('.image-error');
                        if (!errorDiv) {
                          const errorElement = document.createElement('div');
                          errorElement.className = 'image-error text-red-400/80 text-sm text-center';
                          errorElement.textContent = 'Image failed to load';
                          e.target.parentElement.appendChild(errorElement);
                        }
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', placeData.photoUrl);
                      }}
                    />
                  </motion.div>
                )}
              </div>

              {/* Location Details */}
              <div className="mb-4">
                <h4 className="font-semibold text-[#E8D5A4] mb-1">Location</h4>
                <p className="text-[#F4E1C1]/80 text-sm">{displayAddress}</p>
              </div>

              {/* Practical Details */}
              <div className="mb-4">
                <h4 className="font-semibold text-[#E8D5A4] mb-1">Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {location.details?.openingHours && (
                    <div>
                      <span className="text-[#F4E1C1]/70">Hours: </span>
                      <span className="text-[#F4E1C1]/90">{location.details.openingHours}</span>
                    </div>
                  )}
                  {location.details?.priceRange && (
                    <div>
                      <span className="text-[#F4E1C1]/70">Price: </span>
                      <span className="text-[#F4E1C1]/90">{location.details.priceRange}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Highlights */}
              {location.highlights?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-[#E8D5A4] mb-1">Highlights</h4>
                  <ul className="list-disc list-inside text-[#F4E1C1]/80 text-sm space-y-1">
                    {location.highlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tips */}
              {location.tips?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-[#E8D5A4] mb-1">Local Tips</h4>
                  <ul className="list-disc list-inside text-[#F4E1C1]/80 text-sm space-y-1">
                    {location.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Best Time to Visit */}
              {location.bestTimeToVisit && (
                <div className="mb-4">
                  <h4 className="font-semibold text-[#E8D5A4] mb-1">Best Time to Visit</h4>
                  <p className="text-[#F4E1C1]/80 text-sm">{location.bestTimeToVisit}</p>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-4 text-sm mt-4 pt-4 border-t border-white/10">
                {location.details?.website && (
                  <a
                    href={location.details.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E8D5A4] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Visit Website
                  </a>
                )}
                {location.details?.phone && (
                  <a
                    href={`tel:${location.details.phone}`}
                    className="text-[#E8D5A4] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Call
                  </a>
                )}
                {location.location?.coordinates && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${location.location.coordinates.lat}&mlon=${location.location.coordinates.lng}#map=16/${location.location.coordinates.lat}/${location.location.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E8D5A4] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on Map
                  </a>
                )}
              </div>
            </div>
            
            <motion.div
              layout="position"
              className="flex items-center justify-center text-xs font-semibold text-[#E8D5A4]/70 mt-4 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
            >
              <span>Click to collapse</span>
              <ChevronIcon isExpanded={isExpanded} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LocationCard; 