// TravelPreferences.jsx - Interactive preference selection component
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, DollarSign, MapPin, Utensils, Camera, Waves, Mountain, Building, Heart } from 'lucide-react';

const TravelPreferences = ({ onPreferencesUpdate, initialPreferences = {}, onComplete }) => {
  const [preferences, setPreferences] = useState({
    budget: initialPreferences.budget || 'moderate',
    interests: initialPreferences.interests || [],
    timeOfDay: initialPreferences.timeOfDay || [],
    groupSize: initialPreferences.groupSize || 'solo',
    pace: initialPreferences.pace || 'moderate',
    mobility: initialPreferences.mobility || 'active',
    dining: initialPreferences.dining || 'mixed',
    duration: initialPreferences.duration || 'half-day',
    ...initialPreferences
  });

  const updatePreference = (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    onPreferencesUpdate?.(newPreferences);
  };

  const toggleInterest = (interest) => {
    const newInterests = preferences.interests.includes(interest)
      ? preferences.interests.filter(i => i !== interest)
      : [...preferences.interests, interest];
    updatePreference('interests', newInterests);
  };

  const toggleTimeOfDay = (time) => {
    const newTimes = preferences.timeOfDay.includes(time)
      ? preferences.timeOfDay.filter(t => t !== time)
      : [...preferences.timeOfDay, time];
    updatePreference('timeOfDay', newTimes);
  };

  const budgetOptions = [
    { value: 'budget', label: 'Budget-Friendly', icon: '€', desc: 'Under €30/day' },
    { value: 'moderate', label: 'Moderate', icon: '€€', desc: '€30-80/day' },
    { value: 'luxury', label: 'Luxury', icon: '€€€', desc: 'Above €80/day' }
  ];

  const interestOptions = [
    { value: 'history', label: 'History', icon: Building },
    { value: 'beaches', label: 'Beaches', icon: Waves },
    { value: 'food', label: 'Food & Drink', icon: Utensils },
    { value: 'nature', label: 'Nature', icon: Mountain },
    { value: 'photography', label: 'Photography', icon: Camera },
    { value: 'nightlife', label: 'Nightlife', icon: Heart },
    { value: 'culture', label: 'Culture', icon: MapPin }
  ];

  const timeOptions = [
    { value: 'early-morning', label: 'Early Morning', time: '6:00-9:00' },
    { value: 'morning', label: 'Morning', time: '9:00-12:00' },
    { value: 'afternoon', label: 'Afternoon', time: '12:00-17:00' },
    { value: 'evening', label: 'Evening', time: '17:00-21:00' },
    { value: 'night', label: 'Night', time: '21:00+' }
  ];

  const groupOptions = [
    { value: 'solo', label: 'Solo Travel', icon: '👤' },
    { value: 'couple', label: 'Couple', icon: '👥' },
    { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
    { value: 'friends', label: 'Friends', icon: '👫' },
    { value: 'group', label: 'Large Group', icon: '👥👥' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col"
    >
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">Customize Your Experience</h3>
          <p className="text-white/70">Help me create the perfect itinerary for you</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Budget Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-white font-medium">
            <DollarSign size={18} />
            Budget Range
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {budgetOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updatePreference('budget', option.value)}
                className={`p-3 rounded-lg border transition-all text-center ${
                  preferences.budget === option.value
                    ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                    : 'border-white/20 hover:border-white/40 text-white/70 hover:text-white'
                }`}
              >
                <div className="font-semibold">{option.icon}</div>
                <div className="text-sm">{option.label}</div>
                <div className="text-xs opacity-70">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Interests Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-white font-medium">
            <Heart size={18} />
            Interests (select multiple)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {interestOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = preferences.interests.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleInterest(option.value)}
                  className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 min-h-[70px] ${
                    isSelected
                      ? 'border-purple-400 bg-purple-500/20 text-purple-300'
                      : 'border-white/20 hover:border-white/40 text-white/70 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs text-center">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Preferences */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-white font-medium">
            <Clock size={18} />
            Preferred Times (select multiple)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {timeOptions.map((option) => {
              const isSelected = preferences.timeOfDay.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleTimeOfDay(option.value)}
                  className={`p-2 rounded-lg border transition-all text-center min-h-[60px] ${
                    isSelected
                      ? 'border-green-400 bg-green-500/20 text-green-300'
                      : 'border-white/20 hover:border-white/40 text-white/70 hover:text-white'
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs opacity-70">{option.time}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Group Size */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-white font-medium">
            <Users size={18} />
            Group Size
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {groupOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updatePreference('groupSize', option.value)}
                className={`p-3 rounded-lg border transition-all text-center min-h-[70px] ${
                  preferences.groupSize === option.value
                    ? 'border-orange-400 bg-orange-500/20 text-orange-300'
                    : 'border-white/20 hover:border-white/40 text-white/70 hover:text-white'
                }`}
              >
                <div className="text-lg mb-1">{option.icon}</div>
                <div className="text-xs">{option.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 p-6 pt-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onComplete?.(preferences)}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            Update My Plan
          </button>
          <button
            onClick={() => onComplete?.(null)}
            className="px-6 py-3 border border-white/20 text-white/70 rounded-lg hover:border-white/40 hover:text-white transition-all"
          >
            Skip
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TravelPreferences; 