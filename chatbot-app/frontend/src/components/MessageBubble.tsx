import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import {
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Edit2,
  AlertCircle,
  Send,
} from "lucide-react";
import { Message } from "../lib/types";
import { ThinkingBlock } from "./ThinkingBlock";

interface MessageBubbleProps {
  message: Message;
  isLastAssistant: boolean;
  isLastUser: boolean;
  onRegenerate?: () => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
  onRetry?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isLastAssistant,
  isLastUser,
  onRegenerate,
  onEditAndResend,
  onRetry,
}) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(message.content);

  // Trigger Prism syntax highlighting after render
  useEffect(() => {
    Prism.highlightAll();
  }, [message.content, message.thinking]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== message.content) {
      onEditAndResend?.(message.id, editText.trim());
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group flex items-start gap-3 my-4 transition-opacity ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white ${
          isUser
            ? "bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-zinc-600 dark:to-zinc-800"
            : "bg-gradient-to-tr from-brand-600 to-indigo-500"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Thinking Block for Assistant Messages */}
        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock thinking={message.thinking} isStreaming={message.isStreaming} />
          </div>
        )}

        {/* Message Body */}
        {isEditing ? (
          <div className="w-full bg-white dark:bg-zinc-900 border border-brand-400 rounded-2xl p-3 shadow-md space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-transparent text-sm resize-none focus:outline-none dark:text-zinc-100"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm font-medium"
              >
                <Send className="w-3 h-3" /> Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`relative px-4 py-3 text-sm leading-relaxed rounded-2xl transition-all shadow-xs ${
              isUser
                ? "bg-brand-600 text-white rounded-tr-sm"
                : "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-zinc-100 rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            ) : (
              <div className="prose dark:prose-invert prose-sm max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      const isInline = !match && !codeString.includes("\n");

                      if (isInline) {
                        return (
                          <code
                            className="bg-slate-100 dark:bg-zinc-800 text-brand-600 dark:text-brand-300 font-mono text-xs px-1.5 py-0.5 rounded"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <div className="relative my-3 rounded-xl overflow-hidden border border-slate-700/60 shadow-md">
                          <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-800/90 text-zinc-400 text-xs font-mono border-b border-zinc-700/50">
                            <span>{match ? match[1] : "code"}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(codeString)}
                              className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
                              title="Copy code"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copied ? "Copied!" : "Copy"}</span>
                            </button>
                          </div>
                          <pre className="!m-0 !p-3.5 !bg-zinc-950 font-mono text-xs overflow-x-auto">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 text-xs">
                            {children}
                          </table>
                        </div>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {message.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-brand-500 animate-pulse align-middle" />
                )}
              </div>
            )}

            {/* Error Banner */}
            {message.error && (
              <div className="mt-2.5 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{message.error}</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-1 font-semibold underline hover:no-underline text-red-700 dark:text-red-300"
                    >
                      Retry request
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Toolbar on Hover */}
        {!isEditing && (
          <div
            className={`flex items-center gap-1 mt-1 text-[11px] text-slate-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <button
              type="button"
              onClick={() => handleCopy(message.content)}
              title="Copy message text"
              className="p-1 hover:text-slate-700 dark:hover:text-zinc-300 rounded"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {isUser && isLastUser && onEditAndResend && (
              <button
                type="button"
                onClick={() => {
                  setEditText(message.content);
                  setIsEditing(true);
                }}
                title="Edit and resend"
                className="p-1 hover:text-slate-700 dark:hover:text-zinc-300 rounded"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {!isUser && isLastAssistant && onRegenerate && !message.isStreaming && (
              <button
                type="button"
                onClick={onRegenerate}
                title="Regenerate response"
                className="p-1 hover:text-slate-700 dark:hover:text-zinc-300 rounded flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px]">Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
