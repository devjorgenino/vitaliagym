"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip";

/**
 * TruncatedCell - A reusable component for table cells with long content
 * 
 * Features:
 * - Truncates text with ellipsis when content exceeds maxWidth
 * - Shows full content in tooltip on hover
 * - Only shows tooltip if content is actually truncated
 * - Accessible with proper ARIA attributes
 * - Supports custom className for styling
 * 
 * @param {string} value - The text content to display
 * @param {string} maxWidth - CSS max-width value (default: "150px")
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} icon - Optional icon to display before text
 * @param {string} fallback - Text to show when value is empty (default: "N/A")
 */
function TruncatedCell({
  value,
  maxWidth = "150px",
  className,
  icon,
  fallback = "N/A",
}) {
  const textRef = React.useRef(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const displayValue = value || fallback;
  const isEmpty = !value;

  // Check if text is truncated on mount and when value changes
  React.useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };

    checkTruncation();
    
    // Re-check on window resize
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [value]);

  const content = (
    <div
      ref={textRef}
      className={cn(
        "truncate",
        isEmpty && "text-muted-foreground",
        className
      )}
      style={{ maxWidth }}
    >
      {icon && (
        <span className="inline-flex items-center gap-1.5">
          {icon}
          <span className="truncate">{displayValue}</span>
        </span>
      )}
      {!icon && displayValue}
    </div>
  );

  // Only wrap in tooltip if text is actually truncated and has a value
  if (isTruncated && !isEmpty) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="cursor-default"
            role="button"
            tabIndex={0}
            aria-label={value}
          >
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[300px] break-words"
          sideOffset={5}
        >
          <p className="text-sm">{value}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/**
 * TruncatedEmailCell - Specialized truncated cell for email addresses
 * Shows email icon and truncates long emails
 */
function TruncatedEmailCell({ value, className }) {
  return (
    <TruncatedCell
      value={value}
      maxWidth="180px"
      className={className}
      fallback="N/A"
    />
  );
}

/**
 * TruncatedAddressCell - Specialized truncated cell for addresses
 * Wider max-width to show more content
 */
function TruncatedAddressCell({ value, className }) {
  return (
    <TruncatedCell
      value={value}
      maxWidth="200px"
      className={className}
      fallback="N/A"
    />
  );
}

/**
 * TruncatedNotesCell - Specialized truncated cell for notes/observations
 * Styled differently to indicate it's a notes field
 */
function TruncatedNotesCell({ value, className }) {
  return (
    <TruncatedCell
      value={value}
      maxWidth="150px"
      className={cn("italic", className)}
      fallback="Sin notas"
    />
  );
}

/**
 * TruncatedNameCell - Specialized truncated cell for names
 * Shows full name with truncation for very long names
 */
function TruncatedNameCell({ value, className }) {
  return (
    <TruncatedCell
      value={value}
      maxWidth="180px"
      className={cn("font-medium", className)}
      fallback="Sin nombre"
    />
  );
}

export {
  TruncatedCell,
  TruncatedEmailCell,
  TruncatedAddressCell,
  TruncatedNotesCell,
  TruncatedNameCell,
};
