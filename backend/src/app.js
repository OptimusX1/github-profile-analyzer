const path = require("path");

// Load environment variables from the .env file
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { summarizeRepos, githubGet, readRateLimit } = require("./repoSummary");
const { log } = require("console");
const app = express();
const ANALYSIS_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_ANALYSIS_CACHE_ENTRIES = 500;
const analysisCache = new Map();

const FRONTEND_ORIGINS = [
  "http://localhost:4200",
  "https://github-profile-analyzer-neon-seven.vercel.app",
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
}));

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "github-profile-analyzer" });
});

app.post("/api/analyze", async (req, res) => {
  // console.log(`Received analyze request for user: ${JSON.stringify(req.body.userName)}`);

  try {
    // Extract the GitHub username from the request body
    const userName = req.body.userName;
    console.log(`req: ${JSON.stringify(userName)}`);

    const cachedAnalysis = getCachedAnalysis(userName);
    if (cachedAnalysis) {
      console.log(`Analysis cache hit for ${userName}`);
      return res.json(cachedAnalysis);
    }

    //first call to get user profile information from GitHub
    const response = await githubGet(
      `https://api.github.com/users/${encodeURIComponent(userName)}`,
    );
    console.log(`https://api.github.com/users/${encodeURIComponent(userName)}`);   
    console.log("GitHub rate limit:", readRateLimit(response));

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error("GitHub user lookup failed:", response.status, body.message || body);
      const error = new Error(response.status === 404 ? "User not found" : "GitHub request failed");
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    //second call to get user repositories from GitHub
    const reposResponse = await githubGet(
      `https://api.github.com/users/${encodeURIComponent(userName)}/repos?per_page=100&sort=updated`,
    );
    console.log(`https://api.github.com/users/${encodeURIComponent(userName)}/repos?per_page=100&sort=updated`);

    if (!reposResponse.ok) {
      const body = await reposResponse.json().catch(() => ({}));
      console.error("GitHub repo lookup failed:", reposResponse.status, body.message || body);
      throw new Error("Could not load repositories");
    }

    const repos = await reposResponse.json();
    const summarized = await summarizeRepos(repos, userName);
    console.log(
      summarized.repos
        .map((repo) => `${repo.name}: ${(repo.languagesUsed || []).join(", ") || "no language detected"}`)
        .join("\n"),
    );

    const analysis = {
      ...data,
      languages: summarized.languages,
      languageScope: summarized.languageScope,
      notice: summarized.notice,
      repos: summarized.repos,
    };
    setCachedAnalysis(userName, analysis);
    res.json(analysis);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    const rateLimited = Boolean(error.rateLimited);
    res.status(rateLimited ? 429 : error.status || 500).json({
      error: rateLimited
        ? "GitHub API rate limit reached. Wait until the limit resets, or add a GITHUB_TOKEN."
        : error.message || "Failed to fetch GitHub profile",
    });
  }
});


function getCachedAnalysis(userName) {
  const key = analysisCacheKey(userName);
  if (!key) {
    return null;
  }

  const cached = analysisCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    analysisCache.delete(key);
    return null;
  }

  analysisCache.delete(key);
  analysisCache.set(key, cached);
  return cached.analysis;
}

function setCachedAnalysis(userName, analysis) {
  const key = analysisCacheKey(userName);
  if (!key) {
    return;
  }

  const now = Date.now();
  for (const [cachedKey, cached] of analysisCache) {
    if (now >= cached.expiresAt) {
      analysisCache.delete(cachedKey);
    }
  }

  analysisCache.delete(key);
  while (analysisCache.size >= MAX_ANALYSIS_CACHE_ENTRIES) {
    analysisCache.delete(analysisCache.keys().next().value);
  }

  analysisCache.set(key, {
    analysis,
    expiresAt: now + ANALYSIS_CACHE_MS,
  });
}

// Helper function to generate a cache key for a given username
function analysisCacheKey(userName) {
  if (typeof userName !== "string") {
    return null;
  }

  const key = userName.trim().toLowerCase();
  return key || null;
}


function isAllowedOrigin(origin) {
  if (FRONTEND_ORIGINS.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".vercel.app") &&
      url.hostname.includes("github-profile-analyzer")
    );
  } catch {
    return false;
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});