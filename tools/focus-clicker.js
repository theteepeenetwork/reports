#!/usr/bin/env node
/* =====================================================================
   focus-clicker.js — turns the Focus Remote into a slide clicker.
   Owner: Board (docs/OWNERSHIP.md)

   Run it on the computer that is showing the slides:

     node focus-clicker.js https://<your-hub>/api/focus/<room>

   (focus.html › Set up › PowerPoint clicker shows the exact line.)
   It listens to the same stream as the iPad and, on "next" / "prev" from
   the watch, presses Page Down / Page Up — what PowerPoint, Keynote,
   Google Slides and PDF viewers all take as next / previous slide, and what
   a shop-bought clicker sends. Add --arrows to press → / ← instead.

   No dependencies. Windows: SendKeys through one long-lived PowerShell.
   macOS: System Events (allow Terminal once under Privacy & Security ›
   Accessibility). Linux: xdotool.
   ===================================================================== */
'use strict';
const http = require('http');
const https = require('https');
const { spawn, execFile } = require('child_process');

const args = process.argv.slice(2);
const ARROWS = args.includes('--arrows');
const base = String(args.find(function (a) { return !a.startsWith('--'); }) || '').replace(/\/+$/, '').replace(/\/events$/, '');
if (!/^https?:\/\/[^/]+\/api\/focus\/[A-Za-z0-9_-]{16,64}$/.test(base)) {
  console.error('Usage: node focus-clicker.js https://<your-hub>/api/focus/<room> [--arrows]\n' +
    'Copy the exact line from Focus › Set up › PowerPoint clicker.');
  process.exit(1);
}

/* ---------- pressing keys ---------- */
let press;
if (process.platform === 'win32') {
  const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', '-'], { stdio: ['pipe', 'ignore', 'inherit'] });
  ps.stdin.write('Add-Type -AssemblyName System.Windows.Forms\n');
  ps.on('exit', function () { console.error('PowerShell stopped — restart the clicker.'); process.exit(1); });
  press = function (dir) {
    const key = ARROWS ? (dir === 'next' ? '{RIGHT}' : '{LEFT}') : (dir === 'next' ? '{PGDN}' : '{PGUP}');
    ps.stdin.write("[System.Windows.Forms.SendKeys]::SendWait('" + key + "')\n");
  };
} else if (process.platform === 'darwin') {
  press = function (dir) {
    const code = ARROWS ? (dir === 'next' ? 124 : 123) : (dir === 'next' ? 121 : 116);
    execFile('osascript', ['-e', 'tell application "System Events" to key code ' + code], function (err) {
      if (err) console.error('Could not press the key. Allow Terminal under System Settings › Privacy & Security › Accessibility.');
    });
  };
} else {
  press = function (dir) {
    const key = ARROWS ? (dir === 'next' ? 'Right' : 'Left') : (dir === 'next' ? 'Next' : 'Prior');
    execFile('xdotool', ['key', key], function (err) { if (err) console.error('Install xdotool to press keys on Linux.'); });
  };
}

/* ---------- listening ---------- */
let seq = -1;
function onState(st) {
  /* the first state after (re)connecting only sets the mark — a press made
     while we were offline is stale and must not move the slides later */
  const isNew = seq >= 0 && st.seq > seq;
  seq = st.seq;
  if (!isNew || !st.last) return;
  if (st.last.cmd === 'next' || st.last.cmd === 'prev') {
    press(st.last.cmd);
    console.log(new Date().toLocaleTimeString() + '  ' + (st.last.cmd === 'next' ? 'next slide ›' : '‹ previous slide'));
  }
}

function connect() {
  const url = base + '/events?role=clicker';
  const lib = url.startsWith('https:') ? https : http;
  const req = lib.get(url, { headers: { Accept: 'text/event-stream' } }, function (res) {
    if (res.statusCode !== 200) { console.error('Server said ' + res.statusCode + ' — is the link right?'); res.resume(); return retry(); }
    console.log('Connected. Leave this window open and put the slideshow in front.');
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', function (chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split('\n').filter(function (l) { return l.startsWith('data:'); })
          .map(function (l) { return l.slice(5).trim(); }).join('\n');
        if (data) { try { onState(JSON.parse(data)); } catch (e) {} }
      }
    });
    res.on('end', retry);
  });
  req.on('error', function (e) { console.error('Connection problem: ' + e.message); retry(); });
  req.setTimeout(70000, function () { req.destroy(new Error('no heartbeat')); });
}
let retrying = false;
function retry() {
  if (retrying) return; retrying = true; seq = -1;
  setTimeout(function () { retrying = false; connect(); }, 3000);
}
connect();
