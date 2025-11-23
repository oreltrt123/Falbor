// Database schema for v0-style chat interface with file tracking and persistence

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  searchQueries?: SearchQuery[] | null;
  files?: FileOperation[] | null;
  toolCalls?: ToolCall[] | null;
  imageData?: ImageAttachment[] | null;
  uploadedFiles?: UploadedFile[] | null;
  hasArtifact: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  id: string;
  query: string;
  results: string;
  timestamp: string;
}

export interface FileOperation {
  id: string;
  messageId: string;
  path: string;
  language: string;
  content: string;
  status: "pending" | "in-progress" | "complete" | "error";
  additions: number;
  deletions: number;
  operation: "create" | "edit" | "delete" | "move";
  preview?: string | null;
  createdAt: string;
  completedAt?: string | null;
  error?: string | null;
}

export interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  description: string;
  status: "pending" | "running" | "complete" | "error";
  result?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ImageAttachment {
  id: string;
  url: string;
  mimeType: string;
  fileName?: string | null;
}

export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
}

export interface Conversation {
  id: string;
  userId?: string | null;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileTree {
  id: string;
  conversationId: string;
  path: string;
  type: "file" | "folder";
  content?: string | null;
  language?: string | null;
  size: number;
  lastModified: string;
}

// Type guards
export function isUserMessage(message: Message): boolean {
  return message.role === "user";
}

export function isAssistantMessage(message: Message): boolean {
  return message.role === "assistant";
}

export function hasThinking(message: Message): boolean {
  return Boolean(message.thinking && message.thinking.trim().length > 0);
}

export function hasSearchQueries(message: Message): boolean {
  return Boolean(message.searchQueries && message.searchQueries.length > 0);
}

export function hasFiles(message: Message): boolean {
  return Boolean(message.files && message.files.length > 0);
}

export function hasToolCalls(message: Message): boolean {
  return Boolean(message.toolCalls && message.toolCalls.length > 0);
}

// Utility functions for file operations
export function getFilesByStatus(
  files: FileOperation[],
  status: FileOperation["status"]
): FileOperation[] {
  return files.filter((f) => f.status === status);
}

export function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

export function getFolderPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

// Build file tree from flat file list
export function buildFileTree(files: FileOperation[]): FileTreeNode {
  const root: FileTreeNode = {
    name: "root",
    path: "/",
    type: "folder",
    children: [],
  };

  files.forEach((file) => {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = "/" + parts.slice(0, index + 1).join("/");

      let existing = current.children?.find((c) => c.name === part);

      if (!existing) {
        existing = {
          name: part,
          path,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        current.children?.push(existing);
      }

      if (!isFile) {
        current = existing;
      }
    });
  });

  return root;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  file?: FileOperation;
}
