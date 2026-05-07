import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { runBacklog } from "./backlog";

export interface DocSummary {
  id: string;
  title: string;
}

export interface DocContent {
  id: string;
  title: string;
  type: string;
  created: string;
  body: string;
  filePath: string;
}

export function parseDocList(output: string): DocSummary[] {
  const docs: DocSummary[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(doc-[\w-]+)\s+-\s+(.+)$/);
    if (!match) continue;
    docs.push({ id: match[1], title: match[2] });
  }
  return docs;
}

export async function listDocs(projectDir: string): Promise<DocSummary[]> {
  const stdout = await runBacklog(["doc", "list", "--plain"], projectDir);
  if (stdout.trim().toLowerCase().startsWith("no docs")) return [];
  return parseDocList(stdout);
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const meta: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key) meta[key] = value;
  }
  return { meta, body };
}

export async function readDocFile(docId: string, projectDir: string): Promise<DocContent> {
  const docsDir = join(projectDir, "backlog", "docs");
  const entries = await readdir(docsDir);
  const prefix = `${docId} - `;
  const filename = entries.find((name) => name.startsWith(prefix) && name.endsWith(".md"));
  if (!filename) {
    throw new Error(`Could not find document file for ${docId} in ${docsDir}`);
  }
  const filePath = join(docsDir, filename);
  const raw = await readFile(filePath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  return {
    id: meta.id || docId,
    title: meta.title || filename.replace(prefix, "").replace(/\.md$/, ""),
    type: meta.type || "",
    created: meta.created_date || "",
    body,
    filePath,
  };
}
