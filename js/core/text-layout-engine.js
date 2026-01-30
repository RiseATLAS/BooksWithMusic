/**
 * TextLayoutEngine - Deterministic text layout with pixel-perfect measurement
 * 
 * This engine uses Canvas API to measure exact text widths and constructs
 * lines that are guaranteed to fit within the specified width. No more
 * overflow detection or reactive adjustments needed!
 */
class TextLayoutEngine {
  constructor() {
    // Create offscreen element for text measurement (more accurate than Canvas)
    this.measurementElement = document.createElement('span');
    this.measurementElement.style.position = 'absolute';
    this.measurementElement.style.visibility = 'hidden';
    this.measurementElement.style.whiteSpace = 'nowrap';
    this.measurementElement.style.left = '-9999px';
    this.measurementElement.style.top = '-9999px';
    // Apply same text rendering properties as .chapter-text
    this.measurementElement.style.textRendering = 'geometricPrecision';
    this.measurementElement.style.webkitFontSmoothing = 'antialiased';
    this.measurementElement.style.mozOsxFontSmoothing = 'grayscale';
    // Disable ALL CSS inheritance that could affect width
    this.measurementElement.style.letterSpacing = 'normal';
    this.measurementElement.style.wordSpacing = 'normal';
    this.measurementElement.style.padding = '0';
    this.measurementElement.style.margin = '0';
    this.measurementElement.style.border = 'none';
    document.body.appendChild(this.measurementElement);
    
    // Cache for text measurements (performance optimization)
    this.measurementCache = new Map();
  }

  /**
   * Measure exact pixel width of text with given font
   * Uses DOM element for accurate measurement matching actual rendering
   */
  measureText(text, fontSize, fontFamily) {
    const cacheKey = `${text}|${fontSize}|${fontFamily}`;
    
    if (this.measurementCache.has(cacheKey)) {
      return this.measurementCache.get(cacheKey);
    }
    
    // Set font properties on measurement element
    this.measurementElement.style.fontSize = `${fontSize}px`;
    this.measurementElement.style.fontFamily = fontFamily;
    this.measurementElement.textContent = text;
    
    // Get actual rendered width with sub-pixel precision
    const rect = this.measurementElement.getBoundingClientRect();
    // Always round UP to account for sub-pixel rendering
    const width = Math.ceil(rect.width);
    
    // Cache the measurement
    this.measurementCache.set(cacheKey, width);
    
    return width;
  }

  /**
   * Clear measurement cache (call when font settings change)
   */
  clearCache() {
    this.measurementCache.clear();
  }

  /**
   * Split text into words, handling punctuation and whitespace
   */
  tokenizeText(text) {
    // Handle null/undefined/empty text
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    // Split on whitespace but preserve the whitespace type
    const tokens = [];
    let currentWord = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (/\s/.test(char)) {
        if (currentWord) {
          tokens.push({ type: 'word', text: currentWord });
          currentWord = '';
        }
        // Preserve space (important for proper spacing)
        tokens.push({ type: 'space', text: char });
      } else {
        currentWord += char;
      }
    }
    
    if (currentWord) {
      tokens.push({ type: 'word', text: currentWord });
    }
    
    return tokens;
  }

  /**
   * Layout a paragraph of text into lines that fit within maxWidth
   * Returns array of line strings
   */
  layoutParagraph(text, maxWidth, fontSize, fontFamily) {
    // Handle empty/invalid text
    if (!text || typeof text !== 'string') {
      return [''];
    }
    
    const tokens = this.tokenizeText(text);
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;
    
    const spaceWidth = this.measureText(' ', fontSize, fontFamily);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === 'space') {
        // Add space to current line if not at start
        if (currentLine.length > 0) {
          currentLine.push(token);
          currentWidth += spaceWidth;
        }
        continue;
      }
      
      // It's a word
      const wordWidth = this.measureText(token.text, fontSize, fontFamily);
      
      // Check if word fits on current line
      if (currentWidth + wordWidth <= maxWidth || currentLine.length === 0) {
        currentLine.push(token);
        currentWidth += wordWidth;
      } else {
        // Word doesn't fit - check if it's too long for any line
        if (wordWidth > maxWidth) {
          // Word is too long - need to break it
          const brokenWord = this.breakLongWord(token.text, maxWidth - currentWidth, maxWidth, fontSize, fontFamily);
          
          // Add first part to current line
          if (brokenWord.first && currentLine.length > 0) {
            currentLine.push({ type: 'word', text: brokenWord.first });
          }
          
          // Save current line
          if (currentLine.length > 0) {
            lines.push(this.tokensToString(currentLine));
            currentLine = [];
            currentWidth = 0;
          }
          
          // Add remaining parts as separate lines
          if (brokenWord.middle) {
            for (const part of brokenWord.middle) {
              lines.push(part);
            }
          }
          
          // Start new line with remaining part
          if (brokenWord.last) {
            currentLine = [{ type: 'word', text: brokenWord.last }];
            currentWidth = this.measureText(brokenWord.last, fontSize, fontFamily);
          }
        } else {
          // Normal case - start new line with this word
          lines.push(this.tokensToString(currentLine));
          currentLine = [token];
          currentWidth = wordWidth;
        }
      }
    }
    
    // Add remaining content
    if (currentLine.length > 0) {
      lines.push(this.tokensToString(currentLine));
    }
    
    return lines.length > 0 ? lines : [''];
  }

  /**
   * Break a long word that doesn't fit on a single line
   * Returns { first: string, middle: string[], last: string }
   */
  breakLongWord(word, availableWidth, maxWidth, fontSize, fontFamily) {
    const result = { first: '', middle: [], last: '' };
    
    // Validate inputs
    if (!word || typeof word !== 'string' || word.length === 0) {
      return result;
    }
    
    if (maxWidth <= 0 || availableWidth < 0) {
      // Invalid dimensions - return word as-is
      result.last = word;
      return result;
    }
    
    // Try to fit as much as possible on current line
    if (availableWidth > maxWidth * 0.3) {
      let chars = '';
      for (let i = 0; i < word.length; i++) {
        const testChars = chars + word[i];
        const width = this.measureText(testChars + '-', fontSize, fontFamily);
        if (width <= availableWidth) {
          chars = testChars;
        } else {
          break;
        }
      }
      if (chars) {
        result.first = chars + '-';
        word = word.substring(chars.length);
      }
    }
    
    // Break remaining word into full-width chunks
    while (word.length > 0) {
      let chars = '';
      for (let i = 0; i < word.length; i++) {
        const testChars = chars + word[i];
        const needsHyphen = i < word.length - 1;
        const testString = needsHyphen ? testChars + '-' : testChars;
        const width = this.measureText(testString, fontSize, fontFamily);
        
        if (width <= maxWidth) {
          chars = testChars;
        } else {
          break;
        }
      }
      
      if (!chars) {
        // Single character is too wide - force it anyway
        chars = word[0];
      }
      
      word = word.substring(chars.length);
      
      if (word.length > 0) {
        result.middle.push(chars + '-');
      } else {
        result.last = chars;
      }
    }
    
    return result;
  }

  /**
   * Convert token array back to string
   */
  tokensToString(tokens) {
    return tokens.map(t => t.text).join('').trim();
  }

  /**
   * Layout content blocks (paragraphs, headings) into pages
   * Each page has exactly maxLinesPerPage lines (or fewer for last page)
   */
  layoutIntoPages(contentBlocks, maxWidth, maxLinesPerPage, fontSize, fontFamily, lineHeight) {
    // Validate inputs
    if (!contentBlocks || !Array.isArray(contentBlocks) || contentBlocks.length === 0) {
      return [{ lines: [], blocks: [] }];
    }
    
    if (maxWidth <= 0 || maxLinesPerPage <= 0) {
      console.error('Invalid layout dimensions:', { maxWidth, maxLinesPerPage });
      return [{ lines: [], blocks: [] }];
    }
    
    console.log('📐 Layout engine processing', contentBlocks.length, 'blocks');
    console.log('📐 Max width:', maxWidth, 'Max lines per page:', maxLinesPerPage);
    
    const pages = [];
    let currentPage = {
      lines: [],
      blocks: [] // Track which blocks are on this page
    };
    
    for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex++) {
      const block = contentBlocks[blockIndex];
      
      // Skip invalid blocks
      if (!block || !block.text) {
        continue;
      }
      
      // Layout this block into lines
      const blockLines = this.layoutParagraph(block.text, maxWidth, fontSize, fontFamily);
      
      if (blockIndex < 3) { // Log first 3 blocks
        console.log(`📝 Block ${blockIndex}:`, block.text.substring(0, 50) + '...');
        console.log(`   Generated ${blockLines.length} lines`);
      }
      
      // Add spacing before block (except for first block on page)
      const spacingBefore = this.getSpacingBefore(block.type, currentPage.lines.length === 0);
      
      for (let i = 0; i < spacingBefore; i++) {
        if (currentPage.lines.length < maxLinesPerPage) {
          currentPage.lines.push({
            type: 'spacing',
            text: '',
            blockType: block.type
          });
        } else {
          // Page is full, start new page
          pages.push(currentPage);
          currentPage = { lines: [], blocks: [] };
        }
      }
      
      // Add block lines to current page
      for (let lineIndex = 0; lineIndex < blockLines.length; lineIndex++) {
        if (currentPage.lines.length >= maxLinesPerPage) {
          // Page is full, start new page
          pages.push(currentPage);
          currentPage = { lines: [], blocks: [] };
        }
        
        currentPage.lines.push({
          type: 'text',
          text: blockLines[lineIndex],
          blockType: block.type,
          blockIndex: blockIndex,
          lineInBlock: lineIndex,
          htmlTag: block.htmlTag || 'p'
        });
      }
      
      // Track that this block appears on this page
      if (!currentPage.blocks.includes(blockIndex)) {
        currentPage.blocks.push(blockIndex);
      }
      
      // Add spacing after block
      const spacingAfter = this.getSpacingAfter(block.type);
      for (let i = 0; i < spacingAfter; i++) {
        if (currentPage.lines.length < maxLinesPerPage) {
          currentPage.lines.push({
            type: 'spacing',
            text: '',
            blockType: block.type
          });
        }
      }
    }
    
    // Add remaining page if it has content
    if (currentPage.lines.length > 0) {
      pages.push(currentPage);
    }
    
    return pages.length > 0 ? pages : [{ lines: [], blocks: [] }];
  }

  /**
   * Get spacing lines before a block type
   */
  getSpacingBefore(blockType, isFirstOnPage) {
    if (isFirstOnPage) return 0;
    
    switch (blockType) {
      case 'h1':
      case 'h2':
        return 2; // Two blank lines before major headings
      case 'h3':
      case 'h4':
        return 1; // One blank line before minor headings
      case 'p':
      default:
        return 0; // No spacing before paragraphs (handled by spacing after)
    }
  }

  /**
   * Get spacing lines after a block type
   */
  getSpacingAfter(blockType) {
    switch (blockType) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        return 1; // One blank line after headings
      case 'p':
      default:
        return 1; // One blank line after paragraphs
    }
  }

  /**
   * Convert page data to HTML
   */
  pageToHTML(page) {
    // Validate input
    if (!page || !page.lines || !Array.isArray(page.lines)) {
      return '<div class="page-lines"><p>Empty page</p></div>';
    }
    
    let html = '<div class="page-lines">';
    
    let currentBlock = null;
    let currentBlockLines = [];
    
    for (const line of page.lines) {
      // Skip invalid lines
      if (!line) continue;
      
      if (line.type === 'spacing') {
        // Close current block if any
        if (currentBlock !== null && currentBlockLines.length > 0) {
          html += this.wrapBlockLines(currentBlockLines, currentBlock.htmlTag);
          currentBlockLines = [];
          currentBlock = null;
        }
        // Add spacing
        html += '<div class="line-spacing"></div>';
      } else {
        // Check if we need to start a new block
        if (currentBlock === null || 
            currentBlock.blockIndex !== line.blockIndex ||
            currentBlock.htmlTag !== line.htmlTag) {
          
          // Close previous block if any
          if (currentBlock !== null && currentBlockLines.length > 0) {
            html += this.wrapBlockLines(currentBlockLines, currentBlock.htmlTag);
            currentBlockLines = [];
          }
          
          // Start new block
          currentBlock = {
            blockIndex: line.blockIndex,
            htmlTag: line.htmlTag
          };
        }
        
        currentBlockLines.push(line.text);
      }
    }
    
    // Close final block
    if (currentBlock !== null && currentBlockLines.length > 0) {
      html += this.wrapBlockLines(currentBlockLines, currentBlock.htmlTag);
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Wrap lines in appropriate HTML tag
   */
  wrapBlockLines(lines, htmlTag) {
    const className = htmlTag === 'p' ? '' : ' class="' + htmlTag + '"';
    return `<${htmlTag}${className}>${lines.join('<br>')}</${htmlTag}>`;
  }

  /**
   * Calculate which block and line index a page number corresponds to
   * Used for position restoration after re-pagination
   */
  getBlockPositionForPage(pages, targetPageIndex) {
    // Validate inputs
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return { blockIndex: 0, lineInBlock: 0 };
    }
    
    if (targetPageIndex < 0 || targetPageIndex >= pages.length) {
      return { blockIndex: 0, lineInBlock: 0 };
    }
    
    const page = pages[targetPageIndex];
    
    // Validate page structure
    if (!page || !page.lines || !Array.isArray(page.lines)) {
      return { blockIndex: 0, lineInBlock: 0 };
    }
    
    // Find first text line on this page
    for (const line of page.lines) {
      if (line && line.type === 'text' && line.blockIndex !== undefined) {
        return {
          blockIndex: line.blockIndex,
          lineInBlock: line.lineInBlock || 0
        };
      }
    }
    
    // Fallback
    return { blockIndex: 0, lineInBlock: 0 };
  }

  /**
   * Find page index that contains a specific block and line
   */
  findPageForBlockPosition(pages, targetBlockIndex, targetLineInBlock = 0) {
    // Validate inputs
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return 0;
    }
    
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      
      // Validate page structure
      if (!page || !page.lines || !Array.isArray(page.lines)) {
        continue;
      }
      
      for (const line of page.lines) {
        if (line && line.type === 'text' &&
            line.blockIndex === targetBlockIndex &&
            line.lineInBlock === targetLineInBlock) {
          return pageIndex;
        }
      }
    }
    
    // If exact line not found, find page with this block
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      if (page && page.blocks && Array.isArray(page.blocks) && page.blocks.includes(targetBlockIndex)) {
        return pageIndex;
      }
    }
    
    return 0; // Fallback to first page
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextLayoutEngine;
}
