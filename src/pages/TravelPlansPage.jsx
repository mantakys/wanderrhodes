import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/ui/Logo';
import { getSavedPlans, deletePlan } from '@/utils/plans';
import LocationCard from '@/components/LocationCard';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useUser } from '@/components/ThemeProvider';

export default function TravelPlansPage() {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadPlans() {
      try {
        setIsLoading(true);
        const stored = await getSavedPlans(user);
        setPlans(stored);
      } catch (error) {
        console.error('Failed to load travel plans:', error);
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadPlans();
  }, [user]);

  const handleDelete = async (planIdentifier) => {
    try {
      const success = await deletePlan(planIdentifier, user);
      if (success) {
        // Reload plans after successful deletion
        const updatedPlans = await getSavedPlans(user);
        setPlans(updatedPlans);
      } else {
        console.error('Failed to delete plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
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

        <button
          onClick={() => navigate('/chat')}
          className="p-2 rounded-full hover:bg-white/10 transition flex items-center gap-2 text-sm font-medium"
        >
          <MessageCircle className="text-white/80 w-4 h-4" />
          <span className="text-white/80">New Chat</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="text-center mt-20">
            <div className="bg-white/5 backdrop-blur-lg border border-white/15 rounded-2xl p-8 max-w-md mx-auto">
              <p className="text-lg mb-4">Loading your travel plans...</p>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center mt-20">
            <div className="bg-white/5 backdrop-blur-lg border border-white/15 rounded-2xl p-8 max-w-md mx-auto">
              <p className="text-lg mb-4">No saved travel plans yet</p>
              <p className="text-sm opacity-80 mb-6">Start a conversation in chat to create your first travel plan for Rhodes!</p>
              <button
                onClick={() => navigate('/chat')}
                className="px-6 py-3 bg-yellow-400/20 text-yellow-300 rounded-lg hover:bg-yellow-400/30 transition font-medium"
              >
                Start Planning
              </button>
            </div>
          </div>
        ) : (
          plans.map((plan) => (
            <PlanItem 
              key={plan.id || plan.timestamp} 
              plan={plan} 
              onDelete={() => handleDelete(plan.id || plan.timestamp)}
              user={user}
            />
          ))
        )}
      </main>
    </div>
  );
}

function PlanItem({ plan, onDelete, user }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  
  // Handle both new backend format and legacy localStorage format
  const planId = plan.id || plan.timestamp;
  const planName = plan.name || plan.title || 'Travel Plan';
  const planTimestamp = plan.timestamp || (plan.createdAt ? new Date(plan.createdAt).getTime() : Date.now());
  const planData = plan.data || plan; // Backend plans have data property, localStorage plans are the data itself
  const locations = planData.locations || [];

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/15 rounded-2xl p-4 shadow-lg hover:shadow-xl transition">
      <div className="flex justify-between items-center" onClick={() => setExpanded((e) => !e)}>
        <div>
          <h3 className="font-bold text-lg text-yellow-400">{planName}</h3>
          <p className="text-xs text-white/70">{new Date(planTimestamp).toLocaleString()}</p>
          {user?.email && plan.createdAt && (
            <p className="text-xs text-green-400/70">Saved to account</p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/plans/${planId}`);
            }}
            className="px-3 py-1 text-[10px] font-semibold rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chat?plan=${planId}`);
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