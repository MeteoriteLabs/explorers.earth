import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../store/store";
import { getMusicCredential, setMusicCredential } from "../../lib/musicCredentialStore";
import Login from "../Login";
import GoogleAuthRedirect from "../GoogleAuthRedirect";

const doubles = vi.hoisted(() => ({
  navigate: vi.fn(),
  loginMutation: vi.fn(),
  axiosGet: vi.fn(),
  loginSubmit: undefined as undefined | ((values: any, helpers: any) => Promise<void>),
}));

vi.mock("@apollo/client", () => ({
  ApolloError: class ApolloError extends Error { graphQLErrors = []; },
  gql: (parts: TemplateStringsArray) => parts.join(""),
  useMutation: () => [doubles.loginMutation, { loading: false }],
}));
vi.mock("axios", () => ({
  default: { get: doubles.axiosGet },
  AxiosError: class AxiosError extends Error { response?: unknown; },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => doubles.navigate,
  useLocation: () => ({ search: "?access_token=google-strapi-jwt" }),
}));
vi.mock("../../features/Authentication/data", () => ({
  getLoginFormFields: () => [], loginInitialValues: {}, createLoginValidationSchema: () => ({}),
}));
vi.mock("../../features/Authentication/components/AuthForm", () => ({
  default: (props: { onSubmit: (values: any, helpers: any) => Promise<void> }) => {
    doubles.loginSubmit = props.onSubmit;
    return <div data-testid="login-form" />;
  },
}));
vi.mock("../../features/Authentication/api/mutation", () => ({ loginQuery: {} }));
vi.mock("../../components/EarthLoader", () => ({ EarthLoader: () => <div data-testid="loader" /> }));
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../components/auth/AuthLayout", () => ({ default: () => null }));
vi.mock("../../components/auth/AuthShell", () => ({ default: ({ children }: { children: unknown }) => <>{children}</> }));
vi.mock("../../hooks/useToast", () => ({ default: () => ({ toast: vi.fn(), toastError: vi.fn() }) }));
vi.mock("../../config/featureFlags", () => ({ isManualAuthEnabled: () => true }));
vi.mock("../../utils/getCurrentDomain", () => ({ createCanonicalUrl: () => "https://explorers.example/login" }));
vi.mock("../../utils/geoHelpers", () => ({ createWebPageGEOData: () => ({}) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));

const priorUser = {
  id: "account-a", documentId: "subject-a", username: "alpha", email: "alpha@example.invalid",
  blocked: false, token: "strapi-a",
};

beforeEach(() => {
  useAuthStore.getState().logout();
  localStorage.clear();
  doubles.navigate.mockReset();
  doubles.loginMutation.mockReset();
  doubles.axiosGet.mockReset();
  doubles.loginSubmit = undefined;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("real login paths replace Music authority centrally", () => {
  it("clears account A credential during the password Login handler without a preceding logout", async () => {
    useAuthStore.getState().login(priorUser);
    setMusicCredential({ token: "account-a.music.credential", expiresAt: Date.now() + 60_000 });
    doubles.loginMutation.mockResolvedValue({ data: { login: {
      jwt: "strapi-b", user: {
        id: "account-b", documentId: "subject-b", username: "bravo", email: "bravo@example.invalid", blocked: false,
      },
    } } });
    render(<Login />);

    vi.useFakeTimers();
    await act(async () => {
      const submitted = doubles.loginSubmit?.(
        { username: "bravo", password: "password-b" },
        { setErrors: vi.fn(), setSubmitting: vi.fn() },
      );
      await vi.runAllTimersAsync();
      await submitted;
    });
    vi.useRealTimers();

    expect(useAuthStore.getState().user?.documentId).toBe("subject-b");
    expect(getMusicCredential()).toBeUndefined();
  });

  it("clears account A credential during Google redirect login without a preceding logout", async () => {
    useAuthStore.getState().login(priorUser);
    setMusicCredential({ token: "account-a.music.credential", expiresAt: Date.now() + 60_000 });
    doubles.axiosGet.mockResolvedValue({ data: {
      id: "account-b", documentId: "subject-b", username: "bravo", email: "bravo@example.invalid", blocked: false,
    } });

    render(<GoogleAuthRedirect />);
    await waitFor(() => expect(useAuthStore.getState().user?.documentId).toBe("subject-b"));
    expect(getMusicCredential()).toBeUndefined();
  });
});
