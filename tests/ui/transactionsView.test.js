import { describe, expect, it, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";

// We'll load the HTML to ensure DOM structure exists. JS behavior is limited; we mock fetch.
const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

describe("Transactions view", () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
    window = dom.window;
    document = dom.window.document;
    global.window = window;
    global.document = document;
    global.fetch = vi.fn();
  });

  it("renders classified column header", () => {
    const header = document.querySelector(".classified-col");
    expect(header).toBeTruthy();
  });
});
