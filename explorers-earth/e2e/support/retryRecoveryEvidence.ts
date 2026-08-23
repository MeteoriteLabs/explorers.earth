export interface RetryRecoveryEvidence {
  documentSentinel: string | undefined;
  expectedSentinel: string;
  actualUrl: string;
  expectedUrl: string;
  markerVisible: boolean;
  retryGone: boolean;
  recoveryRequests: number;
  responseOk: boolean;
  responseHasErrors: boolean;
  hasContent: boolean;
}

export function assertRetryRecoveryEvidence(evidence: RetryRecoveryEvidence): void {
  if (evidence.documentSentinel !== evidence.expectedSentinel) throw new Error("RETRY_RECOVERY_RELOADED_DOCUMENT");
  if (evidence.actualUrl !== evidence.expectedUrl) throw new Error("RETRY_RECOVERY_ROUTE_CHANGED");
  if (!evidence.markerVisible || !evidence.retryGone || !evidence.hasContent) throw new Error("RETRY_RECOVERY_UI_INCOMPLETE");
  if (evidence.recoveryRequests < 1) throw new Error("RETRY_RECOVERY_NO_OP");
  if (!evidence.responseOk || evidence.responseHasErrors) throw new Error("RETRY_RECOVERY_OPERATION_FAILED");
}
