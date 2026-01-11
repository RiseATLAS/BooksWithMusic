export class Pagination {
  private containerWidth: number = 700;
  private fontSize: number = 18;
  private lineHeight: number = 1.6;
  private linesPerPage: number = 30;

  setContainerWidth(width: number): void {
    this.containerWidth = width;
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  setLineHeight(height: number): void {
    this.lineHeight = height;
  }

  calculatePages(content: string): number {
    const avgCharsPerLine = Math.floor(this.containerWidth / (this.fontSize * 0.6));
    const totalLines = Math.ceil(content.length / avgCharsPerLine);
    return Math.ceil(totalLines / this.linesPerPage);
  }

  getPageContent(content: string, pageNumber: number): string {
    const charsPerPage = this.containerWidth * this.linesPerPage;
    const start = pageNumber * charsPerPage;
    const end = start + charsPerPage;
    return content.slice(start, end);
  }
}
