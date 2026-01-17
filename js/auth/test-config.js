// Test Configuration
// Toggle these flags to test different scenarios

export const TEST_CONFIG = {
  // Show Terms of Service modal to all users (even if already accepted)
  ALWAYS_SHOW_TOS: false,  // PRODUCTION MODE: Only show to new users or on version update
  
  // Simulate max users reached (blocks all new registrations)
  SIMULATE_MAX_USERS: false,
  
  // Allow existing users to bypass max users check
  ALLOW_EXISTING_USERS: true
};

/**
 * Production mode - revert to normal behavior
 * Uncomment this to disable all test modes:
 */
/*
export const TEST_CONFIG = {
  ALWAYS_SHOW_TOS: false,
  SIMULATE_MAX_USERS: false,
  ALLOW_EXISTING_USERS: true
};
*/
