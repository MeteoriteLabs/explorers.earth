import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddRecommendation } from "../useAddRecommendation";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  placeRefetch: vi.fn(),
  createPlace: vi.fn(),
  createPerson: vi.fn(),
  updatePlace: vi.fn(),
  updatePerson: vi.fn(),
  setSelectedCity: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useApolloClient: () => ({}),
  useQuery: () => ({ refetch: mocks.placeRefetch }),
  useMutation: (document: any) => {
    const source = document?.loc?.source?.body || "";
    if (source.includes("mutation CreateRecommendedPlace")) return [mocks.createPlace];
    if (source.includes("mutation CreateRecommendedPerson")) return [mocks.createPerson];
    if (source.includes("mutation updatePerson")) return [mocks.updatePerson];
    return [mocks.updatePlace];
  },
}));

vi.mock("../../../../store/store", () => ({
  default: () => ({
    token: "token",
    user: { username: "alice" },
  }),
}));

vi.mock("../../../../store/useCityStore", () => ({
  useCityStore: () => ({
    selectedCity: {
      documentId: "list-1",
      List_Name: "Favorites",
      recommended_places: [],
    },
    setSelectedCity: mocks.setSelectedCity,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  });
  return { toast };
});

vi.mock("../../services/claimablePlaceProfileService", () => ({
  createClaimablePlaceProfileService: () => ({
    updateOrCreateClaimablePlaceProfile: vi.fn(),
  }),
}));

const createdRecord = {
  id: 77,
  documentId: "created-place",
};

const uploadedMedia = {
  id: 88,
  documentId: "uploaded-media",
  url: "https://saved-media.s3.amazonaws.com/place.jpg",
};

const selectedMedia = [{
  photoBlob: new Blob(["image"], { type: "image/jpeg" }),
  fileName: "place.jpg",
  url: "blob:place",
  isThumbnail: false,
}];

const values = {
  title: "Saved place",
  category: "category-1",
  subcategory: "subcategory-1",
  address: "Address",
};

const defaultProps = (fetchedGoogleMedia = selectedMedia) => ({
  places: null,
  listId: "list-1",
  type: "default",
  fetchedListId: undefined,
  fetchedGoogleMedia,
  instagramMedia: [],
  setPreviewUrl: vi.fn(),
  setIsLoading: vi.fn(),
  userInputRef: { current: null },
  isCustom: false,
  recommendationType: "place" as const,
  media_details: undefined as any,
});

const renderMediaHook = (fetchedGoogleMedia = selectedMedia) =>
  renderHook(
    ({ media }) => useAddRecommendation(defaultProps(media)),
    { initialProps: { media: fetchedGoogleMedia } },
  );

describe("useAddRecommendation selected-media persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.placeRefetch.mockResolvedValue({
      data: {
        recommendationList: {
          documentId: "list-1",
          List_Name: "Favorites",
          Visibility: true,
          recommended_places: [],
        },
      },
    });
    mocks.createPlace.mockResolvedValue({
      data: { createRecommendedPlace: { documentId: createdRecord.documentId } },
    });
    mocks.updatePlace.mockResolvedValue({
      data: { updateRecommendedPlace: { documentId: createdRecord.documentId } },
    });
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [createdRecord] } });
    vi.mocked(axios.post).mockResolvedValue({ data: [uploadedMedia] });
  });

  it("reports saved only after selected media uploads and metadata persists", async () => {
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });

    expect(result.current.mediaStatus).toBe("saved");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlace).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        documentId: createdRecord.documentId,
        data: {
          media_details: expect.objectContaining({
            imageDetails: [uploadedMedia],
          }),
        },
      }),
    }));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("reports not-selected and completes without a media lookup or false image claim", async () => {
    const { result } = renderMediaHook([]);

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });

    expect(result.current.mediaStatus).toBe("not-selected");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(mocks.updatePlace).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps the created record and selected files after lookup failure, then retries without creating again", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("lookup failed"));
    const hook = renderMediaHook();

    await act(async () => {
      await hook.result.current.handleSubmit(values as any);
    });

    expect(hook.result.current.mediaStatus).toBe("upload-failed");
    expect(hook.result.current.createdRecommendationDocumentId).toBe("created-place");
    expect(mocks.navigate).not.toHaveBeenCalled();

    hook.rerender({ media: [] });
    await act(async () => {
      await hook.result.current.retryMediaUpload();
    });

    expect(hook.result.current.mediaStatus).toBe("saved");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("rejects a lookup row for a different recommendation without uploading to it", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { data: [{ id: 999, documentId: "different-place" }] },
    });
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });

    expect(result.current.mediaStatus).toBe("upload-failed");
    expect(result.current.createdRecommendationDocumentId).toBe("created-place");
    expect(axios.post).not.toHaveBeenCalled();
    expect(mocks.updatePlace).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("reports upload-failed and retries only the failed upload on the same record", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("upload failed"));
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });

    expect(result.current.mediaStatus).toBe("upload-failed");
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retryMediaUpload();
    });

    expect(result.current.mediaStatus).toBe("saved");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("reports metadata-failed and retries metadata without uploading the media twice", async () => {
    mocks.updatePlace.mockRejectedValueOnce(new Error("metadata failed"));
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });

    expect(result.current.mediaStatus).toBe("metadata-failed");
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retryMediaUpload();
    });

    expect(result.current.mediaStatus).toBe("saved");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlace).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("continues after media failure without retrying or duplicating the recommendation", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("upload failed"));
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
    });
    await act(async () => {
      await result.current.continueWithoutImage();
    });

    expect(result.current.mediaStatus).toBe("upload-failed");
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlace).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated submit clicks once a recommendation has already been created", async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error("upload failed"));
    const { result } = renderMediaHook();

    await act(async () => {
      await result.current.handleSubmit(values as any);
      await result.current.handleSubmit(values as any);
    });

    await waitFor(() => expect(result.current.mediaStatus).toBe("upload-failed"));
    expect(mocks.createPlace).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
