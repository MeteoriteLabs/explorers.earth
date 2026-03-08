import { memo } from "react";
import PublicHome from "../../features/PublicHome/components/PublicHome";

const PublicHomePage = memo(() => {
  console.log("=== PUBLIC HOME PAGE COMPONENT ===");
  console.log("PublicHomePage component rendered");
  console.log("Current URL:", window.location.href);
  console.log("Current pathname:", window.location.pathname);
  
  return <PublicHome />;
});

export default PublicHomePage;
