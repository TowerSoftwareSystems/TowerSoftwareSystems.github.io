// Zero-dependency static server for site/, close enough to GitHub Pages for local
// review and for the accessibility scan: loopback only, the right content types,
// /dir/ -> /dir/index.html, and 404.html with status 404 for anything missing.
//
//   npm run serve                     http://127.0.0.1:4321/
//   PORT=8080 npm run serve           another port (POSIX shell)
//   $env:PORT=8080; npm run serve     another port (PowerShell)
//
// scripts/validate-a11y.mjs imports startServer() and asks for port 0, so the scan
// never collides with a server you already have running.
import { createServer } from "node:http";
import { realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const siteRoot = resolve(fileURLToPath(new URL("../site/", import.meta.url)));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

// Resolves a URL path to a file inside siteRoot, or null. Anything that decodes to a
// path outside the root (../, an encoded %2e%2e, a drive letter, a NUL byte) is null,
// and so is a colon, which on Windows would open an NTFS stream (styles.css::$DATA)
// that GitHub Pages would never serve.
async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\") || decoded.includes(":")) return null;
  const candidate = resolve(siteRoot, "." + decoded);
  const fromRoot = relative(siteRoot, candidate);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  // A path that resolves to the root itself without a trailing slash (/..%2fsite)
  // would otherwise try siteRoot + ".html", a file beside site/ rather than in it.
  if (fromRoot === "" && !decoded.endsWith("/")) return null;

  const tries = decoded.endsWith("/") ? [join(candidate, "index.html")] : [candidate, candidate + ".html"];
  for (const file of tries) {
    try {
      if ((await stat(file)).isFile()) return { file };
    } catch {
      // Try the next candidate.
    }
  }
  // A directory requested without its trailing slash: redirect, as GitHub Pages does.
  if (!decoded.endsWith("/")) {
    try {
      // Built from the normalised path, never the raw one, so /.//host cannot become a
      // protocol-relative redirect to //host/.
      if ((await stat(join(candidate, "index.html"))).isFile()) return { redirect: "/" + fromRoot.split(sep).map(encodeURIComponent).join("/") + "/" };
    } catch {
      // Not a directory with an index either.
    }
  }
  return null;
}

async function handle(request, response) {
  const headers = { "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { ...headers, Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed\n");
    return;
  }

  const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
  const found = await resolveFile(pathname);

  if (found?.redirect) {
    response.writeHead(301, { ...headers, Location: found.redirect });
    response.end();
    return;
  }

  const status = found ? 200 : 404;
  const file = found ? found.file : join(siteRoot, "404.html");
  let body;
  try {
    body = await readFile(file);
  } catch {
    response.writeHead(500, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
    response.end("Could not read the requested file\n");
    return;
  }
  response.writeHead(status, {
    ...headers,
    "Content-Type": contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": body.length,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

export function startServer(port = 4321, host = "127.0.0.1") {
  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolvePromise(server));
  });
}

// Node resolves the main module through symlinks and junctions, so compare real paths;
// comparing against the unresolved argv[1] would make an aliased launch a silent no-op.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const raw = process.env.PORT ?? "4321";
  const port = /^\d{1,5}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`PORT must be an integer from 0 to 65535; got ${process.env.PORT}`);
    process.exit(1);
  }
  let server;
  try {
    server = await startServer(port);
  } catch (error) {
    console.error(error?.code === "EADDRINUSE" ? `Port ${port} is in use; set PORT to another port.` : String(error));
    process.exit(1);
  }
  console.log(`Serving site/ at http://127.0.0.1:${server.address().port}/ (Ctrl+C to stop)`);
}
