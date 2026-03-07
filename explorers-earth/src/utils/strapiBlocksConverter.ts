/**
 * Utility functions for converting between HTML and Strapi Blocks format
 * 
 * Strapi v5 uses a "Blocks" format for rich text which is a JSON structure
 * ReactQuill/TiptapEditor outputs HTML, so we need to convert it
 */

/**
 * Converts HTML string to Strapi Blocks format
 * This is a simplified converter - for production, consider using a library like html-to-blocks
 */
export const htmlToBlocks = (html: string): any[] => {
  if (!html || html.trim() === '' || html === '<p><br></p>') {
    return [];
  }

  // Remove the outer <p> tags if present and extract content
  const cleanHtml = html.trim();
  
  // Simple parser for basic formatting
  const blocks: any[] = [];
  
  // Split by paragraph tags
  const paragraphRegex = /<p>(.*?)<\/p>/gs;
  const matches = cleanHtml.matchAll(paragraphRegex);
  
  for (const match of matches) {
    const paragraphContent = match[1];
    
    // Skip empty paragraphs
    if (!paragraphContent || paragraphContent === '<br>' || paragraphContent.trim() === '') {
      continue;
    }
    
    // Parse inline formatting (bold, italic, etc.)
    const children = parseInlineFormatting(paragraphContent);
    
    blocks.push({
      type: 'paragraph',
      children: children
    });
  }
  
  // If no paragraphs were found, treat the whole content as one paragraph
  if (blocks.length === 0 && cleanHtml) {
    const children = parseInlineFormatting(cleanHtml);
    blocks.push({
      type: 'paragraph',
      children: children
    });
  }
  
  return blocks;
};

/**
 * Parses inline formatting like bold, italic, underline, strikethrough
 */
const parseInlineFormatting = (html: string): any[] => {
  const children: any[] = [];
  
  // Regular expression to match formatted text
  const formattingRegex = /<(strong|b|em|i|u|s|strike)>(.*?)<\/(strong|b|em|i|u|s|strike)>/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = formattingRegex.exec(html)) !== null) {
    // Add plain text before the formatted text
    if (match.index > lastIndex) {
      const plainText = html.substring(lastIndex, match.index);
      if (plainText) {
        children.push({
          type: 'text',
          text: stripHtmlTags(plainText)
        });
      }
    }
    
    // Add formatted text
    const tag = match[1];
    const text = stripHtmlTags(match[2]);
    
    const textNode: any = {
      type: 'text',
      text: text
    };
    
    // Apply formatting based on tag
    if (tag === 'strong' || tag === 'b') {
      textNode.bold = true;
    } else if (tag === 'em' || tag === 'i') {
      textNode.italic = true;
    } else if (tag === 'u') {
      textNode.underline = true;
    } else if (tag === 's' || tag === 'strike') {
      textNode.strikethrough = true;
    }
    
    children.push(textNode);
    lastIndex = formattingRegex.lastIndex;
  }
  
  // Add remaining plain text
  if (lastIndex < html.length) {
    const plainText = html.substring(lastIndex);
    if (plainText) {
      children.push({
        type: 'text',
        text: stripHtmlTags(plainText)
      });
    }
  }
  
  // If no formatted text was found, return the whole content as plain text
  if (children.length === 0 && html) {
    children.push({
      type: 'text',
      text: stripHtmlTags(html)
    });
  }
  
  return children;
};

/**
 * Strips HTML tags from a string
 */
const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Converts Strapi Blocks format back to HTML (for display)
 */
export const blocksToHtml = (blocks: any[]): string => {
  if (!blocks || blocks.length === 0) {
    return '';
  }
  
  return blocks.map(block => {
    if (block.type === 'paragraph') {
      const content = block.children.map((child: any) => {
        if (child.type === 'text') {
          let text = child.text;
          
          // Apply formatting
          if (child.bold) text = `<strong>${text}</strong>`;
          if (child.italic) text = `<em>${text}</em>`;
          if (child.underline) text = `<u>${text}</u>`;
          if (child.strikethrough) text = `<s>${text}</s>`;
          
          return text;
        }
        return '';
      }).join('');
      
      return `<p>${content}</p>`;
    }
    
    return '';
  }).join('');
};
