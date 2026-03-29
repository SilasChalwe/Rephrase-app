const createOpenApiSpec = (baseUrl = '') => ({
  openapi: '3.0.3',
  info: {
    title: 'Rephrase API',
    version: '1.0.0',
    description:
      'Express backend for Rephrase. Firebase Auth protects private routes, Firestore stores users and friends, and Realtime Database powers live chat.',
  },
  servers: baseUrl ? [{ url: baseUrl }] : [],
  tags: [
    { name: 'System', description: 'Service status and API metadata' },
    { name: 'Auth', description: 'Authenticated user registration and profile routes' },
    { name: 'Public', description: 'Public search and chat history routes' },
    { name: 'Friends', description: 'Friend list and friend request routes' },
    { name: 'Chat', description: 'Realtime chat, message, presence, and typing routes' },
    { name: 'Media', description: 'Profile media upload routes' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
        description: 'Send a Firebase ID token in the Authorization header as Bearer <token>.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          document_Id: { type: 'string' },
          fullName: { type: 'string' },
          emailAddress: { type: 'string' },
          phoneNumber: { type: 'string' },
          friendIds: {
            type: 'array',
            items: { type: 'string' },
          },
          FriendIdsWaitingApproval: {
            type: 'array',
            items: { type: 'string' },
          },
          profilePictureUrl: { type: 'string' },
          role: { type: 'string' },
        },
      },
      RegisterUserInput: {
        type: 'object',
        required: ['fullName'],
        properties: {
          fullName: { type: 'string' },
          emailAddress: { type: 'string' },
          phoneNumber: { type: 'string' },
          profilePictureUrl: { type: 'string' },
        },
      },
      UpdateUserInput: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          emailAddress: { type: 'string' },
          phoneNumber: { type: 'string' },
          profilePictureUrl: { type: 'string' },
          friendIds: {
            type: 'array',
            items: { type: 'string' },
          },
          FriendIdsWaitingApproval: {
            type: 'array',
            items: { type: 'string' },
          },
          role: { type: 'string' },
        },
      },
      ProfileImageInput: {
        type: 'object',
        required: ['imageUrl'],
        properties: {
          imageUrl: { type: 'string' },
        },
      },
      FriendRequestInput: {
        type: 'object',
        required: ['recipientId'],
        properties: {
          recipientId: { type: 'string' },
        },
      },
      MessageStatusInput: {
        type: 'object',
        required: ['receiverId', 'status'],
        properties: {
          receiverId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['SENT', 'DELIVERED', 'READ'],
          },
        },
      },
      TextMessageInput: {
        type: 'object',
        required: ['receiverId', 'text'],
        properties: {
          receiverId: { type: 'string' },
          text: { type: 'string' },
        },
      },
      MediaMessageInput: {
        type: 'object',
        required: ['receiverId', 'mediaUrl', 'mediaType'],
        properties: {
          receiverId: { type: 'string' },
          mediaUrl: { type: 'string' },
          mediaType: { type: 'string' },
        },
      },
      TypingIndicatorInput: {
        type: 'object',
        required: ['receiverId', 'isTyping'],
        properties: {
          receiverId: { type: 'string' },
          isTyping: { type: 'boolean' },
        },
      },
      ChatMessage: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
          message: { type: 'string' },
          status: {
            type: 'string',
            enum: ['SENT', 'DELIVERED', 'READ'],
          },
          mediaUrl: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
          },
          type: { type: 'string' },
          timestamp: { type: 'number' },
        },
      },
      UploadProfileImageResponse: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string' },
          user: {
            $ref: '#/components/schemas/User',
          },
        },
      },
      MessageResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check service health',
        responses: {
          200: {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['System'],
        summary: 'Get the OpenAPI document',
        responses: {
          200: {
            description: 'OpenAPI JSON',
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create the current authenticated user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterUserInput',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          400: {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
    '/api/users/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Auth'],
        summary: 'Update the authenticated user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateUserInput',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Delete the authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          204: {
            description: 'User deleted',
          },
        },
      },
    },
    '/api/users/me/profile': {
      put: {
        tags: ['Auth'],
        summary: 'Update the authenticated user profile image URL',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProfileImageInput',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
    '/api/public/users/search': {
      get: {
        tags: ['Public'],
        summary: 'Search users by name',
        parameters: [
          {
            in: 'query',
            name: 'q',
            schema: { type: 'string' },
            required: false,
            description: 'Name search query',
          },
        ],
        responses: {
          200: {
            description: 'Matching users',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
          404: {
            description: 'No users found',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    '/api/public/messages/history/{userId}/{otherUserId}': {
      get: {
        tags: ['Public'],
        summary: 'Get public chat history between two users',
        parameters: [
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string' },
          },
          {
            in: 'path',
            name: 'otherUserId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Chat history',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ChatMessage' },
                },
              },
            },
          },
        },
      },
    },
    '/api/friends': {
      get: {
        tags: ['Friends'],
        summary: 'Get the authenticated user friend list',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Friend list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    '/api/friends/requests/pending': {
      get: {
        tags: ['Friends'],
        summary: 'Get pending friend requests for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Pending requests',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    '/api/friends/requests/sent': {
      get: {
        tags: ['Friends'],
        summary: 'Get sent friend requests for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Sent requests',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    '/api/friends/requests': {
      post: {
        tags: ['Friends'],
        summary: 'Send a friend request',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FriendRequestInput',
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Friend request accepted for processing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageResponse' },
              },
            },
          },
        },
      },
    },
    '/api/friends/requests/{requesterId}': {
      put: {
        tags: ['Friends'],
        summary: 'Approve a friend request',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'requesterId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Friend request approved',
          },
        },
      },
    },
    '/api/friends/{friendId}': {
      delete: {
        tags: ['Friends'],
        summary: 'Remove a friend',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'friendId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Friend removed',
          },
        },
      },
    },
    '/api/chat/messages/text': {
      post: {
        tags: ['Chat'],
        summary: 'Send a text message',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TextMessageInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Message sent',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatMessage' },
              },
            },
          },
        },
      },
    },
    '/api/chat/messages/media': {
      post: {
        tags: ['Chat'],
        summary: 'Send a media message',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MediaMessageInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Media message sent',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatMessage' },
              },
            },
          },
        },
      },
    },
    '/api/chat/messages/stream': {
      get: {
        tags: ['Chat'],
        summary: 'Open a server-sent events message stream',
        description: 'Streams arrays of chat messages using text/event-stream.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'otherUserId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'SSE stream opened',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    '/api/chat/messages/{receiverId}': {
      get: {
        tags: ['Chat'],
        summary: 'Load chat history with another user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'receiverId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Chat history',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ChatMessage' },
                },
              },
            },
          },
        },
      },
    },
    '/api/chat/messages/{messageId}/status': {
      patch: {
        tags: ['Chat'],
        summary: 'Update a message delivery status',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'messageId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MessageStatusInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Message status updated',
          },
        },
      },
    },
    '/api/chat/conversations/read': {
      post: {
        tags: ['Chat'],
        summary: 'Mark a conversation as read',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'id',
            required: true,
            schema: { type: 'string' },
            description: 'The other user ID in the conversation',
          },
        ],
        responses: {
          200: {
            description: 'Conversation marked as read',
          },
        },
      },
    },
    '/api/chat/presence/{id}': {
      get: {
        tags: ['Chat'],
        summary: 'Check whether a user is online',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Presence result',
            content: {
              'application/json': {
                schema: {
                  type: 'boolean',
                },
              },
            },
          },
        },
      },
    },
    '/api/chat/typing': {
      post: {
        tags: ['Chat'],
        summary: 'Update typing state for a conversation',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TypingIndicatorInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Typing state updated',
          },
        },
      },
    },
    '/api/users/media/profile': {
      post: {
        tags: ['Media'],
        summary: 'Upload a profile image',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Profile image uploaded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadProfileImageResponse' },
              },
            },
          },
        },
      },
    },
  },
});

module.exports = {
  createOpenApiSpec,
};
