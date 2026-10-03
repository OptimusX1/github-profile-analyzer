const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRepoSummary,
  chooseLanguageTotals,
  describeLanguages,
  excerptFromReadme,
} = require("./repoSummary");

test("summarizes what a repository is about and which languages it uses", () => {
  const summary = buildRepoSummary({
    description: "Prints a greeting from a sample app",
    readmeExcerpt: null,
    topics: [],
    fork: false,
    languages: { JavaScript: 80, CSS: 20 },
    primaryLanguage: "JavaScript",
  });

  assert.match(summary, /Prints a greeting from a sample app/);
  assert.match(summary, /JavaScript \(80%\)/);
  assert.match(summary, /CSS \(20%\)/);
});

test("lists every language used by a repository", () => {
  const described = describeLanguages({ TypeScript: 80, HTML: 15, CSS: 5 }, "TypeScript");

  assert.deepEqual(described.languagesUsed, ["TypeScript", "HTML", "CSS"]);
  assert.equal(described.language, "TypeScript");
  assert.equal(described.languages.HTML, 15);
});

test("uses the README when the description is missing", () => {
  const excerpt = excerptFromReadme(`
# badges
![build](https://img.shields.io/badge/build-passing)

A small tool that converts profile data into a readable brief for developers.
`);

  const summary = buildRepoSummary({
    description: null,
    readmeExcerpt: excerpt,
    topics: [],
    fork: false,
    languages: { TypeScript: 100 },
    primaryLanguage: null,
  });

  assert.match(summary, /converts profile data into a readable brief/);
  assert.match(summary, /Written in TypeScript/);
});

test("labels a fork in its summary", () => {
  const summary = buildRepoSummary({
    description: "A copy of an upstream project",
    readmeExcerpt: null,
    topics: [],
    fork: true,
    languages: { Python: 100 },
    primaryLanguage: "Python",
  });

  assert.match(summary, /^Fork\./);
});

test("keeps fork language bytes out of the original breakdown", () => {
  const chosen = chooseLanguageTotals({ JavaScript: 100 }, { JavaScript: 100, C: 100000 }, 1);

  assert.equal(chosen.includedForks, false);
  assert.deepEqual(chosen.languages, { JavaScript: 100 });
});

test("falls back to all repositories when originals have no languages", () => {
  const chosen = chooseLanguageTotals({}, { C: 100000 }, 2);

  assert.equal(chosen.includedForks, true);
  assert.deepEqual(chosen.languages, { C: 100000 });
});
