---
Feature: person
Doc type: schema
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_decisions.md
---

# People — Strapi Schema

Complete data model for the People (Person Recommendations) feature. These collections need to be created in the Strapi admin panel (Content-Type Builder).

> [!IMPORTANT]
> Since we use a unified S3 storage logic, remember to always use the `path` parameter when uploading media. See **Storage Logic** sections below.

---

## Collection 1: PersonList

**Purpose:** A themed list of person recommendations created by a user (e.g., "Top Product Designers", "Inspiring Founders", "Creative Writers").

**API ID (singular):** `person-list`
**API ID (plural):** `person-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "Top Product Designers") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short text | Yes | Auto | URL-safe slug for shareable links. Auto-generated from List_Name, editable. Must be unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public page. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | Cover image for the list. Falls back to first person's avatar if not set. |
| `display_order` | Integer | No | `0` | Order position on the public page. Lower = higher on page. |
| `top_picks_heading` | Short text | No | "Top Picks" | Custom display name for the Top Picks section on the public page |
| `account` | Relation (Many-to-One) | Yes | — | Relates to the user's Account. Many PersonLists belong to one Account. |
| `recommended_people` | Relation (One-to-Many) | No | — | People in this list. One PersonList has many RecommendedPeople. |

### Notes for Strapi Admin
- `account` relation connects to the existing Account/User collection.
- Use the `Visibility` boolean (matching existing `MovieList`/`BookList` patterns).
- **Manual Path Configuration**: For `cover_image`, use the S3 path: `{username}/people/{personListId}/cover/`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access.

---

## Collection 2: RecommendedPerson

**Purpose:** A single person recommendation with social profile metadata, creator notes, portfolio screenshots, and contact platforms.

**API ID (singular):** `recommended-person`
**API ID (plural):** `recommended-people`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **Social / Profile Metadata** | | | | |
| `name` | Short text | Yes | — | Full name of the recommended person (e.g., "Jane Doe") |
| `username_handle` | Short text | No | — | Social handle (e.g., "@janedoe" or "janedoe-ux") |
| `headline` | Short text | No | — | Professional title or tagline (e.g., "Lead Designer @ Figma") |
| `location` | Short text | No | — | Geographical location (e.g., "San Francisco, CA") |
| `avatar_path` | Short text | No | — | S3 path to the downloaded profile image (e.g. `jane-doe-avatar.jpg`). |
| `primary_platform` | Enumeration | Yes | `linkedin` | Primary platform: `[instagram, linkedin, twitter, github, youtube, website, other]` |
| `social_urls` | JSON | No | `{}` | Key-value mapping of all platforms and their URLs: `{ "linkedin": "https://...", "instagram": "https://..." }` |
| `skills_tags` | JSON | No | `[]` | Array of skill or focus tags: `["UI/UX", "Product Design", "Figma", "Mentorship"]` |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal endorsement/note. Tiptap/Blocks format. |
| `user_rating` | Integer | No | — | Creator's endorsement score (1-10 rating scale). |
| `is_pinned` | Boolean | No | `false` | Whether this person is pinned to Top Picks. |
| `pin_order` | Integer | No | `null` | Order within Top Picks (null if not pinned). Lower = earlier. |
| `display_order` | Integer | No | `0` | Order within the list. Lower = earlier position. |
| **Media & Portfolio** | | | | |
| `Media` | Media (multiple) | No | — | Creator's uploaded photos/screenshots of the person's work (max 10). Stored in S3 under `{username}/people/{personListId}/{personSlug}/{filename}` |
| `media_details` | JSON | No | — | Structured media metadata: `{ "imageDetails": [...], "thumbnail": "url" }`. Matches existing RecommendedPlace/RecommendedMovie pattern. |
| **Relations** | | | | |
| `person_list` | Relation (Many-to-One) | Yes | — | The PersonList this person belongs to. Many RecommendedPeople belong to one PersonList. |
| `people_category` | Relation (Many-to-One) | No | — | Links to the People_Category collection (industry sector). |

### Notes for Strapi Admin
- `username_handle` + `person_list` combination should be unique per list to prevent duplicates.
- `social_urls` stores direct links so visitors can visit their profiles easily.
- `skills_tags` is a JSON array of strings to easily filter profiles.
- **Self-Hosting Avatars**: The avatar photo is scraped or uploaded, then uploaded to S3 to guarantee self-hosting and prevent hotlinking failures.
- **S3 Storage Logic**: All media files must be uploaded with the specific `path` parameter:
  - `PersonList` cover: `{username}/people/{personListId}/cover/{filename}`
  - `RecommendedPerson` avatar and portfolio media: `{username}/people/{personListId}/{personSlug}/{filename}`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access.

---

## Collection 3: People_Category

**Purpose:** A dedicated category collection for the People feature, representing industries or professional roles.

**API ID (singular):** `people-category`
**API ID (plural):** `people-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `Category_name` | Short text | Yes | — | The name of the category/role (e.g., "Designers", "Founders", "Engineers", "Photographers") |
| `recommended_people` | Relation (One-to-Many) | No | — | Relates to the RecommendedPerson collection |

### Notes for Strapi Admin
- Mirrors the `Movie_Category`/`Book_Category`/`People_Category` collection patterns.
- Keeps profile categorization clean and independent of Places or Media.
- Pre-populate common categories: "Designers", "Founders", "Engineers", "Marketers", "Writers", "Photographers", "Artists".

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── PersonList
    │              │
    │              ├── 1:N ── RecommendedPerson
    │              │              │
    │              │              └── N:1 ── People_Category
    │              │
    │              └── (cover_image: Media)
    │
    ├── 1:N ── MovieList (existing, untouched)
    │              │
    │              └── 1:N ── RecommendedMovie (existing, untouched)
    │
    └── 1:N ── RecommendationList (existing, untouched)
                   │
                   └── 1:N ── RecommendedPlace (existing, untouched)
```

---

## S3 Upload & Image Management

To ensure reliability and compliance with external platform hotlinking rules (Instagram and LinkedIn block direct CDN image embeds), profile pictures are copied to our S3 repository at creation time:

**Avatar Storage Path:**
`{s3-bucket-url}/{username}/people/{personListId}/{personSlug}/avatar_{timestamp}.jpg`

**Portfolio Screenshots Storage Path:**
`{s3-bucket-url}/{username}/people/{personListId}/{personSlug}/portfolio_{filename}`

---

## Migration Notes

- No migration of existing data required. These are entirely new collections.
- No changes to existing `RecommendationList`, `MovieList`, or `BookList` collections.
- The new `PersonList`, `RecommendedPerson`, and `People_Category` collections are completely independent, only sharing the `Account` relation.
