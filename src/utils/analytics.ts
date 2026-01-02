/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

/**
 * Google Analytics 4 (GA4) Integration
 * 
 * Tracks website visitors and usage metrics.
 * Only loads in production builds when VITE_GA4_ID is configured.
 * 
 * To enable:
 * 1. Create a GA4 property at https://analytics.google.com
 * 2. Get your Measurement ID (format: G-XXXXXXXXXX)
 * 3. Set environment variable: VITE_GA4_ID=G-XXXXXXXXXX
 * 4. Rebuild and deploy
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Initialize Google Analytics 4
 * Only loads in production when VITE_GA4_ID is set
 */
export function initializeAnalytics(): void {
  // Only load in production builds
  if (!import.meta.env.PROD) {
    return;
  }

  // Check if GA4 Measurement ID is configured
  const ga4Id = import.meta.env.VITE_GA4_ID;
  if (!ga4Id || typeof ga4Id !== 'string' || ga4Id.trim() === '') {
    console.log('GA4: Not configured (VITE_GA4_ID not set)');
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]): void {
    window.dataLayer.push(args);
  }
  window.gtag = gtag;

  // Configure GA4
  gtag('js', new Date());
  gtag('config', ga4Id, {
    // Additional configuration options can be added here
    // page_title: document.title,
    // page_location: window.location.href,
  });

  // Load the GA4 script asynchronously
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
  document.head.appendChild(script);

  console.log('GA4: Initialized with ID:', ga4Id);
}

/**
 * Track a custom event
 * @param eventName - Name of the event
 * @param eventParams - Optional event parameters
 */
export function trackEvent(eventName: string, eventParams?: Record<string, unknown>): void {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

/**
 * Track page views (useful for SPA navigation)
 * @param pagePath - Path of the page
 * @param pageTitle - Title of the page
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  if (window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA4_ID, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }
}
