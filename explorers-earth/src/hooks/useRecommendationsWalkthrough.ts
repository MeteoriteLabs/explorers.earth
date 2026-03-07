import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { CallBackProps, STATUS, Step } from "react-joyride";
import useSetupStore from "../store/useSetupStore";

interface RecommendationsData {
  hasPlaces?: boolean;
  isPublished?: boolean;
  placesCount?: number; // Track place count to detect step 1 completion
}

// Session storage key for tracking current step (last *incomplete* step index)
// This is used to resume the walkthrough from the correct step after navigation.
const WALKTHROUGH_CURRENT_STEP_KEY = 'recommendationStep';
const WALKTHROUGH_COMPLETED_STEPS_KEY = 'recommendationCompletedSteps';

// Helper functions for completed steps tracking
const getCompletedSteps = (): number[] => {
  try {
    const completed = sessionStorage.getItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
    if (completed) {
      const parsed = JSON.parse(completed);
      return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'number' && !isNaN(s)) : [];
    }
  } catch (e) {
    console.warn('Failed to parse completed steps:', e);
  }
  return [];
};

const saveCompletedSteps = (completedSteps: number[]): void => {
  try {
    sessionStorage.setItem(WALKTHROUGH_COMPLETED_STEPS_KEY, JSON.stringify(completedSteps));
    console.log('💾 Saved completed steps:', completedSteps);
  } catch (e) {
    console.warn('Failed to save completed steps:', e);
  }
};

const findFirstIncompleteStep = (steps: Step[]): number => {
  const completedSteps = getCompletedSteps();
  console.log(`🔍 Finding first incomplete step. Completed steps: [${completedSteps.join(', ')}], Total steps: ${steps.length}`);
  const firstIncomplete = steps.findIndex((_, index) => !completedSteps.includes(index));
  const result = firstIncomplete !== -1 ? firstIncomplete : steps.length;
  console.log(`🔍 First incomplete step found: ${result}`);
  return result;
};

export const useRecommendationsWalkthrough = (
  recommendationsData?: RecommendationsData,
  isPlaceModalOpen?: boolean,
  onTabChange?: (tabName: string) => void,
  manageTabName?: string
) => {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { isProfileComplete, isRecommendationsComplete } = useSetupStore();

  // Refs for tracking state
  const runRef = useRef(run);
  const stepIndexRef = useRef(0);
  const onTabChangeRef = useRef(onTabChange);
  const manageTabNameRef = useRef(manageTabName);
  const isActionInProgressRef = useRef(false); // Track when real action is in progress
  const advanceToNextStepRef = useRef<(() => void) | null>(null); // Ref to store advanceToNextStep function
  const isAdvancingRef = useRef(false); // Track when advanceToNextStep() is in progress

  // Update refs when values change
  useEffect(() => {
    runRef.current = run;
    stepIndexRef.current = stepIndex;
    onTabChangeRef.current = onTabChange;
    manageTabNameRef.current = manageTabName;
  }, [run, stepIndex, onTabChange, manageTabName]);

  // Define all 5 steps
  const steps: Step[] = useMemo(() => [
    {
      target: '[data-walkthrough="add-place"]',
      content: "Click here to add places to your recommendation list.",
      placement: "bottom",
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
    },
    {
      target: '[data-walkthrough="suggestion-button"]',
      content: "Click here to see suggested places based on your location.",
      placement: "bottom",
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
    },
    {
      target: '[data-walkthrough="togglePublish"]',
      content: "Toggle this switch to change from Draft to Published status.",
      placement: "bottom",
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
    },
    {
      target: '[data-walkthrough="manage-tab"]',
      content: "Click on the Manage tab to access sharing options and QR code.",
      placement: "bottom",
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
    },
    {
      target: '[data-walkthrough="share-button"]',
      content: recommendationsData?.isPublished
        ? "Click here to share your recommendation list and access the QR code."
        : "Share your recommendation list from here. QR code will be active once you publish at least one recommendation.",
      placement: "bottom",
      disableBeacon: true,
      disableOverlayClose: true,
      spotlightClicks: true,
    },
  ], [recommendationsData?.isPublished]);  // ✅ Add dependency
  // Helper: normalize saved step index (no data inference, just validation)
  const normalizeSavedStep = useCallback(
    (saved: number | null): number => {
      // If no saved step, start from step 0
      if (saved === null || isNaN(saved)) {
        return 0;
      }

      // Clamp into valid range (no conditional skipping based on data)
      let startFromStep = saved;
      if (startFromStep < 0) startFromStep = 0;
      if (startFromStep >= steps.length) startFromStep = steps.length - 1;

      return startFromStep;
    },
    [steps.length]
  );

  // Track if walkthrough was skipped or finished (prevents auto-restart)
  const hasBeenSkippedOrFinishedRef = useRef(false);

  // Helper function to wait for element (defined early so it can be used in useEffects)
  const waitForElement = useCallback((selector: string, maxAttempts: number = 50): Promise<Element | null> => {
    return new Promise((resolve) => {
      let attempts = 0;

      const checkElement = () => {
        attempts++;
        const element = document.querySelector(selector);

        if (element) {
          console.log(`✅ Found: ${selector} (${attempts})`);
          resolve(element);
        } else if (attempts < maxAttempts) {
          setTimeout(checkElement, 100);
        } else {
          console.warn(`⚠️ Not found: ${selector}`);
          resolve(null);
        }
      };

      checkElement();
    });
  }, []);

  // Load first incomplete step from completed steps on mount - but don't auto-start
  // CRITICAL: Don't load if profile setup is already complete
  useEffect(() => {
    // If setup is complete, clear any walkthrough state and don't load steps
    if (isProfileComplete && isRecommendationsComplete) {
      console.log('⏭️ Setup complete - clearing walkthrough state on mount');
      sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
      sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
      setRun(false); // Stop if it was running
      setStepIndex(0);
      stepIndexRef.current = 0;
      hasBeenSkippedOrFinishedRef.current = true; // Mark as finished to prevent any auto-start
      return;
    }

    const firstIncomplete = findFirstIncompleteStep(steps);
    if (firstIncomplete < steps.length) {
      console.log('📂 Loaded first incomplete step on mount:', firstIncomplete, '(completed steps:', getCompletedSteps(), ')');
      setStepIndex(firstIncomplete);
      stepIndexRef.current = firstIncomplete;
      sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, firstIncomplete.toString());
    }
  }, [steps, isProfileComplete, isRecommendationsComplete]);

  // Track the last known step index to prevent unnecessary resets
  const lastKnownStepRef = useRef<number | null>(null);
  const previousPlacesCountRef = useRef<number>(recommendationsData?.placesCount || 0);

  // Initialize previous places count when walkthrough starts at step 0
  useEffect(() => {
    if (run && stepIndex === 0) {
      // When walkthrough starts at step 0, initialize previous count to current count
      previousPlacesCountRef.current = recommendationsData?.placesCount || 0;
      console.log(`📊 Initialized previous places count: ${previousPlacesCountRef.current}`);
    }
  }, [run, stepIndex, recommendationsData?.placesCount]);

  // REMOVED: Complex useEffect that infers steps from data
  // Step advancement is now handled ONLY by advanceToNextStep() which increments by +1

  // Save current step to session storage whenever it changes (single source of truth)
  // CRITICAL: Don't save if profile setup is already complete
  useEffect(() => {
    // If setup is complete, don't save walkthrough state
    if (isProfileComplete && isRecommendationsComplete) {
      return;
    }

    if (!hasBeenSkippedOrFinishedRef.current && stepIndex >= 0 && stepIndex < steps.length) {
      stepIndexRef.current = stepIndex;
      sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, stepIndex.toString());
      lastKnownStepRef.current = stepIndex;
      console.log('💾 Saved step to sessionStorage:', stepIndex);
    }
  }, [stepIndex, steps.length, isProfileComplete, isRecommendationsComplete]);

  // Start walkthrough ONLY from Setup button (location.state?.startTour)
  // Never auto-start when just visiting the page
  // CRITICAL: Don't start if profile setup is already complete
  useEffect(() => {
    if (location.state?.startTour) {
      // Check if profile setup is complete - if so, don't start walkthrough
      if (isProfileComplete && isRecommendationsComplete) {
        console.log('⏭️ Skipping walkthrough - profile setup is already complete');
        window.history.replaceState({}, document.title);
        return;
      }

      window.history.replaceState({}, document.title);

      // Reset skip/finish flag and action flag when starting from Setup
      hasBeenSkippedOrFinishedRef.current = false;
      isActionInProgressRef.current = false; // Clear action flag

      // Find first incomplete step (based on completed steps tracking)
      const startFromStep = findFirstIncompleteStep(steps);
      lastKnownStepRef.current = startFromStep;

      console.log('✅ Starting from first incomplete step:', startFromStep, '(completed steps:', getCompletedSteps(), ')');

      const targetSelector = steps[startFromStep]?.target as string;

      waitForElement(targetSelector).then((element) => {
        if (element) {
          setStepIndex(startFromStep);
          stepIndexRef.current = startFromStep;
          sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, startFromStep.toString());
          // Add 1-2 second delay before showing tooltip
          setTimeout(() => {
            setRun(true);
          }, 1200);
        } else {
          // Start from beginning if element not found
          setStepIndex(0);
          stepIndexRef.current = 0;
          lastKnownStepRef.current = 0;
          sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, '0');
          waitForElement('[data-walkthrough="add-place"]').then((el) => {
            if (el) {
              setTimeout(() => setRun(true), 1200);
            }
          });
        }
      });
    }
  }, [location.state?.startTour, steps, waitForElement, normalizeSavedStep, recommendationsData?.hasPlaces, recommendationsData?.isPublished, isProfileComplete, isRecommendationsComplete]);

  // Pause when modal opens OR when real action starts
  useEffect(() => {
    if (isPlaceModalOpen && run) {
      console.log('⏸️ Pausing - modal open');
      isActionInProgressRef.current = true;
      setRun(false);
    }
  }, [isPlaceModalOpen, run]);

  // Pause immediately when user clicks on walkthrough target elements (real actions)
  useEffect(() => {
    if (!run) return; // Only when walkthrough is running

    const handleRealActionClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const clickedElement = target.closest('[data-walkthrough]');

      if (!clickedElement) return;

      const walkthroughAttr = clickedElement.getAttribute('data-walkthrough');
      const currentStepTarget = steps[stepIndexRef.current]?.target as string;

      // Check if clicked element matches current step target (real action)
      if (walkthroughAttr && currentStepTarget?.includes(walkthroughAttr)) {
        // Don't pause for preview mode (Next/Back buttons)
        if (target.closest('.react-joyride__tooltip')) return;

        console.log(`⏸️ Pausing - real action started: ${walkthroughAttr} (current step: ${stepIndexRef.current})`);

        // CRITICAL: Save current step index to sessionStorage before pausing
        // This ensures advanceToNextStep() can correctly identify which step was completed
        if (stepIndexRef.current >= 0 && stepIndexRef.current < steps.length) {
          sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, stepIndexRef.current.toString());
          console.log(`💾 Saved step ${stepIndexRef.current} to sessionStorage before pausing for real action`);
        }

        isActionInProgressRef.current = true;
        setRun(false);
      }
    };

    document.addEventListener('click', handleRealActionClick, true);
    return () => {
      document.removeEventListener('click', handleRealActionClick, true);
    };
  }, [run, steps]);


  // DO NOT auto-resume step 5 - only allow if walkthrough was already running
  // This prevents auto-starting when user returns to page
  // Step 5 will only appear when user clicks Setup or is already in the walkthrough
  // Profile walkthrough follows the same pattern - no auto-resume

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, action, type } = data;

    console.log('🎯 Callback:', { status, index, action, type });

    // Handle completion
    if (status === STATUS.FINISHED) {
      console.log('🎉 Finished');
      hasBeenSkippedOrFinishedRef.current = true;
      isActionInProgressRef.current = false; // Clear action flag
      sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
      sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
      setRun(false);
      setStepIndex(0);
      return;
    }

    // Handle skip - must end permanently and clear storage
    if (status === STATUS.SKIPPED) {
      console.log('⏭️ Skipped - ending walkthrough permanently');
      hasBeenSkippedOrFinishedRef.current = true;
      isActionInProgressRef.current = false; // Clear action flag
      sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
      sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
      setRun(false);
      setStepIndex(0);
      return;
    }

    // Ignore stop callbacks that are triggered by our own setRun(false)
    // These are just status updates, not user actions
    if (action === 'stop' && type === 'tour:status') {
      return;
    }

    // Handle Next/Finish button - this is for preview/navigation only, doesn't mark step as complete
    if (action === 'next' && type === 'step:after') {
      // Handle Finish button on step 5 (index 4) - preview mode only
      if (index === 4) {
        console.log('🎉 Completed via Finish button on step 5 (preview mode)');
        hasBeenSkippedOrFinishedRef.current = true;
        sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
        sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
        setRun(false);
        setStepIndex(0);
        return;
      }

      const nextIndex = index + 1;

      console.log(`➡️ Next clicked: moving from step ${index} to step ${nextIndex} (preview only)`);

      if (nextIndex >= steps.length) {
        console.log('🎉 Completed via Next button');
        hasBeenSkippedOrFinishedRef.current = true;
        sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
        setRun(false);
        setStepIndex(0);
        return;
      }

      // Update ref and save to sessionStorage for navigation
      // This is just for preview - real completion is tracked by actual actions
      stepIndexRef.current = nextIndex;
      if (!hasBeenSkippedOrFinishedRef.current) {
        sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, nextIndex.toString());
        console.log(`💾 Saved step ${nextIndex} to sessionStorage (preview)`);
      }

      // Special: Manage tab -> Share button (step 4 to step 5)
      if (index === 3) {
        console.log("📌 Moving to Manage page for Step 5");

        // CRITICAL: Set stepIndex to 4 FIRST (before pausing) - same pattern as normal next flow
        // This ensures Joyride knows which step to show when we resume
        setStepIndex(4);
        stepIndexRef.current = 4;
        sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
        console.log("💾 Set stepIndex to 4 before pausing");

        // Now pause - Joyride will have stepIndex=4 when it resumes
        setRun(false);

        const openTab = () => {
          const manageButton = document.querySelector('[data-walkthrough="manage-tab"]') as HTMLElement;
          if (manageButton) manageButton.click();
          else onTabChangeRef.current?.(manageTabNameRef.current ?? "");
        };

        openTab();

        // Wait for tab switch, then find element and scroll
        setTimeout(async () => {
          console.log("🔍 Waiting for share button...");
          const element = await waitForElement('[data-walkthrough="share-button"]', 200);

          if (!element) {
            console.warn("⚠ share button not found, retrying later");
            return;
          }

          console.log("✅ Found share-button, scrolling into view");
          element.scrollIntoView({ behavior: "smooth", block: "center" });

          // Wait for scroll animation to complete
          await new Promise(res => setTimeout(res, 800));

          // Verify stepIndex is still 4 and element is ready
          if (stepIndexRef.current !== 4) {
            console.warn("⚠️ stepIndex changed, resetting to 4");
            setStepIndex(4);
            stepIndexRef.current = 4;
            sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
          }

          // Use same delay pattern as normal next flow (1200ms)
          setTimeout(() => {
            const verifyElement = document.querySelector('[data-walkthrough="share-button"]');
            if (verifyElement && stepIndexRef.current === 4) {
              console.log("🎯 Ready → Showing step 5 (stepIndex confirmed as 4, element verified)");
              setRun(true);
            } else {
              console.warn("⚠️ Element or stepIndex issue, retrying...");
              if (stepIndexRef.current !== 4) {
                setStepIndex(4);
                stepIndexRef.current = 4;
              }
              setTimeout(() => setRun(true), 500);
            }
          }, 1200); // Same delay as normal next flow
        }, 1000); // Wait for tab switch to complete

        return;
      }

      // Normal next - update stepIndex and advance
      // Always advance the step, even if element not found immediately
      const nextSelector = steps[nextIndex]?.target as string;
      console.log(`🔍 Checking for next element: ${nextSelector}`);

      // Update stepIndex immediately to advance
      setStepIndex(nextIndex);

      // Check if element exists immediately
      const nextElement = document.querySelector(nextSelector);
      if (nextElement) {
        console.log(`✅ Element found immediately, continuing to step ${nextIndex}`);
        // Element exists, pause briefly then resume with delay
        setRun(false);
        setTimeout(() => {
          setRun(true);
        }, 1200);
        return;
      }

      // Element not found, wait for it then resume
      console.log(`⏳ Element not found, waiting for: ${nextSelector}`);
      setRun(false);

      waitForElement(nextSelector).then((element) => {
        if (element) {
          console.log(`✅ Found element for step ${nextIndex}, resuming walkthrough`);
          // Add 1-2 second delay before showing tooltip
          setTimeout(() => {
            console.log(`▶️ Resuming walkthrough at step ${nextIndex}`);
            setRun(true);
          }, 1200);
        } else {
          console.warn(`⚠️ Target not found for step ${nextIndex}: ${nextSelector}, but advancing anyway`);
          // Advance anyway even if element not found, with delay
          setTimeout(() => {
            setRun(true);
          }, 1200);
        }
      });
      return;
    }

    // Handle Back button
    if (action === 'prev' && type === 'step:after') {
      const prevIndex = index - 1;
      if (prevIndex < 0) return;

      console.log('⬅️ Back to:', prevIndex);

      // Update ref and save to sessionStorage immediately
      stepIndexRef.current = prevIndex;
      sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, prevIndex.toString());

      const prevSelector = steps[prevIndex]?.target as string;
      setRun(false);

      waitForElement(prevSelector).then((element) => {
        if (element) {
          // Update stepIndex before resuming to ensure Joyride shows correct step
          setStepIndex(prevIndex);
          // Add 1-2 second delay before showing tooltip
          setTimeout(() => {
            setRun(true);
          }, 1200);
        } else {
          console.warn(`⚠️ Target not found for step ${prevIndex}: ${prevSelector}`);
        }
      });
      return;
    }

    // Handle target not found
    if (type === 'error:target_not_found') {
      console.warn(`⚠️ Target not found: step ${index}`);
      setRun(false);

      const targetSelector = steps[index]?.target as string;

      waitForElement(targetSelector, 100).then((element) => {
        if (element) {
          setTimeout(() => setRun(true), 200);
        }
      });
    }
  }, [steps, waitForElement, onTabChangeRef, manageTabNameRef]);

  // Manual advance - called after user completes the REAL action for a step
  // This is different from clicking Next - this marks the step as actually completed
  const advanceToNextStep = useCallback(() => {
    if (hasBeenSkippedOrFinishedRef.current || (isProfileComplete && isRecommendationsComplete)) {
      console.log('⚠️ Cannot advance - walkthrough was skipped, finished, or setup is already complete');
      // Ensure state is cleared if setup is complete
      if (isProfileComplete && isRecommendationsComplete) {
        sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
        sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
        setRun(false);
      }
      return;
    }

    // CRITICAL: If walkthrough is not running, only advance if we explicitly want to start/resume
    // and there is actual progress saved. This prevents auto-starting on new recommendation additions
    // when the user is not currently in a walkthrough session.
    if (!run && !sessionStorage.getItem(WALKTHROUGH_CURRENT_STEP_KEY)) {
      console.log('⏭️ Skipping advancement - walkthrough not active and no saved progress');
      return;
    }

    // Set flag to prevent useEffect from running while we're advancing
    isAdvancingRef.current = true;
    console.log(`🚀 Starting advanceToNextStep() - setting isAdvancingRef to true`);

    // Get current step from sessionStorage (source of truth for actual-action mode)
    // This ensures we have the correct step even if stepIndexRef is out of sync
    const savedStepRaw = sessionStorage.getItem(WALKTHROUGH_CURRENT_STEP_KEY);
    let currentIndex: number;

    if (savedStepRaw !== null) {
      const parsed = parseInt(savedStepRaw, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < steps.length) {
        currentIndex = parsed;
        // Sync ref with sessionStorage
        stepIndexRef.current = parsed;
        console.log(`📊 Current step from sessionStorage: ${currentIndex}`);
      } else {
        // Fallback to ref if sessionStorage is invalid
        currentIndex = stepIndexRef.current;
        console.log(`📊 Using stepIndexRef as fallback: ${currentIndex} (sessionStorage had invalid value: ${savedStepRaw})`);
      }
    } else {
      // Fallback to ref if sessionStorage is empty
      // But also check if we can infer from completed steps
      const completedSteps = getCompletedSteps();
      if (completedSteps.length > 0) {
        // If we have completed steps, the current step should be the last completed step
        // But wait, that's not right - if step 2 is completed, we should be advancing to step 3
        // Actually, if step 2 is completed, the current step should be... hmm, this is tricky
        // Let's just use the ref for now
        currentIndex = stepIndexRef.current;
        console.log(`📊 Using stepIndexRef (no sessionStorage, completed steps: [${completedSteps.join(', ')}]): ${currentIndex}`);
      } else {
        currentIndex = stepIndexRef.current;
        console.log(`📊 Using stepIndexRef (no sessionStorage, no completed steps): ${currentIndex}`);
      }
    }

    if (isNaN(currentIndex) || currentIndex < 0 || currentIndex >= steps.length) {
      console.warn('⚠️ Invalid current step index:', currentIndex);
      isAdvancingRef.current = false;
      return;
    }

    console.log(`📊 Current step: ${currentIndex} (stepIndexRef: ${stepIndexRef.current})`);

    // Mark current step as completed (for actual-action mode only)
    const completedSteps = getCompletedSteps();
    if (!completedSteps.includes(currentIndex)) {
      completedSteps.push(currentIndex);
      saveCompletedSteps(completedSteps);
      console.log(`✅ Marked step ${currentIndex} as completed. Completed steps:`, completedSteps);
    } else {
      console.log(`ℹ️ Step ${currentIndex} already marked as completed. Completed steps:`, completedSteps);
    }

    // Find next incomplete step
    const nextIndex = findFirstIncompleteStep(steps);

    if (nextIndex >= steps.length) {
      // All steps completed
      console.log('🎉 All steps completed');
      hasBeenSkippedOrFinishedRef.current = true;
      sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
      sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
      lastKnownStepRef.current = null;
      setRun(false);
      setStepIndex(0);
      isAdvancingRef.current = false;
      return;
    }

    // CRITICAL: Prevent looping back to the same step
    if (nextIndex === currentIndex) {
      console.error(`❌ Cannot advance - next step ${nextIndex} is same as current step ${currentIndex}`);
      console.error(`   Completed steps:`, getCompletedSteps());
      isAdvancingRef.current = false;
      return;
    }

    // CRITICAL: Ensure next step is not already completed
    const completedStepsAfterMarking = getCompletedSteps();
    if (completedStepsAfterMarking.includes(nextIndex)) {
      console.error(`❌ Next step ${nextIndex} is already completed! Completed steps:`, completedStepsAfterMarking);
      isAdvancingRef.current = false;
      return;
    }

    console.log(`➡️ Step ${currentIndex} completed, next incomplete step: ${nextIndex}`);

    // Special handling for step 4→5 transition (Manage tab → Share button)
    if (currentIndex === 3) {
      console.log("📑 Real completion: Switching to Manage tab for step 5");

      // CRITICAL: Set stepIndex to 4 FIRST (before pausing) - same pattern as normal next flow
      setStepIndex(4);
      stepIndexRef.current = 4;
      lastKnownStepRef.current = 4;
      sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
      console.log("💾 Set stepIndex to 4 before pausing (real completion)");

      // Now pause - Joyride will have stepIndex=4 when it resumes
      setRun(false);

      // Click the manage-tab button to switch tabs
      const manageTabButton = document.querySelector('[data-walkthrough="manage-tab"]') as HTMLElement;
      if (manageTabButton) {
        console.log('🖱️ Clicking manage-tab button (real completion)');
        manageTabButton.click();
      } else {
        console.warn('⚠️ Manage tab button not found, trying callback');
        onTabChangeRef.current?.(manageTabNameRef.current ?? "");
      }

      // Wait for tab switch, route navigation, and component to render
      setTimeout(async () => {
        console.log('🔍 Looking for share-button (real completion)...');

        // First, verify we're on the Manage route
        let routeCheckAttempts = 0;
        while (routeCheckAttempts < 10) {
          const currentPath = window.location.pathname.toLowerCase();
          const isOnManageRoute = currentPath.includes('manage');
          if (isOnManageRoute) {
            console.log('✅ On Manage route');
            break;
          }
          console.log(`⏳ Waiting for route change... (attempt ${routeCheckAttempts + 1})`);
          await new Promise(res => setTimeout(res, 200));
          routeCheckAttempts++;
        }

        // Wait for element with more attempts
        const element = await waitForElement('[data-walkthrough="share-button"]', 200);

        if (element) {
          const el = element as HTMLElement;
          console.log(`✅ Found share-button, scrolling into view (real completion)`);

          // Get element position before scrolling
          const beforeScrollRect = el.getBoundingClientRect();
          const beforeScrollTop = window.pageYOffset || window.scrollY;
          console.log('📏 Before scroll:', {
            elementTop: beforeScrollRect.top,
            elementBottom: beforeScrollRect.bottom,
            viewportHeight: window.innerHeight,
            scrollTop: beforeScrollTop,
            isVisible: el.offsetParent !== null
          });

          // CRITICAL: Scroll to element - same as preview mode
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest"
          });

          // Wait for scroll animation to complete (longer for smooth scroll)
          await new Promise(res => setTimeout(res, 1500));

          // Verify element is now in viewport after scroll
          const afterScrollRect = el.getBoundingClientRect();
          const afterScrollTop = window.pageYOffset || window.scrollY;
          const isInViewport = afterScrollRect.top >= -100 &&
            afterScrollRect.bottom <= window.innerHeight + 100; // Allow margin

          console.log('📏 After scroll:', {
            elementTop: afterScrollRect.top,
            elementBottom: afterScrollRect.bottom,
            viewportHeight: window.innerHeight,
            scrollTop: afterScrollTop,
            scrollDelta: afterScrollTop - beforeScrollTop,
            isInViewport,
            isVisible: el.offsetParent !== null,
            hasDimensions: afterScrollRect.width > 0 && afterScrollRect.height > 0
          });

          // If not in viewport, try scrolling again
          if (!isInViewport && el.offsetParent !== null) {
            console.log('🔄 Element not fully in viewport, scrolling again...');
            el.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest"
            });
            await new Promise(res => setTimeout(res, 1000));
          }

          // Verify stepIndex is still 4
          if (stepIndexRef.current !== 4) {
            console.warn("⚠️ stepIndex changed, resetting to 4");
            setStepIndex(4);
            stepIndexRef.current = 4;
            lastKnownStepRef.current = 4;
            sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
          }

          // Use same delay pattern as normal next flow (1200ms)
          setTimeout(() => {
            const verifyElement = document.querySelector('[data-walkthrough="share-button"]') as HTMLElement;
            const finalRect = verifyElement?.getBoundingClientRect();

            // CRITICAL: Verify element is not just in DOM, but also visible and in viewport
            const isElementReady = verifyElement &&
              verifyElement.offsetParent !== null &&
              finalRect &&
              finalRect.width > 0 &&
              finalRect.height > 0 &&
              finalRect.top >= -100 && // Allow margin above viewport
              finalRect.bottom <= window.innerHeight + 100; // Allow margin below

            if (isElementReady && stepIndexRef.current === 4) {
              console.log("🎯 Ready → Showing step 5 (real completion, element verified as visible and in viewport)");

              // Ensure stepIndex is definitely 4
              if (stepIndexRef.current !== 4) {
                setStepIndex(4);
                stepIndexRef.current = 4;
                lastKnownStepRef.current = 4;
                sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
              }

              // Use requestAnimationFrame to ensure React has processed state
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  console.log("✅ Calling setRun(true) for step 5 after scroll");
                  setRun(true);
                });
              });
            } else {
              console.warn("⚠️ Element not ready or stepIndex issue, retrying...", {
                elementExists: !!verifyElement,
                isVisible: verifyElement ? verifyElement.offsetParent !== null : false,
                hasDimensions: finalRect ? finalRect.width > 0 : false,
                isInViewport: finalRect ? (finalRect.top >= -100 && finalRect.bottom <= window.innerHeight + 100) : false,
                stepIndex: stepIndexRef.current
              });

              if (stepIndexRef.current !== 4) {
                setStepIndex(4);
                stepIndexRef.current = 4;
                lastKnownStepRef.current = 4;
                sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, "4");
              }

              // Retry after a bit more time - scroll again if needed
              setTimeout(() => {
                const retryElement = document.querySelector('[data-walkthrough="share-button"]') as HTMLElement;
                const retryRect = retryElement?.getBoundingClientRect();
                if (retryElement &&
                  retryElement.offsetParent !== null &&
                  retryRect &&
                  retryRect.width > 0 &&
                  retryRect.height > 0 &&
                  stepIndexRef.current === 4) {
                  // Scroll one more time if not in viewport
                  if (retryRect.top < -100 || retryRect.bottom > window.innerHeight + 100) {
                    console.log('🔄 Final scroll attempt...');
                    retryElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          setRun(true);
                        });
                      });
                    }, 1000);
                  } else {
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        setRun(true);
                      });
                    });
                  }
                }
              }, 800);
            }
          }, 1200); // Same delay as normal next flow
        } else {
          console.warn(`⚠️ Share button not found after waiting, but advancing anyway`);
          // Update stepIndex and resume with proper delay
          setStepIndex(4);
          stepIndexRef.current = 4;
          lastKnownStepRef.current = 4;
          setTimeout(() => {
            setRun(true);
          }, 1200);
        }
      }, 1000); // Wait for tab switch to complete
      return;
    }

    // Normal step advancement (not step 4→5)
    // Update step index and save to sessionStorage IMMEDIATELY
    stepIndexRef.current = nextIndex;
    lastKnownStepRef.current = nextIndex;
    sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, nextIndex.toString());
    setStepIndex(nextIndex);
    console.log(`💾 Saved step ${nextIndex} to sessionStorage (from advanceToNextStep)`);

    setRun(false);

    const nextSelector = steps[nextIndex]?.target as string;
    console.log(`🔍 Waiting for element: ${nextSelector} (step ${nextIndex})`);

    // Increase wait attempts for manage tab (step 3) as it might need more time
    const maxAttempts = nextIndex === 3 ? 150 : 100;

    waitForElement(nextSelector, maxAttempts).then((element) => {
      // Clear the advancing flag after a short delay to allow state to settle
      setTimeout(() => {
        isAdvancingRef.current = false;
        console.log(`✅ Cleared isAdvancingRef flag after advancing to step ${nextIndex}`);
      }, 1000);

      if (element) {
        console.log(`✅ Element found for step ${nextIndex}: ${nextSelector}`);
        // Scroll element into view if needed
        const el = element as HTMLElement;
        if (el) {
          // Verify element is visible before scrolling
          const rect = el.getBoundingClientRect();
          const isVisible = el.offsetParent !== null && rect.width > 0 && rect.height > 0;
          console.log(`📏 Element visibility check: offsetParent=${el.offsetParent !== null}, width=${rect.width}, height=${rect.height}, visible=${isVisible}`);

          if (isVisible) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            console.warn(`⚠️ Element exists but not visible, trying to make it visible`);
            // Try to make element visible
            el.style.display = '';
            el.style.visibility = '';
            el.style.opacity = '';
            setTimeout(() => {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        }
        // Add delay before showing tooltip to ensure element is ready
        setTimeout(() => {
          // Double-check element still exists and is visible
          const verifyElement = document.querySelector(nextSelector) as HTMLElement;
          if (verifyElement && verifyElement.offsetParent !== null) {
            console.log(`▶️ Resuming walkthrough for step ${nextIndex} (element verified as visible)`);
            setRun(true);
          } else {
            console.warn(`⚠️ Element not visible when resuming, but continuing anyway`);
            setRun(true);
          }
        }, 1200);
      } else {
        console.warn(`⚠️ Target not found for step ${nextIndex}: ${nextSelector}, but resuming anyway`);
        // Resume walkthrough even if element not found immediately - it might appear later
        setTimeout(() => {
          console.log(`▶️ Resuming walkthrough for step ${nextIndex} (element not found, but continuing)`);
          setRun(true);
        }, 1200);
      }
    });
  }, [steps, waitForElement]);

  // Update the ref so advanceToNextStep can be called from useEffect
  useEffect(() => {
    advanceToNextStepRef.current = advanceToNextStep;
  }, [advanceToNextStep]);

  // Clear walkthrough state when setup becomes complete
  useEffect(() => {
    if (isProfileComplete && isRecommendationsComplete) {
      console.log('✅ Setup complete - clearing walkthrough state and stopping walkthrough');
      sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
      sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
      hasBeenSkippedOrFinishedRef.current = true;
      setRun(false);
      setStepIndex(0);
      stepIndexRef.current = 0;
    }
  }, [isProfileComplete, isRecommendationsComplete]);

  // Mark processing complete
  // DO NOT auto-resume - only allow resume if walkthrough was already running
  // This prevents auto-starting when processing completes
  // Profile walkthrough follows the same pattern - no auto-resume
  // CRITICAL: Don't resume if profile setup is already complete
  const markProcessingComplete = useCallback(() => {
    console.log('✅ Processing complete');
    // Don't resume if setup is complete
    if (isProfileComplete && isRecommendationsComplete) {
      console.log('⏭️ Skipping processing complete resume - profile setup is already complete');
      return;
    }
    // Only resume if walkthrough was already running (not auto-start)
    if (run && stepIndexRef.current < steps.length && !hasBeenSkippedOrFinishedRef.current) {
      setTimeout(() => setRun(true), 300);
    }
  }, [run, steps.length, isProfileComplete, isRecommendationsComplete]);

  // Reset walkthrough
  const resetWalkthrough = useCallback(() => {
    console.log('🔄 Reset');
    hasBeenSkippedOrFinishedRef.current = false;
    isActionInProgressRef.current = false; // Clear action flag
    sessionStorage.removeItem(WALKTHROUGH_CURRENT_STEP_KEY);
    sessionStorage.removeItem(WALKTHROUGH_COMPLETED_STEPS_KEY);
    setStepIndex(0);
    setRun(false);
  }, []);

  // Start manually - resume from first incomplete step
  const startWalkthrough = useCallback(() => {
    console.log('▶️ Manual start');

    // Check if profile setup is complete - if so, don't start walkthrough
    if (isProfileComplete && isRecommendationsComplete) {
      console.log('⏭️ Skipping manual walkthrough start - profile setup is already complete');
      return;
    }

    // Reset skip/finish flag and action flag when manually starting
    hasBeenSkippedOrFinishedRef.current = false;
    isActionInProgressRef.current = false; // Clear action flag

    // Find first incomplete step (based on completed steps tracking)
    const startFromStep = findFirstIncompleteStep(steps);

    console.log('📂 Manual start from first incomplete step:', startFromStep, '(completed steps:', getCompletedSteps(), ')');

    const targetSelector = steps[startFromStep]?.target as string;

    waitForElement(targetSelector).then((element) => {
      if (element) {
        setStepIndex(startFromStep);
        sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, startFromStep.toString());
        // Add 1-2 second delay before showing tooltip
        setTimeout(() => {
          setRun(true);
        }, 1200);
      } else {
        // Fallback to step 0 if target not found
        waitForElement('[data-walkthrough="add-place"]').then((el) => {
          if (el) {
            setStepIndex(0);
            sessionStorage.setItem(WALKTHROUGH_CURRENT_STEP_KEY, '0');
            setTimeout(() => {
              setRun(true);
            }, 1200);
          }
        });
      }
    });
  }, [waitForElement, steps, normalizeSavedStep, isProfileComplete, isRecommendationsComplete]);

  return {
    run,
    steps,
    stepIndex,
    setRun,
    setStepIndex,
    handleJoyrideCallback,
    advanceToNextStep,
    markProcessingComplete,
    resetWalkthrough,
    startWalkthrough,
    isWalkthroughComplete: false,
    setIsFormActive: () => { },
    advanceToNextStepRef: { current: advanceToNextStep },
    markProcessingCompleteRef: { current: markProcessingComplete },
  };
};