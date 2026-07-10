import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { CallBackProps, STATUS, Step } from "react-joyride";

interface ProfileData {
  profilePicture?: string;
  coverImage?: string;
  accountName?: string;
  bio?: string;
  socialMedia?: {
    [key: string]: { link?: string; visibility?: boolean };
  };
}

export const useProfileWalkthrough = (
  profileData?: ProfileData,
  isCropModalOpen?: boolean,
  isUploading?: boolean,
  isFormSubmitting?: boolean
) => {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const wasRunningBeforeModalRef = useRef(false);
  const [isFormActive, setIsFormActive] = useState(false);
  const hasBeenSkippedOrFinishedRef = useRef(false);
  const runRef = useRef(run); // Track current run state for event handlers
  const isProcessingStepRef = useRef(false); // Track if we're processing a step action
  const shownStepsRef = useRef<Set<number>>(new Set()); // Track which steps have shown their tooltip
  const tooltipHiddenRef = useRef(false); // Track if tooltip should be hidden
  const stepIndexRef = useRef(0); // Track current step index for closures
  const stepsRef = useRef<Step[]>([]); // Track current steps for closures
  const spotlightClickedRef = useRef(false); // Track if user clicked on spotlight

  // Stable primitive values extracted from profileData for memo dependencies
  const profilePicture = profileData?.profilePicture ?? "";
  const coverImage = profileData?.coverImage ?? "";
  const accountName = profileData?.accountName ?? "";
  const bio = profileData?.bio ?? "";
  // Stable string representation of social links count for memo dep
  const socialLinksCount = useMemo(() => {
    const socialMedia = profileData?.socialMedia || {};
    return Object.values(socialMedia).filter(
      (platform: any) =>
        platform?.link && typeof platform.link === "string" && platform.link.trim() !== ""
    ).length;
  }, [profileData?.socialMedia]);

  // Determine which fields are missing — depends only on stable primitives
  const missingFields = useMemo(() => {
    return {
      profilePicture: !profilePicture || profilePicture.trim() === "",
      coverImage: !coverImage || coverImage.trim() === "",
      accountName: !accountName || accountName.trim() === "",
      bio: !bio || bio.trim() === "",
      socialMedia: socialLinksCount < 2,
    };
  }, [profilePicture, coverImage, accountName, bio, socialLinksCount]);

  // Filter steps to only show remaining required fields
  const steps: Step[] = useMemo(() => {
    const allSteps: Step[] = [
      {
        target: '[data-walkthrough="profile-picture"]',
        content:
          "Upload your profile picture here. Click the camera icon to add or change your photo.",
        placement: "bottom",
        disableBeacon: true,
        disableOverlayClose: false,
        disableScrolling: false,
        disableCloseOnEsc: false,
      },
      {
        target: '[data-walkthrough="cover-image"]',
        content:
          "Upload your cover image here. Click the camera icon to add or change your background photo.",
        placement: "bottom",
        disableBeacon: true,
        disableOverlayClose: false,
        disableScrolling: false,
        disableCloseOnEsc: false,
      },
      {
        target: '[data-walkthrough="social-media-accordion"]',
        content:
          "Expand and add at least 2 social media links.",
        placement: "top",
        disableBeacon: true,
        disableOverlayClose: false,
        disableScrolling: false,
        disableCloseOnEsc: false,
      },
      {
        target: '[data-walkthrough="save-publish-button"]',
        content:
          "Click 'Save & Publish' to save all your profile changes. Make sure you've completed all required fields before saving!",
        placement: "top",
        disableBeacon: true,
        disableOverlayClose: false,
        disableScrolling: false,
        disableCloseOnEsc: false,
      },
    ];

    const filtered: Step[] = [];

    // Step 1: Profile Picture (always first if missing)
    if (missingFields.profilePicture) {
      filtered.push(allSteps[0]);
    }

    // Step 2: Cover Image (always second if missing)
    if (missingFields.coverImage) {
      filtered.push(allSteps[1]);
    }

    // Step 3: Social Media Accordion (only if socialMedia is missing - at least 2 links required)
    if (missingFields.socialMedia) {
      filtered.push(allSteps[2]);
    }

    // Step 4: Save & Publish Button (always last if any field is missing)
    if (
      missingFields.profilePicture ||
      missingFields.coverImage ||
      missingFields.socialMedia
    ) {
      filtered.push(allSteps[3]);
    }

    return filtered;
  }, [missingFields]);

  // Ref to persist the "start tour" intent even after location state is cleared.
  // Using a ref (not state) so it can be read synchronously in effects/timers.
  const pendingStartTourRef = useRef(false);
  // Ref to track if a polling loop is currently active, so we don't start two at once.
  const tourPollingActiveRef = useRef(false);

  // ─── Effect 1: Capture the navigation intent immediately ───────────────────
  // This runs as soon as location.state?.startTour appears. We save to a ref
  // and clear the history state so it doesn't retrigger on re-renders.
  useEffect(() => {
    if (location.state?.startTour) {
      pendingStartTourRef.current = true;
      hasBeenSkippedOrFinishedRef.current = false;
      isProcessingStepRef.current = false;
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.startTour]);

  // ─── Effect 2: Start the tour once steps + DOM are both ready ──────────────
  // Watches steps.length. Whenever it becomes > 0 and we have a pending intent,
  // we start a polling loop to wait for the DOM target to appear then launch.
  useEffect(() => {
    // Nothing to do if no pending intent or tour already active
    if (!pendingStartTourRef.current || steps.length === 0) return;
    if (hasBeenSkippedOrFinishedRef.current) return;
    // Don't start a second polling loop if one is already running
    if (tourPollingActiveRef.current) return;

    tourPollingActiveRef.current = true;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 × 200ms = 4 seconds max wait

    const tryStart = () => {
      if (cancelled || hasBeenSkippedOrFinishedRef.current) {
        tourPollingActiveRef.current = false;
        return;
      }

      attempts++;
      const firstTarget = steps[0]?.target;
      const element =
        firstTarget && typeof firstTarget === 'string'
          ? document.querySelector(firstTarget)
          : null;

      if (element) {
        // Target found — consume the intent and start the tour
        pendingStartTourRef.current = false;
        isProcessingStepRef.current = false;
        tourPollingActiveRef.current = false;
        setStepIndex(0);
        setTimeout(() => {
          if (!cancelled && !hasBeenSkippedOrFinishedRef.current) {
            setRun(true);
          }
        }, 700);
      } else if (attempts < maxAttempts) {
        setTimeout(tryStart, 200);
      } else {
        tourPollingActiveRef.current = false;
        console.warn('[Walkthrough] Target element not found after max attempts:', firstTarget);
      }
    };

    // Small initial delay to let React finish painting the DOM
    setTimeout(tryStart, 400);

    // Cleanup: if the component unmounts or steps change again before we start,
    // cancel the in-flight polling loop
    return () => {
      cancelled = true;
      tourPollingActiveRef.current = false;
    };
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset stepIndex when steps change (e.g., after completing a field)
  // CRITICAL: Don't reset stepIndex automatically - let it progress naturally
  // Only adjust if stepIndex is out of bounds
  useEffect(() => {
    if (steps.length === 0 && run) {
      // If no steps remain, stop the walkthrough
      setRun(false);
      setStepIndex(0);
    }
    // Only adjust stepIndex if it's out of bounds - don't reset it otherwise
    if (steps.length > 0 && stepIndex >= steps.length) {
      // If stepIndex is out of bounds, set to last valid step
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [steps.length, run]);

  // Auto-expand accordion when walkthrough reaches it
  useEffect(() => {
    if (!run || steps.length === 0) return;

    const currentStep = steps[stepIndex];

    // Handle social media accordion - expand it if collapsed
    if (currentStep?.target === '[data-walkthrough="social-media-accordion"]') {
      console.log('🎯 Walkthrough reached social media accordion step');

      // CRITICAL: Mark tooltip as not hidden for this new step
      tooltipHiddenRef.current = false;

      // Find the social media accordion
      const accordion = document.querySelector('[data-walkthrough="social-media-accordion"]');
      if (accordion) {
        console.log('✅ Found social media accordion element');
        // Check if it's collapsed by finding the button inside it
        const button = accordion.querySelector('button[aria-expanded]');
        if (button) {
          const isExpanded = button.getAttribute('aria-expanded') === 'true';
          console.log('📌 Accordion expanded state:', isExpanded);
          if (!isExpanded) {
            // Accordion is collapsed, click to expand it
            console.log('🔧 Expanding accordion...');
            setTimeout(() => {
              (button as HTMLButtonElement).click();

              // After expanding, aggressively force tooltip visibility
              setTimeout(() => {
                const forceShowTooltip = () => {
                  const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
                  console.log('🎨 Forcing tooltip visibility, found', tooltips.length, 'tooltips');
                  tooltips.forEach((tooltip) => {
                    const element = tooltip as HTMLElement;
                    if (element) {
                      element.style.setProperty('opacity', '1', 'important');
                      element.style.setProperty('visibility', 'visible', 'important');
                      element.style.setProperty('display', 'block', 'important');
                      element.style.setProperty('pointer-events', 'auto', 'important');
                      element.style.setProperty('z-index', '10005', 'important');
                    }
                  });
                };

                // Try multiple times with increasing delays
                forceShowTooltip();
                setTimeout(forceShowTooltip, 50);
                setTimeout(forceShowTooltip, 100);
                setTimeout(forceShowTooltip, 200);
                setTimeout(forceShowTooltip, 500);
                setTimeout(forceShowTooltip, 1000);
              }, 300);
            }, 100);
          } else {
            // Already expanded, just force tooltip visibility
            console.log('✅ Accordion already expanded, forcing tooltip');
            const forceShowTooltip = () => {
              const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
              tooltips.forEach((tooltip) => {
                const element = tooltip as HTMLElement;
                if (element) {
                  element.style.setProperty('opacity', '1', 'important');
                  element.style.setProperty('visibility', 'visible', 'important');
                  element.style.setProperty('display', 'block', 'important');
                  element.style.setProperty('pointer-events', 'auto', 'important');
                  element.style.setProperty('z-index', '10005', 'important');
                }
              });
            };

            forceShowTooltip();
            setTimeout(forceShowTooltip, 50);
            setTimeout(forceShowTooltip, 100);
            setTimeout(forceShowTooltip, 200);
          }
        }
      } else {
        console.error('❌ Could not find social media accordion element');
      }
    }

    // Handle save button - ensure it's visible and scrolled into view
    if (currentStep?.target === '[data-walkthrough="save-publish-button"]') {
      setTimeout(() => {
        const saveButton = document.querySelector('[data-walkthrough="save-publish-button"]');
        if (saveButton) {
          saveButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [run, stepIndex, steps]);


  // Update refs whenever values change
  useEffect(() => {
    runRef.current = run;
    stepIndexRef.current = stepIndex;
    stepsRef.current = steps;
  }, [run, stepIndex, steps]);

  // CRITICAL: Ensure stepIndex ref is always in sync
  // This is especially important when stepIndex is set directly
  useEffect(() => {
    if (stepIndexRef.current !== stepIndex) {
      stepIndexRef.current = stepIndex;
    }
  }, [stepIndex]);

  useEffect(() => {
    const shouldPause = isCropModalOpen || isFormActive || isUploading || isFormSubmitting;

    if (shouldPause && run) {
      // Pause walkthrough and remember it was running
      wasRunningBeforeModalRef.current = true;
      isProcessingStepRef.current = true; // Mark that we're processing a step
      setRun(false);
    } else if (
      !shouldPause &&
      wasRunningBeforeModalRef.current &&
      steps.length > 0 &&
      !hasBeenSkippedOrFinishedRef.current &&
      !run // Only resume if not already running
    ) {
      // CRITICAL: Only auto-resume for simple pauses (cropper, form interaction)
      // Don't auto-resume if isProcessingStepRef is true - that means
      // advanceToNextStep() is handling the resume with step advancement
      if (!isProcessingStepRef.current) {
        // Simple pause cleared (cropper closed, form blur) - resume current step
        wasRunningBeforeModalRef.current = false;
        setTimeout(() => {
          if (!hasBeenSkippedOrFinishedRef.current && !run) {
            setRun(true);
            runRef.current = true;
          }
        }, 300);
      }
      // If isProcessingStepRef is true, advanceToNextStep() will handle resume
    }
  }, [isCropModalOpen, isFormActive, isUploading, isFormSubmitting, run, steps.length]);



  // Toggle body class for Joyride to prevent alignment distortion
  useEffect(() => {
    if (run) {
      document.body.classList.add('joyride-active');
      document.documentElement.classList.add('joyride-active');
    } else {
      document.body.classList.remove('joyride-active');
      document.documentElement.classList.remove('joyride-active');
    }
    return () => {
      document.body.classList.remove('joyride-active');
      document.documentElement.classList.remove('joyride-active');
    };
  }, [run]);

  // Detect form interaction to pause walkthrough
  useEffect(() => {
    let formInteractionTimeout: NodeJS.Timeout;

    const handleFormInteraction = (e?: Event) => {
      const target = e?.target as HTMLElement | undefined;

      // CRITICAL: Check for visibility toggle FIRST - before any other checks
      const isVisibilityToggle = target?.closest('button[data-tooltip-id="visibility-tooltip"]') ||
        target?.closest('[data-tooltip-id="visibility-tooltip"]') ||
        (target?.closest('button') && target?.closest('button')?.getAttribute('data-tooltip-id') === 'visibility-tooltip');

      // If it's a visibility toggle, immediately return - don't interfere at all
      if (isVisibilityToggle) {
        return; // Don't pause, don't interfere - let everything work exactly as before
      }

      // CRITICAL: Never interfere with social media accordion - restore original functionality
      // Check if interaction is inside social media accordion
      const isInSocialMediaAccordion = target?.closest('[data-walkthrough="social-media-accordion"]') ||
        target?.closest('[data-walkthrough*="social"]');

      // If inside social media accordion, completely ignore - don't interfere at all
      // This restores the original functionality completely
      if (isInSocialMediaAccordion) {
        return; // Don't pause, don't interfere - let everything work exactly as before
      }

      // Only pause for non-social-media interactions
      // Immediately pause walkthrough when user interacts with form
      if (runRef.current) {
        wasRunningBeforeModalRef.current = true;
        isProcessingStepRef.current = true; // Mark that we're processing a step
        setRun(false);
      }
      setIsFormActive(true);
      // Clear any existing timeout
      if (formInteractionTimeout) {
        clearTimeout(formInteractionTimeout);
      }
    };

    const handleFormBlur = () => {
      // Wait a bit before resuming to ensure user is done with form
      formInteractionTimeout = setTimeout(() => {
        const activeElement = document.activeElement;
        // Only resume if focus is not on a form element
        if (
          !activeElement ||
          (activeElement.tagName !== 'INPUT' &&
            activeElement.tagName !== 'TEXTAREA' &&
            activeElement.tagName !== 'SELECT' &&
            !activeElement.closest('form') &&
            !activeElement.closest('[contenteditable="true"]'))
        ) {
          setIsFormActive(false);
        }
      }, 500); // Longer delay to ensure user is done
    };

    // Listen for form interactions (typing, clicking, etc.)
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;

      // CRITICAL: Check for visibility toggle FIRST - before any other checks
      const isVisibilityToggle = target.closest('button[data-tooltip-id="visibility-tooltip"]') ||
        target.closest('[data-tooltip-id="visibility-tooltip"]') ||
        (target.closest('button') && target.closest('button')?.getAttribute('data-tooltip-id') === 'visibility-tooltip');

      // If it's a visibility toggle, immediately return - don't interfere at all
      if (isVisibilityToggle) {
        return; // Don't pause, don't interfere - let everything work exactly as before
      }

      // CRITICAL: Never interfere with social media accordion - restore original functionality
      // Check if focus is inside social media accordion
      const isInSocialMediaAccordion = target.closest('[data-walkthrough="social-media-accordion"]') ||
        target.closest('[data-walkthrough*="social"]');

      // If inside social media accordion, completely ignore - don't interfere at all
      // This restores the original functionality completely
      if (isInSocialMediaAccordion) {
        return; // Don't pause, don't interfere - let everything work exactly as before
      }

      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('form') ||
        target.closest('[contenteditable="true"]')
      ) {
        // Immediately pause walkthrough when user focuses on form elements
        if (runRef.current) {
          wasRunningBeforeModalRef.current = true;
          isProcessingStepRef.current = true; // Mark that we're processing a step
          setRun(false);
        }
        setIsFormActive(true);
      }
    };

    // Listen for clicks on upload buttons, save buttons, and form fields
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // CRITICAL: Check for visibility toggle FIRST - before any other checks
      // This ensures visibility toggles work exactly as before, without any interference
      // Check multiple ways to catch all possible click targets (button, svg, path, etc.)
      const visibilityButton = target.closest('button[data-tooltip-id="visibility-tooltip"]');
      const visibilityElement = target.closest('[data-tooltip-id="visibility-tooltip"]');
      const isVisibilityToggle =
        visibilityButton !== null ||
        visibilityElement !== null ||
        (target.tagName === 'BUTTON' && target.getAttribute('data-tooltip-id') === 'visibility-tooltip') ||
        (target.tagName === 'svg' && target.closest('button[data-tooltip-id="visibility-tooltip"]') !== null) ||
        (target.tagName === 'path' && target.closest('button[data-tooltip-id="visibility-tooltip"]') !== null) ||
        (target.closest('button') && target.closest('button')?.getAttribute('data-tooltip-id') === 'visibility-tooltip');

      // If it's a visibility toggle, immediately return - don't interfere at all
      // CRITICAL: Do NOT prevent default, do NOT stop propagation - let it work normally
      if (isVisibilityToggle) {
        // Completely ignore this click - let it propagate normally to the actual handler
        return; // Let the click work normally, don't interfere
      }

      // CRITICAL: Never interfere with social media accordion - restore original functionality
      // Check if click is inside social media accordion FIRST
      const isInSocialMediaAccordion = target.closest('[data-walkthrough="social-media-accordion"]') ||
        target.closest('[data-walkthrough*="social"]');

      // If inside social media accordion, completely ignore - don't interfere at all
      // This restores the original functionality completely
      // Only check for accordion closing to advance walkthrough, but don't interfere with the click itself
      if (isInSocialMediaAccordion) {
        // Only observe accordion closing for walkthrough advancement, but don't interfere with functionality
        // Check if this is an accordion button click that's closing the accordion
        const isAccordionButton = target.closest('button[type="button"]') &&
          (target.closest('button[type="button"]')?.getAttribute('aria-expanded') !== null ||
            target.closest('button[type="button"]')?.getAttribute('aria-controls') !== null);

        if (isAccordionButton && runRef.current && stepIndexRef.current < stepsRef.current.length) {
          const currentStep = stepsRef.current[stepIndexRef.current];
          if (currentStep?.target === '[data-walkthrough="social-media-accordion"]') {
            // Observe accordion closing for walkthrough advancement only
            // Don't interfere with the click - let it work normally
            const button = target.closest('button[type="button"]') as HTMLButtonElement;
            if (button) {
              const ariaExpanded = button.getAttribute('aria-expanded');
              const isCurrentlyExpanded = ariaExpanded === 'true';

              // Use a small delay to check the NEW state after click (observe only, don't interfere)
              setTimeout(() => {
                const newAriaExpanded = button.getAttribute('aria-expanded');
                const isNowExpanded = newAriaExpanded === 'true';

                // If accordion was expanded and is now closed, advance walkthrough
                if (isCurrentlyExpanded && !isNowExpanded) {
                  // Accordion is closing, check if 2+ links are filled
                  setTimeout(() => {
                    const socialMediaFields = [
                      'instagramLink', 'youtubeLink', 'whatsappLink', 'websiteLink',
                      'facebookLink', 'linkedinLink', 'snapchatLink', 'tiktokLink',
                      'gmailLink', 'XLink', 'spotifyLink', 'youtubeMusicLink',
                      'appleMusicLink', 'mobilenumberLink'
                    ];
                    let filledCount = 0;
                    socialMediaFields.forEach(fieldName => {
                      const input = document.querySelector(`input[name="${fieldName}"], input[id="${fieldName}"]`) as HTMLInputElement;
                      if (input && input.value && input.value.trim() !== '') {
                        filledCount++;
                      }
                    });

                    // If 2+ links filled, advance to next step (save button) instantly
                    if (filledCount >= 2 && stepIndexRef.current < stepsRef.current.length - 1 && !hasBeenSkippedOrFinishedRef.current) {
                      // Wait a tiny bit for accordion animation, then advance instantly
                      setTimeout(() => {
                        advanceToNextStep();
                      }, 100); // Minimal delay just for accordion animation
                    }
                  }, 200);
                }
              }, 50); // Small delay to let accordion state update
            }
          }
        }

        // Return early - don't interfere with any social media accordion functionality
        return;
      }

      // CRITICAL: Don't interfere with accordion button clicks outside social media
      // Check if click is on accordion toggle button
      const isAccordionButton = target.closest('button[type="button"]') &&
        (target.closest('button[type="button"]')?.getAttribute('aria-expanded') !== null ||
          target.closest('button[type="button"]')?.getAttribute('aria-controls') !== null);

      // Don't pause walkthrough for accordion button clicks
      // IMPORTANT: Don't prevent default or stop propagation - let the click work normally
      if (isAccordionButton) {
        return; // Let the click work normally, don't interfere
      }

      const isWalkthroughTarget =
        target.closest('[data-walkthrough="profile-picture"]') ||
        target.closest('[data-walkthrough="cover-image"]') ||
        target.closest('[data-walkthrough="save-publish-button"]') ||
        target.closest('input[type="file"]') ||
        target.closest('button[type="submit"]') ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('form');

      if (isWalkthroughTarget) {
        // Immediately pause walkthrough when clicking on interactive elements
        if (runRef.current) {
          wasRunningBeforeModalRef.current = true;
          isProcessingStepRef.current = true; // Mark that we're processing a step
          setRun(false);
        }
        setIsFormActive(true);
        if (formInteractionTimeout) {
          clearTimeout(formInteractionTimeout);
        }
      }
    };

    document.addEventListener('input', handleFormInteraction);
    document.addEventListener('change', handleFormInteraction);
    // Use capture phase for clicks, but visibility toggles will return early without interference
    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFormBlur);

    return () => {
      document.removeEventListener('input', handleFormInteraction);
      document.removeEventListener('change', handleFormInteraction);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFormBlur);
      if (formInteractionTimeout) {
        clearTimeout(formInteractionTimeout);
      }
    };
  }, []);

  // Listen for clicks on spotlight/highlight to show tooltip
  useEffect(() => {
    if (!run) return;

    const handleSpotlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is on spotlight or beacon
      const isSpotlightClick =
        target.closest('.react-joyride__spotlight') !== null ||
        target.closest('[class*="react-joyride__spotlight"]') !== null ||
        target.closest('.react-joyride__beacon') !== null ||
        target.closest('[class*="react-joyride__beacon"]') !== null;

      if (isSpotlightClick) {
        // User clicked on highlight - force show tooltip
        spotlightClickedRef.current = true;
        tooltipHiddenRef.current = false;

        // Force show tooltip immediately and keep it visible
        const forceShowTooltip = () => {
          const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
          tooltips.forEach((tooltip) => {
            const element = tooltip as HTMLElement;
            if (element) {
              element.style.setProperty('opacity', '1', 'important');
              element.style.setProperty('visibility', 'visible', 'important');
              element.style.setProperty('display', 'block', 'important');
              element.style.setProperty('pointer-events', 'auto', 'important');
              element.style.setProperty('z-index', '10005', 'important');
            }
          });
        };

        // Try multiple times to ensure tooltip appears
        forceShowTooltip();
        setTimeout(forceShowTooltip, 10);
        setTimeout(forceShowTooltip, 50);
        setTimeout(forceShowTooltip, 100);
        setTimeout(forceShowTooltip, 200);

        // Keep tooltip visible for 5 seconds after click
        setTimeout(() => {
          spotlightClickedRef.current = false;
          // After 5 seconds, allow auto-hide if step was already shown
          if (shownStepsRef.current.has(stepIndexRef.current)) {
            setTimeout(() => {
              tooltipHiddenRef.current = true;
            }, 5000);
          }
        }, 5000); // Keep visible for 5 seconds after click
      }
    };

    document.addEventListener('click', handleSpotlightClick, true);
    return () => {
      document.removeEventListener('click', handleSpotlightClick, true);
    };
  }, [run]);

  // Continuously ensure tooltips are visible for newly advanced steps
  // Only hide tooltips for steps that were already shown and user has seen them
  useEffect(() => {
    if (!run) return;

    const manageTooltips = () => {
      const isNewlyAdvancedStep = !shownStepsRef.current.has(stepIndexRef.current);
      const userClickedSpotlight = spotlightClickedRef.current;

      const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
      tooltips.forEach((tooltip) => {
        const element = tooltip as HTMLElement;
        if (element) {
          if (isNewlyAdvancedStep || userClickedSpotlight) {
            // CRITICAL: For newly advanced steps OR when user clicks spotlight, ALWAYS keep tooltip visible
            // This ensures dialogue box is visible during the flow and when user clicks highlight
            element.style.setProperty('opacity', '1', 'important');
            element.style.setProperty('visibility', 'visible', 'important');
            element.style.setProperty('display', 'block', 'important');
            element.style.setProperty('pointer-events', 'auto', 'important');
            element.style.setProperty('z-index', '10005', 'important');
          } else if (tooltipHiddenRef.current && shownStepsRef.current.has(stepIndexRef.current)) {
            // Only hide if step was already shown, should be hidden, AND user didn't click spotlight
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('pointer-events', 'none', 'important');
          } else {
            // Keep visible for other cases
            element.style.setProperty('opacity', '1', 'important');
            element.style.setProperty('visibility', 'visible', 'important');
            element.style.setProperty('display', 'block', 'important');
            element.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
      });
    };

    const interval = setInterval(manageTooltips, 50); // Check more frequently
    return () => clearInterval(interval);
  }, [run, stepIndex]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index, action, type } = data;

    // Debug logging to understand what's happening
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Joyride Callback:', {
        status,
        index,
        action,
        type,
        run: runRef.current,
        stepIndex: stepIndexRef.current,
        stepsLength: stepsRef.current.length,
        currentStepTarget: stepsRef.current[index]?.target,
      });
    }

    // Handle Next button - preview navigation only, does NOT mark step as complete

    if (action === 'next' && type === 'step:after') {
      const nextIndex = index + 1;

      if (nextIndex >= stepsRef.current.length) {
        // Last step completed via Next/Finish button
        hasBeenSkippedOrFinishedRef.current = true;
        setRun(false);
        setStepIndex(0);
        wasRunningBeforeModalRef.current = false;
        shownStepsRef.current.clear();
        tooltipHiddenRef.current = false;
        isProcessingStepRef.current = false;
        return;
      }

      // Preview navigation: update stepIndex but do NOT mark step as complete
      // Real completion is tracked by actual actions (advanceToNextStep)
      stepIndexRef.current = nextIndex;
      setStepIndex(nextIndex);

      // CRITICAL: Clear processing flag to allow walkthrough to continue
      isProcessingStepRef.current = false;
      wasRunningBeforeModalRef.current = false;

      // Mark next step as shown for tooltip visibility (but not as complete)
      if (!shownStepsRef.current.has(nextIndex)) {
        shownStepsRef.current.add(nextIndex);
      }
      tooltipHiddenRef.current = false;

      // Pause briefly then resume to show next step (1-2 second delay)
      setRun(false);
      setTimeout(() => {
        setRun(true);
      }, 1200);
      return;
    }



    // Handle Back button - preview navigation only, does NOT mark step as complete
    if (action === 'prev' && type === 'step:after') {
      const prevIndex = index - 1;
      if (prevIndex < 0) return;

      // Preview navigation: update stepIndex but do NOT mark step as complete
      stepIndexRef.current = prevIndex;
      setStepIndex(prevIndex);

      // CRITICAL: Clear processing flag to allow walkthrough to continue
      isProcessingStepRef.current = false;
      wasRunningBeforeModalRef.current = false;

      // Mark previous step as shown for tooltip visibility (but not as complete)
      if (!shownStepsRef.current.has(prevIndex)) {
        shownStepsRef.current.add(prevIndex);
      }
      tooltipHiddenRef.current = false;

      // Pause briefly then resume to show previous step (1-2 second delay)
      setRun(false);
      setTimeout(() => {
        setRun(true);
      }, 1200);
      return;
    }


    // Mark step as shown when tooltip appears
    // CRITICAL: For steps in the flow, keep tooltip visible - don't auto-hide
    if (type === "step:after" || action === "next" || action === "prev") {
      if (!shownStepsRef.current.has(index)) {
        // This is a new step - mark it as shown but DON'T auto-hide during flow
        // Keep tooltip visible so users can see what to do
        shownStepsRef.current.add(index);
        tooltipHiddenRef.current = false; // Ensure it's visible

        // Force show tooltip immediately
        setTimeout(() => {
          const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
          tooltips.forEach((tooltip) => {
            const element = tooltip as HTMLElement;
            if (element) {
              element.style.setProperty('opacity', '1', 'important');
              element.style.setProperty('visibility', 'visible', 'important');
              element.style.setProperty('display', 'block', 'important');
              element.style.setProperty('pointer-events', 'auto', 'important');
              element.style.setProperty('z-index', '10005', 'important');
            }
          });
        }, 10); // Very short delay to ensure DOM is ready

        // Only auto-hide after a long delay (10 seconds) - gives users time to read
        setTimeout(() => {
          if (runRef.current && stepIndexRef.current === index) {
            // Only hide if still on this step and user hasn't interacted
            tooltipHiddenRef.current = true;
          }
        }, 10000); // Show tooltip for 10 seconds for newly advanced steps
      } else {
        // Step already shown before - keep visible but can hide after delay
        tooltipHiddenRef.current = false; // Show it again if revisiting
        setTimeout(() => {
          if (runRef.current && stepIndexRef.current === index) {
            tooltipHiddenRef.current = true;
          }
        }, 5000); // Show for 5 seconds if revisiting
      }
    }

    // Sync stepIndex with Joyride's internal state
    if (action === "next" || action === "prev" || type === "step:after") {
      setStepIndex(index);
      // CRITICAL: When moving to a new step (especially via advanceToNextStep),
      // ensure tooltip is visible for the new step
      if (type === "step:after") {
        // This is a new step being shown - make sure tooltip is visible
        tooltipHiddenRef.current = false;
        // Force show tooltip for new steps
        setTimeout(() => {
          const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
          tooltips.forEach((tooltip) => {
            const element = tooltip as HTMLElement;
            if (element) {
              element.style.setProperty('opacity', '1', 'important');
              element.style.setProperty('visibility', 'visible', 'important');
              element.style.setProperty('display', 'block', 'important');
              element.style.setProperty('pointer-events', 'auto', 'important');
            }
          });
        }, 50);
      } else {
        // Reset tooltip hidden state when moving to new step
        if (shownStepsRef.current.has(index)) {
          tooltipHiddenRef.current = true;
        } else {
          tooltipHiddenRef.current = false;
        }
      }
    }

    // Handle completion - mark as skipped/finished to prevent restart
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      hasBeenSkippedOrFinishedRef.current = true;
      setRun(false);
      setStepIndex(0);
      wasRunningBeforeModalRef.current = false;
      shownStepsRef.current.clear();
      tooltipHiddenRef.current = false;
    } else if (status === STATUS.ERROR) {
      // If target not found, try to continue to next step
      if (index < steps.length - 1) {
        // Wait a bit before moving to next step to allow DOM to update
        setTimeout(() => {
          setStepIndex(index + 1);
        }, 500);
      } else {
        hasBeenSkippedOrFinishedRef.current = true;
        setRun(false);
        setStepIndex(0);
        wasRunningBeforeModalRef.current = false;
        shownStepsRef.current.clear();
        tooltipHiddenRef.current = false;
      }
    }
  };

  // Monitor social media links - removed auto-advance, now only advances when accordion closes
  // This allows users to fill as many links as they want before closing accordion

  // Function to manually advance to next step (for auto-advance after actions)
  const advanceToNextStep = () => {
    if (stepIndexRef.current < stepsRef.current.length - 1) {
      const nextIndex = stepIndexRef.current + 1;

      // CRITICAL: Clear all processing flags FIRST
      isProcessingStepRef.current = false;
      wasRunningBeforeModalRef.current = false;

      // CRITICAL: Ensure we're not paused - clear form active state
      setIsFormActive(false);

      // CRITICAL: Reset tooltip visibility for the new step
      // This ensures the dialogue box appears for the next step
      tooltipHiddenRef.current = false;

      // Update refs immediately to ensure consistency
      stepIndexRef.current = nextIndex;

      // Set stepIndex first - this ensures Joyride knows which step to show
      setStepIndex(nextIndex);

      // CRITICAL: Resume walkthrough with delay to prevent overwhelming user
      // Add 1-2 second delay before showing next step
      setTimeout(() => {
        if (!hasBeenSkippedOrFinishedRef.current) {
          // Resume walkthrough to highlight next step with tooltip visible
          setRun(true);
          runRef.current = true;

          // Force show tooltip for the new step immediately and continuously
          // Use multiple attempts to ensure tooltip appears
          const forceShowTooltip = () => {
            const tooltips = document.querySelectorAll('.react-joyride__tooltip, [class*="react-joyride__tooltip"]');
            if (tooltips.length > 0) {
              tooltips.forEach((tooltip) => {
                const element = tooltip as HTMLElement;
                if (element) {
                  // Force show the tooltip with high z-index
                  element.style.setProperty('opacity', '1', 'important');
                  element.style.setProperty('visibility', 'visible', 'important');
                  element.style.setProperty('display', 'block', 'important');
                  element.style.setProperty('pointer-events', 'auto', 'important');
                  element.style.setProperty('z-index', '10005', 'important');
                }
              });
            }
          };

          // Try multiple times to ensure tooltip appears
          forceShowTooltip();
          setTimeout(forceShowTooltip, 50);
          setTimeout(forceShowTooltip, 100);
          setTimeout(forceShowTooltip, 200);
          setTimeout(forceShowTooltip, 300);
        }
      }, 1200);
    } else {
      // If it's the last step, mark processing as complete
      isProcessingStepRef.current = false;
      wasRunningBeforeModalRef.current = false;
    }
  };

  // Function to set form active state (for form handling)
  const setFormActive = (active: boolean) => {
    setIsFormActive(active);
  };

  // Function to mark processing as complete (called after uploads/form submissions complete)
  const markProcessingComplete = () => {
    isProcessingStepRef.current = false;
  };

  return {
    run,
    steps,
    stepIndex,
    setRun,
    setStepIndex,
    handleJoyrideCallback,
    advanceToNextStep,
    setFormActive,
    markProcessingComplete,
  };
};
