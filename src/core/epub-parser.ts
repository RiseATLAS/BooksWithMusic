import JSZip from 'jszip';
import { Book, Chapter } from '../types/interfaces';

export class EPUBParser {
  async parseEPUB(file: File): Promise<Book> {
    const zip = await JSZip.loadAsync(file);
    const container = await this.getContainerXML(zip);
    const opfPath = this.getOPFPath(container);
    const opf = await this.getOPF(zip, opfPath);
    
    const metadata = this.extractMetadata(opf);
    const spine = this.extractSpine(opf);
    const manifest = this.extractManifest(opf);
    
    const chapters = await this.extractChapters(zip, spine, manifest, opfPath);
    
    const book: Book = {
      id: this.generateId(),
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

    return book;
  }

  private async getContainerXML(zip: JSZip): Promise<string> {
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('Invalid EPUB: container.xml not found');
    return await containerFile.async('text');
  }

  private getOPFPath(containerXML: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXML, 'text/xml');
    const rootfile = doc.querySelector('rootfile');
    if (!rootfile) throw new Error('Invalid EPUB: rootfile not found');
    return rootfile.getAttribute('full-path') || '';
  }

  private async getOPF(zip: JSZip, opfPath: string): Promise<Document> {
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error('Invalid EPUB: OPF file not found');
    const opfText = await opfFile.async('text');
    const parser = new DOMParser();
    return parser.parseFromString(opfText, 'text/xml');
  }

  private extractMetadata(opf: Document): any {
    const metadata: any = {};
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

  private extractSpine(opf: Document): string[] {
    const spine = opf.querySelector('spine');
    if (!spine) return [];
    
    return Array.from(spine.querySelectorAll('itemref'))
      .map(item => item.getAttribute('idref') || '');
  }

  private extractManifest(opf: Document): Map<string, string> {
    const manifest = new Map<string, string>();
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

  private async extractChapters(
    zip: JSZip,
    spine: string[],
    manifest: Map<string, string>,
    opfPath: string
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    for (let i = 0; i < spine.length; i++) {
      const itemId = spine[i];
      const href = manifest.get(itemId);
      
      if (href) {
        const fullPath = basePath + href;
        const file = zip.file(fullPath);
        
        if (file) {
          const content = await file.async('text');
          const cleanContent = this.cleanHTML(content);
          const title = this.extractChapterTitle(content) || `Chapter ${i + 1}`;
          
          chapters.push({
            id: this.generateId(),
            title,
            content: cleanContent,
            order: i,
          });
        }
      }
    }

    return chapters;
  }

  private cleanHTML(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove scripts and styles
    doc.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Get body content
    const body = doc.querySelector('body');
    return body?.innerHTML || html;
  }

  private extractChapterTitle(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const heading = doc.querySelector('h1, h2, h3');
    return heading?.textContent?.trim() || '';
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
