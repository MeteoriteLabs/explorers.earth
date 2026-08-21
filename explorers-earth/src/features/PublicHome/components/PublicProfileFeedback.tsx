import { memo } from "react";
import { useTranslation } from "react-i18next";

export type PublicProfileFeedbackProps =
  | { kind: "empty"; title: string; description: string }
  | { kind: "partial-error"; title: string; retrying: boolean; onRetry: () => void }
  | { kind: "all-error"; title: string; description: string; retrying: boolean; onRetry: () => void };

export const PublicProfileFeedback = memo((props: PublicProfileFeedbackProps) => {
  const { t } = useTranslation();

  if (props.kind === "empty") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">{props.title}</h2>
        <p className="text-sm md:text-base text-gray-300 max-w-md">{props.description}</p>
      </div>
    );
  }

  const { title, retrying, onRetry } = props;
  const description = props.kind === "all-error" ? props.description : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      data-testid="public-profile-feedback"
      role="alert"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl space-y-4">
        <h2 className="text-lg md:text-xl font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-gray-300">{description}</p>}
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm transition-opacity hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
