"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, ListFilter } from "lucide-react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface HybridSelectProps {
  /** Optional field label or element rendered on the left side of the header. */
  label?: React.ReactNode
  /** Predefined choices shown in the dropdown. */
  options: string[]
  /** Current value — either a preset option or a custom string. */
  value: string
  /** Fired with the selected preset or the typed custom value. */
  onChange: (value: string) => void
  /** Dropdown placeholder shown when nothing is selected. */
  placeholder?: string
  /** Placeholder for the manual custom-input field. */
  customPlaceholder?: string
  /** Extra classes for the outer wrapper. */
  className?: string
  /** Optional id — associates the label with the trigger. */
  id?: string
}

/**
 * Hybrid Select Combobox — presents a dropdown of predefined `options` with an in-dropdown
 * `+ কাস্টম` icon button located at the very top right of the dropdown popup.
 *
 * Clicking the `+ কাস্টম` icon button opens an input field directly INSIDE the dropdown popup at the top.
 * While custom mode is active, the predefined dropdown options below transition to a blur
 * (`blur-[2px] opacity-35 pointer-events-none`) until returned to list mode.
 */
export function HybridSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "একটি অপশন সিলেক্ট করুন",
  customPlaceholder = "এখানে নিজের মতো করে লিখুন…",
  className,
  id,
}: HybridSelectProps) {
  const generatedId = React.useId()
  const fieldId = id ?? generatedId
  const customInputRef = React.useRef<HTMLInputElement>(null)
  const shouldFocusRef = React.useRef(false)

  // Whether custom input mode is active. Seeded from incoming value if custom.
  const [isCustom, setIsCustom] = React.useState<boolean>(
    () => value !== "" && !options.includes(value)
  )

  // Reflect external value changes into custom mode state
  React.useEffect(() => {
    if (value === "") return
    setIsCustom(!options.includes(value))
  }, [value, options])

  // Auto-focus input when toggled on by user
  React.useEffect(() => {
    if (isCustom && shouldFocusRef.current) {
      shouldFocusRef.current = false
      customInputRef.current?.focus()
    }
  }, [isCustom])

  const enableCustomMode = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    shouldFocusRef.current = true
    setIsCustom(true)
    if (options.includes(value)) {
      onChange("")
    }
  }

  const disableCustomMode = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setIsCustom(false)
    if (!options.includes(value)) {
      onChange("")
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* ─── Header bar: Label (left) ─── */}
      {label && (
        typeof label === "string" ? (
          <Label htmlFor={fieldId} className="text-sm font-semibold">
            {label}
          </Label>
        ) : (
          label
        )
      )}

      {/* ─── Select Dropdown Control ─── */}
      <Select
        value={!isCustom && options.includes(value) ? value : ""}
        onValueChange={(selected) => {
          setIsCustom(false)
          onChange(selected ?? "")
        }}
      >
        <SelectTrigger
          id={fieldId}
          className="w-full h-11 rounded-xl bg-secondary/10 border-border/60 hover:border-primary/40 transition-colors"
        >
          <SelectValue placeholder={placeholder}>
            {(v: string | null) => (isCustom ? value || customPlaceholder : v || placeholder)}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="p-0 overflow-hidden min-w-[220px]">
          {/* ─── Top Header inside Dropdown Popup: Icon button at top right ─── */}
          <div className="p-2 border-b border-border/60 bg-popover/95 backdrop-blur-xs sticky top-0 z-20 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                <ListFilter className="w-3 h-3 text-primary" />
                <span>{isCustom ? "কাস্টম ইনপুট" : "অপশনসমূহ"}</span>
              </span>

              {/* Small icon button at the very top right of the dropdown popup */}
              {!isCustom ? (
                <button
                  type="button"
                  onClick={enableCustomMode}
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all cursor-pointer shadow-2xs shrink-0"
                  title="কাস্টম টেক্সট ইনপুট অ্যাক্টিভ করুন"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>কাস্টম</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={disableCustomMode}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-all cursor-pointer shrink-0"
                  title="ড্রপডাউন লিস্টে ফিরে যান"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>লিস্ট</span>
                </button>
              )}
            </div>

            {/* In-Dropdown Custom Text Input Field (Opens directly INSIDE dropdown at the top) */}
            <AnimatePresence initial={false}>
              {isCustom && (
                <motion.div
                  key="dropdown-inline-custom-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="overflow-hidden pt-1"
                >
                  <div className="relative flex items-center">
                    <Input
                      ref={customInputRef}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={customPlaceholder}
                      className="h-9 rounded-lg bg-background border-2 border-primary/60 focus-visible:ring-1 focus-visible:ring-primary text-xs font-medium pr-7"
                    />
                    {value && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onChange("")
                        }}
                        className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md"
                        title="ক্লিয়ার করুন"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-primary font-semibold mt-1 px-0.5 flex items-center gap-1">
                    <span>✍️ ইনপুট লিখে নিজের মতো মান ব্যবহার করুন</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Options List inside Dropdown Popup (Blurred when Custom Mode is active) ─── */}
          <div
            className={cn(
              "p-1 max-h-56 overflow-y-auto transition-all duration-200",
              isCustom && "opacity-35 blur-[2px] pointer-events-none select-none"
            )}
          >
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>
    </div>
  )
}
