import React from 'react';

/**
 * Extracts all @usernames from a given text string.
 * Example: "Hello @user1 and @user2!" -> ["@user1", "@user2"]
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@[a-z0-9_]{3,}/g;
  const matches = text.toLowerCase().match(mentionRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Renders text content, wrapping @mentions in a styled span.
 */
export function renderContentWithMentions(content: string) {
  if (!content) return null;

  const parts = content.split(/(@[a-z0-9_]{3,})/gi);
  
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={i} 
          className="text-primary font-bold hover:underline cursor-pointer transition-all"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}
