# Panda profile statistics

Run `node scripts/generate-stats.mjs` with Node.js 22 or newer. No npm dependencies are required. `PROFILE_USERNAME` defaults to `RizaniHusyairi`; optional `GITHUB_TOKEN` raises the API rate limit. Never put a token in a file or commit.

The workflow runs daily at 01:23 UTC (09:23 WITA), on generator changes pushed to main, or manually using **Actions → Update Panda Profile Stats → Run workflow**. It uses the repository's built-in token; no personal token is required. Enable GitHub Actions in repository settings. If branch protection prevents bot pushes, use a pull-request publishing flow rather than disabling protection.

Three SVG snapshots are saved under `assets/generated/`. Failed API requests fail the job before replacing images, so the previous committed snapshot stays visible. Dates printed on the cards show snapshot freshness. Scheduled workflows may be delayed or disabled by GitHub after prolonged repository inactivity; a manual run restores updates.

Metrics are deliberately public-only:

- Repository count includes owned public forks. Received stars/forks exclude forked repositories.
- Languages count the primary language of each owned public non-fork repository, not lines of code or bytes. Only the top six appear; percentages use all repositories with a detected language.
- Activity counts public events returned by GitHub over the displayed 30 UTC dates, with a maximum of 300 recent events. These are not commit totals or the full contribution calendar. Missing events are not evidence of inactivity; API results can be delayed.

The old external streak/trophy cards are removed to avoid another dependency on public image servers. The existing contribution snake workflow is separate and unchanged.

References: [repository API](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user), [events API limits](https://docs.github.com/en/rest/activity/events#about-github-events).

Tests: `node --test scripts/generate-stats.test.mjs`.
