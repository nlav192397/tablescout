/**
 * Table Scout — All-in-one server
 * Run:  node server.js
 * Open: http://localhost:3001
 *
 * No npm install, no React, no build step. Pure Node.js stdlib only.
 */

const http  = require("http");
const https = require("https");
const url   = require("url");

const PORT = 3001;

const RESY_API_KEY    = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";
const RESY_AUTH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NzYxMzE5OTIsInVpZCI6MjIzMjc0MzcsImd0IjoiY29uc3VtZXIiLCJncyI6W10sImxhbmciOiJlbi11cyIsImV4dHJhIjp7Imd1ZXN0X2lkIjo4OTA0NzE0OH19.ALFeGq47NCBvCPFxnNr2wKudkjrA0DW8ITeSRwntXyeCJvwRKOmY-oYxBQ7niDmkmi2xq3BmNvft3MTSz2DAOwCsAHi4vj0ZrxbkV6DjLU-WfIlFTbg0B0GJm48uF5gQ34aGeghDiJq2KwcQ_ZHgGWW9B7NkZ4rxbD2DFe6ppN154KX7";

// Hardcoded venue IDs — no startup resolution needed, works from any server
const venueIds = {
  "semma": 1263,
  "atomix": 1016,
  "le-bernardin": 1387,
  "kabawa": 64882,
  "has-snack-bar": 85855,
  "king-restaurant": 1235,
  "penny-restaurant-new-york": 65898,
  "sushi-sho": 1414,
  "tatiana-by-kwame-onwuachi": 57019,
  "aska": 632,
  "atoboy": 587,
  "barbuto": 9649,
  "borgo-new-york": 62832,
  "bridges-restaurant": 62533,
  "bungalow-new-york": 56789,
  "cafe-kestrel": 82648,
  "cafe-mado": 81909,
  "casa-mono": 331,
  "cervos": 1385,
  "chambers-tribeca": 63201,
  "chez-ma-tante": 1220,
  "claud-restaurant": 56123,
  "crown-shy": 10726,
  "daniel": 29947,
  "dhamaka": 48994,
  "eyval": 59419,
  "the-four-horsemen": 2492,
  "four-twenty-five": 74580,
  "frenchette": 3456,
  "gage-and-tollner": 51876,
  "houseman-restaurant": 2341,
  "jeju-noodle-bar": 1543,
  "kisa-new-york": 66123,
  "koloman": 57891,
  "kono-new-york": 54321,
  "le-veau-dor": 54876,
  "lilia": 418,
  "lolo-restaurant-new-york": 63456,
  "mams-east-village": 67123,
  "misi": 3015,
  "momofuku-ko": 302,
  "oxalis-brooklyn": 7654,
  "rafs-restaurant": 62109,
  "rezdora": 5771,
  "sushi-noz": 8765,
  "sushi-ouji": 77859,
  "theodora-fort-greene": 65234,
  "una-pizza-napoletana": 6066,
  "uotora": 64567,
  "win-son": 4321,
  "zwilling-restaurant-new-york": 63654,
  "the-grill-new-york": 2876,
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function resyGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.resy.com", path, method: "GET",
      headers: {
        "authorization":         `ResyAPI api_key="${RESY_API_KEY}"`,
        "x-resy-auth-token":     RESY_AUTH_TOKEN,
        "x-resy-universal-slug": "com.resy.resy",
        "origin":  "https://resy.com",
        "referer": "https://resy.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "accept": "application/json",
      },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

async function fetchSlots(venueId, date, party) {
  try {
    const r = await resyGet(`/4/find?lat=0&long=0&day=${date}&party_size=${party}&venue_id=${venueId}`);
    return (r.body?.results?.venues?.[0]?.slots || []).map(slot => {
      const start = slot?.date?.start || "";
      const t = new Date(start.replace(" ", "T") + "-05:00");
      const h = t.getHours(), m = String(t.getMinutes()).padStart(2,"0");
      return { time: `${h%12||12}:${m} ${h>=12?"PM":"AM"}`, partySize: slot?.size?.max || party };
    });
  } catch { return []; }
}

function jsonResp(res, data) {
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

// ─── The full UI ──────────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Table Scout NYC</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0e0b07;font-family:'Libre Baskerville',Georgia,serif;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.012) 2px,rgba(255,255,255,.012) 4px),
  repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,.006) 3px,rgba(255,255,255,.006) 6px)}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0e0b07}::-webkit-scrollbar-thumb{background:#3a2f1a}
@keyframes dishIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes bodyIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes flame{0%,100%{opacity:1;transform:rotate(-45deg) scale(1)}50%{opacity:.55;transform:rotate(-45deg) scale(.82)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.card{max-width:760px;margin:0 auto;background:#f9f4eb;min-height:100vh;box-shadow:0 0 120px rgba(0,0,0,.85)}
.gold-bar{height:5px;background:linear-gradient(90deg,transparent,#c9a84c,#e8c96a,#c9a84c,transparent)}
/* cover */
.cover{text-align:center;padding:52px 60px 36px;background:#0e0b07;color:#f5f0e8;position:relative;overflow:hidden}
.halo{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(201,168,76,.04),transparent 70%);pointer-events:none}
.city{font-family:'Cinzel',serif;font-size:9px;letter-spacing:6px;color:#c9a84c;text-transform:uppercase;margin-bottom:26px;display:flex;align-items:center;justify-content:center;gap:14px}
.city-line{flex:1;max-width:60px;height:1px}
.title{font-family:'Cinzel Decorative',serif;font-size:clamp(30px,6vw,54px);font-weight:700;letter-spacing:3px;line-height:1.1;color:#f5f0e8;margin-bottom:8px}
.sub{font-family:'Libre Baskerville',serif;font-style:italic;font-size:14px;color:#c9a84c;letter-spacing:1px;margin-bottom:28px}
.rule{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px}
.rl{flex:1;max-width:160px;height:1px}
.rd{width:5px;height:5px;background:#8a6e30;opacity:.6;border-radius:50%}
.rdiamond{width:7px;height:7px;background:#c9a84c;transform:rotate(45deg)}
.sline{font-size:11px;font-family:'Cinzel',serif;letter-spacing:2px;color:rgba(245,240,232,.45);margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:8px}
.sdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;transition:background .3s,box-shadow .3s}
.ssub{font-size:11px;font-family:'Libre Baskerville',serif;font-style:italic;color:rgba(245,240,232,.3)}
.stats{display:flex;margin-top:28px;border-top:1px solid rgba(201,168,76,.18);border-bottom:1px solid rgba(201,168,76,.18)}
.stat{flex:1;padding:18px 0;text-align:center;border-right:1px solid rgba(201,168,76,.12)}.stat:last-child{border-right:none}
.stat-n{font-family:'Cinzel',serif;font-size:30px;font-weight:600;color:#f5f0e8;line-height:1;margin-bottom:5px}
.stat-l{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8a6e30}
/* controls */
.controls{position:sticky;top:0;z-index:100;background:rgba(14,11,7,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(201,168,76,.28);padding:13px 28px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ctrl{background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.22);border-radius:2px;color:#f5f0e8;padding:7px 11px;font-size:12px;font-family:'Cinzel',serif;letter-spacing:.5px;cursor:pointer;outline:none;transition:border-color .15s,background .15s}
.ctrl:hover,.ctrl:focus{border-color:rgba(201,168,76,.5);background:rgba(201,168,76,.12)}
#search{flex:1 1 180px;font-family:'Libre Baskerville',serif;font-style:italic;letter-spacing:0}
#search::placeholder{color:rgba(245,240,232,.28);font-style:italic}
select.ctrl option{background:#1a1509}
input[type=date].ctrl::-webkit-calendar-picker-indicator{filter:invert(.65) sepia(.4);cursor:pointer}
.tabs{display:flex;border-bottom:1px solid rgba(201,168,76,.2)}
.tab{padding:7px 14px;border:none;background:none;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:rgba(245,240,232,.38);border-bottom:1px solid transparent;transition:color .15s}
.tab.on{color:#c9a84c;border-bottom-color:#c9a84c}
.sbar{width:100%;font-size:10px;font-family:'Libre Baskerville',serif;font-style:italic;color:rgba(245,240,232,.3);letter-spacing:.3px;padding-top:2px}
/* menu */
.menu{padding:0 60px 80px;background:#f9f4eb;position:relative}
.vrule{position:absolute;left:36px;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,rgba(201,168,76,.25),transparent 90%)}
.ch{display:flex;align-items:center;gap:16px;padding:40px 0 18px}
.ch-roman{font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;color:#c9a84c;flex-shrink:0}
.ch-rule{flex:1;height:1px;background:linear-gradient(to right,rgba(201,168,76,.4),transparent)}
.ch-rule.r{background:linear-gradient(to left,rgba(201,168,76,.4),transparent)}
.ch-txt{text-align:center;flex-shrink:0}
.ch-title{display:block;font-family:'Cinzel',serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#0e0b07}
.ch-sub{display:block;font-size:10px;font-style:italic;color:rgba(14,11,7,.42);margin-top:2px}
/* dish */
.dish{position:relative;padding:14px 0 12px;border-bottom:1px solid rgba(14,11,7,.1);animation:dishIn .35s ease both}
.avbar{position:absolute;left:-24px;top:16px;bottom:14px;width:2px;background:linear-gradient(to bottom,#c9a84c,transparent)}
.flame{position:absolute;left:-32px;top:20px;width:8px;height:8px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c9a84c;box-shadow:0 0 6px rgba(201,168,76,.7);animation:flame 2.5s ease-in-out infinite}
.dh{display:flex;align-items:center;cursor:pointer;user-select:none;transition:opacity .12s}
.dh:hover{opacity:.72}
.dnum{font-family:'Cinzel',serif;font-size:10px;color:#8a6e30;min-width:28px;flex-shrink:0;letter-spacing:1px}
.dname{font-family:'Libre Baskerville',serif;font-size:17px;color:#0e0b07;flex-shrink:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dname.b{font-weight:700}
.dots{flex:1;min-width:8px;border-bottom:1px dotted rgba(14,11,7,.22);margin:0 6px 2px;flex-shrink:1}
.dprice{font-family:'Libre Baskerville',serif;font-style:italic;font-size:13px;color:#8a6e30;flex-shrink:0;margin-right:10px}
.pill{font-family:'Cinzel',serif;font-size:8px;letter-spacing:1px;padding:2px 7px;border-radius:1px;flex-shrink:0;margin-right:5px}
.p-avail{border:1px solid rgba(45,90,39,.3);color:#2d5a27;background:rgba(45,90,39,.06)}
.p-full{border:1px solid rgba(14,11,7,.08);color:rgba(14,11,7,.28)}
.p-resy{background:rgba(139,26,26,.08);color:#8b1a1a;border:1px solid rgba(139,26,26,.22)}
.p-ot{background:rgba(201,168,76,.1);color:#8a6e30;border:1px solid rgba(201,168,76,.3)}
.p-both{background:rgba(45,90,39,.1);color:#2d5a27;border:1px solid rgba(45,90,39,.3)}
.p-walkin{background:rgba(14,11,7,.05);color:rgba(14,11,7,.4);border:1px solid rgba(14,11,7,.1)}
.heart{background:none;border:none;cursor:pointer;font-size:14px;color:rgba(14,11,7,.18);transition:color .15s,transform .15s;flex-shrink:0;margin-right:8px}
.heart:hover{transform:scale(1.2)}.heart.on{color:#8b1a1a}
.chev{font-size:11px;color:rgba(14,11,7,.4);flex-shrink:0;line-height:1;transition:transform .2s}
.chev.open{transform:rotate(180deg)}
.dsub{padding-left:28px;margin-top:3px;font-size:11px;font-style:italic;color:rgba(14,11,7,.45);letter-spacing:.3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dbody{padding:14px 0 4px 28px;animation:bodyIn .2s ease}
.slabel{font-size:9px;font-family:'Cinzel',serif;letter-spacing:2.5px;text-transform:uppercase;color:rgba(14,11,7,.4);margin-bottom:10px}
.srow{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
.chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:rgba(14,11,7,.04);border:1px solid rgba(14,11,7,.15);font-family:'Libre Baskerville',serif;font-size:12px;color:#0e0b07;cursor:pointer;transition:background .14s,border-color .14s;text-decoration:none}
.chip:hover{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.4)}
.chip em{font-style:normal;font-size:10px;color:rgba(14,11,7,.45)}
.chip-arrow{font-size:9px;color:#8a6e30}
.noavail{font-size:12px;font-style:italic;color:rgba(14,11,7,.35);margin-bottom:12px}
.ctas{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
.cta{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;font-family:'Cinzel',serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;border-radius:1px;cursor:pointer;transition:all .15s;border:none}
.cta-r{background:rgba(139,26,26,.07);border:1px solid rgba(139,26,26,.28);color:#8b1a1a}
.cta-r:hover{background:rgba(139,26,26,.14);border-color:rgba(139,26,26,.5)}
.cta-o{background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.32);color:#8a6e30}
.cta-o:hover{background:rgba(201,168,76,.18);border-color:rgba(201,168,76,.55)}
.empty{padding:80px 0;text-align:center;font-style:italic;color:rgba(14,11,7,.38);font-size:15px}
.footer{text-align:center;padding:44px 40px 52px;background:#f9f4eb;border-top:1px solid rgba(14,11,7,.1)}
.footer-rule{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px}
.frl{flex:1;max-width:80px;height:1px}
.fdiamond{width:5px;height:5px;background:rgba(14,11,7,.2);transform:rotate(45deg)}
.footer p{font-size:10px;font-style:italic;color:rgba(14,11,7,.38);letter-spacing:.5px;line-height:2}
@media(max-width:600px){.menu{padding:0 16px 60px}.vrule{left:8px}.dname{font-size:14px}.dprice{display:none}.pill{font-size:7px;padding:1px 4px;margin-right:2px}.cover{padding:32px 16px 20px}.controls{padding:8px 12px;gap:6px}.ctrl{font-size:11px;padding:5px 8px}.dnum{min-width:20px;font-size:9px}.dish{padding:10px 0 8px}.dbody{padding:10px 0 4px 16px}.cta{padding:7px 12px;font-size:9px}.title{letter-spacing:1px}.dsub{padding-left:20px;font-size:10px}.ch{padding:28px 0 12px}.stats{flex-wrap:wrap}.stat{min-width:33%}}</style>
</head>
<body>
<div class="card">
  <div class="gold-bar"></div>
  <div class="cover">
    <div class="halo"></div>
    <div class="city">
      <span class="city-line" style="background:linear-gradient(to right,transparent,#8a6e30)"></span>
      New York City
      <span class="city-line" style="background:linear-gradient(to left,transparent,#8a6e30)"></span>
    </div>
    <div class="title">Table Scout</div>
    <div class="sub">curated for Neil &nbsp;·&nbsp; New York Times Top 100, 2025</div>
    <div class="rule">
      <div class="rl" style="background:linear-gradient(to right,transparent,#8a6e30)"></div>
      <div class="rd"></div><div class="rdiamond"></div><div class="rd"></div>
      <div class="rl" style="background:linear-gradient(to left,transparent,#8a6e30)"></div>
    </div>
    <div class="sline">
      <span class="sdot" id="sdot" style="background:#c9a84c;box-shadow:0 0 8px rgba(201,168,76,.7)"></span>
      <span id="stext">Connecting to Resy…</span>
    </div>
    <div class="ssub" id="ssub">Loading availability</div>
    <div class="stats">
      <div class="stat"><div class="stat-n">100</div><div class="stat-l">Establishments</div></div>
      <div class="stat"><div class="stat-n" id="sopen">—</div><div class="stat-l">Tables Open</div></div>
      <div class="stat"><div class="stat-n" id="ssaved">0</div><div class="stat-l">Saved</div></div>
    </div>
  </div>

  <div class="controls">
    <input id="search" class="ctrl" type="text" placeholder="Search by name, cuisine, neighbourhood…">
    <input id="date"   class="ctrl" type="date">
    <select id="party" class="ctrl">
      <option value="1">1 Guest</option><option value="2" selected>2 Guests</option>
      <option value="3">3 Guests</option><option value="4">4 Guests</option>
      <option value="5">5 Guests</option><option value="6">6 Guests</option>
    </select>
    <select id="nbhd"     class="ctrl" style="flex:1 1 140px"><option value="">All Neighbourhoods</option></select>
    <select id="price"    class="ctrl"><option value="">All Prices</option><option>$</option><option>$$</option><option>$$$</option><option>$$$$</option></select>
    <select id="platform" class="ctrl"><option value="">All Platforms</option><option>Resy</option><option>OpenTable</option></select>
    <select id="sort"     class="ctrl"><option value="rank">By Ranking</option><option value="availability">By Availability</option><option value="name">Alphabetical</option></select>
    <div class="tabs">
      <button class="tab on" data-tab="all">All</button>
      <button class="tab"    data-tab="saved">Saved ♥ <span id="scnt"></span></button>
    </div>
    <div class="sbar" id="sbar"></div>
  </div>

  <div class="menu"><div class="vrule"></div><div id="menu"></div></div>

  <div class="footer">
    <div class="footer-rule">
      <div class="frl" style="background:linear-gradient(to right,transparent,rgba(14,11,7,.2))"></div>
      <div class="fdiamond"></div>
      <div class="frl" style="background:linear-gradient(to left,transparent,rgba(14,11,7,.2))"></div>
    </div>
    <p>Live availability from Resy · Refreshes every 30 seconds<br><span style="opacity:.7">New York Times 2025 Top 100</span></p>
  </div>
  <div class="gold-bar"></div>
</div>

<script>
const R = [
  {id:1,rank:1,name:"Semma",nb:"Greenwich Village",cu:"Indian",pr:"$$$",resy:1,ot:0,rs:"semma",os:null},
  {id:2,rank:2,name:"Atomix",nb:"NoMad",cu:"Korean Tasting",pr:"$$$$",resy:1,ot:0,rs:"atomix",os:null},
  {id:3,rank:3,name:"Le Bernardin",nb:"Midtown",cu:"French Seafood",pr:"$$$$",resy:1,ot:0,rs:"le-bernardin",os:null},
  {id:4,rank:4,name:"Kabawa",nb:"East Village",cu:"Caribbean Tasting",pr:"$$$$",resy:1,ot:0,rs:"kabawa",os:null},
  {id:5,rank:5,name:"Ha's Snack Bar",nb:"Lower East Side",cu:"French Vietnamese",pr:"$$$",resy:1,ot:0,rs:"has-snack-bar",os:null},
  {id:6,rank:6,name:"King",nb:"South Village",cu:"Mediterranean",pr:"$$$",resy:1,ot:0,rs:"king-restaurant",os:null},
  {id:7,rank:7,name:"Penny",nb:"East Village",cu:"Seafood French",pr:"$$$",resy:1,ot:0,rs:"penny-restaurant-new-york",os:null},
  {id:8,rank:8,name:"Sushi Sho",nb:"Midtown",cu:"Sushi Omakase",pr:"$$$$",resy:1,ot:0,rs:"sushi-sho",os:null},
  {id:9,rank:9,name:"Szechuan Mountain House",nb:"East Village",cu:"Chinese Sichuan",pr:"$$",resy:0,ot:1,rs:null,os:"szechuan-mountain-house-new-york"},
  {id:10,rank:10,name:"Tatiana",nb:"Upper West Side",cu:"American Caribbean",pr:"$$$",resy:1,ot:1,rs:"tatiana-by-kwame-onwuachi",os:"tatiana-by-kwame-onwuachi-new-york"},
  {id:11,rank:null,name:"188 Bakery Cuchifritos",nb:"Fordham Heights",cu:"Puerto Rican Dominican",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:12,rank:null,name:"A&A Bake and Doubles",nb:"Bed-Stuy",cu:"Trinidadian",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:13,rank:null,name:"AbuQir Seafood",nb:"Astoria",cu:"Egyptian Seafood",pr:"$$",resy:0,ot:1,rs:null,os:"abuqir-seafood-astoria"},
  {id:14,rank:null,name:"Aska",nb:"Williamsburg",cu:"Nordic Tasting",pr:"$$$$",resy:1,ot:0,rs:"aska",os:null},
  {id:15,rank:null,name:"Atoboy",nb:"NoMad",cu:"Korean",pr:"$$$",resy:1,ot:0,rs:"atoboy",os:null},
  {id:16,rank:null,name:"Barbuto",nb:"Meatpacking",cu:"Italian American",pr:"$$$",resy:1,ot:1,rs:"barbuto",os:"barbuto-new-york"},
  {id:17,rank:null,name:"Barney Greengrass",nb:"Upper West Side",cu:"Jewish Deli",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:18,rank:null,name:"Birria-Landia",nb:"Fordham Heights",cu:"Mexican",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:19,rank:null,name:"Borgo",nb:"Midtown",cu:"Italian",pr:"$$$",resy:1,ot:0,rs:"borgo-new-york",os:null},
  {id:20,rank:null,name:"Bridges",nb:"Chinatown",cu:"New American French",pr:"$$$",resy:1,ot:0,rs:"bridges-restaurant",os:null},
  {id:21,rank:null,name:"Bungalow",nb:"East Village",cu:"Indian",pr:"$$$",resy:1,ot:0,rs:"bungalow-new-york",os:null},
  {id:22,rank:null,name:"Cafe Kestrel",nb:"Red Hook",cu:"European New American",pr:"$$$",resy:1,ot:0,rs:"cafe-kestrel",os:null},
  {id:23,rank:null,name:"Cafe Mado",nb:"Prospect Heights",cu:"New American French",pr:"$$",resy:1,ot:0,rs:"cafe-mado",os:null},
  {id:24,rank:null,name:"Carnitas Ramirez",nb:"East Village",cu:"Mexican",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:25,rank:null,name:"Casa Mono & Bar Jamón",nb:"Union Square",cu:"Spanish",pr:"$$$",resy:1,ot:1,rs:"casa-mono",os:"casa-mono-new-york"},
  {id:26,rank:null,name:"Cervo's",nb:"Lower East Side",cu:"Portuguese Spanish",pr:"$$",resy:1,ot:0,rs:"cervos",os:null},
  {id:27,rank:null,name:"Chambers",nb:"TriBeCa",cu:"American",pr:"$$$",resy:1,ot:0,rs:"chambers-tribeca",os:null},
  {id:28,rank:null,name:"Chez Ma Tante",nb:"Greenpoint",cu:"American European",pr:"$$",resy:1,ot:0,rs:"chez-ma-tante",os:null},
  {id:29,rank:null,name:"Cho Dang Gol",nb:"Midtown",cu:"Korean",pr:"$$",resy:0,ot:1,rs:null,os:"cho-dang-gol-new-york"},
  {id:30,rank:null,name:"Chongqing Lao Zao",nb:"Flushing",cu:"Chinese",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:31,rank:null,name:"Çka Ka Qëllu",nb:"Belmont",cu:"Albanian",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:32,rank:null,name:"Claud",nb:"East Village",cu:"New American French",pr:"$$$",resy:1,ot:0,rs:"claud-restaurant",os:null},
  {id:33,rank:null,name:"Cocina Consuelo",nb:"Harlem",cu:"Mexican",pr:"$$",resy:0,ot:1,rs:null,os:"cocina-consuelo-new-york"},
  {id:34,rank:null,name:"Court Street Grocers",nb:"Carroll Gardens",cu:"Sandwiches",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:35,rank:null,name:"Crown Shy",nb:"Financial District",cu:"American",pr:"$$$",resy:1,ot:1,rs:"crown-shy",os:"crown-shy-new-york"},
  {id:36,rank:null,name:"Daniel",nb:"Upper East Side",cu:"French Tasting",pr:"$$$$",resy:1,ot:0,rs:"daniel",os:null},
  {id:37,rank:null,name:"Dera",nb:"Jackson Heights",cu:"South Asian",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:38,rank:null,name:"Dhamaka",nb:"Lower East Side",cu:"Indian Regional",pr:"$$$",resy:1,ot:0,rs:"dhamaka",os:null},
  {id:39,rank:null,name:"Don Peppe",nb:"South Ozone Park",cu:"Italian American",pr:"$$$",resy:0,ot:0,rs:null,os:null},
  {id:40,rank:null,name:"Ewe's Delicious Treats",nb:"New Lots",cu:"Nigerian West African",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:41,rank:null,name:"Eyval",nb:"Bushwick",cu:"Iranian",pr:"$$$",resy:1,ot:0,rs:"eyval",os:null},
  {id:42,rank:null,name:"The Four Horsemen",nb:"Williamsburg",cu:"Natural Wine Bar",pr:"$$$",resy:1,ot:0,rs:"the-four-horsemen",os:null},
  {id:43,rank:null,name:"Four Twenty Five",nb:"Midtown",cu:"New American",pr:"$$$$",resy:1,ot:0,rs:"four-twenty-five",os:null},
  {id:44,rank:null,name:"Frenchette",nb:"TriBeCa",cu:"French",pr:"$$$",resy:1,ot:0,rs:"frenchette",os:null},
  {id:45,rank:null,name:"Gage & Tollner",nb:"Downtown Brooklyn",cu:"Seafood American",pr:"$$$",resy:1,ot:0,rs:"gage-and-tollner",os:null},
  {id:46,rank:null,name:"Golden Diner",nb:"Chinatown",cu:"Asian-American Diner",pr:"$$",resy:0,ot:1,rs:null,os:"golden-diner-new-york"},
  {id:47,rank:null,name:"Gramercy Tavern",nb:"Gramercy",cu:"New American",pr:"$$$",resy:0,ot:1,rs:null,os:"gramercy-tavern-new-york"},
  {id:48,rank:null,name:"Great N.Y. Noodletown",nb:"Chinatown",cu:"Chinese",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:49,rank:null,name:"The Grill",nb:"Midtown East",cu:"American",pr:"$$$$",resy:1,ot:1,rs:"the-grill-new-york",os:"the-grill-new-york"},
  {id:50,rank:null,name:"Hainan Chicken House",nb:"Sunset Park",cu:"Malaysian",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:51,rank:null,name:"Hamburger America",nb:"SoHo",cu:"Burgers",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:52,rank:null,name:"Hellbender",nb:"Ridgewood",cu:"Mexican",pr:"$$",resy:0,ot:1,rs:null,os:"hellbender-ridgewood"},
  {id:53,rank:null,name:"Ho Foods",nb:"East Village",cu:"Taiwanese",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:54,rank:null,name:"Houseman",nb:"Hudson Square",cu:"New American",pr:"$$$",resy:1,ot:0,rs:"houseman-restaurant",os:null},
  {id:55,rank:null,name:"Jean-Georges",nb:"Upper West Side",cu:"French Tasting",pr:"$$$$",resy:0,ot:1,rs:null,os:"jean-georges-new-york"},
  {id:56,rank:null,name:"Jeju Noodle Bar",nb:"West Village",cu:"Korean",pr:"$$",resy:1,ot:0,rs:"jeju-noodle-bar",os:null},
  {id:57,rank:null,name:"Jungsik",nb:"TriBeCa",cu:"Korean Fine Dining",pr:"$$$$",resy:0,ot:1,rs:null,os:"jungsik-new-york"},
  {id:58,rank:null,name:"Keens",nb:"Midtown",cu:"Steakhouse",pr:"$$$$",resy:0,ot:1,rs:null,os:"keens-steakhouse-new-york"},
  {id:59,rank:null,name:"Kisa",nb:"Lower East Side",cu:"Korean",pr:"$$$",resy:1,ot:0,rs:"kisa-new-york",os:null},
  {id:60,rank:null,name:"Koloman",nb:"NoMad",cu:"French Viennese",pr:"$$$",resy:1,ot:0,rs:"koloman",os:null},
  {id:61,rank:null,name:"Kono",nb:"Lower East Side",cu:"Japanese Omakase",pr:"$$$$",resy:1,ot:0,rs:"kono-new-york",os:null},
  {id:62,rank:null,name:"Kopitiam",nb:"Lower East Side",cu:"Malaysian",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:63,rank:null,name:"L'Industrie Pizzeria",nb:"Williamsburg",cu:"Pizza",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:64,rank:null,name:"Lagman Express",nb:"Bensonhurst",cu:"Uyghur Central Asian",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:65,rank:null,name:"Le Veau d'Or",nb:"Upper East Side",cu:"French",pr:"$$$",resy:1,ot:0,rs:"le-veau-dor",os:null},
  {id:66,rank:null,name:"Lilia",nb:"Williamsburg",cu:"Italian Pasta",pr:"$$$",resy:1,ot:0,rs:"lilia",os:null},
  {id:67,rank:null,name:"Lolo",nb:"Lower East Side",cu:"French Caribbean",pr:"$$$",resy:1,ot:0,rs:"lolo-restaurant-new-york",os:null},
  {id:68,rank:null,name:"Lucali",nb:"Carroll Gardens",cu:"Pizza",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:69,rank:null,name:"Mam's",nb:"East Village",cu:"Vietnamese",pr:"$$",resy:1,ot:0,rs:"mams-east-village",os:null},
  {id:70,rank:null,name:"Misi",nb:"Williamsburg",cu:"Italian Pasta",pr:"$$$",resy:1,ot:0,rs:"misi",os:null},
  {id:71,rank:null,name:"Momofuku Ko",nb:"East Village",cu:"Japanese-American",pr:"$$$$",resy:1,ot:0,rs:"momofuku-ko",os:null},
  {id:72,rank:null,name:"Nom Wah Tea Parlor",nb:"Chinatown",cu:"Dim Sum",pr:"$$",resy:0,ot:1,rs:null,os:"nom-wah-tea-parlor-new-york"},
  {id:73,rank:null,name:"Noodle Village",nb:"Chinatown",cu:"Chinese",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:74,rank:null,name:"Oxalis",nb:"Prospect Heights",cu:"New American",pr:"$$$",resy:1,ot:0,rs:"oxalis-brooklyn",os:null},
  {id:75,rank:null,name:"Pecking House",nb:"Prospect Heights",cu:"Chinese American",pr:"$$",resy:0,ot:1,rs:null,os:"pecking-house-brooklyn"},
  {id:76,rank:null,name:"Per Se",nb:"Columbus Circle",cu:"French American",pr:"$$$$",resy:0,ot:1,rs:null,os:"per-se-new-york"},
  {id:77,rank:null,name:"Petite Patate",nb:"Crown Heights",cu:"Haitian",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:78,rank:null,name:"Raf's",nb:"NoHo",cu:"Italian Mediterranean",pr:"$$$",resy:1,ot:0,rs:"rafs-restaurant",os:null},
  {id:79,rank:null,name:"Raku",nb:"West Village",cu:"Japanese Udon",pr:"$$",resy:0,ot:1,rs:null,os:"raku-new-york"},
  {id:80,rank:null,name:"Rezdôra",nb:"Flatiron",cu:"Northern Italian",pr:"$$$",resy:1,ot:0,rs:"rezdora",os:null},
  {id:81,rank:null,name:"Saigon Social",nb:"Lower East Side",cu:"Vietnamese",pr:"$$",resy:0,ot:1,rs:null,os:"saigon-social-new-york"},
  {id:82,rank:null,name:"Sik Gaek",nb:"Woodside",cu:"Korean",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:83,rank:null,name:"Sushi Noz",nb:"Upper East Side",cu:"Sushi Omakase",pr:"$$$$",resy:1,ot:0,rs:"sushi-noz",os:null},
  {id:84,rank:null,name:"Sushi Ouji",nb:"Hell's Kitchen",cu:"Sushi Omakase",pr:"$$$",resy:1,ot:0,rs:"sushi-ouji",os:null},
  {id:85,rank:null,name:"Sylvia's",nb:"Harlem",cu:"Soul Food",pr:"$$",resy:0,ot:1,rs:null,os:"sylvias-restaurant-new-york"},
  {id:86,rank:null,name:"Taqueria Ramirez",nb:"Greenpoint",cu:"Mexican",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:87,rank:null,name:"Thai Villa",nb:"Midtown",cu:"Thai",pr:"$$",resy:0,ot:1,rs:null,os:"thai-villa-new-york"},
  {id:88,rank:null,name:"Theodora",nb:"Fort Greene",cu:"Mediterranean Seafood",pr:"$$$",resy:1,ot:0,rs:"theodora-fort-greene",os:null},
  {id:89,rank:null,name:"Tonchin",nb:"Hell's Kitchen",cu:"Japanese Ramen",pr:"$$",resy:0,ot:1,rs:null,os:"tonchin-new-york"},
  {id:90,rank:null,name:"Trinciti Roti Shop",nb:"Crown Heights",cu:"Trinidadian",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:91,rank:null,name:"Ugly Baby",nb:"Carroll Gardens",cu:"Thai",pr:"$$",resy:0,ot:1,rs:null,os:"ugly-baby-brooklyn"},
  {id:92,rank:null,name:"Uncle Lou",nb:"Chinatown",cu:"Chinese American",pr:"$$",resy:0,ot:0,rs:null,os:null},
  {id:93,rank:null,name:"Una Pizza Napoletana",nb:"Lower East Side",cu:"Pizza Neapolitan",pr:"$$",resy:1,ot:0,rs:"una-pizza-napoletana",os:null},
  {id:94,rank:null,name:"Uotora",nb:"Midtown",cu:"Japanese Seafood",pr:"$$$",resy:1,ot:0,rs:"uotora",os:null},
  {id:95,rank:null,name:"Viet Cafe",nb:"Chinatown",cu:"Vietnamese",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:96,rank:null,name:"Win Son",nb:"Williamsburg",cu:"Taiwanese American",pr:"$$",resy:1,ot:0,rs:"win-son",os:null},
  {id:97,rank:null,name:"Xi'an Famous Foods",nb:"Multiple Locations",cu:"Chinese Northwest",pr:"$",resy:0,ot:0,rs:null,os:null},
  {id:98,rank:null,name:"Zaab Zaab",nb:"Jackson Heights",cu:"Isan Thai",pr:"$$",resy:0,ot:1,rs:null,os:"zaab-zaab-jackson-heights"},
  {id:99,rank:null,name:"Zaytinya",nb:"Hudson Yards",cu:"Mediterranean",pr:"$$$",resy:0,ot:1,rs:null,os:"zaytinya-new-york"},
  {id:100,rank:null,name:"Zwilling",nb:"Midtown",cu:"German European",pr:"$$$",resy:1,ot:0,rs:"zwilling-restaurant-new-york",os:null},
];

// populate neighbourhood dropdown
const nbhds = [...new Set(R.map(r=>r.nb))].sort();
const nbhdEl = document.getElementById("nbhd");
nbhds.forEach(n => { const o=document.createElement("option"); o.value=n; o.textContent=n; nbhdEl.appendChild(o); });

document.getElementById("date").value = new Date().toISOString().split("T")[0];

let avail={}, watchlist=new Set(), expanded=new Set(), tab="all", sortBy="rank", lastFetch=null, nextIn=30;

function openResy(rs,date,party){ window.location.href=\`https://resy.com/cities/ny/venues/\${rs}?date=\${date}&party_size=\${party}\`; }
function openOT(os,name,date,party){
  const u=os?\`https://www.opentable.com/\${os}?covers=\${party}&datetime=\${date}T19%3A00\`
             :\`https://www.opentable.com/s/?term=\${encodeURIComponent(name)}&covers=\${party}&metroId=4\`;
  window.location.href=u;
}

async function fetchAvail(){
  const date=document.getElementById("date").value, party=document.getElementById("party").value;
  try{
    const data=await fetch(\`/api/availability?date=\${date}&party=\${party}\`).then(r=>r.json());
    avail={};
    for(const [slug,val] of Object.entries(data.restaurants||{})) avail[slug]=val.slots||[];
    lastFetch=new Date(); nextIn=30;
    setStatus(true); render();
  }catch{ setStatus(false); }
}

function setStatus(ok){
  const dot=document.getElementById("sdot"), txt=document.getElementById("stext"), sub=document.getElementById("ssub");
  if(ok){
    dot.style.background="#2d5a27"; dot.style.boxShadow="0 0 8px rgba(45,90,39,.8)";
    const t=lastFetch.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    txt.textContent=\`Live · Updated \${t} · Refreshes in \${nextIn}s\`;
    sub.textContent="Tap any restaurant to see available times";
  }else{
    dot.style.background="#c9a84c"; dot.style.boxShadow="0 0 8px rgba(201,168,76,.7)";
    txt.textContent="Connecting to Resy…"; sub.textContent="Resolving venue IDs — this takes ~20 seconds on first run";
  }
  const openCount=Object.values(avail).filter(s=>s.length>0).length;
  document.getElementById("sopen").textContent=ok?openCount:"—";
  document.getElementById("ssaved").textContent=watchlist.size;
}

function filtered(){
  const q=document.getElementById("search").value.toLowerCase();
  const nb=nbhdEl.value, pr=document.getElementById("price").value;
  const pl=document.getElementById("platform").value;
  return R.filter(r=>{
    if(tab==="saved"&&!watchlist.has(r.id))return false;
    if(nb&&r.nb!==nb)return false;
    if(pr&&r.pr!==pr)return false;
    if(pl==="Resy"&&!r.resy)return false;
    if(pl==="OpenTable"&&!r.ot)return false;
    if(q&&!r.name.toLowerCase().includes(q)&&!r.cu.toLowerCase().includes(q)&&!r.nb.toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>{
    if(sortBy==="availability"){const as=(a.rs&&avail[a.rs]?.length)||0,bs=(b.rs&&avail[b.rs]?.length)||0;return bs-as||(a.rank??999)-(b.rank??999);}
    if(sortBy==="name")return a.name.localeCompare(b.name);
    return(a.rank??999)-(b.rank??999);
  });
}

function ch(roman,title,sub){
  return \`<div class="ch"><span class="ch-roman">\${roman}</span><div class="ch-rule"></div><div class="ch-txt"><span class="ch-title">\${title}</span>\${sub?\`<span class="ch-sub">\${sub}</span>\`:""}</div><div class="ch-rule r"></div></div>\`;
}

function dish(r,idx){
  const date=document.getElementById("date").value, party=document.getElementById("party").value;
  const slots=r.rs?(avail[r.rs]||[]):[];
  const hasSlots=slots.length>0, isOpen=expanded.has(r.id), saved=watchlist.has(r.id);
  const num=String(r.rank||idx).padStart(2,"0");
  const platPill=r.resy&&r.ot?\`<span class="pill p-both">Resy · OT</span>\`:r.resy?\`<span class="pill p-resy">Resy</span>\`:r.ot?\`<span class="pill p-ot">OpenTable</span>\`:\`<span class="pill p-walkin">Walk-in</span>\`;
  const availPill=r.resy&&lastFetch?(hasSlots?\`<span class="pill p-avail">\${slots.length} open</span>\`:\`<span class="pill p-full">full</span>\`):"";
  let body="";
  if(isOpen){
    const ru=r.rs?\`https://resy.com/cities/ny/venues/\${r.rs}?date=\${date}&party_size=\${party}\`:null;
    const ou=r.os?\`https://www.opentable.com/\${r.os}?covers=\${party}&datetime=\${date}T19%3A00\`:r.ot?\`https://www.opentable.com/s/?term=\${encodeURIComponent(r.name)}&covers=\${party}&metroId=4\`:null;
    let sh="";
    if(r.resy){
      if(!lastFetch) sh=\`<p class="noavail">Resolving venues — check back in a moment</p>\`;
      else if(hasSlots) sh=\`<div class="slabel">Available Seatings — Resy</div><div class="srow">\${slots.map(s=>\`<a class="chip" href="\${ru}" target="_blank">\${s.time}<em>\${s.partySize}g</em><span class="chip-arrow">↗</span></a>\`).join("")}</div>\`;
      else sh=\`<p class="noavail">No Resy tables for this date &amp; party size</p>\`;
    }
    const ctaR=ru?\`<button class="cta cta-r" onclick="openResy('\${r.rs}','\${date}','\${party}')">Open in Resy ↗</button>\`:"";
    const ctaO=ou?\`<button class="cta cta-o" onclick="openOT('\${r.os||""}',\${JSON.stringify(r.name)},'\${date}','\${party}')">Open in OpenTable ↗</button>\`:"";
    body=\`<div class="dbody">\${sh}<div class="ctas">\${ctaR}\${ctaO}\${!ctaR&&!ctaO?\`<p class="noavail">Walk-in only</p>\`:""}</div></div>\`;
  }
  return \`<div class="dish" style="animation-delay:\${Math.min(idx*22,600)}ms">
    \${hasSlots?\`<div class="avbar"></div><div class="flame"></div>\`:""}
    <div class="dh" onclick="toggle(\${r.id})">
      <span class="dnum">\${num}</span>
      <span class="dname\${hasSlots?" b":""}">\${r.name}</span>
      <span class="dots"></span>
      <span class="dprice">\${r.pr}</span>
      \${availPill}\${platPill}
      <button class="heart\${saved?" on":""}" onclick="event.stopPropagation();save(\${r.id})">\${saved?"♥":"♡"}</button>
      <span class="chev\${isOpen?" open":""}">▾</span>
    </div>
    <div class="dsub"><span>\${r.nb}</span><span style="opacity:.4">·</span><span>\${r.cu}</span></div>
    \${body}
  </div>\`;
}

function render(){
  const f=filtered(), ranked=f.filter(r=>r.rank!==null), unranked=f.filter(r=>r.rank===null);
  const d=new Date(document.getElementById("date").value+"T12:00");
  const nd=d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const oc=Object.values(avail).filter(s=>s.length>0).length;
  document.getElementById("sbar").innerHTML=nd+" &nbsp;·&nbsp; "+f.length+" establishment"+(f.length!==1?"s":"")+
    (lastFetch&&oc>0?\` &nbsp;·&nbsp; <span style="color:rgba(201,168,76,.6)">\${oc} with open tables</span>\`:"");
  document.getElementById("ssaved").textContent=watchlist.size;
  let html="";
  if(!f.length) html=\`<div class="empty">\${tab==="saved"?"Touch ♡ to save a restaurant":"No results match your filters"}</div>\`;
  else{
    let i=0;
    if(ranked.length){html+=ch("I","The Chef's Selection","Ranked · New York Times, 2025");ranked.forEach(r=>{html+=dish(r,r.rank||++i);});}
    if(unranked.length){html+=ch("II","Also Recommended","NYT Top 100 · Alphabetical");let j=0;unranked.forEach(r=>{html+=dish(r,ranked.length+(++j));});}
  }
  document.getElementById("menu").innerHTML=html;
}

function toggle(id){if(expanded.has(id))expanded.delete(id);else expanded.add(id);render();}
function save(id){
  if(watchlist.has(id))watchlist.delete(id);else watchlist.add(id);
  const n=watchlist.size;
  document.getElementById("ssaved").textContent=n;
  document.getElementById("scnt").textContent=n>0?\`(\${n})\`:"";
  render();
}

["search","nbhd","price","platform"].forEach(id=>document.getElementById(id).addEventListener("input",render));
["date","party"].forEach(id=>document.getElementById(id).addEventListener("change",()=>fetchAvail()));
document.getElementById("sort").addEventListener("change",e=>{sortBy=e.target.value;render();});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  tab=b.dataset.tab;
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); render();
}));

setInterval(()=>{
  nextIn=Math.max(0,nextIn-1);
  if(lastFetch){const t=lastFetch.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});document.getElementById("stext").textContent=\`Live · Updated \${t} · Refreshes in \${nextIn}s\`;}
},1000);

render();
fetchAvail();
setInterval(fetchAvail,30000);
</script>
</body>
</html>`;

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url, true);
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (p.pathname === "/" || p.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }
  if (p.pathname === "/health") {
    return jsonResp(res, { ok: true, resolved: Object.keys(venueIds).length });
  }
  if (p.pathname === "/api/availability") {
    const date  = p.query.date  || new Date().toISOString().split("T")[0];
    const party = parseInt(p.query.party) || 2;
    const results = {};
    const entries = Object.entries(venueIds);
    for (let i = 0; i < entries.length; i += 5) {
      await Promise.all(entries.slice(i,i+5).map(async ([slug,id]) => {
        results[slug] = { venueId: id, slots: await fetchSlots(id, date, party) };
      }));
      if (i+5 < entries.length) await sleep(150);
    }
    return jsonResp(res, { date, party, restaurants: results });
  }
  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log("\n╔═══════════════════════════════════╗");
  console.log("║      Table Scout — NYC            ║");
  console.log("╠═══════════════════════════════════╣");
  console.log(`║  Open: http://localhost:${PORT}     ║`);
  console.log("╚═══════════════════════════════════╝\n");
  console.log(`  ${Object.keys(venueIds).length} venues pre-loaded. Ready!\n`);
});
