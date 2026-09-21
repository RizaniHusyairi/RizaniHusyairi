import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate, summarize, render } from './generate-stats.mjs';

test('pagination continues past 100 items and respects event cap', async () => {
  const paths = [];
  const rows = await paginate('/repos?type=owner', async path => {
    paths.push(path);
    return Array(paths.length === 1 ? 100 : 2).fill({});
  });
  assert.equal(rows.length, 102);
  assert.match(paths[1], /&per_page=100&page=2$/);
  assert.equal((await paginate('/events', async () => Array(100).fill({}), 3)).length, 300);
});

test('public owned repos, non-fork languages, deduplicated UTC events', () => {
  const repo = { owner: { login: 'panda' }, private: false, fork: false, language: 'C<&', stargazers_count: 3, forks_count: 2 };
  const event = { id: '1', public: true, created_at: '2026-09-21T01:00:00Z' };
  const summary = summarize({ login: 'Panda', followers: 7 }, [repo, { ...repo, fork: true }, { ...repo, private: true }, { ...repo, owner: { login: 'other' } }], [event, event, { ...event, id: '2', public: false }, { ...event, id: '3', created_at: '2026-08-01T00:00:00Z' }], new Date('2026-09-21T12:00:00Z'));
  assert.equal(summary.repos, 2);
  assert.equal(summary.stars, 3);
  assert.deepEqual(summary.languages, [['C<&', 1]]);
  assert.equal(summary.days.length, 30);
  assert.equal(summary.days.reduce((n, d) => n + d.count, 0), 1);
  assert.equal(summary.days.at(-1).count, 1);
  assert.match(render(summary)['languages.svg'], /C&lt;&amp;/);
});

test('empty data generates valid numeric coordinates and honest empty state', () => {
  const output = render(summarize({ login: 'panda', followers: 0 }, [], [], new Date('2026-09-21T00:00:00Z')));
  assert.equal(Object.keys(output).length, 3);
  for (const svg of Object.values(output)) assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  assert.match(output['languages.svg'], /Belum ada bahasa/);
  assert.match(output['activity.svg'], /0 event ditampilkan/);
});
