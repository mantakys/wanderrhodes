// src/utils/dataMigration.js
// Utility to migrate localStorage data to backend when users first log in

import { savePlan, saveUserPreferences } from './plans.js';

const MIGRATION_KEY = 'wr_data_migrated';

/**
 * Migrate localStorage travel plans to backend
 */
async function migrateTravelPlans(user) {
  if (!user?.email || typeof window === 'undefined') return;

  try {
    const rawPlans = localStorage.getItem('travelPlans');
    if (!rawPlans) return;

    const localPlans = JSON.parse(rawPlans);
    if (!Array.isArray(localPlans) || localPlans.length === 0) return;

    console.log(`🔄 Migrating ${localPlans.length} travel plans to backend for ${user.email}`);

    let migratedCount = 0;
    for (const plan of localPlans) {
      try {
        const planName = plan.title || plan.name || `Rhodes Adventure #${Date.now()}`;
        const success = await savePlan(plan, user);
        if (success) {
          migratedCount++;
        }
      } catch (error) {
        console.error('Failed to migrate plan:', error);
      }
    }

    console.log(`✅ Successfully migrated ${migratedCount}/${localPlans.length} travel plans`);

    // Keep localStorage plans as backup for now, but mark as migrated
    if (migratedCount > 0) {
      localStorage.setItem(`${MIGRATION_KEY}_plans`, 'true');
    }

    return migratedCount;
  } catch (error) {
    console.error('Error during travel plans migration:', error);
    return 0;
  }
}

/**
 * Migrate localStorage preferences to backend
 */
async function migrateUserPreferences(user) {
  if (!user?.email || typeof window === 'undefined') return;

  try {
    const rawPrefs = localStorage.getItem('wr_user_preferences');
    if (!rawPrefs) return;

    const localPrefs = JSON.parse(rawPrefs);
    if (!localPrefs || Object.keys(localPrefs).length === 0) return;

    console.log(`🔄 Migrating user preferences to backend for ${user.email}`);

    const success = await saveUserPreferences(localPrefs, user);
    if (success) {
      console.log(`✅ Successfully migrated user preferences`);
      localStorage.setItem(`${MIGRATION_KEY}_preferences`, 'true');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error during preferences migration:', error);
    return false;
  }
}

/**
 * Check if data has already been migrated for this user
 */
function isMigrationComplete() {
  if (typeof window === 'undefined') return true;

  const plansMigrated = localStorage.getItem(`${MIGRATION_KEY}_plans`) === 'true';
  const prefsMigrated = localStorage.getItem(`${MIGRATION_KEY}_preferences`) === 'true';
  
  return plansMigrated && prefsMigrated;
}

/**
 * Main migration function - call this when user logs in
 */
export async function migrateUserData(user) {
  if (!user?.email || isMigrationComplete()) {
    return { success: true, migrated: false, message: 'No migration needed' };
  }

  console.log(`🔄 Starting data migration for ${user.email}`);

  try {
    const [plansCount, prefsSuccess] = await Promise.all([
      migrateTravelPlans(user),
      migrateUserPreferences(user)
    ]);

    const migrated = plansCount > 0 || prefsSuccess;

    if (migrated) {
      return {
        success: true,
        migrated: true,
        message: `Successfully migrated ${plansCount} travel plans${prefsSuccess ? ' and preferences' : ''} to your account!`
      };
    } else {
      return {
        success: true,
        migrated: false,
        message: 'No data to migrate'
      };
    }
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      migrated: false,
      message: 'Failed to migrate data'
    };
  }
}

/**
 * Clean up localStorage data after successful migration (optional)
 */
export function cleanupLocalStorageData() {
  if (typeof window === 'undefined') return;

  try {
    // Only clean up if migration was successful
    const plansMigrated = localStorage.getItem(`${MIGRATION_KEY}_plans`) === 'true';
    const prefsMigrated = localStorage.getItem(`${MIGRATION_KEY}_preferences`) === 'true';

    if (plansMigrated) {
      // Keep as backup for now, maybe clean up after a few weeks
      console.log('📦 Travel plans backed up in localStorage (will be cleaned later)');
    }

    if (prefsMigrated) {
      console.log('📦 Preferences backed up in localStorage (will be cleaned later)');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Force reset migration status (for testing)
 */
export function resetMigrationStatus() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(`${MIGRATION_KEY}_plans`);
  localStorage.removeItem(`${MIGRATION_KEY}_preferences`);
  console.log('🔄 Migration status reset');
} 