# explorers

explorers is a React-based web application that enables users to create personalized QR codes and shareable links for their favorite places and recommendations. Users can build curated lists of locations, organize them by cities or themes, and share them with others through QR codes and social media integration.

## 🚀 Project Overview

explorers transforms local knowledge into shareable digital experiences. Users can create profiles, add favorite places with photos and details, organize recommendations into location-based lists, and generate QR codes that others can scan to access these curated guides. Perfect for travelers, local businesses, content creators, and anyone wanting to share their favorite spots.

## 🛠️ Tech Stack

### Frontend

- **React 18** - Main framework
- **TypeScript** - Type safety and development experience
- **Vite** - Build tool and development server
- **Tailwind CSS** - Styling and responsive design
- **Framer Motion** - Animations and transitions

### State Management & Data

- **Zustand** - Global state management
- **Apollo Client** - GraphQL client for API communication
- **GraphQL** - API query language
- **Formik & Yup** - Form handling and validation

### UI Components & Libraries

- **Radix UI** - Headless UI components (Accordion, Toast, Tooltip, etc.)
- **React Router DOM** - Client-side routing
- **QRCode.react** - QR code generation
- **React Easy Crop** - Image cropping functionality
- **React Spinners** - Loading indicators
- **Sonner** - Toast notifications

### Maps & Location Services

- **@vis.gl/react-google-maps** - Google Maps integration
- **@react-google-maps/api** - Additional Google Maps features
- **Google Places API** - Place details and photos
- **Google Geocoding API** - Address to coordinates conversion

### Media & Content

- **html2canvas & html-to-image** - Screenshot generation
- **React Quill** - Rich text editor
- **Axios** - HTTP requests for file uploads and external APIs

### Development Tools

- **ESLint** - Code linting
- **PostCSS & Autoprefixer** - CSS processing
- **TypeScript ESLint** - TypeScript-specific linting

## ✨ Purpose & Features

### Core Features

- **User Authentication**: Registration, login, password reset, Google OAuth integration
- **Profile Management**: Customizable profiles with photos, bio, contact info, and social media links
- **Location Recommendations**: Add, edit, and organize favorite places with photos, ratings, and notes
- **QR Code Generation**: Automatic QR code creation for profiles and recommendation lists
- **Social Sharing**: Share recommendations via WhatsApp, Instagram, Twitter, SMS
- **Interactive Maps**: Google Maps integration with markers and location visualization
- **Public Profiles**: Shareable public pages showcasing user recommendations

### Advanced Features

- **Image Management**: Photo uploads, cropping, and Google Images integration
- **List Organization**: Create themed lists (by city, category, etc.)
- **Mobile-Responsive Design**: Optimized for all devices
- **Real-time Updates**: Live data synchronization
- **Search & Filtering**: Find places by category, location, or name
- **Analytics Ready**: Built-in tracking capabilities

## 🏗️ Architecture & Implementation

### Frontend Architecture

```
src/
├── components/         # Reusable UI components
├── features/          # Feature-based modules
│   ├── Authentication/
│   ├── Profile/
│   ├── Favorites/
│   ├── PublicHome/
│   └── Settings/
├── pages/             # Route-level components
├── hooks/             # Custom React hooks
├── store/             # Zustand state management
├── utils/             # Utility functions
├── assets/            # Icons, images, fonts
└── routes/            # Routing configuration
```

### Key Implementation Details

**State Management**: Uses Zustand for global state (authentication, selected cities, email storage) with React Query/Apollo Client for server state management.

**Authentication Flow**: JWT-based authentication with localStorage persistence, protected routes, and onboarding flow for new users.

**Data Flow**: GraphQL mutations and queries handle all backend communication, with Apollo Client providing caching and optimistic updates.

**Image Handling**: Multi-source image system combining user uploads, Google Places photos, and custom search images with cropping and compression.

**QR Integration**: Dynamic QR code generation using qrcode.react library, with downloadable PNG export functionality.

**Maps Integration**: Google Maps API for place selection, geocoding, and interactive map views with custom markers and clustering.

### Backend Integration

- **GraphQL API**: All data operations via GraphQL endpoints
- **Strapi CMS**: Headless CMS for content management (inferred from API patterns)
- **File Upload API**: REST endpoints for media uploads
- **Authentication API**: JWT-based auth with social login support

## 🚀 How to Run Locally

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Google Maps API key
- Backend API access (GraphQL endpoint)

### Environment Setup

Create a `.env` file in the root directory:

```env
VITE_API_URL=your_graphql_api_endpoint
VITE_REST_API_URL=your_rest_api_endpoint
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_GOOGLE_CUSTOM_SEARCH_API_KEY=your_custom_search_api_key
VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id
VITE_PUBLIC_ACCESS_TOKEN=your_public_access_token
VITE_PUBLIC_SHAREABLE_LINK=your_public_shareable_link

# Local Tunes Integration
VITE_LOCAL_TUNES_API_URL=https://localtunes.earth
VITE_LOCAL_TUNES_ENABLED=true
VITE_LOCAL_TUNES_TIMEOUT=10000
VITE_LOCAL_TUNES_RETRY_ATTEMPTS=3
```

### Installation & Running

```bash
# Clone the repository
git clone <repository-url>
cd explorers

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

The application will be available at `http://localhost:5173` (default Vite port).

### Development Server Features

- Hot module replacement
- TypeScript compilation
- Proxy configuration for API requests
- Google Maps API integration

## 🌐 Deployment

### Production Build

The application is configured for deployment with:

- **Vite** optimized production builds
- **Netlify** deployment configuration (netlify.toml)
- **Environment variables** for different stages
- **Proxy redirects** for API requests

### Deployment Configuration

```toml
# netlify.toml
[[redirects]]
  from = "/graphql"
  to = "https://api-qa.explorers.earth/graphql"
  status = 200

[[redirects]]
  from = "/*"
  to = "/"
  status = 200
```

### Build Commands

```bash
# Production build
npm run build

# Type checking
tsc -b

# Preview build locally
npm run preview
```

## 📱 Usage Notes

### User Journey

1. **Registration/Login**: Create account or sign in with Google
2. **Onboarding**: Complete profile setup with photos and basic info
3. **Add Recommendations**: Create location lists and add favorite places
4. **Share**: Generate QR codes and share via social media
5. **Discover**: Browse other users' public recommendations

### Known Features

- **QR Code Animation**: Profile pictures animate to QR codes on click
- **Infinite Scroll**: Recommendation lists support pagination
- **Image Optimization**: Automatic image compression and cropping
- **Mobile-First Design**: Optimized touch interactions and responsive layout
- **Social Integration**: Direct sharing to major social platforms

### Performance Considerations

- **Lazy Loading**: Images and components load on demand
- **Code Splitting**: Route-based bundle splitting
- **Caching**: Apollo Client provides intelligent data caching
- **Optimized Images**: WebP support and responsive sizing

## 🤝 Contributing

This appears to be a commercial/personal project. For contributions:

1. Follow the existing code structure and patterns
2. Use TypeScript for type safety
3. Follow the established component architecture
4. Ensure responsive design compliance
5. Test on multiple devices and browsers

## 📄 License

Project license information not specified in the codebase. Contact project maintainers for licensing details.

---

**explorers** - Transforming local knowledge into shareable digital experiences. 🗺️✨
