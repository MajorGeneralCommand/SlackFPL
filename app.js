require('dotenv').config();
const { WebClient } = require('@slack/web-api');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const LEAGUE_ID = 2295537;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const TOP_N = 5;

async function fetchStandings() {
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/?page_standings=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FPL HTTP ${res.status}`);
  return res.json();
}

function emojiForGW(i, total, topN) {
  if (i === 0) return '👑';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  const cutoff = topN ?? total;
  if (i === cutoff - 1) return '🗑️';
  return '🙂';
}

function emojiForSeason(i, total, topN) {
  if (i === 0) return '👑';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  const cutoff = topN ?? total;
  if (i === cutoff - 1) return '☹️';
  return '🙂';
}

function formatGW(results) {
  const sorted = [...results].sort((a, b) => b.event_total - a.event_total);
  const cutoff = TOP_N ?? sorted.length;
  let message = `⚡ Current Gameweek Leaders:\n\n\n`;
  sorted.slice(0, cutoff).forEach((t, i) => {
    const emoji = emojiForGW(i, sorted.length, cutoff);
    message += `${emoji}  ${t.player_name}, *${t.entry_name}*, ${t.event_total} pts\n\n`;
  });
  return message;
}

function formatSeason(results) {
  const sorted = [...results].sort((a, b) => b.total - a.total);
  const cutoff = TOP_N ?? sorted.length;
  let message = `🏆 League Standings:\n\n\n`;
  sorted.slice(0, cutoff).forEach((t, i) => {
    const emoji = emojiForSeason(i, sorted.length, cutoff);
    message += `${emoji}  ${t.player_name}, *${t.entry_name}*, ${t.total} pts\n\n`;
  });
  return message;
}

async function postMessages() {
  const data = await fetchStandings();
  const results = data.standings.results;
  const gwMessage = formatGW(results);
  const seasonMessage = formatSeason(results);

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: gwMessage,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: gwMessage } }]
  });

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: "────────────────────────────",
    blocks: [{ type: 'section', text: { type: 'plain_text', text: " " } }]
  });

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: seasonMessage,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: seasonMessage } }]
  });

  console.log('Posted GW, spacer, and Season messages.');
}

postMessages().catch(console.error);
