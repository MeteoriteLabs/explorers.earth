import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
export default function EmailApisTab() {
  const [selectedApi, setSelectedApi] = useState<string | null>(null);
  
  const emailApis = [
    {
      id: "templates",
      name: "Email Templates API",
      description: "Endpoints for managing email templates",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/templates",
          description: "Get all email templates",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "templates": [
    {
      "id": 1,
      "name": "Welcome Email",
      "subject": "Welcome to Cosmic",
      "description": "Sent to new users after registration",
      "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
      "textContent": "Welcome! Thanks for joining us, {{name}}.",
      "variables": ["name"],
      "createdAt": "2025-03-22T12:00:00Z",
      "updatedAt": "2025-03-22T12:00:00Z",
      "isActive": true
    }
  ]
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/templates/:id",
          description: "Get a specific email template by ID",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" }
          ],
          responseExample: `{
  "template": {
    "id": 1,
    "name": "Welcome Email",
    "subject": "Welcome to Cosmic",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "createdAt": "2025-03-22T12:00:00Z",
    "updatedAt": "2025-03-22T12:00:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "POST",
          path: "/api/admin/email/templates",
          description: "Create a new email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "name", type: "string", description: "Template name" },
            { name: "subject", type: "string", description: "Email subject line" },
            { name: "htmlContent", type: "string", description: "HTML content with {{variable}} placeholders" },
            { name: "textContent", type: "string", description: "Plain text content with {{variable}} placeholders" },
            { name: "description", type: "string", description: "Optional template description" }
          ],
          requestExample: `{
  "name": "Welcome Email",
  "subject": "Welcome to Cosmic",
  "description": "Sent to new users after registration",
  "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
  "textContent": "Welcome! Thanks for joining us, {{name}}."
}`,
          responseExample: `{
  "success": true,
  "template": {
    "id": 1,
    "name": "Welcome Email",
    "subject": "Welcome to Cosmic",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "createdAt": "2025-03-22T12:00:00Z",
    "updatedAt": "2025-03-22T12:00:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "PUT",
          path: "/api/admin/email/templates/:id",
          description: "Update an existing email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" },
            { name: "name", type: "string", description: "Template name (optional)" },
            { name: "subject", type: "string", description: "Email subject line (optional)" },
            { name: "htmlContent", type: "string", description: "HTML content with {{variable}} placeholders (optional)" },
            { name: "textContent", type: "string", description: "Plain text content with {{variable}} placeholders (optional)" },
            { name: "description", type: "string", description: "Template description (optional)" },
            { name: "isActive", type: "boolean", description: "Active status (optional)" }
          ],
          requestExample: `{
  "name": "Updated Welcome Email",
  "subject": "Welcome to Cosmic - Updated",
  "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}. We're glad to have you!</p>"
}`,
          responseExample: `{
  "success": true,
  "template": {
    "id": 1,
    "name": "Updated Welcome Email",
    "subject": "Welcome to Cosmic - Updated",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}. We're glad to have you!</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "updatedAt": "2025-03-22T14:30:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "DELETE",
          path: "/api/admin/email/templates/:id",
          description: "Delete an email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" }
          ],
          responseExample: `{
  "success": true,
  "message": "Template deleted successfully"
}`
        }
      ]
    },
    {
      id: "send",
      name: "Send Email API",
      description: "Endpoints for sending emails",
      endpoints: [
        {
          method: "POST",
          path: "/api/admin/email/send",
          description: "Send an email using a template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "templateId", type: "number", description: "ID of the template to use" },
            { name: "to", type: "string", description: "Recipient email address" },
            { name: "variables", type: "object", description: "Object containing variables to replace in the template" },
            { name: "replyTo", type: "string", description: "Reply-to email address (optional)" }
          ],
          requestExample: `{
  "templateId": 1,
  "to": "user@example.com",
  "variables": {
    "name": "John Doe",
    "venue": "Music Café",
    "event_date": "March 30, 2025"
  },
  "replyTo": "support@yourvenue.com"
}`,
          responseExample: `{
  "success": true,
  "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
  "emailLogId": 123
}`
        }
      ]
    },
    {
      id: "logs",
      name: "Email Logs API",
      description: "Endpoints for accessing email sending logs",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/logs",
          description: "Get email sending logs with pagination",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "page", type: "number", description: "Page number (optional, default: 1)" },
            { name: "limit", type: "number", description: "Results per page (optional, default: 20)" },
            { name: "status", type: "string", description: "Filter by status (optional): 'sent', 'delivered', 'failed'" },
            { name: "recipient", type: "string", description: "Filter by recipient email (optional)" }
          ],
          responseExample: `{
  "logs": [
    {
      "id": 123,
      "templateId": 1,
      "templateName": "Welcome Email",
      "recipient": "user@example.com",
      "subject": "Welcome to Cosmic",
      "status": "delivered",
      "sentAt": "2025-03-22T14:35:00Z",
      "deliveredAt": "2025-03-22T14:35:05Z",
      "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
      "errorMessage": null,
      "apiTokenId": 5,
      "apiTokenName": "Marketing API"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/logs/:id",
          description: "Get a specific email log by ID",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Email log ID" }
          ],
          responseExample: `{
  "log": {
    "id": 123,
    "templateId": 1,
    "templateName": "Welcome Email",
    "recipient": "user@example.com",
    "subject": "Welcome to Cosmic",
    "status": "delivered",
    "sentAt": "2025-03-22T14:35:00Z",
    "deliveredAt": "2025-03-22T14:35:05Z",
    "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
    "errorMessage": null,
    "apiTokenId": 5,
    "apiTokenName": "Marketing API",
    "variables": {
      "name": "John Doe",
      "venue": "Music Café"
    }
  }
}`
        }
      ]
    },
    {
      id: "stats",
      name: "Email Statistics API",
      description: "Endpoints for email usage statistics",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/stats",
          description: "Get email sending statistics",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "total": 1250,
  "sent": 1240,
  "delivered": 1210,
  "failed": 40,
  "daily": [
    {
      "date": "2025-03-21",
      "count": 126,
      "status": "sent"
    },
    {
      "date": "2025-03-21",
      "count": 122,
      "status": "delivered"
    },
    {
      "date": "2025-03-21",
      "count": 4,
      "status": "failed"
    },
    {
      "date": "2025-03-22",
      "count": 143,
      "status": "sent"
    },
    {
      "date": "2025-03-22",
      "count": 139,
      "status": "delivered"
    },
    {
      "date": "2025-03-22",
      "count": 4,
      "status": "failed"
    }
  ],
  "byTemplate": [
    {
      "templateId": 1,
      "templateName": "Welcome Email",
      "count": 450,
      "delivered": 442,
      "failed": 8
    },
    {
      "templateId": 2,
      "templateName": "Password Reset",
      "count": 320,
      "delivered": 318,
      "failed": 2
    }
  ]
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/quota",
          description: "Get email service sending quota information",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "max24HourSend": 50000,
  "maxSendRate": 14,
  "sentLast24Hours": 1240,
  "remainingToday": 48760,
  "sendingEnabled": true
}`
        }
      ]
    },
    {
      id: "verification",
      name: "Email Verification API",
      description: "Endpoints for managing email sender verification status",
      endpoints: [
        {
          method: "POST",
          path: "/api/admin/email/verify",
          description: "Request verification for an email address",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "email", type: "string", description: "Email address to verify" }
          ],
          requestExample: `{
  "email": "user@example.com"
}`,
          responseExample: `{
  "success": true,
  "message": "Verification email sent to user@example.com"
}`
        }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {emailApis.map((api) => (
          <Button 
            key={api.id}
            variant={selectedApi === api.id ? "default" : "outline"}
            onClick={() => setSelectedApi(api.id)}
          >
            {api.name}
          </Button>
        ))}
      </div>

      {emailApis.map((api) => (
        <div 
          key={api.id} 
          className={cn("space-y-6", selectedApi && selectedApi !== api.id && "hidden")}
        >
          <Card>
            <CardHeader>
              <CardTitle>{api.name}</CardTitle>
              <CardDescription>{api.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {api.endpoints.map((endpoint, index) => (
                <div key={index} className="space-y-4 border-b border-border pb-8 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-primary font-mono">
                      {endpoint.method}
                    </Badge>
                    <code className="bg-muted p-1 rounded text-sm font-mono">
                      {endpoint.path}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Parameters</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {endpoint.parameters.map((param, paramIndex) => (
                          <TableRow key={paramIndex}>
                            <TableCell className="font-mono text-xs">{param.name}</TableCell>
                            <TableCell>{param.type}</TableCell>
                            <TableCell>{param.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {endpoint.requestExample && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Request Example</h4>
                      <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                        {endpoint.requestExample}
                      </pre>
                    </div>
                  )}

                  {endpoint.responseExample && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Response Example</h4>
                      <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                        {endpoint.responseExample}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}


