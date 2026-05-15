// Generate per-store listing copy from store/listing.data.js.
//
// Output: dist/store/{chrome,edge}.md
//
// Each file contains the listing copy for one store. Code-fenced blocks are
// the verbatim text to paste into the store submission form.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import listing from "../store/listing.data.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "dist", "store");

mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "chrome.md"), renderChrome(listing));
writeFileSync(join(outDir, "edge.md"), renderEdge(listing));

console.log(`Wrote ${outDir}/{chrome,edge}.md`);

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function fence(text) {
  return "```\n" + text + "\n```";
}

function header(store) {
  return `# ${store} listing — ${listing.meta.name}

> Generated from \`store/listing.data.js\`. Do not edit by hand.
`;
}

function renderChrome(l) {
  const justifications = l.chrome.permissionJustifications
    .map(
      (permission) =>
        `**${permission.permission}**

${fence(permission.justification)}

_(${permission.justification.length} chars)_`,
    )
    .join("\n\n");

  const reviewerNotes = [
    l.reviewerNotes.intro,
    "",
    bullets(l.reviewerNotes.verification),
    "",
    l.reviewerNotes.closingNote,
  ].join("\n");

  return `${header("Chrome Web Store")}
## Product details

**Name:**

${fence(l.meta.name)}

**Short description (132 char limit):**

${fence(l.copy.shortDescription)}

_(${l.copy.shortDescription.length} chars)_

**Version notes:**

${fence(l.copy.versionNotes)}

---

## Store listing

### Description (16,000 char limit)

${fence(l.copy.detailedDescription)}

_(${l.copy.detailedDescription.length} chars)_

### Category

${l.categories.chrome}

### Language

${l.meta.language}

### Official URL

${l.meta.officialUrl}

### Homepage URL

${l.meta.homepageUrl}

### Support URL

${l.meta.supportUrl}

---

## Privacy

### Single purpose (1,000 char limit)

${fence(l.chrome.singlePurpose)}

_(${l.chrome.singlePurpose.length} chars)_

### Permission justifications (1,000 char limit each)

${justifications}

### Remote code justification

${fence(l.chrome.remoteCodeJustification)}

_(${l.chrome.remoteCodeJustification.length} chars)_

### Privacy policy URL

${l.meta.privacyPolicyUrl}

---

## Test instructions

### Additional instructions

${reviewerNotes}
`;
}

function renderEdge(l) {
  const totalWords = l.edge.searchTerms.reduce(
    (count, term) => count + term.split(/\s+/).length,
    0,
  );

  const certificationNotes = [
    l.reviewerNotes.intro,
    "",
    bullets(l.reviewerNotes.verification),
    "",
    l.reviewerNotes.closingNote,
  ].join("\n");

  return `${header("Edge Add-ons")}
## Properties

### 1. Category (1 only)

${l.categories.edge}

### Support Details

**1. Does this product access, collect, or transmit personal information?**

**No** — the extension stores only user preferences via the browser's built-in
sync storage. No personal data is collected or transmitted.

**2. Privacy policy URL**

${l.meta.privacyPolicyUrl}

**3. Website**

${l.meta.homepageUrl}

**4. Support contact detail**

${l.meta.supportUrl}

## Store Listing

### 1. Description

${fence(l.copy.detailedDescription)}

_(${l.copy.detailedDescription.length} chars)_

### 2. YouTube video URL

_(not set — optional)_

### 3. Search terms

<!-- Edge: max 7 terms · 30 chars per term · 21 words total -->

${bullets(l.edge.searchTerms)}

_Total: ${totalWords} words_

## Submission

### 1. Notes for certification (less than 2,000 characters)

${fence(certificationNotes)}

_(${certificationNotes.length} chars)_
`;
}
