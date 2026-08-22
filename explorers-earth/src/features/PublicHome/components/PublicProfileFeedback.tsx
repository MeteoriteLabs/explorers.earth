import { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

type FocusBehavior = { focusOnMount?: boolean };

export type PublicProfileFeedbackProps = (
  | { kind: "empty"; title: string; description: string }
  | { kind: "partial-error"; title: string; retrying: boolean; onRetry: () => void }
  | { kind: "all-error"; title: string; description: string; retrying: boolean; onRetry: () => void }
) & FocusBehavior;

export const PublicProfileFeedback = memo((props: PublicProfileFeedbackProps) => {
  const { t } = useTranslation();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.focusOnMount) regionRef.current?.focus({ preventScroll: true });
  }, [props.focusOnMount]);

  if (props.kind === "empty") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">{props.title}</h2>
        <p className="max-w-md text-sm text-[var(--text-secondary)] md:text-base">{props.description}</p>
      </div>
    );
  }

  const { title, retrying, onRetry } = props;
  const description = props.kind === "all-error" ? props.description : null;

  return (
    <div
      ref={regionRef}
      tabIndex={props.focusOnMount ? -1 : undefined}
      className={
        props.kind === "partial-error"
          ? "sticky top-0 z-40 mx-auto flex w-full max-w-3xl items-center justify-between gap-4 border-b border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-primary)]"
          : "flex min-h-[40vh] w-full items-center justify-center p-4 text-[var(--text-primary)]"
      }
      data-testid="public-profile-feedback"
      role="alert"
      aria-label={title}
    >
      <div
        className={
          props.kind === "partial-error"
            ? "flex w-full items-center justify-between gap-4"
            : "w-full max-w-md space-y-4 text-center"
        }
      >
        <div className={props.kind === "partial-error" ? "min-w-0" : undefined}>
          <h2 className="text-lg font-semibold md:text-xl">{title}</h2>
          {description && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
          )}
        </div>
        <div className={props.kind === "partial-error" ? "shrink-0" : "pt-2"}>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex min-h-[44px] min-w-[120px] cursor-pointer items-center justify-center rounded-full bg-[var(--accent-color)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--bg-card)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? t("publicProfile.error.retrying", "Retrying...") : t("publicProfile.error.retry", "Retry")}
          </button>
        </div>
      </div>
    </div>
  );
});

PublicProfileFeedback.displayName = "PublicProfileFeedback";

export default PublicProfileFeedback;
