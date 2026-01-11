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
    
    const chapters = await this._extractChapters(zip, spine, manifest, opfPath);
    
    return {
      id: this._generateId(),
      title: metadata.title || 'Untitled Book',
      author: metadata.author || 'Unknown Author',
      chapters,
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
      metadata.title = metadataEl.querySelector('title')?.textContent || '';
      metadata.author = metadataEl.querySelector('creator')?.textContent || '';
      metadata.language = metadataEl.querySelector('language')?.textContent || '';
      metadata.publisher = metadataEl.querySelector('publisher')?.textContent || '';
      metadata.date = metadataEl.querySelector('date')?.textContent || '';
      metadata.description = metadataEl.querySelector('description')?.textContent || '';
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

  async _extractChapters(zip, spine, manifest, opfPath) {
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
          const cleanContent = this._cleanHTML(content);
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
}
