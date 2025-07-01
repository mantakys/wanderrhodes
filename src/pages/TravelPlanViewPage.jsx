import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import './TravelPlanViewPage.css';
import Logo from '@/components/ui/Logo';
import { getSavedPlans } from '@/utils/plans';
import { ArrowLeft } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

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
  const [showAllMarkers, setShowAllMarkers] = useState(false);

  const coords = plan?.locations
    ? plan.locations.map((l) => l.location?.coordinates).filter(Boolean)
    : [];

  // Calculate center of all points
  const getCenter = (coords) => {
    if (!coords.length) return { lng: 28.1, lat: 36.1 };
    const lng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;
    const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
    return { lng, lat };
  };

  // Calculate bounds for all points
  const getBounds = (coords) => {
    if (!coords.length) return null;
    let minLng = coords[0].lng, maxLng = coords[0].lng;
    let minLat = coords[0].lat, maxLat = coords[0].lat;
    coords.forEach(({ lng, lat }) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    return [ [minLng, minLat], [maxLng, maxLat] ];
  };

  // Initial center for single marker
  const center = getCenter(coords);

  // Ref for map instance
  const mapRef = React.useRef();

  // On click, zoom to fit all points and show all markers
  const handleShowPlan = () => {
    setShowAllMarkers(true);
    // Fit bounds
    if (mapRef.current && coords.length > 1) {
      const bounds = getBounds(coords);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 80, duration: 1200 });
      }
    }
  };

  useEffect(() => {
    const p = getSavedPlans().find((pl) => String(pl.timestamp) === id);
    if (!p) {
      navigate('/plans');
    } else {
      setPlan(p);
      if (p.locations?.[0]?.location?.coordinates) {
        const firstCoord = p.locations[0].location.coordinates;
        setViewState({
          longitude: firstCoord.lng,
          latitude: firstCoord.lat,
          zoom: 10
        });
      }
    }
  }, [id, navigate]);

  useEffect(() => {
    if (coords.length > 1) {
      console.log('Sending coords to directions API:', coords);
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
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center pointer-events-none">
            <Logo className="text-3xl md:text-4xl" />
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 h-[calc(100vh-80px)]">
        <Map
          {...(showAllMarkers ? viewState : { ...viewState, longitude: center.lng, latitude: center.lat })}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
          ref={mapRef}
        >
          {/* Step 1: Show only central marker */}
          {!showAllMarkers && coords.length > 0 && (
            <Marker longitude={center.lng} latitude={center.lat} anchor="bottom">
              <button
                className="bg-[#E8D5A4] text-black px-3 py-2 rounded-lg text-sm font-bold shadow-lg border-2 border-yellow-500 hover:bg-yellow-200 transition"
                onClick={handleShowPlan}
                style={{ cursor: 'pointer' }}
              >
                Show Plan
              </button>
            </Marker>
          )}

          {/* Step 2: Show all markers and route */}
          {showAllMarkers && plan.locations.map((loc, idx) => {
            const c = loc.location?.coordinates;
            if (!c) return null;
            const isStart = idx === 0;
            const isFinish = idx === plan.locations.length - 1;
            return (
              <Marker
                key={idx}
                longitude={c.lng}
                latitude={c.lat}
                anchor="bottom"
              >
                <div
                  className={`wr-pill ${isStart ? 'wr-pill-start' : isFinish ? 'wr-pill-finish' : ''}`}
                >
                  {isStart ? 'Start: ' : isFinish ? 'Finish: ' : ''}{loc.name.length > 20 ? loc.name.slice(0,17)+'…' : loc.name}
                </div>
              </Marker>
            );
          })}

          {/* Route */}
          {showAllMarkers && Array.isArray(route) && route.length > 0 && route[0]?.coordinates ? (
            route.map((segment, idx) => (
              <Source
                key={idx}
                type="geojson"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: segment.coordinates.map(point => [point.lng, point.lat])
                  }
                }}
              >
                <Layer
                  id={`route-segment-${idx}`}
                  type="line"
                  paint={segment.durationMinutes <= 5
                    ? {
                        'line-color': '#2196F3',
                        'line-width': 4,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.85
                      }
                    : {
                        'line-color': '#1565C0',
                        'line-width': 4,
                        'line-opacity': 0.85
                      }
                  }
                />
              </Source>
            ))
          ) : showAllMarkers && route.length > 0 ? (
            <Source {...routeSource}>
              <Layer {...routeLayer} />
            </Source>
          ) : null}
          {/* Debug: Show message if route is missing */}
          {showAllMarkers && coords.length > 1 && route.length === 0 && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-700 text-white px-3 py-1 rounded shadow-lg z-[1000] text-xs">
              No route found or route not loaded.{routeError ? ` (${routeError})` : ''}
            </div>
          )}
          {/* Fallback: Draw straight line if route fails but coords are present */}
          {showAllMarkers && coords.length > 1 && route.length === 0 && (
            <Source
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: coords.map(point => [point.lng, point.lat])
                }
              }}
            >
              <Layer
                id="fallback-route"
                type="line"
                paint={{
                  'line-color': '#ff0000',
                  'line-width': 2,
                  'line-opacity': 0.7
                }}
              />
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
        <h2 className="text-xl font-bold text-[#E8D5A4] mb-2">{plan.name}</h2>
        <div className="text-sm text-[#F4E1C1]/80">
          {plan.locations.length} locations • {plan.companions || 'Solo'} trip
        </div>
      </div>
    </div>
  );
} 