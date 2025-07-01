import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import './TravelPlanViewPage.css';
import Logo from '@/components/ui/Logo';
import { getSavedPlans } from '@/utils/plans';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '@/components/ThemeProvider';

// Mapbox route fetcher
async function fetchMapboxRoute(coords) {
  if (coords.length < 2) return [];
  const res = await fetch('/api/mapbox-directions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coords }),
  });
  const data = await res.json();
  return data.route || [];
}

export default function TravelPlanViewPage() {
  const { user, loading } = useUser();
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [route, setRoute] = useState([]);
  const [routeError, setRouteError] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 28.1,
    latitude: 36.1,
    zoom: 10
  });

  // Handle both backend plans (plan.data.locations) and localStorage plans (plan.locations)
  const planData = plan?.data || plan;
  const coords = planData?.locations
    ? planData.locations.map((l) => l.location?.coordinates).filter(Boolean)
    : [];

  useEffect(() => {
    async function loadPlan() {
      try {
        const plans = await getSavedPlans(user);
        // Try to find by database ID first, then by timestamp
        const foundPlan = plans.find((pl) => 
          String(pl.id) === id || String(pl.timestamp) === id
        );
        
        if (!foundPlan) {
          navigate('/plans');
          return;
        }
        
        setPlan(foundPlan);
        
        // Get the actual plan data (handle both formats)
        const actualPlanData = foundPlan.data || foundPlan;
        if (actualPlanData.locations?.[0]?.location?.coordinates) {
          const firstCoord = actualPlanData.locations[0].location.coordinates;
          setViewState({
            longitude: firstCoord.lng,
            latitude: firstCoord.lat,
            zoom: 10
          });
        }
      } catch (error) {
        console.error('Failed to load plan:', error);
        navigate('/plans');
      }
    }
    
    loadPlan();
  }, [id, navigate, user]);

  useEffect(() => {
    if (coords.length > 1) {
      fetchMapboxRoute(coords)
        .then(setRoute)
        .catch(e => setRouteError(e.message));
    } else {
      setRoute([]);
      setRouteError(null);
    }
  }, [JSON.stringify(coords)]);

  if (!plan) return null;

  const routeLayer = {
    id: 'route',
    type: 'line',
    paint: {
      'line-color': '#E8D5A4',
      'line-width': 4,
      'line-opacity': 0.85
    }
  };

  const routeSource = {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: route.map(point => [point.lng, point.lat])
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-md border-b border-white/10 p-4 relative">
        <div className="flex items-center relative">
          {/* Back arrow on the left */}
          <button
            onClick={() => navigate('/plans')}
            className="text-white text-2xl mr-4 focus:outline-none z-10"
            aria-label="Back to Plans"
          >
            <ArrowLeft className="w-7 h-7" />
          </button>
          {/* Logo absolutely centered */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center">
            <button
              onClick={() => navigate('/')}
              className="focus:outline-none"
              style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
              aria-label="Go to Home"
            >
            <Logo className="text-3xl md:text-4xl" />
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 h-[calc(100vh-80px)]">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
        >
          {/* Markers */}
          {planData.locations?.map((loc, idx) => {
            const c = loc.location?.coordinates;
            if (!c) return null;
            return (
              <Marker
                key={idx}
                longitude={c.lng}
                latitude={c.lat}
                anchor="bottom"
              >
                <div className="bg-[#E8D5A4] text-black px-2 py-1 rounded text-xs font-bold">
                  {loc.name}
                </div>
              </Marker>
            );
          })}

          {/* Route */}
          {route.length > 1 && (
            <Source {...routeSource}>
              <Layer {...routeLayer} />
            </Source>
          )}
        </Map>
        {routeError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded shadow-lg z-[1000] text-xs">
            Route error: {routeError}
          </div>
        )}
      </div>

      {/* Info board */}
      <div className="bg-black/50 backdrop-blur-md border-t border-white/10 p-4">
        <h2 className="text-xl font-bold text-[#E8D5A4] mb-2">
          {plan.name || plan.title || 'Travel Plan'}
        </h2>
        <div className="text-sm text-[#F4E1C1]/80">
          {planData.locations?.length || 0} locations • {planData.companions || 'Solo'} trip
        </div>
      </div>
    </div>
  );
} 