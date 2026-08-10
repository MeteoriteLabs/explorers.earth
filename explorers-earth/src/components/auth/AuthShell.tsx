import type { ReactNode } from "react";
import GlobeCanvas from "./GlobeCanvas";
import "./authShell.css";

/**
 * The "Earthrise" scene: warm-dark ground + rotating point-cloud globe + vignette,
 * centering whatever card/form is passed as children. Used by both the OAuth-only
 * screen (AuthLayout) and the manual username/password form.
 */
const AuthShell = ({ children }: { children: ReactNode }) => (
  <div className="ea-root">
    <GlobeCanvas />
    <div className="ea-vignette" />
    {children}
  </div>
);

export default AuthShell;
