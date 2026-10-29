import fs from 'node:fs/promises';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(root, 'content', name + '.json'), 'utf8'));
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const template = await fs.readFile(path.join(root, 'site/layout.html'), 'utf8');
const assetManifest = await readJson('assets-manifest');
const localAssets = new Map(assetManifest.assets.filter((asset) => asset.status === 'downloaded').map((asset) => [asset.sourceUrl, '/assets/course/' + path.basename(asset.localPath)]));
const assetPaths = new Map([...localAssets].map(([url, local]) => [new URL(url).pathname, local]));
const localImage = (url) => {
  if (localAssets.has(url)) return localAssets.get(url);
  try { return assetPaths.get(new URL(url).pathname) || url; } catch { return ''; }
};
const clean = (html) => sanitizeHtml(html, {
  allowedTags: ['p','h1','h2','h3','h4','strong','b','em','i','ul','ol','li','figure','figcaption','div','img','a','br','table','thead','tbody','tr','td','th','blockquote','sup','sub'],
  allowedAttributes: {a:['href','target','rel'],img:['src','alt','loading','decoding'],ol:['start'],td:['colspan','rowspan'],th:['colspan','rowspan']},
  allowedSchemes: ['https','http','mailto'],
  allowProtocolRelative: false,
  transformTags: {
    h1: 'h2',
    a: (tagName, attribs) => ({tagName, attribs:{href:attribs.href || '',target:'_blank',rel:'noopener noreferrer'}}),
    img: (tagName, attribs) => ({tagName, attribs:{src:localImage(attribs.src || ''),alt:attribs.alt || 'Course illustration',loading:'lazy',decoding:'async'}})
  }
});
const plainText = (html) => sanitizeHtml(html, {allowedTags:[],allowedAttributes:{}});
const definitions = [
  {key:'general-b',label:'General B',title:'The craft of construction.',description:'From planning and estimating to structural work, core trades, and jobsite safety. Build a clear understanding of how the work comes together.',symbol:'⌂',tone:'',order:['planning-estimating','framing-and-structural-components','core-trades','finish-trades','safety'],path:'/general-b-course'},
  {key:'law-and-business',label:'Law & Business',title:'The business behind the build.',description:'Understand the responsibilities of running a contracting business, from licensing and finance to contracts, employment, and public works.',symbol:'▤',tone:'orange',order:['business-organization-and-licensing','business-finances','employment-requirements','insurance-and-liens','contract-requirements-and-execution','public-works','safety'],path:'/law-and-business'}
];
const tracks = await Promise.all(definitions.map(async (definition) => {
  const source = await readJson(definition.key);
  const lessons = source.items.filter((item) => item.chapterHtml.trim()).sort((a,b) => definition.order.indexOf(a.slug) - definition.order.indexOf(b.slug)).map((item,index) => ({
    ...item,
    title:item.name,
    track:definition.key,
    trackLabel:definition.label,
    chapterNumber:index + 1,
    path:'/lessons/' + definition.key + '/' + item.slug,
    readingMinutes:Math.max(1,Math.ceil(plainText(item.chapterHtml).split(/\s+/).filter(Boolean).length / 220))
  }));
  return {...definition,lessons,tests:source.items.filter((item) => item.practiceTestUrl)};
}));
const lessons = tracks.flatMap((track) => track.lessons);
const catalog = lessons.map(({id,slug,title,track,trackLabel,path,readingMinutes,chapterNumber}) => ({id,slug,title,track,trackLabel,path,readingMinutes,chapterNumber}));
const trackCard = (track) => '<a class="track-card ' + track.tone + '" href="' + track.path + '"><div class="card-kicker"><span>Study track</span><span>' + String(track.lessons.length).padStart(2,'0') + ' chapters</span></div><span class="track-icon" aria-hidden="true">' + track.symbol + '</span><h3>' + escape(track.label) + '</h3><p>' + escape(track.description) + '</p><span class="track-link">Explore this track <span aria-hidden="true">↗</span></span></a>';
const lessonCard = (lesson) => '<a class="lesson-card" href="' + lesson.path + '" data-lesson-id="' + lesson.id + '" data-track="' + lesson.track + '" data-title="' + escape(lesson.title.toLowerCase()) + '"><div class="lesson-meta"><span>' + escape(lesson.trackLabel) + '</span><span class="lesson-index">' + String(lesson.chapterNumber).padStart(2,'0') + '</span></div><h2>' + escape(lesson.title) + '</h2><div class="lesson-card-bottom"><span><span class="lesson-default">' + lesson.readingMinutes + ' min read</span><span class="lesson-complete">✓ Completed</span></span><span class="lesson-arrow" aria-hidden="true">↗</span></div></a>';
const filters = (active='all') => '<div class="filter-tabs" aria-label="Filter course tracks">' + [['all','All chapters'],['general-b','General B'],['law-and-business','Law & Business']].map(([key,label]) => '<button type="button" data-filter="' + key + '" aria-pressed="' + (active === key) + '">' + label + '</button>').join('') + '</div>';
const button = (href,label,style='dark') => '<a class="button button-' + style + '" href="' + href + '">' + label + '<span aria-hidden="true">↗</span></a>';
const pages = [];
async function writePage(route,title,description,content,page) {
  const relative = route === '/' ? 'index.html' : route.replace(/^\//,'') + '.html';
  const destination = path.join(output,relative);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  const values={TITLE:escape(title + ' | The Contractor’s Course'),DESCRIPTION:escape(description),CONTENT:content,PAGE:escape(page)};
  await fs.writeFile(destination,template.replace(/\{\{([A-Z]+)\}\}/g,(_,key) => values[key] ?? ''));
  pages.push({route,file:relative});
}
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(path.join(output,'assets/course'),{recursive:true});
await fs.mkdir(path.join(output,'data'),{recursive:true});
await fs.copyFile(path.join(root,'site/site.css'),path.join(output,'assets/site.css'));
await fs.copyFile(path.join(root,'site/app.js'),path.join(output,'assets/app.js'));
for (const asset of assetManifest.assets.filter((asset) => asset.status === 'downloaded')) await fs.copyFile(path.join(root,asset.localPath),path.join(output,'assets/course',path.basename(asset.localPath)));
await fs.writeFile(path.join(output,'favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#171c19"/><path d="M10 31v-6a14 14 0 0 1 10-13v13m8-13a14 14 0 0 1 10 13v6M21 10h6v15h-6zM8 31h32v6H8z" fill="none" stroke="#e58034" stroke-width="3" stroke-linejoin="round"/></svg>');

const home = '<div class="container"><section class="hero"><div><div class="eyebrow">California contractor exam prep</div><h1>Build your<br>next <span>chapter.</span></h1><p class="hero-description">The knowledge behind a confident contractor. Explore clear, practical lessons in construction, law, and business, with the tools to keep moving forward.</p><div class="hero-actions">' + button('/dashboard','Explore the course') + '<a class="button button-ghost" href="/flash-cards">Try the flashcards <span aria-hidden="true">↗</span></a></div><p class="hero-note">Your pace. Your progress. A stronger foundation.</p></div><div class="hero-art" aria-label="A structured path through General B construction and Law and Business"><div class="art-top"><span>THE FOUNDATION FOR WHAT’S NEXT</span><span class="art-tag">CALIFORNIA</span></div><div class="art-center"><div class="art-caption">A little progress, built on every day.</div><div class="building" aria-hidden="true"><span></span><span></span><span></span><span></span></div><span class="art-line" aria-hidden="true">BUILD</span></div><div class="art-bottom"><div><strong>From the ground up.</strong><span>Two tracks. One clear direction.</span></div><span class="circle-arrow" aria-hidden="true">↗</span></div></div></section><div class="stat-strip"><div><strong>12</strong><span>In-depth study chapters</span></div><div><strong>81</strong><span>Quick-review flashcards</span></div><div><strong>02</strong><span>Focused study tracks</span></div><div><strong>24/7</strong><span>Learn on your schedule</span></div></div><section class="section"><div class="section-top"><div><div class="eyebrow">A practical path forward</div><h2>Know the trade.<br>Understand the business.</h2></div><p>A strong contractor needs both. Work through two focused tracks, one chapter at a time.</p></div><div class="track-grid">' + tracks.map(trackCard).join('') + '</div></section></div><section class="tools-section"><div class="container section"><div class="section-top"><div><div class="eyebrow">Make the knowledge stick</div><h2>A toolkit for your study routine.</h2></div></div><div class="tool-grid"><div class="tool"><span class="tool-number">01 / LEARN</span><h3>Go beyond memorizing.</h3><p>Read detailed chapters with practical explanations, illustrations, and examples from the course.</p><a href="/dashboard">Browse all chapters ↗</a></div><div class="tool"><span class="tool-number">02 / REVIEW</span><h3>Small cards. Solid recall.</h3><p>Practice 81 questions, reveal the answers, and mark the concepts you know as you go.</p><a href="/flash-cards">Start a review session ↗</a></div><div class="tool"><span class="tool-number">03 / PRACTICE</span><h3>Put your learning to work.</h3><p>Open the General B and Law & Business practice tests to check your understanding.</p><a href="/practice-tests">Find your practice test ↗</a></div></div></div></section><div class="container"><section class="cta-panel"><div><h2>Your next step starts with the first chapter.</h2><p>Pick a track. Get comfortable. Start building your knowledge.</p></div>' + button('/dashboard','Start learning','orange') + '</section></div>';
await writePage('/','California contractor exam study hub','Study General B construction and Law and Business with 12 chapters, 81 flashcards, and practice tests.',home,'home');

for (const track of [null,...tracks]) {
  const route = track?.path || '/dashboard';
  const selected = track?.key || 'all';
  const title = track ? track.label + ' course' : 'A stronger foundation.';
  const intro = track ? track.description : 'Your study library, all in one place. Choose a chapter, pick up where you left off, and keep your momentum.';
  const body = '<div class="container"><div class="page-head"><div class="eyebrow">Your course library</div><h1>' + escape(title) + '</h1><p>' + escape(intro) + '</p></div><section class="progress-panel" aria-label="Learning progress"><div><div class="progress-heading"><strong>Every chapter counts.</strong><span data-progress-count>0 of 12 completed</span></div><div class="progress-track" role="progressbar" aria-label="Chapters completed" aria-valuemin="0" aria-valuemax="12" aria-valuenow="0"><div class="progress-fill"></div></div><p class="progress-note">Progress is saved in this browser.</p></div><a class="button button-light" href="' + lessons[0].path + '" data-resume>Start the first chapter <span aria-hidden="true">↗</span></a></section><div class="library-controls">' + filters(selected) + '<label class="search-wrap"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search chapters" placeholder="Find a chapter…" data-search></label></div><div class="lesson-grid" data-library data-initial-filter="' + selected + '">' + lessons.map(lessonCard).join('') + '</div><p class="empty-state" data-no-results hidden>No chapters match your search. Try another topic.</p></div>';
  await writePage(route,track ? track.label + ' course' : 'Course library',intro,body,'dashboard');
}

for (const track of tracks) {
  const sidebar = '<aside class="reader-sidebar"><a href="/dashboard">← Back to the library</a>' + tracks.map((group) => '<div class="sidebar-label">' + escape(group.label) + '</div>' + group.lessons.map((lesson) => '<a href="' + lesson.path + '" data-sidebar-lesson="' + lesson.id + '"><span class="sidebar-num">' + String(lesson.chapterNumber).padStart(2,'0') + '</span><span>' + escape(lesson.title) + '</span></a>').join('')).join('') + '</aside>';
  for (const lesson of track.lessons) {
    const index = lessons.findIndex((item) => item.id === lesson.id);
    const previous = lessons[index - 1];
    const next = lessons[index + 1];
    const nav = '<nav class="lesson-nav" aria-label="More chapters">' + (previous ? '<a href="' + previous.path + '"><span>← Previous chapter</span><strong>' + escape(previous.title) + '</strong></a>' : '') + (next ? '<a href="' + next.path + '"><span>Next chapter →</span><strong>' + escape(next.title) + '</strong></a>' : '<a href="/practice-tests"><span>Put it into practice →</span><strong>Explore the practice tests</strong></a>') + '</nav>';
    const body = '<div class="reader-shell">' + sidebar + '<article class="reader-article" data-current-lesson="' + lesson.id + '"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/dashboard">Course library</a><span>/</span><a href="' + track.path + '">' + escape(track.label) + '</a><span>/</span><span>Chapter ' + lesson.chapterNumber + '</span></nav><header class="lesson-header"><div class="eyebrow">' + escape(track.label) + '</div><h1>' + escape(lesson.title) + '</h1><div class="reading-meta"><span>Chapter ' + lesson.chapterNumber + ' of ' + track.lessons.length + '</span><span>' + lesson.readingMinutes + ' min read</span></div></header><div class="reader-tools"><span>Go at your own pace. Pick up anytime.</span><button class="button button-light" data-complete="' + lesson.id + '" aria-pressed="false">Mark complete <span aria-hidden="true">✓</span></button></div><div class="reader-content">' + clean(lesson.chapterHtml) + '</div>' + nav + '<p class="study-note">Original course study material. For current licensing and application information, consult the <a href="https://www.cslb.ca.gov/" target="_blank" rel="noopener noreferrer">California Contractors State License Board</a>.</p></article></div>';
    await writePage(lesson.path,lesson.title,'Study ' + lesson.title + ' in the ' + track.label + ' contractor exam course.',body,'lesson');
  }
}
const cardsSource = await readJson('flash-cards');
const cards = cardsSource.items.sort((a,b) => Number(a.name) - Number(b.name)).map(({id,question,answer,type}) => ({id,question:clean(question),answer:clean(answer),type}));
const cardTypes = [...new Set(cards.map((card) => card.type))].sort();
const deckFilters = '<div class="filter-tabs" aria-label="Filter flashcards"><button type="button" data-card-filter="all" aria-pressed="true">All cards</button>' + cardTypes.map((type) => '<button type="button" data-card-filter="' + escape(type) + '" aria-pressed="false">' + escape(type) + '</button>').join('') + '</div>';
const deck = '<div class="container page-head"><div class="eyebrow">Build your recall</div><h1>Little by little.<br>Know it by heart.</h1><p>Give a question a moment. Flip to reveal the answer. Keep reviewing until the concepts feel familiar.</p></div><section class="deck-container" aria-label="Flashcard study session"><div class="deck-toolbar">' + deckFilters + '<button class="button button-light" data-shuffle>Shuffle <span aria-hidden="true">⇄</span></button></div><div class="deck-status"><span data-card-position>Card 1 of ' + cards.length + '</span><span data-card-type>' + escape(cards[0].type) + '</span></div><button class="flashcard" data-flashcard aria-pressed="false" aria-label="Flashcard question. Show answer"><span class="flashcard-label" data-card-side>QUESTION</span><span class="flashcard-html" data-card-content>' + cards[0].question + '</span><span class="flashcard-hint" data-card-hint>Click to reveal the answer</span></button><div class="deck-buttons"><div class="deck-controls"><button class="button button-light" data-previous>← Previous</button><button class="button button-light" data-next>Next →</button></div><button class="button button-dark" data-known aria-pressed="false">Got it ✓</button></div><p class="deck-keyboard">Use the arrow keys to move between cards. Select the card to flip it.</p><p class="learned-note" data-learned-count>0 of ' + cards.length + ' marked as learned</p><p class="progress-note" style="text-align:center;margin-top:7px">Your review progress is saved in this browser.</p></section>';
await writePage('/flash-cards','Flashcards','Review 81 contractor exam flashcards covering General B and Law and Business.',deck,'flash-cards');
const testCards = tracks.map((track) => '<article class="test-card"><div class="card-kicker"><span>Practice test</span><span>↗</span></div><div class="track-icon" aria-hidden="true">' + track.symbol + '</div><h2>' + escape(track.label) + '</h2><p>Put your ' + (track.key === 'general-b' ? 'construction knowledge' : 'understanding of contracting law and business') + ' to the test in a focused practice session.</p><a class="button button-dark" href="' + escape(track.tests[0].practiceTestUrl) + '" target="_blank" rel="noopener noreferrer">Open practice test <span aria-hidden="true">↗</span></a></article>').join('');
await writePage('/practice-tests','Practice tests','Practice General B and Law and Business with the course’s existing FlexiQuiz tests.','<div class="container"><div class="page-head"><div class="eyebrow">Put it into practice</div><h1>See what’s sticking.</h1><p>Take the next step from reading to recall. Choose a practice test and check your understanding.</p></div><div class="test-grid">' + testCards + '</div><div class="info-note"><strong>A note before you begin.</strong> Practice tests open on FlexiQuiz in a new tab. Availability and any sign-in requirements are managed by FlexiQuiz. Results from those sessions are separate from your chapter progress here.</div></div>','practice-tests');
await writePage('/404','Page not found','Find your way back to The Contractor’s Course.','<section class="container error-page"><div class="eyebrow" style="justify-content:center">A small detour</div><h1>Let’s get you<br>back on track.</h1><p>This page isn’t here. Your next chapter is.</p>' + button('/dashboard','Go to the course library') + '</section>','404');
await fs.writeFile(path.join(output,'data/catalog.json'),JSON.stringify(catalog));
await fs.writeFile(path.join(output,'data/flashcards.json'),JSON.stringify(cards));
await fs.writeFile(path.join(output,'data/site-manifest.json'),JSON.stringify({lessons:catalog.length,flashcards:cards.length,assets:localAssets.size,pages},null,2));
await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nAllow: /\n');
console.log('Built ' + pages.length + ' pages, ' + catalog.length + ' chapters, ' + cards.length + ' flashcards, and ' + localAssets.size + ' course assets.');
