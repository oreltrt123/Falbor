"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, X } from 'lucide-react';
import type { FileOperation } from "./typesserver";
import { buildFileTree, type FileTreeNode } from "./typesserver";

interface FileExplorerProps {
  files: FileOperation[];
  trigger?: React.ReactNode;
}

export function FileExplorer({ files, trigger }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<FileOperation | null>(null);
  const fileTree = buildFileTree(files);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Folder className="w-4 h-4 mr-2" />
            Files ({files.length})
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Project Files</SheetTitle>
          <SheetDescription>
            {files.length} file{files.length !== 1 ? "s" : ""} in this conversation
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 flex min-h-0">
          {/* File Tree */}
          <div className="w-64 border-r">
            <ScrollArea className="h-full">
              <div className="p-4">
                <FileTreeView
                  node={fileTree}
                  onSelectFile={setSelectedFile}
                  selectedFile={selectedFile}
                />
              </div>
            </ScrollArea>
          </div>

          {/* File Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile ? (
              <>
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-mono truncate">{selectedFile.path}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="p-4 text-xs font-mono">
                    <code>{selectedFile.content}</code>
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <File className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Select a file to view its content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// File Tree View Component
function FileTreeView({
  node,
  level = 0,
  onSelectFile,
  selectedFile,
}: {
  node: FileTreeNode;
  level?: number;
  onSelectFile: (file: FileOperation) => void;
  selectedFile: FileOperation | null;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const isFolder = node.type === "folder";
  const hasChildren = isFolder && node.children && node.children.length > 0;

  if (level === 0 && hasChildren) {
    return (
      <div className="space-y-0.5">
        {node.children!.map((child) => (
          <FileTreeView
            key={child.path}
            node={child}
            level={level + 1}
            onSelectFile={onSelectFile}
            selectedFile={selectedFile}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start h-7 px-2 font-normal",
          selectedFile?.path === node.file?.path && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 12}px` }}
        onClick={() => {
          if (isFolder) {
            setIsExpanded(!isExpanded);
          } else if (node.file) {
            onSelectFile(node.file);
          }
        }}
      >
        {isFolder ? (
          <>
            {hasChildren &&
              (isExpanded ? (
                <ChevronDown className="w-3 h-3 mr-1 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 mr-1 flex-shrink-0" />
              ))}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 mr-2 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
            )}
          </>
        ) : (
          <File className="w-4 h-4 mr-2 flex-shrink-0 ml-4" />
        )}
        <span className="truncate text-xs">{node.name}</span>
      </Button>

      {isFolder && hasChildren && isExpanded && (
        <div className="space-y-0.5 mt-0.5">
          {node.children!.map((child) => (
            <FileTreeView
              key={child.path}
              node={child}
              level={level + 1}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
