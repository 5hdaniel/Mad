/**
 * Analytics Utility
 * Manages Microsoft Clarity and Google Analytics tracking for the application
 */

/**
 * Initialize Microsoft Clarity tracking
 * @param {string} clarityId - Microsoft Clarity project ID
 */
export const initializeMicrosoftClarity = (clarityId) => {
  if (!clarityId || clarityId === 'your_clarity_project_id') {
    console.log('Microsoft Clarity: No project ID configured');
    return;
  }

  try {
    // Microsoft Clarity tracking code
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", clarityId);

    console.log('Microsoft Clarity initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Microsoft Clarity:', error);
  }
};

/**
 * Initialize Google Analytics tracking
 * @param {string} measurementId - Google Analytics measurement ID (G-XXXXXXXXXX)
 */
export const initializeGoogleAnalytics = (measurementId) => {
  if (!measurementId || measurementId === 'your_ga_measurement_id') {
    console.log('Google Analytics: No measurement ID configured');
    return;
  }

  try {
    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize Google Analytics
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId);

    console.log('Google Analytics initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Google Analytics:', error);
  }
};

/**
 * Initialize all analytics services
 */
export const initializeAnalytics = () => {
  // Check if running in Electron environment
  const isElectron = window.electron !== undefined;

  if (isElectron) {
    console.log('Analytics: Running in Electron environment');
  }

  // Get tracking IDs from environment variables or window object
  const clarityId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  // Initialize Microsoft Clarity
  if (clarityId) {
    initializeMicrosoftClarity(clarityId);
  }

  // Initialize Google Analytics
  if (gaId) {
    initializeGoogleAnalytics(gaId);
  }

  if (!clarityId && !gaId) {
    console.log('Analytics: No tracking IDs configured. Add VITE_CLARITY_PROJECT_ID and VITE_GA_MEASUREMENT_ID to your .env file');
  }
};

/**
 * Track a custom event
 * @param {string} eventName - Name of the event
 * @param {object} eventData - Additional data to track with the event
 */
export const trackEvent = (eventName, eventData = {}) => {
  try {
    // Google Analytics event tracking
    if (window.gtag) {
      window.gtag('event', eventName, eventData);
    }

    // Microsoft Clarity custom tags
    if (window.clarity) {
      window.clarity('event', eventName);
    }
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};

/**
 * Track a page view
 * @param {string} pagePath - The page path or name
 * @param {string} pageTitle - The page title
 */
export const trackPageView = (pagePath, pageTitle) => {
  try {
    // Google Analytics page view
    if (window.gtag) {
      window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
};

/**
 * Set user properties for analytics
 * @param {object} properties - User properties to set
 */
export const setUserProperties = (properties = {}) => {
  try {
    // Google Analytics user properties
    if (window.gtag) {
      window.gtag('set', 'user_properties', properties);
    }

    // Microsoft Clarity custom session data
    if (window.clarity) {
      Object.entries(properties).forEach(([key, value]) => {
        window.clarity('set', key, value);
      });
    }
  } catch (error) {
    console.error('Failed to set user properties:', error);
  }
};
