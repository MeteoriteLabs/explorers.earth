import { createRoot } from "react-dom/client";
// Import NewApp for explorers.earth auth model
import NewApp from "./NewApp";
// Old App is still available if needed
// import App from "./App";
import "./index.css";

// Initialize Microsoft Clarity Analytics if project ID is available
const initMicrosoftClarity = () => {
  try {
    // Only initialize if a valid project ID is provided
    const clarityProjectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
    
    if (clarityProjectId && clarityProjectId !== "your-clarity-project-id") {
      console.log("Initializing Microsoft Clarity with project ID");
      
      // Create and inject Clarity script
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", clarityProjectId);
      
      // Add a verification tag that Microsoft Clarity looks for
      window.clarity = window.clarity || function() { (window.clarity.q = window.clarity.q || []).push(arguments) };
      
      // Add metadata to help Clarity detect successful installation
      window.clarity("set", "_clarityProjectId", clarityProjectId);
      window.clarity("set", "cookieConsentLevel", "required");
      
      // Add a verification element that Clarity's detection script looks for
      const verificationTag = document.createElement('meta');
      verificationTag.name = 'ms-clarity';
      verificationTag.content = clarityProjectId;
      document.head.appendChild(verificationTag);
    } else {
      console.log("Microsoft Clarity not initialized - no valid project ID provided");
    }
  } catch (error) {
    console.error("Error initializing Microsoft Clarity:", error);
  }
};

// Initialize analytics
initMicrosoftClarity();

// Render the app with new explorers.earth auth model
createRoot(document.getElementById("root")!).render(<NewApp />);
