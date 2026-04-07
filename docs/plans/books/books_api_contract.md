---
Feature: books
Doc type: api_contract
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_schema.md
---

# Books API Contract

## Overview

The Books feature combines:
- **Strapi CMS (GraphQL)**: Manages book lists, recommendations, and user content
- **Google Books API (REST)**: Client-side search and metadata enrichment
- **Apollo Client**: Frontend GraphQL client for all Strapi interactions

This document specifies the API contracts between frontend, Strapi CMS, and Google Books.

---

## 1. GraphQL Queries (Strapi)

All queries use Strapi v4+ GraphQL with `documentId` pattern, filters, pagination, and sorting — mirroring the Movies & Shows pattern.

### 1.1 bookListsByAccount

**Purpose**: Fetch all book lists for a user account. Used by dashboard Books Home and public profile page.

**Query**:
```graphql
query BookListsByAccount($accountDocumentId: ID!) {
  bookLists(
    filters: { account: { documentId: { eq: $accountDocumentId } } }
    sort: ["display_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    cover_image {
      url
      alternativeText
    }
    display_order
    top_reads_heading
    recommended_books {
      documentId
      volume_id
      title
      cover_url
      is_pinned
    }
    account {
      documentId
      username
    }
  }
}
```

**Variables**:
```typescript
{ accountDocumentId: string; }
```

**Response Type**:
```typescript
interface BookListsResponse {
  bookLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    Visibility: boolean;
    cover_image: { url: string; alternativeText: string | null } | null;
    display_order: number;
    top_reads_heading: string | null;
    recommended_books: Array<{
      documentId: string;
      volume_id: string;
      title: string;
      cover_url: string | null;
      is_pinned: boolean;
    }>;
    account: { documentId: string; username: string };
  }>;
}
```

---

### 1.2 booksByList

**Purpose**: Fetch paginated books in a specific list. Used by dashboard list view and public carousel.

**Query**:
```graphql
query BooksByList(
  $bookListDocumentId: ID!
  $page: Int!
  $pageSize: Int!
) {
  bookLists(
    filters: { documentId: { eq: $bookListDocumentId } }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    recommended_books(
      sort: ["display_order:asc"]
      pagination: { start: $page, limit: $pageSize }
    ) {
      documentId
      volume_id
      title
      subtitle
      authors
      publisher
      year
      published_date
      description
      cover_url
      cover_url_large
      subjects
      page_count
      isbn_13
      google_rating
      ratings_count
      user_recommendation_note
      user_rating
      buy_links
      is_pinned
      pin_order
      display_order
      book_categories {
        documentId
        subject_name
      }
      Media {
        documentId
        url
        caption
      }
    }
    _count {
      recommended_books
    }
  }
}
```

**Variables**:
```typescript
{
  bookListDocumentId: string;
  page: number;      // 0-indexed
  pageSize: number;  // typically 12 or 20
}
```

---

### 1.3 bookDetails

**Purpose**: Fetch full details for a single book. Used by detail modal and edit form.

**Query**:
```graphql
query BookDetails($documentId: ID!) {
  recommendedBooks(filters: { documentId: { eq: $documentId } }) {
    documentId
    volume_id
    title
    subtitle
    authors
    publisher
    published_date
    year
    description
    cover_url
    cover_url_large
    subjects
    page_count
    isbn_13
    isbn_10
    google_rating
    ratings_count
    language
    preview_link
    user_recommendation_note
    user_rating
    buy_links
    is_pinned
    pin_order
    display_order
    media_details
    Media {
      documentId
      url
      caption
    }
    book_list {
      documentId
      List_Name
      slug
    }
    book_categories {
      documentId
      subject_name
    }
  }
}
```

**Variables**:
```typescript
{ documentId: string; }
```

---

### 1.4 pinnedBooks

**Purpose**: Fetch all pinned books for a user across all lists. Used by Top Reads row and Top Reads manager.

**Query**:
```graphql
query PinnedBooks($accountDocumentId: ID!) {
  recommendedBooks(
    filters: {
      is_pinned: { eq: true }
      book_list: { account: { documentId: { eq: $accountDocumentId } } }
    }
    sort: ["pin_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    volume_id
    title
    authors
    cover_url
    cover_url_large
    google_rating
    user_rating
    is_pinned
    pin_order
    book_list {
      documentId
      List_Name
      slug
    }
  }
}
```

**Variables**:
```typescript
{ accountDocumentId: string; }
```

---

### 1.5 booksBySubject

**Purpose**: Fetch all books for a user with a specific subject. Used by public subject page.

**Query**:
```graphql
query BooksBySubject($accountDocumentId: ID!, $subject: String!) {
  recommendedBooks(
    filters: {
      subjects: { contains: $subject }
      book_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
    sort: ["display_order:asc"]
    pagination: { limit: 200 }
  ) {
    documentId
    volume_id
    title
    authors
    cover_url
    google_rating
    user_rating
    subjects
    year
    book_list {
      documentId
      List_Name
      slug
    }
  }
}
```

**Variables**:
```typescript
{
  accountDocumentId: string;
  subject: string; // e.g., "Fiction", "Business & Economics"
}
```

---

### 1.6 bookListBySlug

**Purpose**: Fetch a single book list by slug and username for public list page.

**Query**:
```graphql
query BookListBySlug($slug: String!, $username: String!) {
  bookLists(
    filters: {
      slug: { eq: $slug }
      account: { username: { eq: $username } }
      Visibility: { eq: true }
    }
  ) {
    documentId
    List_Name
    list_description
    slug
    cover_image {
      url
      alternativeText
    }
    top_reads_heading
    recommended_books(sort: ["display_order:asc"]) {
      documentId
      volume_id
      title
      authors
      cover_url
      year
      subjects
      google_rating
      user_rating
      is_pinned
      pin_order
    }
    account {
      documentId
      username
    }
  }
}
```

---

### 1.7 publicBookData

**Purpose**: Fetch aggregated data for public books page (all published lists with books and subject summary).

**Query**:
```graphql
query PublicBookData($accountDocumentId: ID!) {
  bookLists(
    filters: {
      account: { documentId: { eq: $accountDocumentId } }
      Visibility: { eq: true }
    }
    sort: ["display_order:asc"]
  ) {
    documentId
    List_Name
    list_description
    slug
    cover_image { url }
    top_reads_heading
    recommended_books(sort: ["is_pinned:desc", "pin_order:asc"]) {
      documentId
      volume_id
      title
      authors
      cover_url
      google_rating
      user_rating
      subjects
      is_pinned
      pin_order
    }
  }
  recommendedBooks(
    filters: {
      book_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
  ) {
    subjects
    cover_url
  }
}
```

---

## 2. GraphQL Mutations (Strapi)

### 2.1 createBookList

**Mutation**:
```graphql
mutation CreateBookList(
  $List_Name: String!
  $list_description: String
  $slug: String!
  $Visibility: Boolean!
  $cover_image: ID
  $display_order: Int!
  $top_reads_heading: String
  $account: ID!
) {
  createBookList(
    data: {
      List_Name: $List_Name
      list_description: $list_description
      slug: $slug
      Visibility: $Visibility
      cover_image: $cover_image
      display_order: $display_order
      top_reads_heading: $top_reads_heading
      account: $account
    }
  ) {
    documentId
    List_Name
    slug
    Visibility
    display_order
  }
}
```

**Input Type**:
```typescript
interface CreateBookListInput {
  List_Name: string;
  list_description?: string;
  slug: string;
  Visibility: boolean;
  cover_image?: string;       // Media documentId
  display_order: number;
  top_reads_heading?: string;
  account: string;            // Account documentId
}
```

---

### 2.2 updateBookList

**Mutation**:
```graphql
mutation UpdateBookList(
  $documentId: ID!
  $List_Name: String
  $list_description: String
  $slug: String
  $Visibility: Boolean
  $cover_image: ID
  $display_order: Int
  $top_reads_heading: String
) {
  updateBookList(
    documentId: $documentId
    data: {
      List_Name: $List_Name
      list_description: $list_description
      slug: $slug
      Visibility: $Visibility
      cover_image: $cover_image
      display_order: $display_order
      top_reads_heading: $top_reads_heading
    }
  ) {
    documentId
    List_Name
    slug
    Visibility
    display_order
    top_reads_heading
  }
}
```

---

### 2.3 deleteBookList

**Mutation**:
```graphql
mutation DeleteBookList($documentId: ID!) {
  deleteBookList(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.4 createRecommendedBook

**Mutation**:
```graphql
mutation CreateRecommendedBook(
  $volume_id: String!
  $title: String!
  $subtitle: String
  $authors: JSON
  $publisher: String
  $published_date: String
  $year: String
  $description: String
  $cover_url: String
  $cover_url_large: String
  $subjects: JSON
  $page_count: Int
  $isbn_13: String
  $isbn_10: String
  $google_rating: Float
  $ratings_count: Int
  $language: String
  $preview_link: String
  $user_recommendation_note: JSON
  $user_rating: Int
  $buy_links: JSON
  $is_pinned: Boolean
  $pin_order: Int
  $display_order: Int!
  $book_list: ID!
  $book_categories: [ID]
) {
  createRecommendedBook(
    data: {
      volume_id: $volume_id
      title: $title
      subtitle: $subtitle
      authors: $authors
      publisher: $publisher
      published_date: $published_date
      year: $year
      description: $description
      cover_url: $cover_url
      cover_url_large: $cover_url_large
      subjects: $subjects
      page_count: $page_count
      isbn_13: $isbn_13
      isbn_10: $isbn_10
      google_rating: $google_rating
      ratings_count: $ratings_count
      language: $language
      preview_link: $preview_link
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      buy_links: $buy_links
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      book_list: $book_list
      book_categories: $book_categories
    }
  ) {
    documentId
    volume_id
    title
    authors
    cover_url
    is_pinned
    display_order
  }
}
```

---

### 2.5 updateRecommendedBook

**Mutation**:
```graphql
mutation UpdateRecommendedBook(
  $documentId: ID!
  $user_recommendation_note: JSON
  $user_rating: Int
  $buy_links: JSON
  $is_pinned: Boolean
  $pin_order: Int
  $display_order: Int
  $book_categories: [ID]
) {
  updateRecommendedBook(
    documentId: $documentId
    data: {
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      buy_links: $buy_links
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      book_categories: $book_categories
    }
  ) {
    documentId
    user_rating
    is_pinned
    pin_order
  }
}
```

---

### 2.6 deleteRecommendedBook

**Mutation**:
```graphql
mutation DeleteRecommendedBook($documentId: ID!) {
  deleteRecommendedBook(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.7 toggleBookPin

**Mutation**: Use `updateRecommendedBook` with only pin fields:
```typescript
// Pin a book
await updateRecommendedBook({
  documentId,
  is_pinned: true,
  pin_order: nextAvailablePinOrder
});

// Unpin a book
await updateRecommendedBook({
  documentId,
  is_pinned: false,
  pin_order: null
});
```

---

### 2.8 reorderBooksInList

**Strategy**: Batch update `display_order` for all affected books after drag-and-drop.

```typescript
// After drag-and-drop reorder, send mutations for all books with changed display_order
// Use Promise.all for batch updates (same as Movies pattern)
await Promise.all(
  reorderedBooks.map((book, index) =>
    updateRecommendedBook({
      documentId: book.documentId,
      display_order: index
    })
  )
);
```

---

### 2.9 reorderPinnedBooks

**Strategy**: Batch update `pin_order` for all pinned books after Top Reads reorder.

```typescript
await Promise.all(
  reorderedPins.map((book, index) =>
    updateRecommendedBook({
      documentId: book.documentId,
      pin_order: index
    })
  )
);
```

---

## 3. Google Books API (REST)

### 3.1 Search Volumes

**Endpoint:** `GET https://www.googleapis.com/books/v1/volumes`

**Parameters:**
```typescript
{
  q: string;          // search query
  maxResults?: number; // default 10, max 40
  startIndex?: number; // pagination, default 0
  printType?: 'books'; // filter to books only
  orderBy?: 'relevance' | 'newest';
  langRestrict?: string;
  key: string;        // VITE_GOOGLE_BOOKS_API_KEY
}
```

**Example Request:**
```
GET https://www.googleapis.com/books/v1/volumes?q=atomic+habits&printType=books&maxResults=10&key={KEY}
```

**Example Response (abridged):**
```json
{
  "kind": "books#volumes",
  "totalItems": 142,
  "items": [
    {
      "id": "XfFvDwAAQBAJ",
      "volumeInfo": {
        "title": "Atomic Habits",
        "subtitle": "An Easy & Proven Way to Build Good Habits & Break Bad Ones",
        "authors": ["James Clear"],
        "publisher": "Penguin Random House",
        "publishedDate": "2018-10-16",
        "description": "No matter your goals, Atomic Habits offers...",
        "pageCount": 320,
        "categories": ["Self-Help"],
        "averageRating": 4.5,
        "ratingsCount": 12847,
        "imageLinks": {
          "smallThumbnail": "http://books.google.com/books/content?id=XfFvDwAAQBAJ&printsec=frontcover&img=1&zoom=5",
          "thumbnail": "http://books.google.com/books/content?id=XfFvDwAAQBAJ&printsec=frontcover&img=1&zoom=1"
        },
        "language": "en",
        "previewLink": "http://books.google.com/books?id=XfFvDwAAQBAJ&printsec=frontcover",
        "industryIdentifiers": [
          { "type": "ISBN_13", "identifier": "9780735211292" },
          { "type": "ISBN_10", "identifier": "0735211299" }
        ]
      },
      "saleInfo": {
        "buyLink": "https://play.google.com/store/books/details?id=XfFvDwAAQBAJ&rdid=book-XfFvDwAAQBAJ"
      }
    }
  ]
}
```

---

### 3.2 Get Volume Details

**Endpoint:** `GET https://www.googleapis.com/books/v1/volumes/{volumeId}`

**Example Request:**
```
GET https://www.googleapis.com/books/v1/volumes/XfFvDwAAQBAJ?key={KEY}
```

**Response:** Same structure as a single item from search, with all fields guaranteed (no `items[]` wrapper — returns the volume object directly).

---

## 4. Data Flow: Add Book

```
Creator types query
  → useGoogleBooksSearch debounces 300ms
  → googleBooksService.searchBooks(query)
    → GET /volumes?q={query}&printType=books
  → Display results in GoogleBooksSearch dropdown

Creator selects a book
  → googleBooksService.getVolumeDetails(volumeId)
    → GET /volumes/{volumeId}
  → bookHelpers.transformGoogleBooksResult(data)
    → Extract: volume_id, title, authors, cover_url, cover_url_large, subjects, page_count, isbn_13, google_rating, buy_links, etc.
  → Pre-fill AddBookPage form

Creator completes form and saves
  → createRecommendedBook mutation
    → Saves all metadata to Strapi RecommendedBook
  → If media uploaded: POST to S3 via existing upload endpoint
  → Navigate back to BookListView

Public page visitor views book
  → Apollo query: bookDetails(documentId)
    → Reads from Strapi (never calls Google Books)
  → Render BookDetailModal with stored data
```

---

## 5. Error Response Shapes

### Strapi GraphQL Error
```json
{
  "errors": [
    {
      "message": "Forbidden access",
      "extensions": {
        "code": "FORBIDDEN",
        "exception": { "message": "Forbidden" }
      }
    }
  ]
}
```

### Google Books API Error
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid. Please pass a valid API key.",
    "status": "INVALID_ARGUMENT",
    "details": [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "API_KEY_INVALID" }]
  }
}
```

### Frontend Error Handling
```typescript
// Wrap all service calls:
try {
  const result = await googleBooksService.searchBooks(query);
  setResults(result);
} catch (error) {
  if (error instanceof GoogleBooksError) {
    if (error.statusCode === 429) {
      setError('Rate limited. Please wait a moment.');
    } else if (error.statusCode === 403) {
      setError('Search unavailable. Please try again later.');
    } else {
      setError('Search failed. Please try a different query.');
    }
  } else {
    setError('Unable to search. Check your internet connection.');
  }
}
```
