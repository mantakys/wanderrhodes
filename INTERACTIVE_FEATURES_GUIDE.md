# 🗺️ Interactive Travel Planning Features Guide

## 🎯 How to Access Interactive Features

The interactive travel planning features are integrated into the **Chat Page** (`/chat`). Here's how to trigger them:

### 1. **Travel Preferences Collection** 
**Trigger phrases to try:**
- "Plan a romantic day in Rhodes"
- "I want to explore Rhodes but need to set my preferences first"
- "Help me plan a trip based on my preferences"

**What happens:**
- Agent responds with `|||PREFERENCES|||` marker
- Interactive preference modal opens
- Set budget, interests, time preferences, group size, etc.
- Preferences are saved and used for personalized recommendations

### 2. **Plan Editor (Drag & Drop)**
**Trigger phrases to try:**
- "Create a family day trip with kids"
- "Plan a full day itinerary for me"
- "I want to customize this travel plan"

**What happens:**
- Agent creates a travel plan with locations
- Agent responds with `|||EDIT_PLAN|||` marker  
- Plan editor opens with drag-and-drop interface
- Reorder stops, add/remove locations, adjust timing

### 3. **Interactive Agent Responses**
**Features include:**
- Preference-aware recommendations
- Dynamic plan customization
- Real-time location suggestions
- Personalized routing optimization

---

## 🚀 How to Test the Features

### Step 1: Start the Application
```bash
# Start backend (in one terminal)
node backend/server.js

# Start frontend (in another terminal)  
npm run dev
```

### Step 2: Navigate to Chat
- Go to `http://localhost:5173/chat`
- No payment required for testing

### Step 3: Trigger Interactive Features
Try these exact prompts to see the features in action:

#### **For Preferences:**
```
"I want to plan a romantic day in Rhodes, but let me set my preferences first"
```

#### **For Plan Editing:**
```
"Create a family-friendly itinerary that I can customize"
```

#### **For Multiple Options:**
```
"Show me different restaurant options I can choose from"
```

---

## 🔧 Technical Implementation

### Frontend Components Created:
- `src/components/ui/TravelPreferences.jsx` - Interactive preference collection
- `src/components/ui/PlanEditor.jsx` - Drag-and-drop plan editing
- `src/components/ui/AgentStatusIndicator.jsx` - Shows agent metadata

### Backend Integration:
- `backend/agentHandler.js` - Enhanced with user preferences
- Agent prompts include preference context
- Interactive response markers (`|||PREFERENCES|||`, `|||EDIT_PLAN|||`)

### Key Features:
- ✅ Persistent preference storage (localStorage)
- ✅ Real-time plan modification
- ✅ Drag-and-drop reordering
- ✅ Location addition/removal
- ✅ Travel time calculations
- ✅ Preference-aware recommendations

---

## 🐛 Troubleshooting

**If interactive features don't appear:**
1. Check browser console for errors
2. Ensure all components are properly imported
3. Verify agent is triggering correct markers
4. Check if framer-motion is installed: `npm install framer-motion`

**If agent doesn't trigger interactive features:**
1. The agent needs specific prompts to trigger markers
2. Try the exact phrases listed above
3. Check backend logs for agent execution

---

## 🔗 Quick Links

- **Chat Page:** `/chat`
- **Backend Logs:** Check terminal running `node backend/server.js`
- **Agent Test:** `node backend/test-agent.js` (for debugging)
- **Component Files:** `src/components/ui/TravelPreferences.jsx` & `PlanEditor.jsx` 