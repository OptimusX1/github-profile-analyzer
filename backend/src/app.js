const path = require("path");

// Load environment variables from the .env file
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { summarizeRepos, githubGet, readRateLimit } = require("./repoSummary");
const app = express();

app.use(cors({
  origin: "https://github-profile-analyzer-neon-seven.vercel.app"
}));

app.use(express.json());

app.post("/api/analyze", async (req, res) => {

  try {
    // Extract the GitHub username from the request body
    const userName = req.body.userName;
    console.log(`req: ${JSON.stringify(userName)}`);

    const response = await githubGet(
      `https://api.github.com/users/${encodeURIComponent(userName)}`,
    );
    console.log("GitHub rate limit:", readRateLimit(response));

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error("GitHub user lookup failed:", response.status, body.message || body);
      const error = new Error(response.status === 404 ? "User not found" : "GitHub request failed");
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const reposResponse = await githubGet(
      `https://api.github.com/users/${encodeURIComponent(userName)}/repos?per_page=100&sort=updated`,
    );

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

    res.json({
      ...data,
      languages: summarized.languages,
      languageScope: summarized.languageScope,
      notice: summarized.notice,
      repos: summarized.repos,
    });
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



const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});