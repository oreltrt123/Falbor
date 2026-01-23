// components/project/SidebarProjects.tsx
"use client";

import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Users,
  Plus,
  MessageSquare,
  Clock,
  Settings,
  ChevronRight,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useClerk } from '@clerk/nextjs';

interface ProjectItem {
  id: string;
  title: string;
  updated_at: string;
  is_owner: boolean;
  collaborator_count?: number;
}

interface SidebarProjectsProps {
  userId: string;
  initialProjects?: ProjectItem[];
  className?: string;
}

const menuVariants: Variants = {
  closed: { x: '-100%', opacity: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
};

export default function SidebarProjects({
  userId,
  initialProjects = [],
  className,
}: SidebarProjectsProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [projects] = useState<ProjectItem[]>(initialProjects);
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  // Hover logic to open/close sidebar
  useEffect(() => {
    const threshold = 20; // px from left edge to trigger open

    const handleMouseMove = (e: MouseEvent) => {
      // Open if mouse is near left edge
      if (e.clientX < threshold) {
        setOpen(true);
      }
      // Close if mouse moves far right of the menu
      else if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        // Add a buffer zone so it doesn't close immediately when leaving the menu
        if (e.clientX > rect.right + 50) {
          setOpen(false);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.aside
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className={cn(
        'fixed top-0 left-0 h-screen w-[320px] z-[999999] flex flex-col',
        'bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl',
        'border-r border-zinc-200 dark:border-zinc-800 shadow-2xl',
        className
      )}
    >
      {/* Header Section */}
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
              <img src="/logo_light.png" width={124} height={24} className='absolute top-[-10px] left-0' alt="" />
            </span>
          </div>
        </div>

        <Link href="/">
          <button className="w-full group relative flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-black dark:text-zinc-900 px-4 py-3 rounded-xl transition-all duration-200 shadow-sm cursor-pointer active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            <span className="font-medium text-sm">New Chat</span>
          </button>
        </Link>
      </div>
      {/* Projects List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        <div className="px-2 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Recent Projects
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500 font-medium">No projects yet</p>
            <p className="text-xs text-zinc-400 mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/chat/${project.id}`}
              className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-all duration-200 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/50"
            >
              <div className={cn(
                "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                project.is_owner
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
              )}>
                {project.is_owner ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {project.title || 'Untitled Project'}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 group-hover:text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {!project.is_owner && (
                    <>
                      <span>•</span>
                      <span>Shared</span>
                    </>
                  )}
                </div>
              </div>

              {project.is_owner && project.collaborator_count && project.collaborator_count > 0 ? (
                <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                  <Users className="h-3 w-3" />
                  {project.collaborator_count}
                </div>
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              )}
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div
          onClick={() => openUserProfile()}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || "User"}
              className="h-8 w-8 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user?.firstName?.slice(0, 1) || userId.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {user?.fullName || "User Account"}
            </p>
            <p className="text-[10px] text-zinc-500 truncate font-mono">
              {user?.primaryEmailAddress?.emailAddress || userId}
            </p>
          </div>
          <Settings className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
        </div>
      </div>
    </motion.aside>
  );
}