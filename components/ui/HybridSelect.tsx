"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

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

/**
 * Sentinel option appended to the end of every HybridSelect dropdown. Selecting
 * it reveals an inline manual-input field so merchants can type a value that is
 * not in the predefined list.
 */
export const HYBRID_CUSTOM_OPTION = "✍️ Custom / ম্যানুয়ালি লিখুন"

export interface HybridSelectProps {
  /** Optional field label rendered above the control. */
  label?: string
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
 * Hybrid Combobox — a dropdown of predefined `options` plus a
 * "✍️ Custom / ম্যানুয়ালি লিখুন" escape hatch. Picking a preset calls `onChange`
 * with that value and hides the manual field; picking the custom option reveals
 * an animated text input whose keystrokes stream straight into `onChange`.
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
  // Marks a user-driven switch into custom mode so we can focus the input on
  // its next commit — without stealing focus when it mounts already-custom.
  const shouldFocusRef = React.useRef(false)

  // Whether the manual custom-input field is currently shown. Seeded from the
  // incoming value so an existing custom answer reopens in manual mode.
  const [isCustom, setIsCustom] = React.useState<boolean>(
    () => value !== "" && !options.includes(value)
  )

  // Reflect external value changes (parent reset / prefilled edit) into custom
  // mode, but leave it alone while the field is empty so the user can type.
  React.useEffect(() => {
    if (value === "") return
    setIsCustom(!options.includes(value))
  }, [value, options])

  // Focus the manual input once it has committed after a user-driven switch.
  React.useEffect(() => {
    if (isCustom && shouldFocusRef.current) {
      shouldFocusRef.current = false
      customInputRef.current?.focus()
    }
  }, [isCustom])

  const handleSelect = (selected: string | null) => {
    if (selected === HYBRID_CUSTOM_OPTION) {
      shouldFocusRef.current = true
      setIsCustom(true)
      onChange("")
      return
    }
    setIsCustom(false)
    onChange(selected ?? "")
  }

  // Value shown as selected in the trigger. `null` renders the placeholder.
  const selectValue: string | null = isCustom
    ? HYBRID_CUSTOM_OPTION
    : value && options.includes(value)
      ? value
      : null

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={fieldId} className="text-sm font-semibold">
          {label}
        </Label>
      )}

      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger
          id={fieldId}
          className="w-full h-11 rounded-xl bg-secondary/10"
        >
          <SelectValue placeholder={placeholder}>
            {(v: string | null) => v ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={HYBRID_CUSTOM_OPTION}>
            {HYBRID_CUSTOM_OPTION}
          </SelectItem>
        </SelectContent>
      </Select>

      <AnimatePresence initial={false}>
        {isCustom && (
          <motion.div
            key="hybrid-custom-input"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Input
              ref={customInputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={customPlaceholder}
              className="h-11 rounded-xl bg-secondary/10 focus-visible:ring-primary/20 mt-0.5"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
