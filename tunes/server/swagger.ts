import { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { musicErrorOpenApiSchema, musicEnsureResponseOpenApiSchema, musicIdentityOpenApi } from '../shared/musicError';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Cosmic API Documentation',
    version: '1.0.0',
    description: 'API documentation for the Cosmic collaborative playlist management platform',
  },
  servers: [
    {
      url: '/api',
      description: 'Development server',
    },
  ],
  components: {
    schemas: {
      MusicIdentityEnsureResponse: musicEnsureResponseOpenApiSchema,
      MusicErrorEnvelope: musicErrorOpenApiSchema,
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string' },
          venueName: { type: 'string' },
          theme: {
            type: 'object',
            properties: {
              primary: { type: 'string' },
              variant: { type: 'string', enum: ['professional', 'tint', 'vibrant'] },
              appearance: { type: 'string', enum: ['light', 'dark', 'system'] },
              radius: { type: 'number' },
            },
          },
          allowSongRequests: { type: 'boolean' },
          allowGuestPlayOnDevice: { type: 'boolean' },
          allowPlaylistSharing: { type: 'boolean' },
        },
      },
      TeamMember: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          role: { type: 'string' },
          email: { type: 'string' },
          status: { type: 'string' },
        },
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          bio: { type: 'string' },
          preferences: { type: 'object' },
        },
      },
      ActivityLog: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer' },
          action: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          details: { type: 'object' },
        },
      },
      Song: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          youtubeId: { type: 'string' },
          title: { type: 'string' },
          artist: { type: 'string' },
          thumbnailUrl: { type: 'string' },
          position: { type: 'integer' },
          status: { type: 'string', enum: ['queued', 'playing', 'played'] },
        },
      },
      Playlist: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          isVisibleToGuests: { type: 'boolean' },
          userId: { type: 'integer' },
          songs: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Song'
            }
          }
        }
      },
      PlayHistory: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          songId: { type: 'integer' },
          playedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          skipped: { type: 'boolean' }
        }
      },
      GuestSession: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          accessToken: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      }
    },
    securitySchemes: {
      strapiBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Strapi JWT',
      },
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
      },
    },
  },
  paths: {
    '/music/identity/ensure': musicIdentityOpenApi.operation,
    '/playlist': {
      get: {
        tags: ['Playlist'],
        summary: 'Get all playlists',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of playlists',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Playlist',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        tags: ['Playlist'],
        summary: 'Create a new playlist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  isVisibleToGuests: { type: 'boolean' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Playlist created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Playlist',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/playlist/{playlistId}': {
      get: {
        tags: ['Playlist'],
        summary: 'Get playlist by ID',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        responses: {
          '200': {
            description: 'Playlist details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Playlist',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
      patch: {
        tags: ['Playlist'],
        summary: 'Update playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  isVisibleToGuests: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Playlist updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Playlist',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
      delete: {
        tags: ['Playlist'],
        summary: 'Delete playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        responses: {
          '200': {
            description: 'Playlist deleted',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
    },
    '/playlist/{playlistId}/songs': {
      get: {
        tags: ['Playlist'],
        summary: 'Get songs in a playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        responses: {
          '200': {
            description: 'List of songs in the playlist',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Song',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
      post: {
        tags: ['Playlist'],
        summary: 'Add songs to a playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        youtubeId: { type: 'string' },
                        title: { type: 'string' },
                        artist: { type: 'string' },
                        thumbnailUrl: { type: 'string' },
                      },
                      required: ['youtubeId', 'title', 'artist', 'thumbnailUrl'],
                    },
                  },
                },
                required: ['songs'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Songs added to playlist',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
    },
    '/playlist/{playlistId}/songs/{songId}': {
      delete: {
        tags: ['Playlist'],
        summary: 'Remove a song from a playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
          {
            name: 'songId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Song ID',
          },
        ],
        responses: {
          '200': {
            description: 'Song removed from playlist',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist or song not found',
          },
        },
      },
      patch: {
        tags: ['Playlist'],
        summary: 'Update song position in playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
          {
            name: 'songId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Song ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  newPosition: { type: 'integer' },
                },
                required: ['newPosition'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Song position updated',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist or song not found',
          },
        },
      },
    },
    '/playlist/{playlistId}/visibility': {
      patch: {
        tags: ['Playlist'],
        summary: 'Update playlist visibility',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isVisible: { type: 'boolean' },
                },
                required: ['isVisible'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Playlist visibility updated',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Playlist not found',
          },
        },
      },
    },
    '/user': {
      get: {
        tags: ['User'],
        summary: 'Get current user information',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Current user information',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/user/settings': {
      patch: {
        tags: ['User'],
        summary: 'Update user settings',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  theme: { 
                    type: 'object',
                    properties: {
                      primary: { type: 'string' },
                      variant: { type: 'string', enum: ['professional', 'tint', 'vibrant'] },
                      appearance: { type: 'string', enum: ['light', 'dark', 'system'] },
                      radius: { type: 'number' },
                    }
                  },
                  allowSongRequests: { type: 'boolean' },
                  allowGuestPlayOnDevice: { type: 'boolean' },
                  allowPlaylistSharing: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/youtube/search': {
      post: {
        tags: ['YouTube'],
        summary: 'Search YouTube videos',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  maxResults: { type: 'integer' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'YouTube search results',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { 
                        type: 'object', 
                        properties: {
                          videoId: { type: 'string' }
                        }
                      },
                      snippet: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          channelTitle: { type: 'string' },
                          thumbnails: { 
                            type: 'object',
                            properties: {
                              default: {
                                type: 'object',
                                properties: {
                                  url: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/youtube/video/{id}': {
      get: {
        tags: ['YouTube'],
        summary: 'Get YouTube video details',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'YouTube video ID',
          },
        ],
        responses: {
          '200': {
            description: 'YouTube video details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    channelTitle: { type: 'string' },
                    thumbnailUrl: { type: 'string' },
                    duration: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Video not found',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'User logout',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
          },
        },
      },
    },
    '/songs': {
      get: {
        tags: ['Songs'],
        summary: 'Get all songs in user queue',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of songs in the queue',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Song',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        tags: ['Songs'],
        summary: 'Add a song to the queue',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  youtubeId: { type: 'string' },
                  title: { type: 'string' },
                  artist: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                },
                required: ['youtubeId', 'title', 'artist', 'thumbnailUrl'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Song added to queue',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Song',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      delete: {
        tags: ['Songs'],
        summary: 'Clear all songs from queue',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Queue cleared',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/songs/{songId}': {
      delete: {
        tags: ['Songs'],
        summary: 'Remove a song from the queue',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'songId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Song ID',
          },
        ],
        responses: {
          '200': {
            description: 'Song removed from queue',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Song not found',
          },
        },
      },
      patch: {
        tags: ['Songs'],
        summary: 'Update song position in queue',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'songId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Song ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  position: { type: 'integer' },
                },
                required: ['position'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Song position updated',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Song not found',
          },
        },
      },
    },
    '/songs/playing': {
      get: {
        tags: ['Songs'],
        summary: 'Get currently playing song',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Currently playing song',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Song',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'No song currently playing',
          },
        },
      },
      post: {
        tags: ['Songs'],
        summary: 'Set currently playing song',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songId: { type: 'integer' },
                },
                required: ['songId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Currently playing song updated',
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Song not found',
          },
        },
      },
    },
    '/songs/history': {
      get: {
        tags: ['Songs'],
        summary: 'Get song play history',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Song play history',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Song',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      delete: {
        tags: ['Songs'],
        summary: 'Clear song play history',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Play history cleared',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/admin/team': {
      get: {
        tags: ['Team Management'],
        summary: 'Get all team members',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of team members',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/TeamMember',
                  },
                },
              },
            },
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
      post: {
        tags: ['Team Management'],
        summary: 'Create team member',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  email: { type: 'string' },
                },
                required: ['name', 'role', 'email'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Team member created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TeamMember',
                },
              },
            },
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
    },
    '/admin/team/{memberId}': {
      patch: {
        tags: ['Team Management'],
        summary: 'Update team member',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'memberId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  email: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Team member updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TeamMember',
                },
              },
            },
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
      delete: {
        tags: ['Team Management'],
        summary: 'Delete team member',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'memberId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Team member deleted',
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
    },
    '/user/change-password': {
      post: {
        tags: ['User'],
        summary: 'Change user password',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string' },
                },
                required: ['currentPassword', 'newPassword'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Password changed successfully',
          },
          '401': {
            description: 'Unauthorized',
          },
          '400': {
            description: 'Invalid password',
          },
        },
      },
    },
    '/user/profile': {
      get: {
        tags: ['User Profile'],
        summary: 'Get user profile',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'User profile data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserProfile',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        tags: ['User Profile'],
        summary: 'Create/update user profile',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bio: { type: 'string' },
                  preferences: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserProfile',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      delete: {
        tags: ['User Profile'],
        summary: 'Delete user profile',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Profile deleted successfully',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/admin/users/{userId}/activity': {
      get: {
        tags: ['Admin'],
        summary: 'Get user activity logs',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'User activity logs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ActivityLog',
                  },
                },
              },
            },
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
    },
    '/admin/system': {
      get: {
        tags: ['Admin'],
        summary: 'Get system metrics',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'System metrics data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userCount: { type: 'integer' },
                    activeUsers: { type: 'integer' },
                    totalPlaylists: { type: 'integer' },
                    systemHealth: { type: 'object' },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Unauthorized access',
          },
        },
      },
    },
    '/guest/{guestUrl}': {
      get: {
        tags: ['Guest Access'],
        summary: 'Get guest view information',
        parameters: [
          {
            name: 'guestUrl',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Host\'s unique guest URL identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Host information and playlist for guest view',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        venueName: { type: 'string' },
                        allowSongRequests: { type: 'boolean' },
                        allowGuestPlayOnDevice: { type: 'boolean' },
                        allowPlaylistSharing: { type: 'boolean' },
                        theme: { type: 'object' },
                      },
                    },
                    songs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Song',
                      },
                    },
                    currentlyPlaying: {
                      $ref: '#/components/schemas/Song',
                    },
                    playedSongs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Song',
                      },
                    },
                    playlists: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Playlist',
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Guest URL not found',
          },
        },
      },
    },
    '/guest/{guestUrl}/song': {
      post: {
        tags: ['Guest Access'],
        summary: 'Request a song as a guest',
        parameters: [
          {
            name: 'guestUrl',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Host\'s unique guest URL identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  youtubeId: { type: 'string' },
                  title: { type: 'string' },
                  artist: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                },
                required: ['youtubeId', 'title', 'artist', 'thumbnailUrl'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Song request submitted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Song',
                },
              },
            },
          },
          '403': {
            description: 'Song requests not allowed by host',
          },
          '404': {
            description: 'Guest URL not found',
          },
        },
      },
    },
    '/guest/{guestUrl}/playlist/{playlistId}': {
      get: {
        tags: ['Guest Access'],
        summary: 'View a shared playlist as a guest',
        parameters: [
          {
            name: 'guestUrl',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Host\'s unique guest URL identifier',
          },
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Playlist ID',
          },
        ],
        responses: {
          '200': {
            description: 'Playlist details visible to guests',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Playlist',
                },
              },
            },
          },
          '403': {
            description: 'Playlist not visible to guests',
          },
          '404': {
            description: 'Guest URL or playlist not found',
          },
        },
      },
    },
    '/playlists': {
      get: {
        tags: ['Playlists'],
        summary: 'Get all playlists',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of playlists',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Playlist'
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          }
        }
      },
      post: {
        tags: ['Playlists'],
        summary: 'Create new playlist',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  isVisibleToGuests: { type: 'boolean' }
                },
                required: ['name']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Playlist created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Playlist'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          }
        }
      }
    },
    '/playlists/{playlistId}': {
      get: {
        tags: ['Playlists'],
        summary: 'Get playlist by ID',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Playlist details with songs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    playlist: {
                      $ref: '#/components/schemas/Playlist'
                    },
                    songs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Song'
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          },
          '404': {
            description: 'Playlist not found'
          }
        }
      },
      delete: {
        tags: ['Playlists'],
        summary: 'Delete a playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Playlist deleted successfully'
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Playlist not found or unauthorized'
          }
        }
      }
    },
    '/playlists/{playlistId}/songs': {
      post: {
        tags: ['Playlists'],
        summary: 'Add songs to playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        youtubeId: { type: 'string' },
                        title: { type: 'string' },
                        artist: { type: 'string' },
                        thumbnailUrl: { type: 'string' }
                      },
                      required: ['youtubeId', 'title', 'artist']
                    }
                  }
                },
                required: ['songs']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Songs added successfully'
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Playlist not found or unauthorized'
          }
        }
      }
    },
    '/playlists/{playlistId}/songs/{songId}': {
      delete: {
        tags: ['Playlists'],
        summary: 'Remove song from playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          },
          {
            name: 'songId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Song removed successfully'
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Playlist or song not found or unauthorized'
          }
        }
      }
    },
    '/playlists/{playlistId}/reorder': {
      patch: {
        tags: ['Playlists'],
        summary: 'Reorder songs in playlist',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songId: { type: 'integer' },
                  position: { type: 'integer' }
                },
                required: ['songId', 'position']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Songs reordered successfully'
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Playlist not found or unauthorized'
          }
        }
      }
    },
    '/playlists/{playlistId}/visibility': {
      patch: {
        tags: ['Playlists'],
        summary: 'Update playlist visibility',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'playlistId',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isVisible: { type: 'boolean' }
                },
                required: ['isVisible']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Playlist visibility updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    isVisibleToGuests: { type: 'boolean' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Playlist not found or unauthorized'
          }
        }
      }
    },
    '/playlist/{guestUrl}': {
      get: {
        tags: ['Guest Access'],
        summary: 'Get playlist by guest URL',
        parameters: [
          {
            name: 'guestUrl',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Playlist data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    songs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Song'
                      }
                    },
                    currentlyPlaying: {
                      $ref: '#/components/schemas/Song'
                    },
                    playedSongs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Song'
                      }
                    },
                    user: {
                      $ref: '#/components/schemas/User'
                    },
                    playlists: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Playlist'
                      }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Playlist not found'
          }
        }
      }
    },
    '/playlist/songs': {
      post: {
        tags: ['Songs'],
        summary: 'Add a song to playlist',
        parameters: [
          {
            name: 'guestUrl',
            in: 'query',
            schema: { type: 'string' },
            description: 'Required for guest access'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  youtubeId: { type: 'string' },
                  title: { type: 'string' },
                  artist: { type: 'string' },
                  thumbnailUrl: { type: 'string' }
                },
                required: ['youtubeId', 'title', 'artist']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Song added successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Song'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Song requests not allowed'
          }
        }
      }
    },
    '/playlist/currently-playing': {
      post: {
        tags: ['Playback Control'],
        summary: 'Update currently playing song',
        parameters: [
          {
            name: 'guestUrl',
            in: 'query',
            schema: { type: 'string' },
            description: 'Required for guest access'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  songId: { type: 'integer' }
                },
                required: ['songId']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Current song updated successfully'
          },
          '401': {
            description: 'Unauthorized'
          },
          '403': {
            description: 'Guest playback not allowed'
          }
        }
      }
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Get all users (admin only)',
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'List of users with pagination',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/User'
                      }
                    },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          },
          '403': {
            description: 'Unauthorized access'
          }
        }
      }
    }
  }
};

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
