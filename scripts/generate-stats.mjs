import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const date = value => new Date(value).toISOString().slice(0, 10);
const colors = ['#b7ce9e', '#e0c88c', '#8ec5b3', '#d7ac9b', '#94b9cf', '#b7abd0'];
const text = (x, y, value, size = 16, color = '#e4ebdb') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(value)}</text>`;
function card(title, width, height, body, updated) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title><style>text{font-family:Segoe UI,Arial,sans-serif}</style><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="20" fill="#163e35" stroke="#44654c"/>${text(26, 38, title, 21, '#b7ce9e')}${body}${text(26, height - 18, `GitHub API · ${updated} UTC`, 11, '#b2c5a7')}</svg>\n`;
}

export async function paginate(path, request, limit = Infinity) {
  const result = [];
  for (let page = 1; page <= limit; page++) {
    const batch = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid paginated API response');
    result.push(...batch);
    if (batch.length < 100) break;
  }
  return result;
}

export function summarize(user, repos, events, now = new Date()) {
  if (!Number.isInteger(user.followers) || !Array.isArray(repos) || !Array.isArray(events)) throw new Error('Invalid GitHub data');
  const owned = repos.filter(r => !r.private && r.owner?.login?.toLowerCase() === user.login.toLowerCase());
  const original = owned.filter(r => !r.fork);
  const languages = new Map();
  for (const repo of original) if (repo.language) languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
  const days = Array.from({ length: 30 }, (_, i) => ({ date: date(new Date(date(now)).getTime() - (29 - i) * 86400000), count: 0 }));
  const seen = new Set();
  for (const event of events) {
    if (!event.public || seen.has(event.id)) continue;
    seen.add(event.id);
    const day = days.find(d => d.date === date(event.created_at));
    if (day) day.count++;
  }
  return { followers: user.followers, repos: owned.length, original: original.length,
    stars: original.reduce((n, r) => n + r.stargazers_count, 0),
    forks: original.reduce((n, r) => n + r.forks_count, 0),
    languages: [...languages].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    days, updated: date(now) };
}

export function render(data) {
  const metrics = [['Repositori publik', data.repos], ['Repositori non-fork', data.original], ['Stars diterima (non-fork)', data.stars], ['Forks diterima (non-fork)', data.forks], ['Followers', data.followers]];
  const stats = metrics.map(([label, value], i) => text(26, 83 + i * 32, label) + text(375, 83 + i * 32, value, 20, '#b7ce9e')).join('');
  const languages = data.languages.slice(0, 6);
  const total = data.languages.reduce((n, [, count]) => n + count, 0);
  let languageBody = text(26, 62, 'Bahasa utama per repo publik non-fork', 12, '#b2c5a7');
  languageBody += languages.length ? languages.map(([name, count], i) => {
    const y = 88 + i * 27;
    return text(26, y, name, 14) + `<rect x="168" y="${y - 10}" width="${Math.max(2, 153 * count / total)}" height="9" rx="4" fill="${colors[i]}"/>` + text(337, y, `${count} (${Math.round(count / total * 100)}%)`, 12);
  }).join('') : text(26, 118, 'Belum ada bahasa yang terdeteksi.', 14);
  const max = Math.max(1, ...data.days.map(d => d.count));
  let graph = text(26, 66, 'Event publik yang tersedia · 30 hari terakhir (UTC)', 14, '#b2c5a7');
  graph += `<path d="M40 97V233H862" fill="none" stroke="#608063"/>`;
  graph += data.days.map((day, i) => {
    const h = 118 * day.count / max;
    const x = 50 + i * 27;
    return `<rect x="${x}" y="${232 - Math.max(2, h)}" width="18" height="${Math.max(2, h)}" rx="4" fill="${day.count ? '#b7ce9e' : '#355c45'}"><title>${day.date}: ${day.count} event</title></rect>` + (i % 7 === 0 || i === 29 ? text(x - 4, 254, day.date.slice(5), 11) : '');
  }).join('');
  graph += text(26, 282, `${data.days.reduce((n, d) => n + d.count, 0)} event ditampilkan · Puncak: ${max === 1 && !data.days.some(d => d.count) ? 0 : max} event/hari`, 14);
  graph += text(26, 307, 'API dibatasi 300 event terbaru; bukan total commit atau kalender kontribusi lengkap.', 12, '#b2c5a7');
  return { 'stats.svg': card('Jejak di GitHub', 450, 290, stats, data.updated),
    'languages.svg': card('Bahasa di kebun kode', 450, 290, languageBody, data.updated),
    'activity.svg': card('Tumbuh sedikit, setiap hari', 900, 350, graph, data.updated) };
}

async function request(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.github.com${path}`, { headers: {
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'panda-profile-stats',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
    }, signal: AbortSignal.timeout(30000) });
    if (response.ok) return response.json();
    if (response.status < 500 || attempt === 2) throw new Error(`GitHub API ${response.status}: ${path}`);
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
}

async function main() {
  const login = process.env.PROFILE_USERNAME || 'RizaniHusyairi';
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) throw new Error('Invalid GitHub username');
  const [user, repos, events] = await Promise.all([
    request(`/users/${login}`), paginate(`/users/${login}/repos?type=owner`, request),
    paginate(`/users/${login}/events/public`, request, 3)
  ]);
  // Fetch and render everything before touching existing assets. API failures preserve the last snapshot.
  const assets = render(summarize(user, repos, events));
  const directory = fileURLToPath(new URL('../assets/generated/', import.meta.url));
  await mkdir(directory, { recursive: true });
  for (const [name, svg] of Object.entries(assets)) await writeFile(resolve(directory, name), svg);
  console.log(`Generated ${Object.keys(assets).length} SVG cards for ${login}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
