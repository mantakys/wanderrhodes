import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/ui/Logo';
import { getSavedPlans, deletePlan } from '@/utils/plans';
import LocationCard from '@/components/LocationCard';
import { ArrowLeft } from 'lucide-react';

export default function TravelPlansPage() {
  const [plans, setPlans] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = getSavedPlans();

    setPlans(stored);
  }, []);

  const handleDelete = (timestamp) => {
    deletePlan(timestamp);
    setPlans(getSavedPlans());
  };

  return (
    <div className="min-h-screen flex flex-col text-[#F4E1C1]" style={{backgroundImage:"linear-gradient(rgba(20,24,48,0.8), rgba(20,24,48,0.9)), url('/assets/secret-beach.jpg')",backgroundSize:'cover',backgroundPosition:'center'}}>
      {/* Header */}
      <header className="relative py-3 px-4 bg-black/40 backdrop-blur-lg border-b border-white/10 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-white/10 transition"
        >
          <ArrowLeft className="text-white/80" />
        </button>

        <button onClick={() => navigate('/')} className="absolute left-1/2 -translate-x-1/2 focus:outline-none">
          <Logo className="text-3xl whitespace-nowrap" />
        </button>

        <div className="w-8" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {plans.length === 0 ? (
          <p className="text-center text-sm mt-10 opacity-80">No saved travel plans yet.</p>
        ) : (
          plans.map((plan) => (
            <PlanItem key={plan.timestamp} plan={plan} onDelete={() => handleDelete(plan.timestamp)} />
          ))
        )}
      </main>
    </div>
  );
}

function PlanItem({ plan, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const { title, timestamp, locations } = plan;

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/15 rounded-2xl p-4 shadow-lg hover:shadow-xl transition">
      <div className="flex justify-between items-center" onClick={() => setExpanded((e) => !e)}>
        <div>
          <h3 className="font-bold text-lg text-yellow-400">{title || 'Travel Plan'}</h3>
          <p className="text-xs text-white/70">{new Date(timestamp).toLocaleString()}</p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/plans/${timestamp}`);
            }}
            className="px-3 py-1 text-[10px] font-semibold rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chat?plan=${timestamp}`);
            }}
            className="px-3 py-1 text-[10px] font-semibold rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            Chat
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-3 py-1 text-[10px] font-semibold rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/40 transition"
          >
            Delete
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 space-y-4">
          {locations.map((loc, idx) => (
            <LocationCard key={idx} location={loc} />
          ))}
        </div>
      )}
    </div>
  );
} 