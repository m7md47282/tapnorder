/**
 * Attachment Model
 * Based on backend-swagger.json schema definitions
 */

export interface Attachment {
  id: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  url: string;
  storagePath: string;
  uploadedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UploadAttachmentRequest {
  file: string; // Base64 encoded file content or data URL
  fileName: string;
  mimeType: string;
  uploadedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  folder?: string;
  metadata?: Record<string, any>;
}


