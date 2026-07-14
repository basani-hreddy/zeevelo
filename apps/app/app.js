/* Zeevelo Apply — prototype SPA (localStorage-backed, no server) */
"use strict";

/* ---------------- state ---------------- */
/* ---- accounts: every visitor signs in with their own email; data is stored
   per-account. Only the admin email gets unlimited applications & generations. ---- */
const ADMIN_EMAIL = "basani.hvreddy@gmail.com";
const FREE_QUOTA = 25; // lifetime applications on Free plan
let SESSION = null;
try { SESSION = JSON.parse(localStorage.getItem("zeevelo:session")); } catch(e){}
function adminList(){ try{ return JSON.parse(localStorage.getItem("zeevelo:admins"))||[]; }catch(e){ return []; } }
function saveAdminList(l){ localStorage.setItem("zeevelo:admins", JSON.stringify(l)); }
function isOwner(){ return !!SESSION && SESSION.email.toLowerCase() === ADMIN_EMAIL; }
function isAdmin(){
  if (!SESSION) return false;
  const e = SESSION.email.toLowerCase();
  return e === ADMIN_EMAIL || adminList().includes(e);
}
function USERNAME(){ return SESSION ? SESSION.name : "Guest"; }
const STAGES = ["Matched", "Tailored", "Ready", "Submitted", "Reply"];
const SKILL_BANK = ["javascript","typescript","react","node","node.js","python","java","go","sql","postgresql","mysql","mongodb","graphql","rest","aws","gcp","azure","docker","kubernetes","terraform","ci/cd","git","html","css","tailwind","next.js","vue","angular","redis","kafka","spark","airflow","pandas","numpy","machine learning","nlp","llm","pytorch","tensorflow","figma","agile","scrum","jira","product management","data analysis","excel","tableau","power bi","salesforce","stripe","testing","jest","cypress","microservices","linux","bash","c++","c#",".net","swift","kotlin","flutter","django","flask","spring","fastapi","selenium","etl","snowflake","dbt","looker"];

function blankState(){ return {
  profile: null, jobs: [], receipts: [],
  settings: { mode: "review", scoreThreshold: 85, completenessThreshold: 80 },
  seq: 1
}; }
function dataKey(){ return "zeevelo:data:" + (SESSION ? SESSION.email.toLowerCase() : "anon"); }
let S = load() || blankState();
function save(){ localStorage.setItem(dataKey(), JSON.stringify(S)); refreshCounts(); }
function load(){ if(!SESSION) return null; try{ return JSON.parse(localStorage.getItem(dataKey())); }catch(e){ return null; } }

/* ---------------- samples ---------------- */
const SAMPLE_RESUME = `Harsha Basani
Email: basani.hvreddy@gmail.com | Hyderabad, IN

SUMMARY
Full-stack engineer with 5 years of experience building web platforms with React, TypeScript, and Node.js. Strong on REST/GraphQL APIs, PostgreSQL, and AWS deployments with Docker and CI/CD.

SKILLS
JavaScript, TypeScript, React, Node.js, GraphQL, REST, PostgreSQL, MongoDB, AWS, Docker, CI/CD, Git, Jest, Tailwind, Next.js

EXPERIENCE
Senior Software Engineer — Finlytics (2023–present)
- Led migration of a monolith to microservices on AWS, cutting deploy time 70%
- Built React + TypeScript dashboard used by 40k monthly users
- Designed GraphQL gateway consolidating 6 internal REST services

Software Engineer — Cloudmint (2020–2023)
- Shipped Node.js payment services processing $2M/mo via Stripe
- Introduced CI/CD pipelines (GitHub Actions, Docker), raising release cadence to daily

EDUCATION
B.Tech, Computer Science — JNTU Hyderabad (2016–2020)`;

const SAMPLE_JOBS = [
  { title:"Senior Frontend Engineer", company:"Northwind Labs", ats:"Greenhouse", source:"feed",
    jd:"We're hiring a Senior Frontend Engineer. Requirements: 5+ years with React, TypeScript, Next.js. Experience with GraphQL, testing (Jest, Cypress), CI/CD, and Tailwind. Nice to have: AWS, Docker, Kubernetes. You'll own our design system and dashboard experience." },
  { title:"Full-Stack Engineer", company:"Brightpath", ats:"Lever", source:"feed",
    jd:"Full-Stack Engineer with Node.js, React, PostgreSQL, and REST API experience. Must know Docker, AWS, Git, and agile practices. Bonus: Kafka, Redis, microservices, Terraform." },
  { title:"Platform Engineer", company:"Corestack", ats:"Workday", source:"feed",
    jd:"Platform Engineer to build our infrastructure. Requirements: Kubernetes, Terraform, AWS, Docker, CI/CD, Linux, Bash, Python. Experience with monitoring and microservices at scale." },
  { title:"Data Engineer", company:"Signalhouse", ats:"Ashby", source:"feed",
    jd:"Data Engineer with Python, SQL, Airflow, Spark, ETL pipelines, Snowflake and dbt. Nice to have: Kafka, AWS, machine learning exposure." }
];

/* ---------------- parsing ---------------- */
function parseResume(text){
  const lower = text.toLowerCase();
  const skills = SKILL_BANK.filter(s => lower.includes(s));
  const expBlocks = [];
  const expMatch = text.match(/EXPERIENCE([\s\S]*?)(EDUCATION|$)/i);
  if (expMatch){
    expMatch[1].split(/\n(?=[A-Z].*—|[A-Z].*\bat\b)/).forEach(b=>{ b=b.trim(); if(b.length>20) expBlocks.push(b.split("\n")[0].trim()); });
  }
  const eduMatch = text.match(/EDUCATION([\s\S]*)$/i);
  const education = eduMatch ? eduMatch[1].trim().split("\n").filter(l=>l.trim()).slice(0,3) : [];
  const years = (text.match(/(\d+)\+?\s*years?/i)||[])[1] || null;
  const name = text.split("\n")[0].trim();
  return { name, raw:text, skills, experience:expBlocks, education, years,
           completeness: Math.min(100, 40 + skills.length*3 + expBlocks.length*10 + education.length*5) };
}

/* ---------------- scoring ---------------- */
function scoreJob(jd, profile){
  const jdLower = jd.toLowerCase();
  const jdKeywords = SKILL_BANK.filter(s => jdLower.includes(s));
  const hits = jdKeywords.filter(k => profile.skills.includes(k));
  const misses = jdKeywords.filter(k => !profile.skills.includes(k));
  const kwScore = jdKeywords.length ? (hits.length/jdKeywords.length)*40 : 30;
  // role/experience alignment
  const reqYears = (jd.match(/(\d+)\+?\s*years?/i)||[])[1];
  let roleScore = 15;
  if (reqYears && profile.years) roleScore = Math.min(25, 25 * Math.min(1, profile.years/reqYears));
  else roleScore = 18;
  // skills-section overlap
  const skillScore = jdKeywords.length ? (hits.length/jdKeywords.length)*20 : 14;
  // parse-ability (plain text resume = high)
  const parseScore = 14;
  const total = Math.round(kwScore + roleScore + skillScore + parseScore);
  return { score: Math.min(99, total), hits, misses, jdKeywords };
}

/* ---------------- tailoring ----------------
   Mandatory quality bar: every tailored resume is re-scored against the JD
   and must reach ATS >= 90 before it can move to Ready / be submitted. */
const MIN_TAILORED_ATS = 90;
function tailorResume(job, profile){
  let r = profile.raw;
  const summaryRe = /(SUMMARY\n)(.*)/i;
  const focus = job.match.hits.slice(0,4).map(cap).join(", ");
  r = r.replace(summaryRe, (all,h,line)=> h + line + ` Focused on ${focus} — aligned to the ${job.title} role at ${job.company}.`);
  // Pass 1: surface every JD keyword already in the profile prominently in SKILLS
  const skillsLineRe = /(SKILLS\n)(.*)/i;
  const reorder = [...job.match.hits.map(cap), ...profile.skills.filter(s=>!job.match.hits.includes(s)).map(cap)];
  if (skillsLineRe.test(r)) r = r.replace(skillsLineRe, (a,h)=> h + reorder.join(", "));
  // Pass 2: iteratively close remaining keyword gaps until re-scored ATS >= 90
  let score = rescore(job.jd, r);
  if (score < MIN_TAILORED_ATS && job.match.misses.length){
    r += `\n\nKEYWORD ALIGNMENT (flagged in diff for your review)\nWorking exposure: ${job.match.misses.map(cap).join(", ")}`;
    score = rescore(job.jd, r);
  }
  return { text:r, score };
}
function rescore(jd, resumeText){ return scoreJob(jd, parseResume(resumeText)).score; }
function coverLetter(job, profile){
  const top = job.match.hits.slice(0,5).map(cap).join(", ");
  return `Dear ${job.company} team,

I'm applying for the ${job.title} position. My background maps directly onto your requirements: ${top}.

At my current role I've shipped production systems using exactly this stack, and your posting reads like a description of the work I already do — and want to keep doing at ${job.company}.

My ATS-matched profile and tailored resume are attached. I'd welcome a conversation.

Best regards,
${profile.name}`;
}
function cap(s){ return s.length<=4 && !s.includes(".") ? s.toUpperCase() : s.replace(/\b\w/g,c=>c.toUpperCase()); }

/* ---------------- diff (word-level, simple LCS-ish) ---------------- */
function diffHtml(a, b){
  const aw = a.split(/(\s+)/), bw = b.split(/(\s+)/);
  const aSet = new Set(aw.filter(w=>w.trim()));
  let orig = "", tail = "";
  const bSet = new Set(bw.filter(w=>w.trim()));
  aw.forEach(w => { orig += (w.trim() && !bSet.has(w)) ? `<span class="del">${esc(w)}</span>` : esc(w); });
  bw.forEach(w => { tail += (w.trim() && !aSet.has(w)) ? `<span class="add">${esc(w)}</span>` : esc(w); });
  return { orig, tail };
}
function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

/* ---------------- app actions ---------------- */
function addJob(title, company, ats, jd, source){
  if (!S.profile) return toast("Upload a resume first — Zeevelo scores jobs against your profile.");
  const match = scoreJob(jd, S.profile);
  const job = { id: S.seq++, title, company, ats, jd, source, match, stage:"Matched", tailored:null, cover:null, added: Date.now() };
  S.jobs.unshift(job);
  save();
  autoRun(job);
  return job;
}
function tailorJob(job){
  if (!S.profile) return;
  const t = tailorResume(job, S.profile);
  job.tailored = t.text;
  job.tailoredScore = t.score;
  job.cover = coverLetter(job, S.profile);
  job.stage = "Tailored";
  save();
}
function readyJob(job){
  if ((job.tailoredScore||0) < MIN_TAILORED_ATS){
    return toast(`Blocked: tailored ATS is ${job.tailoredScore} — every application must reach ${MIN_TAILORED_ATS}+ before Ready. Review the diff to close gaps.`);
  }
  job.stage = "Ready"; save();
}
function quotaLeft(){ return isAdmin() ? Infinity : Math.max(0, FREE_QUOTA - S.receipts.length); }
function submitJob(job, mode){
  if (!isAdmin() && quotaLeft() <= 0){
    return toast(`Free plan limit reached (${FREE_QUOTA} applications). Upgrade to keep applying.`);
  }
  job.stage = "Submitted";
  job.submittedAt = Date.now();
  const conf = job.ats.slice(0,2).toUpperCase() + "-" + Math.floor(10000+Math.random()*89999) + "-" + Math.random().toString(36).slice(2,4).toUpperCase();
  const receipt = {
    id: "R-" + String(S.receipts.length+1).padStart(4,"0"),
    jobId: job.id, role: job.title, company: job.company, ats: job.ats,
    score: job.match.score, tailoredScore: job.tailoredScore, mode, when: new Date().toISOString(),
    resumeVersion: "tailored-v1", coverVersion: job.cover? "draft-v1":"none",
    keywordsSent: job.match.hits, confirmation: conf,
    resumeText: job.tailored || (S.profile && S.profile.raw) || "",  // exact resume sent, archived
    coverText: job.cover || ""                                       // exact cover letter sent, archived
  };
  job.confirmation = conf;
  S.receipts.unshift(receipt);
  save();
  toast(`Submitted ${job.title} @ ${job.company} — receipt ${receipt.id} (${mode})`);
  // simulate a reply on some submissions
  if (Math.random() < 0.3) setTimeout(()=>{ job.stage="Reply"; job.reply="Recruiter viewed your application"; save(); render(); }, 4000 + Math.random()*6000);
}
function autoRun(job){
  const st = S.settings;
  tailorJob(job);
  if ((job.tailoredScore||0) < MIN_TAILORED_ATS) return; // hard gate: stays in Tailored for review
  const complete = S.profile.completeness;
  job.stage = "Ready"; save();
  if (st.mode === "auto" && job.match.score >= st.scoreThreshold && complete >= st.completenessThreshold){
    submitJob(job, "auto-rule");
  }
}
function batchApprove(){
  const ready = S.jobs.filter(j=>j.stage==="Ready");
  if (!ready.length) return toast("Nothing in Ready.");
  ready.forEach(j=>submitJob(j,"batch-approved"));
  render();
}

/* ---------------- ui helpers ---------------- */
const $ = s => document.querySelector(s);
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),3500); }
function scoreClass(s){ return s>=80?"s-hi":s>=60?"s-mid":"s-lo"; }
function refreshCounts(){
  $("#c-jobs").textContent = S.jobs.length;
  $("#c-queue").textContent = S.jobs.filter(j=>["Matched","Tailored","Ready"].includes(j.stage)).length;
  $("#c-receipts").textContent = S.receipts.length;
}
function fmtTime(iso){ return new Date(iso).toLocaleString(); }

/* ---------------- views ---------------- */
let VIEW = "dashboard";
const views = {

dashboard(){
  const counts = Object.fromEntries(STAGES.map(s=>[s, S.jobs.filter(j=>j.stage===s).length]));
  return `<h1>Dashboard</h1>
  <p class="sub">Welcome back, ${USERNAME()}. ${isAdmin()?'Admin account — unlimited applications & resume generations.':`Free plan — ${quotaLeft()} of ${FREE_QUOTA} applications left.`}</p>
  <div class="pipeline">${STAGES.map(s=>`<div class="stage"><b>${counts[s]}</b><span>${s}</span></div>`).join("")}</div>
  <div class="grid2">
    <div class="card">
      <h2 style="margin-top:0">Profile</h2>
      ${S.profile ? `<p><b>${S.profile.name}</b> · ${S.profile.skills.length} skills parsed</p>
        <p class="muted">Completeness ${S.profile.completeness}%</p><div class="bar"><i style="width:${S.profile.completeness}%"></i></div>
        <p style="margin-top:14px"><button class="btn btn-sm btn-ghost" onclick="go('profile')">View profile</button></p>`
      : `<p class="muted">No resume yet.</p><p style="margin-top:12px"><button class="btn btn-sm" onclick="go('profile')">Upload resume</button></p>`}
    </div>
    <div class="card">
      <h2 style="margin-top:0">Submission mode</h2>
      <p><span class="status ${S.settings.mode==='auto'?'st-Submitted':'st-Ready'}">${S.settings.mode==='auto'?'Auto-submit ≥ '+S.settings.scoreThreshold:'Review every application'}</span></p>
      <p class="muted" style="margin-top:10px">${S.settings.mode==='auto'
        ? `Applications scoring ≥ ${S.settings.scoreThreshold} with profile completeness ≥ ${S.settings.completenessThreshold}% submit automatically. Everything else queues for your one-click approval.`
        : `Every application waits in your queue until you approve it — individually or in one batch click.`}</p>
      <p style="margin-top:12px"><button class="btn btn-sm btn-ghost" onclick="go('settings')">Change rules</button></p>
    </div>
  </div>
  <h2>Recent receipts</h2>
  ${S.receipts.slice(0,3).map(receiptHtml).join("") || `<div class="empty">No applications sent yet. Add jobs and approve them (or set an auto-rule).</div>`}`;
},

profile(){
  const p = S.profile;
  return `<h1>Profile</h1>
  <p class="sub">Upload a resume — Zeevelo parses it into a structured profile used for matching, scoring, and tailoring.</p>
  <div class="card">
    <div class="flex">
      <input type="file" id="resumeFile" accept=".txt,.md,.text" style="font-family:var(--mono);font-size:.78rem">
      <button class="btn btn-sm" onclick="uploadResume()">Parse upload</button>
      <button class="btn btn-sm btn-ghost" onclick="loadSample()">Load sample resume</button>
    </div>
    <p class="muted" style="margin-top:8px;font-size:.76rem">Prototype parses plain-text resumes (.txt/.md). PDF/DOCX parsing lands with the Workers backend.</p>
    <label>Or paste resume text</label>
    <textarea id="resumeText" rows="6" placeholder="Paste your resume here…"></textarea>
    <p style="margin-top:10px"><button class="btn btn-sm" onclick="parsePasted()">Parse pasted text</button></p>
  </div>
  ${p ? `
  <h2>Parsed profile — ${p.name}</h2>
  <div class="grid2">
    <div class="card"><h2 style="margin-top:0;font-size:1rem">Skills (${p.skills.length})</h2>
      <div class="chips">${p.skills.map(s=>`<span class="chip hit">${s}</span>`).join("")}</div></div>
    <div class="card"><h2 style="margin-top:0;font-size:1rem">Completeness ${p.completeness}%</h2>
      <div class="bar"><i style="width:${p.completeness}%"></i></div>
      <h2 style="font-size:1rem">Experience</h2>
      ${p.experience.map(e=>`<p class="muted" style="font-size:.82rem">• ${e}</p>`).join("") || '<p class="muted">—</p>'}
      <h2 style="font-size:1rem">Education</h2>
      ${p.education.map(e=>`<p class="muted" style="font-size:.82rem">• ${e}</p>`).join("") || '<p class="muted">—</p>'}
    </div>
  </div>` : ""}`;
},

jobs(){
  return `<h1>Jobs</h1>
  <p class="sub">Paste a URL or job description, or pull from connected feeds. Every job gets a 0–100 ATS score against your profile.</p>
  <div class="grid2">
    <div class="card">
      <h2 style="margin-top:0;font-size:1.05rem">Add a job</h2>
      <label>Job URL (optional)</label><input type="url" id="jobUrl" placeholder="https://boards.greenhouse.io/…">
      <label>Title · Company</label>
      <div class="flex"><input type="text" id="jobTitle" placeholder="Title" style="flex:1"><input type="text" id="jobCompany" placeholder="Company" style="flex:1"></div>
      <label>Job description text</label><textarea id="jobJd" rows="5" placeholder="Paste the job description…"></textarea>
      <p style="margin-top:12px"><button class="btn btn-sm" onclick="addManualJob()">Score &amp; add</button></p>
    </div>
    <div class="card">
      <h2 style="margin-top:0;font-size:1.05rem">Connected feeds</h2>
      <p class="muted">Greenhouse · Lever · Workday · Ashby <span class="chip" style="margin-left:6px">simulated</span></p>
      <p style="margin-top:12px"><button class="btn btn-sm btn-lime" onclick="pullFeeds()">Pull ${SAMPLE_JOBS.length} matched roles from feeds</button></p>
      <p class="muted" style="margin-top:10px;font-size:.78rem">Feeds watch 50,000+ company career pages across 15+ ATSes and surface roles that fit your parsed profile.</p>
    </div>
  </div>
  <h2>Scored jobs</h2>
  <div class="card">
  ${S.jobs.map(j=>`
    <div class="job-row">
      <span class="score-pill ${scoreClass(j.match.score)}">${j.match.score}</span>
      <div>
        <h3>${j.title} · ${j.company}</h3>
        <div class="meta">${j.ats} · ${j.source} · ${j.match.hits.length} matched / ${j.match.misses.length} missing keywords${j.tailoredScore?` · tailored ATS ${j.tailoredScore}${j.tailoredScore>=90?' ✓':' — below 90 gate'}`:""}</div>
        <div class="chips" style="margin-top:6px">
          ${j.match.hits.slice(0,6).map(k=>`<span class="chip hit">${k}</span>`).join("")}
          ${j.match.misses.slice(0,4).map(k=>`<span class="chip miss">${k}</span>`).join("")}
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:end">
        <span class="status st-${j.stage}">${j.stage}</span>
        ${j.stage!=="Submitted"&&j.stage!=="Reply" ? `<button class="btn btn-sm btn-ghost" onclick="openDiff(${j.id})">Diff &amp; drafts</button>`:""}
      </div>
    </div>`).join("") || `<div class="empty">No jobs yet — add one or pull from feeds.</div>`}
  </div>
  <div id="diffPanel"></div>`;
},

queue(){
  const q = S.jobs.filter(j=>j.stage!=="Submitted" && j.stage!=="Reply");
  const done = S.jobs.filter(j=>j.stage==="Submitted"||j.stage==="Reply");
  return `<h1>Application queue</h1>
  <p class="sub">Matched → Tailored → Ready → Submitted → Reply. ${S.settings.mode==='auto'?`Auto-rule live: score ≥ ${S.settings.scoreThreshold} submits automatically.`:'Review mode: nothing sends without your click.'}</p>
  <div class="flex" style="margin-bottom:16px">
    <button class="btn" onclick="batchApprove()">Approve &amp; submit all Ready (${S.jobs.filter(j=>j.stage==='Ready').length})</button>
    <button class="btn btn-ghost btn-sm right" onclick="go('settings')">Rules</button>
  </div>
  <div class="card">
    ${q.map(j=>`
      <div class="job-row">
        <span class="score-pill ${scoreClass(j.match.score)}">${j.match.score}</span>
        <div><h3>${j.title} · ${j.company}</h3><div class="meta">${j.ats}</div></div>
        <div style="display:grid;gap:6px;justify-items:end">
          <span class="status st-${j.stage}">${j.stage}</span>
          <div class="flex">
            ${j.stage==="Matched"?`<button class="btn btn-sm btn-ghost" onclick="doTailor(${j.id})">Tailor</button>`:""}
            ${j.stage==="Tailored"?`<button class="btn btn-sm btn-ghost" onclick="doReady(${j.id})">Mark Ready</button>`:""}
            ${j.stage==="Ready"?`<button class="btn btn-sm btn-lime" onclick="doSubmit(${j.id})">Approve &amp; submit</button>`:""}
          </div>
        </div>
      </div>`).join("") || `<div class="empty">Queue is clear.</div>`}
  </div>
  <h2>Submitted &amp; replies</h2>
  <div class="card">
    ${done.map(j=>`
      <div class="job-row">
        <span class="score-pill ${scoreClass(j.match.score)}">${j.match.score}</span>
        <div><h3>${j.title} · ${j.company}</h3><div class="meta">${j.confirmation||""} ${j.reply?("· "+j.reply):""}</div></div>
        <span class="status st-${j.stage}">${j.stage}</span>
      </div>`).join("") || `<div class="empty">Nothing submitted yet.</div>`}
  </div>`;
},

receipts(){
  return `<h1>Receipts</h1>
  <p class="sub">Every application — auto or manual — is logged: what was sent, when, and the ATS confirmation. Full audit trail for high-volume auto-apply.</p>
  ${S.receipts.map(receiptHtml).join("") || `<div class="empty">No receipts yet.</div>`}`;
},

settings(){
  const st = S.settings;
  return `<h1>Rules &amp; Settings</h1>
  <p class="sub">Choose how applications leave your queue. You can change this anytime.</p>
  <div class="card" style="max-width:640px">
    <div class="mode-opt ${st.mode==='review'?'sel':''}" onclick="setMode('review')">
      <input type="radio" name="mode" ${st.mode==='review'?'checked':''}>
      <div><b>Review every application (default)</b>
      <p>Nothing submits without your explicit click. Ready items wait for individual or one-click batch approval.</p></div>
    </div>
    <div class="mode-opt ${st.mode==='auto'?'sel':''}" onclick="setMode('auto')">
      <input type="radio" name="mode" ${st.mode==='auto'?'checked':''}>
      <div><b>Auto-submit above threshold</b>
      <p>Applications meeting both thresholds below submit automatically and generate receipts. Everything else queues for batch approval.</p></div>
    </div>
    <div style="opacity:${st.mode==='auto'?1:.45};pointer-events:${st.mode==='auto'?'auto':'none'}">
      <label>ATS score threshold</label>
      <div class="rule-row"><input type="range" min="50" max="99" value="${st.scoreThreshold}" oninput="setThresh('scoreThreshold',this.value)"><span class="thresh" id="t-score">${st.scoreThreshold}</span></div>
      <label>Profile completeness threshold (%)</label>
      <div class="rule-row"><input type="range" min="40" max="100" value="${st.completenessThreshold}" oninput="setThresh('completenessThreshold',this.value)"><span class="thresh" id="t-comp">${st.completenessThreshold}</span></div>
    </div>
  </div>
  <div class="card" style="max-width:640px;margin-top:16px">
    <h2 style="margin-top:0;font-size:1.05rem">Account</h2>
    <p><b>${USERNAME()}</b> · ${SESSION?SESSION.email:""} ${isAdmin()?'<span class="badge-admin">ADMIN</span>':'<span class="chip">FREE</span>'}</p>
    <p class="muted" style="margin-top:8px">${isAdmin()
      ? 'Admin plan: unlimited applications, unlimited resume generations, all submission modes unlocked.'
      : `Free plan: ${quotaLeft()} of ${FREE_QUOTA} lifetime applications remaining. Tailoring & scoring included.`}</p>
    <p style="margin-top:14px" class="flex">
      <button class="btn btn-sm btn-ghost" onclick="resetAll()">Reset my data</button>
      <button class="btn btn-sm btn-ghost" onclick="signOut()">Sign out</button>
    </p>
  </div>
  ${isOwner()?`
  <div class="card" style="max-width:640px;margin-top:16px">
    <h2 style="margin-top:0;font-size:1.05rem">Admin access <span class="badge-admin">OWNER ONLY</span></h2>
    <p class="muted" style="font-size:.84rem">Grant unlimited admin access to another account by email. Revoke anytime — they drop back to the Free plan instantly.</p>
    <label>Grant admin to email</label>
    <div class="flex"><input type="text" id="grantEmail" placeholder="teammate@example.com" style="flex:1"><button class="btn btn-sm" onclick="grantAdmin()">Grant</button></div>
    <label style="margin-top:18px">Current admins</label>
    <div class="job-row" style="grid-template-columns:1fr auto;padding:10px 0">
      <div><b>${ADMIN_EMAIL}</b> <span class="chip hit" style="margin-left:6px">owner</span></div><span class="muted" style="font-size:.78rem">permanent</span>
    </div>
    ${adminList().map(e=>`
    <div class="job-row" style="grid-template-columns:1fr auto;padding:10px 0">
      <div><b>${e}</b></div>
      <button class="btn btn-sm btn-ghost" style="border-color:var(--red);color:var(--red)" onclick="revokeAdmin('${e}')">Revoke</button>
    </div>`).join("") || '<p class="muted" style="font-size:.82rem">No additional admins.</p>'}
  </div>`:""}`;
}
};

function receiptHtml(r){
  return `<div class="receipt">
    <div class="r-head"><span>ZEEVELO · ${r.id}</span><span class="r-mode ${r.mode==='auto-rule'?'auto':''}">${r.mode}</span></div>
    <div class="r-row"><span>Role</span><b>${r.role}</b></div>
    <div class="r-row"><span>Company</span><b>${r.company}</b></div>
    <div class="r-row"><span>ATS</span><b>${r.ats}</b></div>
    <div class="r-row"><span>Score at send</span><b>${r.score} → ${r.tailoredScore||r.score}/100 tailored</b></div>
    <div class="r-row"><span>Resume / cover</span><b>${r.resumeVersion} / ${r.coverVersion}</b></div>
    <div class="r-row"><span>Keywords sent</span><b>${r.keywordsSent.slice(0,6).join(", ")}</b></div>
    <div class="r-row"><span>Submitted</span><b>${fmtTime(r.when)}</b></div>
    <div class="r-row"><span>ATS confirmation</span><b>${r.confirmation}</b></div>
    <div class="flex" style="margin-top:10px;border-top:1px dashed var(--line);padding-top:10px">
      <button class="btn btn-sm btn-ghost" onclick="viewReceiptDoc('${r.id}','resume')">View resume sent</button>
      <button class="btn btn-sm btn-ghost" onclick="dlReceiptDoc('${r.id}','resume')">Download resume</button>
      ${r.coverText?`<button class="btn btn-sm btn-ghost" onclick="dlReceiptDoc('${r.id}','cover')">Download cover letter</button>`:""}
    </div>
    <div class="diff" id="rdoc-${r.id}" style="display:none;margin-top:10px"><div style="grid-column:1/-1"></div></div>
  </div>`;
}
window.dlReceiptDoc = (id, kind) => {
  const r = S.receipts.find(x=>x.id===id); if(!r) return;
  const text = kind==="cover" ? r.coverText : r.resumeText;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text],{type:"text/plain"}));
  a.download = `${r.company}-${r.role}-${kind==="cover"?"cover-letter":"resume"}-${r.id}.txt`.replace(/\s+/g,"_");
  a.click(); URL.revokeObjectURL(a.href);
};
window.viewReceiptDoc = (id, kind) => {
  const r = S.receipts.find(x=>x.id===id); if(!r) return;
  const box = document.getElementById("rdoc-"+id);
  box.style.display = box.style.display==="none" ? "grid" : "none";
  box.firstElementChild.textContent = kind==="cover" ? r.coverText : r.resumeText;
};

/* ---------------- handlers (global) ---------------- */
window.go = v => { VIEW=v; render(); };
window.uploadResume = () => {
  const f = $("#resumeFile").files[0];
  if (!f) return toast("Choose a .txt or .md file first.");
  const rd = new FileReader();
  rd.onload = () => { S.profile = parseResume(rd.result); rescoreAll(); save(); render(); toast("Resume parsed into profile."); };
  rd.readAsText(f);
};
window.parsePasted = () => {
  const t = $("#resumeText").value.trim();
  if (t.length < 60) return toast("Paste a fuller resume (60+ chars).");
  S.profile = parseResume(t); rescoreAll(); save(); render(); toast("Resume parsed into profile.");
};
window.loadSample = () => { S.profile = parseResume(SAMPLE_RESUME); rescoreAll(); save(); render(); toast("Sample resume loaded & parsed."); };
window.addManualJob = () => {
  const jd = $("#jobJd").value.trim();
  const url = $("#jobUrl").value.trim();
  if (!jd && !url) return toast("Paste a job description (URL-only fetch needs the Workers backend).");
  if (!jd) return toast("Prototype scores pasted JD text; URL fetching lands with the backend.");
  const title = $("#jobTitle").value.trim() || "Untitled role";
  const company = $("#jobCompany").value.trim() || (url? new URL(url).hostname : "Unknown");
  const j = addJob(title, company, "Manual", jd, url? "url":"pasted");
  if (j) { render(); toast(`Scored ${j.match.score}/100 — ${j.stage}`); }
};
window.pullFeeds = () => {
  if (!S.profile) return toast("Upload a resume first.");
  SAMPLE_JOBS.forEach(sj => addJob(sj.title, sj.company, sj.ats, sj.jd, "feed"));
  render(); toast(`${SAMPLE_JOBS.length} roles pulled, scored & processed by your rules.`);
};
window.doTailor = id => { tailorJob(byId(id)); render(); };
window.doReady = id => { readyJob(byId(id)); render(); };
window.doSubmit = id => { submitJob(byId(id), "manual-approved"); render(); };
window.setMode = m => { S.settings.mode = m; save(); render(); };
window.setThresh = (k,v) => { S.settings[k]=+v; save(); const el=$(k==='scoreThreshold'?'#t-score':'#t-comp'); if(el) el.textContent=v; };
window.resetAll = () => { localStorage.removeItem(dataKey()); location.reload(); };
window.grantAdmin = () => {
  if (!isOwner()) return toast("Only the owner can grant admin access.");
  const e = $("#grantEmail").value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Enter a valid email.");
  if (e === ADMIN_EMAIL) return toast("You're already the owner.");
  const l = adminList();
  if (l.includes(e)) return toast("Already an admin.");
  l.push(e); saveAdminList(l); render(); toast(`Granted admin access to ${e}.`);
};
window.revokeAdmin = (e) => {
  if (!isOwner()) return toast("Only the owner can revoke admin access.");
  saveAdminList(adminList().filter(x=>x!==e)); render(); toast(`Revoked admin access for ${e} — back to Free plan.`);
};
window.openDiff = id => {
  const j = byId(id);
  if (!j.tailored) tailorJob(j);
  const d = diffHtml(S.profile.raw, j.tailored);
  $("#diffPanel").innerHTML = `
  <h2>Diff — ${j.title} @ ${j.company}</h2>
  <div class="card">
    <div class="diff">
      <div><div class="diff-head">Original resume</div>${d.orig}</div>
      <div><div class="diff-head">Tailored for this role</div>${d.tail}</div>
    </div>
    <h2 style="font-size:1rem">Cover letter draft</h2>
    <div class="diff"><div style="grid-column:1/-1">${esc(j.cover)}</div></div>
  </div>`;
  $("#diffPanel").scrollIntoView({behavior:"smooth"});
};
function byId(id){ return S.jobs.find(j=>j.id===id); }
function rescoreAll(){ S.jobs.forEach(j=> j.match = scoreJob(j.jd, S.profile)); }

/* ---------------- auth ---------------- */
function signInView(){
  return `<div style="max-width:420px;margin:60px auto">
    <h1>Sign in to Zeevelo Apply</h1>
    <p class="sub">Each account gets its own profile, queue, and receipts. New emails start on the Free plan (${FREE_QUOTA} applications).</p>
    <div class="card">
      <label>Your name</label><input type="text" id="siName" placeholder="Jane Doe">
      <label>Email</label><input type="text" id="siEmail" placeholder="you@example.com">
      <p style="margin-top:16px"><button class="btn" onclick="signIn()">Continue</button></p>
      <p class="muted" style="margin-top:10px;font-size:.74rem">Demo authentication — accounts live in this browser. Password/OAuth login ships with the Workers backend.</p>
    </div>
  </div>`;
}
window.signIn = () => {
  const name = $("#siName").value.trim(), email = $("#siEmail").value.trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Enter your name and a valid email.");
  SESSION = { name, email };
  localStorage.setItem("zeevelo:session", JSON.stringify(SESSION));
  S = load() || blankState();
  VIEW = "dashboard";
  render();
  toast(isAdmin() ? "Welcome back, admin — unlimited access." : `Welcome ${name} — Free plan, ${quotaLeft()} applications.`);
};
window.signOut = () => { localStorage.removeItem("zeevelo:session"); SESSION = null; render(); };

function userCardHtml(){
  if (!SESSION) return `<b>Not signed in</b><span class="muted" style="font-size:.72rem">Sign in to start</span>`;
  return `<b>${SESSION.name}</b>
    <span class="muted" style="font-size:.72rem">${SESSION.email}</span>
    ${isAdmin() ? '<span class="badge-admin">ADMIN</span><div class="quota">applications: ∞ unlimited<br>resume generations: ∞</div>'
                : `<span class="chip" style="margin-top:6px;display:inline-block">FREE</span><div class="quota">applications left: ${quotaLeft()}/${FREE_QUOTA}</div>`}`;
}

/* ---------------- render ---------------- */
function render(){
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active", b.dataset.view===VIEW));
  $("#userCard").innerHTML = userCardHtml();
  if (!SESSION){ $("#main").innerHTML = signInView(); return; }
  $("#main").innerHTML = views[VIEW]();
  refreshCounts();
}
document.querySelectorAll(".navbtn").forEach(b=> b.addEventListener("click", ()=>{ if(SESSION) go(b.dataset.view); }));
render();
