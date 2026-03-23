import { Readability } from "@mozilla/readability";
import { normalizeWhitespace, segmentSentences } from "@veritas/shared";
import { JSDOM } from "jsdom";

import { AppError } from "../lib/errors.js";

type FetchLike = typeof fetch;

export interface DiscoveredImage {
  url: string;
  alt?: string;
  title?: string;
  host?: string;
}

export interface IngestedSource {
  sourceText: string;
  sentences: string[];
  images: DiscoveredImage[];
  warnings: string[];
}

function absolutizeUrl(source: string | null | undefined, baseUrl: string): string | null {
  if (!source) {
    return null;
  }

  try {
    return new URL(source, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractImages(document: Document, baseUrl: string): DiscoveredImage[] {
  const images = Array.from(document.querySelectorAll("img")).map((image): DiscoveredImage | null => {
      const url = absolutizeUrl(image.getAttribute("src"), baseUrl);
      if (!url) {
        return null;
      }

      return {
        url,
        alt: image.getAttribute("alt") ?? undefined,
        title: image.getAttribute("title") ?? undefined,
        host: new URL(url).hostname
      };
    });

  return images.filter((image): image is DiscoveredImage => image !== null).slice(0, 3);
}

export function extractReadableContent(html: string, baseUrl: string): {
  text: string;
  images: DiscoveredImage[];
} {
  const dom = new JSDOM(html, { url: baseUrl });
  const images = extractImages(dom.window.document, baseUrl);

  const articleDom = new JSDOM(html, { url: baseUrl });
  const article = new Readability(articleDom.window.document).parse();

  const readableText = normalizeWhitespace(`${article?.title ?? ""} ${article?.textContent ?? ""}`);
  const fallbackText = normalizeWhitespace(dom.window.document.body?.textContent ?? "");

  return {
    text: readableText.length >= 280 ? readableText : fallbackText,
    images
  };
}

export async function ingestSource({
  inputText,
  inputUrl,
  fetchImpl = fetch
}: {
  inputText?: string;
  inputUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<IngestedSource> {
  const warnings: string[] = [];
  const providedText = normalizeWhitespace(inputText ?? "");
  let extractedText = "";
  let images: DiscoveredImage[] = [];

  if (inputUrl) {
    try {
      const response = await fetchImpl(inputUrl, {
        headers: {
          "User-Agent": "VeritasPrototype/0.1 (+https://localhost)",
          Accept: "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        warnings.push(`Unable to fetch the provided URL (${response.status}).`);
      } else {
        const html = await response.text();
        const extracted = extractReadableContent(html, inputUrl);
        extractedText = extracted.text;
        images = extracted.images;

        if (!extracted.text) {
          warnings.push("The URL was fetched, but readable article text could not be extracted cleanly.");
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Failed to fetch URL content: ${error.message}`
          : "Failed to fetch URL content."
      );
    }
  }

  const baseText = providedText || extractedText || "";
  const mergedText =
    providedText && extractedText && providedText.length < 280
      ? normalizeWhitespace(`${providedText} ${extractedText}`)
      : baseText;

  if (!mergedText) {
    throw new AppError("No readable input text was available for analysis.", 422);
  }

  return {
    sourceText: mergedText,
    sentences: segmentSentences(mergedText),
    images,
    warnings
  };
}
