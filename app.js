require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const LEAGUE_ID = 2295537;

const STATE_FILE = path.join(process.cwd(), 'state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastPostedGW: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
}

async function fetchEvents() {
  const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
  if (!res.ok) throw new Error(`FPL events HTTP ${res.status}`);
  return res.json();
}

async function fetchLeague() {
  const res = await fetch(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/?page_standings=1`);
  if (!res.ok) throw new Error(`FPL league HTTP ${res.status}`);
  return res.json();
}

function formatGW(results) {
  const sorted = [...results].sort((a, b) => b.event_total - a.event_total);
  const TOP_N = 5;
  let message = `⚡ Current Gameweek Leaders:\n\n\n`;
  sorted.slice(0, TOP_N).forEach((t, i) => {
    const emoji = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i === TOP_N - 1 ? '🗑️' : '🙂');
    message += `${emoji}  ${t.player_name}, *${t.entry_name}*, ${t.event_total} pts\n\n`;
  });
  return message;
}

function formatSeason(results) {
  const sorted = [...results].sort((a, b) => b.total - a.total);
  const TOP_N = 5;
  let message = `🏆 Season Standings:\n\n\n`;
  sorted.slice(0, TOP_N).forEach((t, i) => {
    const emoji = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i === TOP_N - 1 ? '☹️' : '🙂');
    message += `${emoji}  ${t.player_name}, *${t.entry_name}*, ${t.total} pts\n\n`;
  });
  return message;
}

function getLatestCompletedEvent(events, { requireDataChecked = true } = {}) {
  const now = Date.now();
  const completed = events
    .filter(e =>
      e.finished === true &&
      new Date(e.deadline_time).getTime() <= now &&
      (!requireDataChecked || e.data_checked === true)
    )
    .sort((a, b) => a.id - b.id);
  return completed[completed.length - 1] || null;
}

async function postGWAndSeason(gwId, results) {
  const gwMessage = formatGW(results);
  const seasonMessage = formatSeason(results);

  await client.chat.postMessage({ channel: CHANNEL_ID, text: gwMessage, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: gwMessage } }] });
  await client.chat.postMessage({ channel: CHANNEL_ID, text: '────────────────────────────', blocks: [{ type: 'section', text: { type: 'plain_text', text: ' ' } }] });
  await client.chat.postMessage({ channel: CHANNEL_ID, text: seasonMessage, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: seasonMessage } }] });

  console.log(`Posted GW${gwId} + season standings`);
}

async function checkAndPost() {
  const state = loadState();
  const data = await fetchEvents();
  const latest = getLatestCompletedEvent(data.events, { requireDataChecked: true });
  if (!latest) return;
  if (state.lastPostedGW === latest.id) return;

  const league = await fetchLeague();
  await postGWAndSeason(latest.id, league.standings.results);
  state.lastPostedGW = latest.id;
  saveState(state);
}

cron.schedule('0 * * * *', checkAndPost);
