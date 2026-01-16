import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

export class EPUBParser {
  async parse(file) {
    return this.parseEPUB(file);
  }

  async parseEPUB(file) {
    const zip = await JSZip.loadAsync(file);
    const container = await this._getContainerXML(zip);
    const opfPath = this._getOPFPath(container);
    const opf = await this._getOPF(zip, opfPath);
    
    const metadata = this._extractMetadata(opf);
    const spine = this._extractSpine(opf);
    const manifest = this._extractManifest(opf);
    
    // Extract images and cover
    const images = await this._extractImages(zip, manifest, opfPath);
    const coverImage = await this._extractCoverImage(zip, opf, manifest, opfPath, images);
    
    const chapters = await this._extractChapters(zip, spine, manifest, opfPath, images);
    
    return {
      id: this._generateId(),
      title: metadata.title || 'Untitled Book',
      author: metadata.author || 'Unknown Author',
      chapters,
      images,
      coverImage,
      metadata: {
        language: metadata.language,
        publisher: metadata.publisher,
        publishDate: metadata.date,
        description: metadata.description,
      },
      addedDate: new Date().toISOString(),
      currentChapter: 0,
      currentPage: 0,
    };
  }

  async _getContainerXML(zip) {
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('Invalid EPUB: container.xml not found');
    return await containerFile.async('text');
  }

  _getOPFPath(containerXML) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXML, 'text/xml');
    const rootfile = doc.querySelector('rootfile');
    if (!rootfile) throw new Error('Invalid EPUB: rootfile not found');
    return rootfile.getAttribute('full-path') || '';
  }

  async _getOPF(zip, opfPath) {
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error('Invalid EPUB: OPF file not found');
    const opfText = await opfFile.async('text');
    const parser = new DOMParser();
    return parser.parseFromString(opfText, 'text/xml');
  }

  _extractMetadata(opf) {
    const metadata = {};
    const metadataEl = opf.querySelector('metadata');
    
    if (metadataEl) {
      metadata.title = metadataEl.querySelector('title')?.textContent?.trim() || '';
      
      // Try multiple ways to get author
      let author = '';
      const creatorEl = metadataEl.querySelector('creator');
      if (creatorEl) {
        author = creatorEl.textContent?.trim() || '';
      }
      
      // Also try dc:creator namespace
      if (!author) {
        const dcCreatorEl = metadataEl.querySelector('dc\\:creator, creator[xmlns*="dublin"]');
        if (dcCreatorEl) {
          author = dcCreatorEl.textContent?.trim() || '';
        }
      }
      
      metadata.author = author;
      metadata.language = metadataEl.querySelector('language')?.textContent?.trim() || '';
      metadata.publisher = metadataEl.querySelector('publisher')?.textContent?.trim() || '';
      metadata.date = metadataEl.querySelector('date')?.textContent?.trim() || '';
      metadata.description = metadataEl.querySelector('description')?.textContent?.trim() || '';
    }
    
    return metadata;
  }

  _extractSpine(opf) {
    const spine = opf.querySelector('spine');
    if (!spine) return [];
    
    return Array.from(spine.querySelectorAll('itemref'))
      .map(item => item.getAttribute('idref') || '');
  }

  _extractManifest(opf) {
    const manifest = new Map();
    const manifestEl = opf.querySelector('manifest');
    
    if (manifestEl) {
      Array.from(manifestEl.querySelectorAll('item')).forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        if (id && href) manifest.set(id, href);
      });
    }
    
    return manifest;
  }

  async _extractChapters(zip, spine, manifest, opfPath, images) {
    const chapters = [];
    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    for (let i = 0; i < spine.length; i++) {
      const itemId = spine[i];
      const href = manifest.get(itemId);
      
      if (href) {
        const fullPath = basePath + href;
        const file = zip.file(fullPath);
        
        if (file) {
          const content = await file.async('text');
          const cleanContent = this._processImagesInContent(content, images, basePath);
          const title = this._extractChapterTitle(content) || `Chapter ${i + 1}`;
          
          chapters.push({
            id: this._generateId(),
            title,
            content: cleanContent,
            order: i,
          });
        }
      }
    }

    return chapters;
  }

  _cleanHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    doc.querySelectorAll('script, style').forEach(el => el.remove());
    
    const body = doc.querySelector('body');
    return body?.innerHTML || html;
  }

  _extractChapterTitle(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const heading = doc.querySelector('h1, h2, h3');
    return heading?.textContent?.trim() || '';
  }

  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async _extractImages(zip, manifest, opfPath) {
    const images = new Map();
    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    
    // Find all image items in manifest
    for (const [id, href] of manifest) {
      const fullPath = basePath + href;
      const file = zip.file(fullPath);
      
      if (file && this._isImageFile(href)) {
        try {
          const base64 = await file.async('base64');
          const mime = this._guessMimeType(href);
          const imageUrl = `data:${mime};base64,${base64}`;
          
          // Store both relative and absolute paths
          images.set(href, imageUrl);
          images.set(fullPath, imageUrl);
          images.set(id, imageUrl);
        } catch (error) {
          console.warn(`Failed to extract image ${href}:`, error);
        }
      }
    }
    
    return images;
  }

  async _extractCoverImage(zip, opf, manifest, opfPath, images) {
    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    
    // Try multiple ways to find cover image
    
    // Method 1: Check metadata for cover
    const metadataEl = opf.querySelector('metadata');
    if (metadataEl) {
      const coverMeta = metadataEl.querySelector('meta[name="cover"]');
      if (coverMeta) {
        const coverId = coverMeta.getAttribute('content');
        if (images.has(coverId)) {
          return images.get(coverId);
        }
      }
    }
    
    // Method 2: Look for cover.jpg/png in common locations
    const commonCoverPaths = [
      'cover.jpg', 'cover.png', 'Cover.jpg', 'Cover.png',
      'images/cover.jpg', 'images/cover.png',
      'Images/cover.jpg', 'Images/cover.png',
      'OEBPS/images/cover.jpg', 'OEBPS/images/cover.png'
    ];
    
    for (const path of commonCoverPaths) {
      const file = zip.file(path);
      if (file) {
        try {
          const base64 = await file.async('base64');
          const mime = this._guessMimeType(path);
          return `data:${mime};base64,${base64}`;
        } catch (error) {
          console.warn(`Failed to load cover from ${path}:`, error);
        }
      }
    }
    
    // Method 3: Find first image in manifest that might be cover
    for (const [id, href] of manifest) {
      if (href.toLowerCase().includes('cover') && this._isImageFile(href)) {
        if (images.has(id)) {
          return images.get(id);
        }
      }
    }
    
    return null;
  }

  _guessMimeType(filename) {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.bmp')) return 'image/bmp';
    if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg';
    return 'application/octet-stream';
  }

  // Used by the library to repair old imports that stored blob: cover URLs.
  async extractCoverOnly(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      const container = await this._getContainerXML(zip);
      const opfPath = this._getOPFPath(container);
      const opf = await this._getOPF(zip, opfPath);
      const manifest = this._extractManifest(opf);
      const images = await this._extractImages(zip, manifest, opfPath);
      const coverImage = await this._extractCoverImage(zip, opf, manifest, opfPath, images);
      return { coverImage };
    } catch (error) {
      console.error('Error extracting cover:', error);
      return { coverImage: null };
    }
  }

  _isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    const lowerFilename = filename.toLowerCase();
    return imageExtensions.some(ext => lowerFilename.endsWith(ext));
  }

  _processImagesInContent(content, images, basePath) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Remove scripts and styles
    doc.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Process images
    doc.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        // Try to find the image in our extracted images
        let imageUrl = null;
        
        // Try exact match first
        if (images.has(src)) {
          imageUrl = images.get(src);
        } else {
          // Try relative path resolution
          const resolvedPath = this._resolvePath(basePath, src);
          if (images.has(resolvedPath)) {
            imageUrl = images.get(resolvedPath);
          } else {
            // Try without base path
            const cleanSrc = src.replace(/^\.?\//, '');
            if (images.has(cleanSrc)) {
              imageUrl = images.get(cleanSrc);
            }
          }
        }
        
        if (imageUrl) {
          img.setAttribute('src', imageUrl);
          img.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 1rem auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);');
        } else {
          console.warn(`Image not found: ${src}`);
          img.setAttribute('alt', `[Image: ${src}]`);
          img.setAttribute('style', 'display: none;');
        }
      }
    });
    
    const body = doc.querySelector('body');
    return body?.innerHTML || doc.documentElement.innerHTML;
  }

  _resolvePath(basePath, relativePath) {
    // Remove leading './' if present
    const cleanPath = relativePath.replace(/^\.?\//, '');
    return basePath + cleanPath;
  }
}
