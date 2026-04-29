import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

export interface TestPage {
  path: string;
  content: string;
  contentType?: string;
}

export interface TestServer {
  url: string;
  server: Server;
  stop: () => Promise<void>;
}

export function startTestServer(pages: TestPage[]): Promise<TestServer> {
  return new Promise((resolve) => {
    const pageMap = new Map<string, TestPage>();
    for (const p of pages) {
      pageMap.set(p.path, p);
    }

    const server = createServer((req, res) => {
      const path = req.url?.split('?')[0] || '/';
      const page = pageMap.get(path);

      if (page) {
        res.writeHead(200, { 'Content-Type': page.contentType || 'text/html' });
        res.end(page.content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        server,
        stop: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
