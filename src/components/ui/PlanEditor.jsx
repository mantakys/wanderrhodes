// PlanEditor.jsx - Interactive travel plan editing component
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  GripVertical, 
  X, 
  Plus, 
  Clock, 
  MapPin, 
  Star, 
  Edit3, 
  Save, 
  RotateCcw,
  Navigation
} from 'lucide-react';
import LocationCard from '../LocationCard';

const PlanEditor = ({ 
  locations = [], 
  onUpdate, 
  onSave, 
  onClose, 
  preferences = {} 
}) => {
  const [editableLocations, setEditableLocations] = useState(locations);
  const [isDirty, setIsDirty] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    setEditableLocations(locations);
    setIsDirty(false);
  }, [locations]);

  const updateLocations = (newLocations) => {
    setEditableLocations(newLocations);
    setIsDirty(true);
    onUpdate?.(newLocations);
  };

  const removeLocation = (index) => {
    const newLocations = editableLocations.filter((_, i) => i !== index);
    updateLocations(newLocations);
  };

  const editLocation = (index, updates) => {
    const newLocations = [...editableLocations];
    newLocations[index] = { ...newLocations[index], ...updates };
    updateLocations(newLocations);
    setEditingLocation(null);
  };

  const addCustomLocation = () => {
    const newLocation = {
      name: "Custom Location",
      type: "Custom",
      description: "Add your own destination",
      location: {
        address: "Click to set address",
        coordinates: { lat: 36.4341, lng: 28.2176 }
      },
      details: {
        openingHours: "Flexible",
        priceRange: "€",
        rating: "New",
        website: "",
        phone: ""
      },
      highlights: ["Customizable experience"],
      tips: ["Add your own notes"],
      bestTimeToVisit: "Anytime",
      nearbyAttractions: [],
      travel: { distanceMeters: 0, durationMinutes: 0 },
      isCustom: true
    };
    updateLocations([...editableLocations, newLocation]);
  };

  const resetPlan = () => {
    setEditableLocations(locations);
    setIsDirty(false);
    setEditingLocation(null);
  };

  const calculateTotalTime = () => {
    return editableLocations.reduce((total, location) => {
      return total + (location.travel?.durationMinutes || 0);
    }, 0);
  };

  const calculateTotalDistance = () => {
    return editableLocations.reduce((total, location) => {
      return total + (location.travel?.distanceMeters || 0);
    }, 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Edit Your Travel Plan</h2>
              <p className="text-white/70 mt-1">
                Customize your itinerary by reordering, editing, or adding locations
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={24} className="text-white/70" />
            </button>
          </div>

          {/* Plan Summary */}
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2 text-blue-300">
              <MapPin size={16} />
              <span>{editableLocations.length} locations</span>
            </div>
            <div className="flex items-center gap-2 text-green-300">
              <Clock size={16} />
              <span>{Math.round(calculateTotalTime() / 60)}h {calculateTotalTime() % 60}m total</span>
            </div>
            <div className="flex items-center gap-2 text-purple-300">
              <Navigation size={16} />
              <span>{(calculateTotalDistance() / 1000).toFixed(1)}km distance</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <Reorder.Group
            axis="y"
            values={editableLocations}
            onReorder={updateLocations}
            className="space-y-4"
          >
            <AnimatePresence>
              {editableLocations.map((location, index) => (
                <Reorder.Item
                  key={`${location.name}-${index}`}
                  value={location}
                  className="group"
                >
                  <motion.div
                    layout
                    className="bg-black/20 rounded-lg border border-white/10 overflow-hidden"
                  >
                    {/* Location Header with Drag Handle */}
                    <div className="flex items-center gap-3 p-4 bg-white/5">
                      <div className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70">
                        <GripVertical size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm">
                            Stop {index + 1}
                          </span>
                          <h3 className="text-white font-medium">{location.name}</h3>
                          <span className="text-white/50 text-sm">({location.type})</span>
                        </div>
                        {location.travel && location.travel.durationMinutes > 0 && (
                          <p className="text-white/60 text-sm mt-1">
                            {location.travel.durationMinutes}min travel • {(location.travel.distanceMeters / 1000).toFixed(1)}km
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingLocation(index)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Edit3 size={16} className="text-white/70" />
                        </button>
                        <button
                          onClick={() => removeLocation(index)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <X size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Location Details */}
                    <AnimatePresence>
                      {editingLocation === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10"
                        >
                          <LocationCard
                            location={location}
                            isEditable={true}
                            onEdit={(updates) => editLocation(index, updates)}
                            onCancel={() => setEditingLocation(null)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          {/* Add Location Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addCustomLocation}
            className="w-full mt-6 p-4 border-2 border-dashed border-white/20 rounded-lg hover:border-white/40 transition-colors flex items-center justify-center gap-2 text-white/70 hover:text-white"
          >
            <Plus size={20} />
            <span>Add Custom Location</span>
          </motion.button>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-black/20">
          <div className="flex gap-3">
            <button
              onClick={() => onSave?.(editableLocations)}
              disabled={!isDirty}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                isDirty
                  ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              Save Changes
            </button>
            
            <button
              onClick={resetPlan}
              disabled={!isDirty}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                isDirty
                  ? 'border border-orange-400 text-orange-300 hover:bg-orange-500/20'
                  : 'border border-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw size={18} />
              Reset
            </button>

            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-white/20 text-white/70 rounded-lg hover:border-white/40 hover:text-white transition-all"
            >
              Close
            </button>
          </div>

          {isDirty && (
            <p className="text-yellow-400 text-sm mt-3 flex items-center gap-2">
              <Star size={16} />
              You have unsaved changes
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PlanEditor; 