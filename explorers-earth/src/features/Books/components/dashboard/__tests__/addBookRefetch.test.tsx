import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { useQuery, useMutation } from "@apollo/client";
import {
  BOOKS_BY_LIST,
  booksByListVars,
  refetchBooksByList,
} from "../../../api/query";
import { CREATE_RECOMMENDED_BOOK } from "../../../api/mutation";

const LIST_ID = "list-1";

// Exactly the 6 NON-NULL variables CREATE_RECOMMENDED_BOOK declares ($volume_id!,
// $title!, $authors!, $is_pinned!, $display_order!, $book_list!). MockedProvider
// matches the mock by deep-equal on variables, so the harness must send this same
// object.
const createVars = {
  volume_id: "vol-1",
  title: "Refetched Book",
  authors: ["Author A"],
  is_pinned: false,
  display_order: 0,
  book_list: LIST_ID,
};

// Full recommended_books selection set (addTypename={false}) so the cache write
// has every field the query asks for — no "missing field" noise on read.
const makeBook = (over: Record<string, unknown>) => ({
  documentId: "b1",
  volume_id: "vol-1",
  title: "Refetched Book",
  subtitle: null,
  authors: ["Author A"],
  year: null,
  cover_url: null,
  cover_url_large: null,
  subjects: null,
  publisher: null,
  page_count: null,
  google_rating: null,
  description: null,
  isbn_13: null,
  preview_link: null,
  user_recommendation_note: null,
  user_rating: null,
  buy_links: null,
  is_pinned: false,
  pin_order: null,
  display_order: 0,
  media_details: null,
  // Typed empty arrays: a future test that needs sub-fields gets a TS error if it
  // spreads the wrong shape (BookListView only renders b.title today).
  book_categories: [] as Array<{ documentId: string; subject_name: string }>,
  Media: [] as Array<{ documentId: string; url: string; caption: string | null }>,
  ...over,
});

const bookListResult = (books: ReturnType<typeof makeBook>[]) => ({
  bookLists: [
    {
      documentId: LIST_ID,
      List_Name: "QA",
      list_description: null,
      slug: "qa",
      visibility: true,
      top_reads_heading: null,
      recommended_books: books,
    },
  ],
});

function Harness() {
  const { data } = useQuery(BOOKS_BY_LIST, {
    variables: booksByListVars(LIST_ID),
    fetchPolicy: "cache-and-network",
  });
  const [createBook] = useMutation(CREATE_RECOMMENDED_BOOK);
  const books = data?.bookLists?.[0]?.recommended_books ?? [];
  return (
    <div>
      <ul>{books.map((b: { documentId: string; title: string }) => <li key={b.documentId}>{b.title}</li>)}</ul>
      <button
        onClick={() =>
          createBook({
            variables: createVars,
            refetchQueries: refetchBooksByList(LIST_ID),
            awaitRefetchQueries: true,
          })
        }
      >
        add
      </button>
    </div>
  );
}

describe("add book → list refetch", () => {
  it("shows the new book after add without a manual reload", async () => {
    const mocks = [
      {
        request: { query: BOOKS_BY_LIST, variables: booksByListVars(LIST_ID) },
        result: { data: bookListResult([]) },
      },
      {
        request: { query: CREATE_RECOMMENDED_BOOK, variables: createVars },
        result: {
          data: {
            createRecommendedBook: {
              documentId: "b1",
              volume_id: "vol-1",
              title: "Refetched Book",
              display_order: 0,
              is_pinned: false,
            },
          },
        },
      },
      {
        request: { query: BOOKS_BY_LIST, variables: booksByListVars(LIST_ID) },
        result: { data: bookListResult([makeBook({})]) },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <Harness />
      </MockedProvider>,
    );

    // Initial list is empty.
    expect(screen.queryByText("Refetched Book")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "add" }));

    // The awaited refetch repopulates the list — appears with no manual reload.
    expect(await screen.findByText("Refetched Book")).toBeInTheDocument();
  });
});
