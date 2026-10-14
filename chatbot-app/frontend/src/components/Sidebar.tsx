import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  Check,
  Bot,
} from "lucide-react";
import { Thread } from "../lib/types";
import { ThreadGroup } from "../hooks/useThreads";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  groupedThreads: ThreadGroup[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  groupedThreads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onDeleteThread,
  searchQuery,
  onSearchChange,
  isLoading,
}) => {
  const [menuOpenThreadId, setMenuOpenThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenThreadId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartRename = (thread: Thread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title);
    setMenuOpenThreadId(null);
  };

  const handleSaveRename = (threadId: string) => {
    if (editTitle.trim()) {
      onRenameThread(threadId, editTitle.trim());
    }
    setEditingThreadId(null);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand & New Chat */}
        <div className="p-3 border-b border-slate-200/60 dark:border-zinc-800/60 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-zinc-50">
                SuperBot AI
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-xs shadow-xs hover:shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-slate-100 dark:bg-zinc-800/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Thread List Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {isLoading ? (
            <div className="p-2 space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-16" />
              <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
              <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-20 pt-2" />
              <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
            </div>
          ) : groupedThreads.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500">
              {searchQuery ? "No matching conversations found." : "No chats yet. Start a new one!"}
            </div>
          ) : (
            groupedThreads.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  {group.label}
                </div>

                {group.items.map((thread) => {
                  const isActive = thread.id === activeThreadId;
                  const isMenuOpen = menuOpenThreadId === thread.id;
                  const isEditing = editingThreadId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      className={`relative group rounded-xl transition-colors flex items-center ${
                        isActive
                          ? "bg-slate-200/70 dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 font-medium"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-300"
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1 w-full p-1.5">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(thread.id);
                              if (e.key === "Escape") setEditingThreadId(null);
                            }}
                            autoFocus
                            className="flex-1 bg-white dark:bg-zinc-950 px-2 py-1 rounded text-xs border border-brand-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(thread.id)}
                            className="p-1 text-emerald-500 hover:text-emerald-600"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingThreadId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectThread(thread.id);
                              onClose();
                            }}
                            className="flex-1 text-left px-2.5 py-2 flex items-center gap-2 overflow-hidden text-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
                            <span className="truncate">{thread.title || "Untitled Chat"}</span>
                          </button>

                          {/* Hover Menu Trigger */}
                          <div className="relative pr-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenThreadId((prev) => (prev === thread.id ? null : thread.id));
                              }}
                              className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-opacity ${
                                isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 p-1 space-y-0.5 animate-fade-in"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRename(thread);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteThread(thread.id);
                                    setMenuOpenThreadId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
