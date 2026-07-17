import Parser from 'rss-parser';

export class NewsService {
  private static instance: NewsService;
  private parser: Parser;

  private constructor() {
    this.parser = new Parser({
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
  }

  public static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  public async getLatestCryptoNews(limit: number = 50): Promise<any[]> {
    const feeds = [
      'https://cointelegraph.com/rss'
    ];

    let allNews: any[] = [];

    for (const feed of feeds) {
      try {
        const parsed = await this.parser.parseURL(feed);
        if (parsed && parsed.items) {
          const mapped = parsed.items.map(item => ({
            title: item.title || '',
            pubDate: item.pubDate || new Date().toISOString(),
            content: item.contentSnippet || item.content || '',
            source: parsed.title || 'Crypto News'
          }));
          allNews = [...allNews, ...mapped];
        }
      } catch (e) {
        console.error(`[NewsService] Failed to fetch RSS feed: ${feed}`, e);
      }
    }

    // Sort by date descending
    allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return allNews.slice(0, limit);
  }
}
