import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../store/store";
import { explorersApiClient } from "../../../lib/explorersApiClient";
import useSetupStore from "../../../store/useSetupStore";
import { useEffect } from "react";

export function useCanonicalAccount(options: { skip?: boolean } = {}) {
  const identityKey = useAuthStore((state) => state.user?.id ?? "cookie-session");
  const bindAccount = useSetupStore((state) => state.bindAccount);
  const account = useQuery({
    queryKey: ["explorers-account", identityKey],
    queryFn: ({ signal }) => explorersApiClient.getMyProfile(signal),
    enabled: !options.skip,
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (account.data) bindAccount(account.data.id, account.data.onboardingStatus);
  }, [account.data, bindAccount]);
  return account;
}
