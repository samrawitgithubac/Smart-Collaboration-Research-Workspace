/**
 * OpenAPI 3 spec for Swagger UI. "Try it out" uses PUBLIC_API_URL or RENDER_EXTERNAL_URL when set.
 */
export function getOpenApiSpec(): Record<string, unknown> {
  const base =
    (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "") ||
    undefined;

  return {
    openapi: "3.0.3",
    info: {
      title: "Smart Collaboration & Research Workspace API",
      version: "1.0.0",
      description:
        "JWT auth, workspaces, Kanban tasks, files, invites. Use **Authorize** with `Bearer <token>` from `/api/auth/login` or `/api/auth/register`.",
    },
    ...(base ? { servers: [{ url: base, description: "API" }] } : {}),
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Workspaces" },
      { name: "Tasks" },
      { name: "Files" },
      { name: "Invites" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        RegisterBody: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string" },
          },
        },
        WorkspaceCreate: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        },
        TaskCreate: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] },
            assigneeId: { type: "string" },
          },
        },
        InviteCreate: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["ADMIN", "MEMBER"] },
          },
        },
      },
      parameters: {
        workspaceId: {
          name: "workspaceId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        taskId: {
          name: "taskId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        fileId: {
          name: "fileId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } } },
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                      token: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "409": { description: "Email already registered" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } } },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                      token: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { user: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/workspaces": {
        get: {
          tags: ["Workspaces"],
          summary: "List my workspaces",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Workspaces"],
          summary: "Create workspace (you become ADMIN)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WorkspaceCreate" } },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/workspaces/{workspaceId}": {
        get: {
          tags: ["Workspaces"],
          summary: "Workspace detail + members",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          responses: { "200": { description: "OK" }, "403": { description: "Not a member" } },
        },
        patch: {
          tags: ["Workspaces"],
          summary: "Rename workspace (ADMIN)",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object", properties: { name: { type: "string" } } },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
        delete: {
          tags: ["Workspaces"],
          summary: "Delete workspace (ADMIN)",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          responses: { "204": { description: "No content" } },
        },
      },
      "/api/workspaces/{workspaceId}/tasks": {
        get: {
          tags: ["Tasks"],
          summary: "List tasks",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Tasks"],
          summary: "Create task",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/TaskCreate" } } },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/workspaces/{workspaceId}/tasks/{taskId}": {
        patch: {
          tags: ["Tasks"],
          summary: "Update task",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/workspaceId" },
            { $ref: "#/components/parameters/taskId" },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string", nullable: true },
                    status: { type: "string", enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] },
                    position: { type: "integer" },
                    assigneeId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
        delete: {
          tags: ["Tasks"],
          summary: "Delete task",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/workspaceId" },
            { $ref: "#/components/parameters/taskId" },
          ],
          responses: { "204": { description: "No content" } },
        },
      },
      "/api/workspaces/{workspaceId}/files": {
        get: {
          tags: ["Files"],
          summary: "List files",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Files"],
          summary: "Upload file (multipart field: file)",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
            },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/workspaces/{workspaceId}/files/{fileId}/download": {
        get: {
          tags: ["Files"],
          summary: "Download file",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/workspaceId" },
            { $ref: "#/components/parameters/fileId" },
          ],
          responses: { "200": { description: "File stream" } },
        },
      },
      "/api/workspaces/{workspaceId}/files/{fileId}": {
        delete: {
          tags: ["Files"],
          summary: "Delete file (ADMIN or uploader)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/workspaceId" },
            { $ref: "#/components/parameters/fileId" },
          ],
          responses: { "204": { description: "No content" } },
        },
      },
      "/api/workspaces/{workspaceId}/invites": {
        get: {
          tags: ["Invites"],
          summary: "List pending invites (ADMIN)",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Invites"],
          summary: "Create invite (ADMIN)",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/workspaceId" }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/InviteCreate" } } },
          },
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/invites/accept": {
        post: {
          tags: ["Invites"],
          summary: "Accept invite (logged-in user email must match invite)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token"],
                  properties: { token: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
    },
  };
}
