"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Code, Link } from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const execCommand = useCallback(
    (command: string, commandValue?: string) => {
      document.execCommand(command, false, commandValue)
      editorRef.current?.focus()
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML)
      }
    },
    [onChange],
  )

  const handleBold = () => execCommand("bold")
  const handleItalic = () => execCommand("italic")
  const handleUnderline = () => execCommand("underline")
  const handleStrikethrough = () => execCommand("strikeThrough")
  const handleOrderedList = () => execCommand("insertOrderedList")
  const handleUnorderedList = () => execCommand("insertUnorderedList")
  const handleQuote = () => execCommand("formatBlock", "blockquote")

  const handleCode = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const code = document.createElement("code")
      code.className = "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-600"
      range.surroundContents(code)
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML)
      }
    }
  }

  const handleLink = () => {
    if (showLinkInput && linkUrl) {
      execCommand("createLink", linkUrl)
      setLinkUrl("")
      setShowLinkInput(false)
    } else {
      setShowLinkInput(!showLinkInput)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const toolbarButtons = [
    { icon: Bold, action: handleBold, title: "Bold" },
    { icon: Italic, action: handleItalic, title: "Italic" },
    { icon: Underline, action: handleUnderline, title: "Underline" },
    { icon: Strikethrough, action: handleStrikethrough, title: "Strikethrough" },
    { icon: ListOrdered, action: handleOrderedList, title: "Numbered List" },
    { icon: List, action: handleUnorderedList, title: "Bullet List" },
    { icon: Quote, action: handleQuote, title: "Quote" },
    { icon: Code, action: handleCode, title: "Code" },
    { icon: Link, action: handleLink, title: "Link" },
  ]

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-t-lg p-1.5 border-b-0">
        {toolbarButtons.map(({ icon: Icon, action, title }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title={title}
          >
            <Icon className="w-4 h-4 text-gray-600" />
          </button>
        ))}

        {showLinkInput && (
          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-200">
            <input
              type="url"
              placeholder="Enter URL..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-200 rounded w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleLink()
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className={cn(
          "min-h-[80px] p-3 border border-gray-200 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          "prose prose-sm max-w-none",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600",
          "[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-red-600",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_ol]:list-decimal [&_ol]:pl-5",
          "[&_ul]:list-disc [&_ul]:pl-5",
        )}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
