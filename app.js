// Drago — front end only. Uses free keyless Pollinations by default; Settings API URL overrides.
// Expected backend: POST {api}/chat {messages,image?} -> {reply}; /image {prompt} -> {url}; /video {prompt} -> {url}; /code {prompt} -> {reply}
const $=s=>document.querySelector(s);
// Free mode (default): Pollinations.ai — free, no API key, kid-safe settings. A custom server in Settings overrides it.
const KID="You are Drago, a friendly dragon AI helper for a 10-year-old kid. Be kind, patient, helpful, clear and simple. Use short sentences and simple words, and a few fun emojis. Keep everything kid-safe. If asked about anything unsafe, scary, violent, adult, or about personal information, gently say you can't help with that and suggest asking a trusted grown-up. Never ask for personal info. Do not call the user 'little one'. Keep answers under 120 words and make sure facts are correct.";
const CODER="You are Drago's code helper for a 10-year-old kid. Write complete, runnable code (for web things, ONE full HTML file with CSS and JS inside) in a single code block, then explain it in 2-3 simple sentences. Keep it kid-safe.";
const FREE='https://text.pollinations.ai/openai';
const withTimeout=(ms,f)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return f(c.signal).finally(()=>clearTimeout(t))};
async function freeText(sys,messages){
  const msgs=[{role:'system',content:sys},...messages.slice(-12)];
  let last;
  // 1) OpenAI-style POST  2) plain GET endpoint — both free, no key, CORS-open
  for(let i=0;i<3;i++){try{
    if(i<2){
      const r=await withTimeout(35000,sg=>fetch(FREE,{method:'POST',headers:{'Content-Type':'application/json'},signal:sg,body:JSON.stringify({model:'openai',messages:msgs,safe:true,referrer:'drago'})}));
      if(!r.ok)throw new Error(r.status===429?'busy':'HTTP '+r.status);
      const j=await r.json();const t=(j.choices?.[0]?.message?.content||'').trim();if(t)return t;throw new Error('empty');
    }else{
      const q=messages.filter(m=>m.role==='user').slice(-1)[0]?.content||'hi';
      const r=await withTimeout(35000,sg=>fetch('https://text.pollinations.ai/'+encodeURIComponent(q)+'?safe=true&referrer=drago&system='+encodeURIComponent(sys),{signal:sg}));
      if(!r.ok)throw new Error('HTTP '+r.status);const t=(await r.text()).trim();if(t)return t;throw new Error('empty');
    }
  }catch(e){last=e;console.warn('free AI try',i,e)}}
  throw last;
}
function freeImage(prompt){return new Promise((ok,no)=>{
  const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt+', kid friendly, cartoon style')+'?safe=true&nologo=true&width='+imgW()+'&height='+imgH()+'&seed='+Math.floor(Math.random()*1e6);
  const im=new Image();const tm=setTimeout(()=>no(new Error('slow')),120000);
  im.onload=()=>{clearTimeout(tm);ok({url:u})};im.onerror=()=>{clearTimeout(tm);no(new Error('img'))};im.src=u;})}
// Answer order: online free AI (fast, light on the phone) -> on-device AI (if online fails) -> friendly error.
// Crash guard: if the page died while loading the on-device model (iPhone memory), skip on-device next time.
let bubble=null;
function prog(f){if(!bubble)return;const pc=Math.round(f*100);bubble.innerHTML='🐉 Downloading Drago\'s brain… use Wi-Fi<div class="pbar"><i style="width:'+pc+'%"></i></div><small>'+pc+'% · only the first time</small>'}
if(localStorage.getItem('drago.loadingLocal')){localStorage.removeItem('drago.loadingLocal');localStorage.setItem('drago.local','off')}
async function onDevice(sys,messages,onTok){
  if(localStorage.getItem('drago.local')==='off')throw new Error('nolocal');
  localStorage.setItem('drago.loadingLocal','1');
  try{const L=await import('./local.js');return await L.chat([{role:'system',content:sys},...messages],t=>{onTok&&onTok(t)},prog)}
  finally{localStorage.removeItem('drago.loadingLocal')}
}
async function brain(sys,messages,onTok){
  try{const t=await freeText(sys,messages);onTok&&onTok(t);return t}
  catch(e){console.warn('online AI failed, trying on-device',e);
    if(!navigator.onLine||e)try{return await onDevice(sys,messages,onTok)}catch(e2){console.warn('on-device failed',e2);throw new Error(navigator.onLine?'allfail':'offline')}}
}
const api={
  get url(){return localStorage.getItem('drago.api')||''},
  async call(path,body){
    if(this.url){try{
      const r=await withTimeout(30000,sg=>fetch(this.url.replace(/\/$/,'')+'/'+path,{method:'POST',signal:sg,headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,onTok:undefined})}));
      if(!r.ok) throw new Error('HTTP '+r.status); return await r.json();
    }catch(e){console.warn('custom server failed, using free AI',e)}}
    if(path==='chat'){if(body.image)throw new Error('novision');return{reply:await brain(KID,body.messages.slice(-8),body.onTok)}}
    if(path==='code')return{reply:await brain(CODER,[{role:'user',content:body.prompt+(codeKind?' '+codeKind:'')}],body.onTok)};
    if(path==='image')return freeImage(body.prompt+(imgStyle?', '+imgStyle:''));
    if(path==='video')throw new Error('novideo');
    throw new Error('nc');
  }
};
const errText=e=>({novision:"📷 I can't look at pictures yet in free mode — but tell me about it in words and I'll help!",
  novideo:"🎬 Video making is coming soon! For now, try the Image tab to make a picture. 🐉",
  busy:"🐉💤 Lots of people are using the free AI right now. Wait a few seconds and try again!",
  slow:"🐢 The picture is taking too long. Please try again!",
  img:"😕 I couldn't make that picture. Try different words!",
  allfail:"🐉 Drago's brain is having trouble right now. Please wait a minute and try again! (If it keeps happening, try Wi-Fi.)",
  offline:"📶 You're offline. Connect to Wi-Fi or data and ask again!",
  AbortError:"🐢 That took too long. Please try again!"})[e.message==='nc'?'':(e.name==='AbortError'?'AbortError':e.message)]||"😕 Oops, I couldn't reach the AI. Check the internet and try again!";
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function add(box,html,cls){const d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
const typing='<span class="typing"><b></b><b></b><b></b></span>';
function codeify(t){return esc(t).replace(/```\w*\n?([\s\S]*?)```/g,(_,c)=>'<pre>'+(/&lt;(!doctype|html|body|canvas|button|div|script)/i.test(c)?'<button type="button" class="save" aria-label="Save this code as a file">⬇ Save</button><button type="button" class="run">▶ Run it</button>':'')+'<button class="copy">Copy</button><code>'+c+'</code></pre>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}
// Tiny floating "Copied!" toast (shared by answer Copy and code Copy)
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t)}
  t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1600)}
document.addEventListener('click',e=>{if(e.target.classList.contains('copy')){navigator.clipboard?.writeText(e.target.nextSibling.textContent);e.target.textContent='Copied ✓';toast('📋 Copied!');setTimeout(()=>e.target.textContent='Copy',1500)}});
// Code Lab: "Run it" shows web code working, inside a safe sandbox box (no access to Drago or your data)
document.addEventListener('click',e=>{const b=e.target.closest('.run');if(!b)return;const pre=b.closest('pre');let f=pre.nextElementSibling;
  if(f&&f.classList.contains('preview')){f.remove();b.textContent='▶ Run it';return}
  f=document.createElement('iframe');f.className='preview';f.title='Your code running';f.setAttribute('sandbox','allow-scripts');f.srcdoc=pre.querySelector('code').textContent;
  pre.after(f);b.textContent='✖ Close';f.scrollIntoView({behavior:'smooth',block:'nearest'})});
// Code Lab: "Save" downloads web code as an .html file you can open later
document.addEventListener('click',e=>{const b=e.target.closest('.save');if(!b)return;const code=b.closest('pre').querySelector('code').textContent;
  const u=URL.createObjectURL(new Blob([code],{type:'text/html'}));const a=document.createElement('a');a.href=u;a.download='drago-code.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
  b.textContent='Saved ✓';setTimeout(()=>b.textContent='⬇ Save',1500)});
// read-aloud button on Drago's chat replies (browser voice, no key needed)
function addSpeak(el){addCopy(el);if(!('speechSynthesis' in window))return;const b=document.createElement('button');b.type='button';b.className='speak';b.textContent='🔊 Read aloud';b.setAttribute('aria-label','Read this answer out loud');el.appendChild(b)}
// Chat: "Copy answer" button copies Drago's reply text
function addCopy(el){el.appendChild(document.createElement('br'));const b=document.createElement('button');b.type='button';b.className='copyans';b.textContent='📋 Copy';b.setAttribute('aria-label','Copy this answer');el.appendChild(b);if(navigator.share){const sh=document.createElement('button');sh.type='button';sh.className='shareans';sh.textContent='📤 Share';sh.setAttribute('aria-label','Share this answer');el.appendChild(sh)}}
document.addEventListener('click',async e=>{const b=e.target.closest('.copyans');if(!b)return;const txt=[...b.parentNode.childNodes].filter(n=>!(n.nodeType===1&&n.matches('button,.speak,.copyans'))).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim();
  try{await navigator.clipboard.writeText(txt);b.textContent='Copied ✓';toast('📋 Copied!')}catch(_){b.textContent='Could not copy';toast('Could not copy')}setTimeout(()=>b.textContent='📋 Copy',1500)});
// Chat: "Share" button sends Drago's answer to Messages, Notes, etc. (only where the phone supports sharing)
document.addEventListener('click',async e=>{const b=e.target.closest('.shareans');if(!b)return;const txt=[...b.parentNode.childNodes].filter(n=>!(n.nodeType===1&&n.matches('button'))).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim();if(!txt)return;
  try{await navigator.share({title:'Drago says',text:'🐉 Drago says: '+txt});b.textContent='Shared ✓';setTimeout(()=>b.textContent='📤 Share',1500)}catch(_){}});
document.addEventListener('click',e=>{const b=e.target.closest('.speak');if(!b)return;const ss=window.speechSynthesis;
  if(b.classList.contains('live')){ss.cancel();return}
  ss.cancel();document.querySelectorAll('.speak.live').forEach(x=>{x.classList.remove('live');x.textContent='🔊 Read aloud'});
  const txt=[...b.parentNode.childNodes].filter(n=>n!==b&&!(n.nodeName==='PRE')&&!(n.nodeName==='BUTTON')).map(n=>n.textContent).join(' ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu,'').trim();
  if(!txt)return;const u=new SpeechSynthesisUtterance(txt);u.lang='en-US';u.rate=talkRate();
  const done=()=>{b.classList.remove('live');b.textContent='🔊 Read aloud'};u.onend=done;u.onerror=done;
  b.classList.add('live');b.textContent='⏹ Stop';ss.speak(u)});
// splash
$('#start').onclick=()=>{$('#splash').classList.add('gone');localStorage.setItem('drago.seen',1)};
if(localStorage.getItem('drago.seen')&&!location.search.includes('splash'))$('#splash').classList.add('gone');
// tabs
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#t-'+b.dataset.t).classList.add('on')});
// chat
const msgs=$('#msgs'),hist=[];
async function ask(text,image){
  const t=add(msgs,typing+'<span class="think" aria-live="polite">Drago is thinking…</span>','bot');
  try{bubble=t;const r=await api.call('chat',{messages:hist.slice(),image,onTok:x=>{bubble=null;t.innerHTML=codeify(x);msgs.scrollTop=msgs.scrollHeight}});bubble=null;t.innerHTML=codeify(r.reply||'');addSpeak(t);autoTalk(t);hist.push({role:'assistant',content:r.reply});try{localStorage.setItem('drago-asked',(+localStorage.getItem('drago-asked')||0)+1)}catch(_){}}
  catch(e){t.innerHTML=errText(e);t.classList.add('notice');addRetry(t,text,image)}
}
// Chat: when something goes wrong, a "🔁 Try again" button asks Drago the same thing again
function addRetry(t,text,image){const b=document.createElement('button');b.type='button';b.className='retry';b.textContent='🔁 Try again';b.setAttribute('aria-label','Ask Drago the same thing again');
  b.onclick=()=>{t.remove();ask(text,image)};t.appendChild(document.createElement('br'));t.appendChild(b)}
$('#chatF').onsubmit=e=>{e.preventDefault();const v=$('#chatIn').value.trim();if(!v)return;$('#chatIn').value='';addReuse(add(msgs,esc(v),'me'),v);hist.push({role:'user',content:v});ask(v)};
$('#pic').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{add(msgs,'<img src="'+rd.result+'">','me');hist.push({role:'user',content:'What is in this picture?'});ask('',rd.result)};rd.readAsDataURL(f);e.target.value=''};
// studios
function studio(btn,inp,out,path,render){$(btn).onclick=async()=>{const B=$(btn);if(B.disabled)return;const lbl=B.textContent;B.disabled=true;B.classList.add('busy');B.textContent='⏳ Working…';const p=$(inp).value.trim()||$(inp).placeholder;const o=$(out);o.innerHTML='';const t=add(o,typing+(path==='image'?' 🎨 Drawing… (can take ~20s)':path==='code'?' 💻 Writing code…':''),'bot');try{bubble=t;t.innerHTML=render(await api.call(path,{prompt:p,onTok:x=>{bubble=null;t.innerHTML=codeify(x)}}));bubble=null}catch(e){t.innerHTML=errText(e);t.classList.add('notice')}finally{B.disabled=false;B.classList.remove('busy');B.textContent=lbl}}}
// Image Studio: style chips (Cartoon, Pixel art, Watercolor, 3D, Sketch); remembers your pick
let imgStyle=localStorage.getItem('drago.imgStyle')||'';
const styleBox=$('#imgStyle');
function showStyle(){styleBox&&styleBox.querySelectorAll('button').forEach(b=>{const on=b.dataset.s===imgStyle;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
if(styleBox){styleBox.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;imgStyle=b.dataset.s;localStorage.setItem('drago.imgStyle',imgStyle);showStyle()});showStyle()}
studio('#imgGo','#imgIn','#imgOut','image',r=>'<img src="'+esc(r.url)+'" alt="Picture Drago made" style="width:100%;border-radius:14px"><div class="imgacts"><button type="button" class="again">🔁 Make another</button><button type="button" class="savepic" data-u="'+esc(r.url)+'" aria-label="Save this picture">⬇ Save picture</button><a class="open" href="'+esc(r.url)+'" target="_blank" rel="noopener">🔍 Full size</a></div>');
// Image Studio: shape chips (Square, Wide, Tall); remembers your pick
let imgShape=localStorage.getItem('drago.imgShape')||'sq';
const SHAPES={sq:[768,768],wide:[1024,576],tall:[576,1024]};
function imgW(){return(SHAPES[imgShape]||SHAPES.sq)[0]}function imgH(){return(SHAPES[imgShape]||SHAPES.sq)[1]}
const shapeBox=$('#imgShape');
function showShape(){shapeBox&&shapeBox.querySelectorAll('button').forEach(b=>{const on=b.dataset.p===imgShape;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
if(shapeBox){shapeBox.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;imgShape=b.dataset.p;localStorage.setItem('drago.imgShape',imgShape);showShape()});showShape()}
// Image Studio: "Surprise me" fills in a random fun picture idea
const IDEAS=['A dragon baking cupcakes in a cozy kitchen','A robot surfing a giant wave at sunset','A castle made of candy on a cloud','An astronaut cat floating past Saturn','A neon cube racing through a city at night','A friendly octopus playing drums under the sea','A treehouse city in a glowing forest','A penguin knight riding a polar bear','A volcano that erupts rainbow sprinkles','A tiny dragon sleeping in a teacup'];
$('#imgDice').onclick=()=>{const cur=$('#imgIn').value;let n;do{n=IDEAS[Math.floor(Math.random()*IDEAS.length)]}while(n===cur);$('#imgIn').value=n;$('#imgIn').focus()};
// Image Studio: "Make another" paints a new version of the same idea
$('#imgOut').addEventListener('click',e=>{if(e.target.closest('.again'))$('#imgGo').click()});
// Image Studio: "Save picture" downloads the picture (opens it full size if the download is blocked)
$('#imgOut').addEventListener('click',async e=>{const b=e.target.closest('.savepic');if(!b)return;const u=b.dataset.u;b.textContent='Saving…';
  try{const r=await fetch(u);if(!r.ok)throw 0;const bl=await r.blob();const o=URL.createObjectURL(bl);const a=document.createElement('a');a.href=o;a.download='drago-picture.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(o),4000);b.textContent='Saved ✓'}
  catch(_){window.open(u,'_blank','noopener');b.textContent='Opened ✓'}
  setTimeout(()=>b.textContent='⬇ Save picture',1500)});
const VIDEAS=['A cube dashing through a neon city','A baby dragon learning to fly over a rainbow','A rocket blasting off to a candy planet','A robot dancing in a disco under the sea','A cat surfing a giant wave at sunset','A volcano that erupts glitter and confetti','A spaceship racing through a field of glowing asteroids','A penguin riding a skateboard down a snowy mountain'];
$('#vidDice').onclick=()=>{const cur=$('#vidIn').value;let n;do{n=VIDEAS[Math.floor(Math.random()*VIDEAS.length)]}while(n===cur);$('#vidIn').value=n;$('#vidIn').focus()};
studio('#vidGo','#vidIn','#vidOut','video',r=>'<video src="'+esc(r.url)+'" controls autoplay loop playsinline style="width:100%;border-radius:14px"></video><div class="imgacts"><button type="button" class="again" aria-label="Make a new video of the same idea">🔁 Make another</button><a class="open" href="'+esc(r.url)+'" target="_blank" rel="noopener">🔍 Full size</a></div>');
// Video Studio: "Make another" makes a new video of the same idea
$('#vidOut').addEventListener('click',e=>{if(e.target.closest('.again'))$('#vidGo').click()});
// Code Lab: "Surprise me" fills in a random fun coding idea
const CIDEAS=['Make a button that changes color when I click it','Make a dice roller that shows a random number from 1 to 6','Make a star that follows my mouse','Make a simple clicker game with a score','Make a page with a bouncing ball','Make a rainbow text that keeps changing colors','Make a quiz with 3 math questions','Make a stopwatch with start and stop buttons','Make a dragon emoji that jumps when I press space'];
$('#codeDice').onclick=()=>{const cur=$('#codeIn').value;let n;do{n=CIDEAS[Math.floor(Math.random()*CIDEAS.length)]}while(n===cur);$('#codeIn').value=n;$('#codeIn').focus()};
// Code Lab: kind chips (Any, Web page, Game, Python); remembers your pick
let codeKind=localStorage.getItem('drago.codeKind')||'';
const kindBox=$('#codeKind');
function showKind(){kindBox&&kindBox.querySelectorAll('button').forEach(b=>{const on=b.dataset.k===codeKind;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
if(kindBox){kindBox.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;codeKind=b.dataset.k;localStorage.setItem('drago.codeKind',codeKind);showKind()});showKind()}
studio('#codeGo','#codeIn','#codeOut','code',r=>codeify(r.reply||''));
// settings
$('#setBtn').onclick=()=>{$('#apiUrl').value=api.url;$('#sheet').classList.add('on')};
$('#closeSet').onclick=()=>$('#sheet').classList.remove('on');
$('#saveApi').onclick=()=>{localStorage.setItem('drago.api',$('#apiUrl').value.trim());$('#sheet').classList.remove('on')};
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{});
  let reloaded=!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded||document.querySelector('.msg.me'))return;reloaded=true;location.reload()})}
// voice input (Web Speech API); ?listen opens straight into listening
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function listen(){
  if(!SR){add(msgs,"🎤 Talking isn't supported in this browser yet. Try Chrome or Safari, or type instead!",'bot notice');return}
  const r=new SR();r.lang='en-US';r.interimResults=true;const m=$('#mic');m.classList.add('live');
  r.onresult=e=>{$('#chatIn').value=[...e.results].map(x=>x[0].transcript).join('')};
  r.onend=()=>{m.classList.remove('live');if($('#chatIn').value.trim())$('#chatF').requestSubmit()};
  r.onerror=e=>{m.classList.remove('live');if(e.error==='not-allowed')add(msgs,"🎤 I need permission to use the microphone.",'bot notice')};
  r.start();
}
$('#mic').onclick=listen;
if(location.search.includes('listen')){$('#splash').classList.add('gone');listen()}

// idea chips: tap one to ask it; they hide after the first message
const chips=$('#chips');
if(chips)chips.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('#chatIn').value=b.textContent.replace(/^\S+\s/,'');$('#chatF').requestSubmit()});
// Tip of the day: one short tip under the hello; same tip all day, new tip tomorrow
const DAY_TIPS=[
  'Tap 📷 to send Drago a picture',
  "Double-tap Drago's answer to give it a ❤️",
  'Tap the dragon logo for a surprise',
  'Use Image Studio to paint a picture from words',
  'Say Hey Drago on your phone to open Chat ready to listen',
  'Tap 🔀 More ideas for new question chips',
  'Turn on Read answers out loud in Settings',
  'Pick Drago colors in Settings',
  'Press Enter in Image/Video/Code Lab to generate',
  'Tap ✖ to clear what you typed'
];
const dayTip=document.createElement('div');
dayTip.id='daytip';dayTip.className='daytip';dayTip.setAttribute('role','note');
dayTip.setAttribute('aria-label','Tip of the day');
{const d=new Date();const dayKey=d.getFullYear()*1000+Math.floor((d-new Date(d.getFullYear(),0,0))/86400000);dayTip.textContent='💡 Tip: '+DAY_TIPS[dayKey%DAY_TIPS.length]}
const hello=msgs.querySelector('.msg.bot');
if(hello)hello.after(dayTip);else if(chips)chips.before(dayTip);else msgs.appendChild(dayTip);
$('#chatF').addEventListener('submit',()=>{if(chips)chips.hidden=true;dayTip.hidden=true});
// New chat button: clears the conversation (keeps Drago's hello, tip, and the idea chips)
// Uses a soft in-app confirm card instead of the browser's plain confirm()
function wipeChat(){
  window.speechSynthesis&&speechSynthesis.cancel();hist.length=0;bubble=null;
  [...msgs.children].forEach((c,i)=>{if(i>0&&c!==chips&&c!==dayTip)c.remove()});if(chips)chips.hidden=false;dayTip.hidden=false;
  document.querySelector('nav button')?.click();$('#chatIn').value='';$('#chatIn').dispatchEvent(new Event('input'));$('#chatIn').focus()}
function askNewChat(){
  if(!hist.length){wipeChat();return}
  let d=document.getElementById('confirm');
  if(!d){
    d=document.createElement('div');d.id='confirm';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-labelledby','confirmTitle');
    d.innerHTML='<div class="ccard"><div class="cico" aria-hidden="true">🆕</div><h3 id="confirmTitle">Start a new chat?</h3><p>This clears the messages on the screen. Drago will still say hi.</p><div class="cacts"><button type="button" class="ghost ckeep">Keep chatting</button><button type="button" class="cta cgo">Start new</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target===d)d.classList.remove('on')});
    d.querySelector('.ckeep').onclick=()=>d.classList.remove('on');
    d.querySelector('.cgo').onclick=()=>{d.classList.remove('on');wipeChat()};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.classList.contains('on'))d.classList.remove('on')});
  }
  d.classList.add('on');
  setTimeout(()=>d.querySelector('.ckeep')?.focus(),50);
}
$('#newChat').onclick=askNewChat;
// Friendly hello that matches the time of day (morning / afternoon / evening)
(()=>{const h=new Date().getHours(),g=h<5?'Hi, night owl! 🦉':h<12?'Good morning! ☀️':h<17?'Good afternoon! 🌤️':'Good evening! 🌙';
  const first=msgs.firstElementChild;if(first&&first.firstChild&&first.firstChild.nodeType===3)first.firstChild.textContent=first.firstChild.textContent.replace(/^Hi!/,g)})();
// Studios: press Enter to Generate (Shift+Enter still makes a new line)
[['#imgIn','#imgGo'],['#vidIn','#vidGo'],['#codeIn','#codeGo']].forEach(([i,b])=>{const t=$(i);if(t)t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$(b).click()}})});
// Chat: "↓ Latest" pill shows when you scroll up; tap to jump back to the newest messages
(()=>{const box=$('#msgs'),tab=$('#t-chat');if(!box||!tab)return;const b=document.createElement('button');b.type='button';b.className='jumpbot';b.textContent='↓ Latest';b.setAttribute('aria-label','Jump to latest message');tab.appendChild(b);
  const near=()=>box.scrollHeight-box.scrollTop-box.clientHeight<=80;
  const check=()=>b.classList.toggle('on',!near());
  box.addEventListener('scroll',check,{passive:true});
  new MutationObserver(check).observe(box,{childList:true,subtree:true});
  b.onclick=()=>{const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;box.scrollTo({top:box.scrollHeight,behavior:reduce?'auto':'smooth'});b.classList.remove('on')}})();
// Offline banner: a small note at the top when the phone loses internet, hides again when it's back
(()=>{const n=document.createElement('div');n.id='netNote';n.setAttribute('role','status');n.textContent='📶 No internet right now. Drago will try again when you’re back online.';document.body.appendChild(n);
  const upd=()=>n.classList.toggle('show',!navigator.onLine);addEventListener('online',upd);addEventListener('offline',upd);upd()})();
// Tabs: Drago remembers which tab you used last (opening with ?listen always starts on Chat)
(()=>{const btns=[...document.querySelectorAll('nav button')];const mark=()=>btns.forEach(x=>x.setAttribute('aria-current',x.classList.contains('on')?'page':'false'));
  btns.forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem('drago.tab',b.dataset.t)}catch(_){}mark()}));
  let t=null;try{t=localStorage.getItem('drago.tab')}catch(_){}
  if(t&&t!=='chat'&&!location.search.includes('listen')){const b=btns.find(x=>x.dataset.t===t);if(b&&document.getElementById('t-'+t))b.click()}mark()})();
// Studios remember what you were typing (saved on this device), cleared after Generate
['#imgIn','#vidIn','#codeIn'].forEach(s=>{const t=$(s);if(!t)return;const k='drago-draft-'+s.slice(1);try{const v=localStorage.getItem(k);if(v&&!t.value)t.value=v}catch(e){}
t.addEventListener('input',()=>{try{t.value.trim()?localStorage.setItem(k,t.value):localStorage.removeItem(k)}catch(e){}})});
['#imgGo','#vidGo','#codeGo'].forEach(b=>{const x=$(b);if(x)x.addEventListener('click',()=>{try{localStorage.removeItem('drago-draft-'+b.slice(1,-2)+'In')}catch(e){}})});
// Studios: a small ✖ button clears the text box (shows only when there is text)
['#imgIn','#vidIn','#codeIn'].forEach(s=>{const t=$(s);if(!t||t.parentNode.classList.contains('tawrap'))return;const w=document.createElement('div');w.className='tawrap';t.parentNode.insertBefore(w,t);w.appendChild(t);
const b=document.createElement('button');b.type='button';b.className='clr';b.textContent='✖';b.setAttribute('aria-label','Clear the text box');b.title='Clear';w.appendChild(b);
const sync=()=>{b.hidden=!t.value};sync();t.addEventListener('input',sync);
['#imgDice','#vidDice','#codeDice'].forEach(d=>{const x=$(d);if(x)x.addEventListener('click',()=>setTimeout(sync))});
b.onclick=()=>{t.value='';try{localStorage.removeItem('drago-draft-'+s.slice(1))}catch(e){}sync();t.focus()}});
// Chat: the ➤ Send button glows when there is something to send, and looks dim when the box is empty
(()=>{const i=$('#chatIn'),f=$('#chatF');if(!i||!f)return;const s=f.querySelector('.send');if(!s)return;
const sync=()=>s.classList.toggle('ready',!!i.value.trim());i.addEventListener('input',sync);f.addEventListener('submit',()=>setTimeout(sync,50));
document.addEventListener('click',()=>setTimeout(sync,60));setInterval(sync,800);sync()})();
// Chat: "🔀 More ideas" swaps the idea chips for new ones
(()=>{const c=$('#chips');if(!c)return;const POOL=['🦖 Tell me a dinosaur fact','😂 Tell me a joke','🎮 Give me a game idea','🧠 Quiz me on math','🚀 Tell me a space fact','🐉 Tell me a dragon story','🦈 Tell me an ocean fact','🎨 Give me a drawing idea','🧩 Give me a riddle','🌋 How do volcanoes work?','🤖 How do robots think?','⚡ Tell me a science fact'];
const b=document.createElement('button');b.type='button';b.className='more';b.textContent='🔀 More ideas';b.setAttribute('aria-label','Show different ideas');c.appendChild(b);
b.addEventListener('click',e=>{e.stopPropagation();const old=[...c.querySelectorAll('button:not(.more)')];const cur=old.map(x=>x.textContent);const pick=POOL.filter(p=>!cur.includes(p)).sort(()=>Math.random()-.5).slice(0,old.length);old.forEach((x,i)=>{if(pick[i])x.textContent=pick[i]})},true)})();

// Chat: a small ✏️ button on your own messages puts that text back in the box so you can change it and ask again
function addReuse(el,v){const b=document.createElement('button');b.type='button';b.className='reuse';b.textContent='✏️';b.title='Use this again';b.setAttribute('aria-label','Put this message back in the text box');
  b.onclick=()=>{const i=$('#chatIn');i.value=v;i.dispatchEvent(new Event('input'));i.focus();try{i.setSelectionRange(v.length,v.length)}catch(_){}};el.appendChild(b)}
// Chat: each new message shows the time it was sent in small letters (like "1:05 PM")
(()=>{const box=$('#msgs');if(!box)return;const stamp=d=>{if(d.nodeType===1&&d.classList.contains('msg')&&!d.dataset.time)d.dataset.time=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(stamp))).observe(box,{childList:true})})();
// Settings: tap the dark area outside the card, or press Escape, to close it
(()=>{const s=$('#sheet');if(!s)return;s.addEventListener('click',e=>{if(e.target===s)s.classList.remove('on')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&s.classList.contains('on'))s.classList.remove('on')})})();
// Chat: a small ✖ button shows when you have typed something; tap it to empty the box
(()=>{const i=$('#chatIn'),f=$('#chatF');if(!i||!f)return;const s=f.querySelector('.send');const b=document.createElement('button');b.type='button';b.className='icon chatclr';b.textContent='✖';b.title='Clear';b.setAttribute('aria-label','Clear what you typed');f.insertBefore(b,s);
const sync=()=>b.classList.toggle('show',!!i.value);i.addEventListener('input',sync);f.addEventListener('submit',()=>setTimeout(sync,50));document.addEventListener('click',()=>setTimeout(sync,60));setInterval(sync,800);
b.onclick=()=>{i.value='';i.dispatchEvent(new Event('input'));i.focus()};sync()})();
// Chat: Drago remembers what you were typing if you close the app, and puts it back next time (saved on this device)
(()=>{const i=$('#chatIn'),f=$('#chatF');if(!i||!f)return;const k='drago-draft-chat';
try{const v=localStorage.getItem(k);if(v&&!i.value&&!location.search.includes('listen')){i.value=v;i.dispatchEvent(new Event('input'))}}catch(_){}
let last=i.value;const save=()=>{if(i.value===last)return;last=i.value;try{i.value.trim()?localStorage.setItem(k,i.value):localStorage.removeItem(k)}catch(_){}};
i.addEventListener('input',save);f.addEventListener('submit',()=>setTimeout(save,0));setInterval(save,1000);addEventListener('pagehide',save)})();
// Chat: the empty text box shows a new example question every few seconds, to give ideas
(()=>{const i=$('#chatIn');if(!i)return;const P=['Ask Drago anything…','Try: How far away is the Moon?','Try: Tell me a funny joke','Try: Help me name my dragon','Try: How do volcanoes work?','Try: Give me a game idea','Try: What is 12 × 12?'];let n=0;
setInterval(()=>{if(i.value||document.activeElement===i||document.hidden)return;n=(n+1)%P.length;i.placeholder=P[n]},4000);i.addEventListener('blur',()=>{if(!i.value){n=0;i.placeholder=P[0]}})})();
// Chat: double-tap one of Drago's answers to give it a ❤️ (double-tap again to take it away)
(()=>{const box=$('#msgs');if(!box)return;let lt=0,lm=null;
const toggle=m=>{let h=m.querySelector(':scope > .heart');if(h){h.remove();return}h=document.createElement('span');h.className='heart';h.textContent='❤️';h.setAttribute('aria-label','You liked this');m.appendChild(h)};
box.addEventListener('pointerup',e=>{if(e.target.closest('button,a,pre,input,textarea'))return;const m=e.target.closest('.msg.bot');if(!m||m.classList.contains('notice')){lm=null;return}
const now=Date.now();if(m===lm&&now-lt<350){toggle(m);lm=null;lt=0;e.preventDefault()}else{lm=m;lt=now}})})();
// Chat: while Drago works on an answer, a small friendly message changes every 2 seconds
(()=>{const L=['Drago is thinking…','🐉 Flapping her wings…','📚 Looking through her books…','✨ Putting the words together…','Almost there…'];
  setInterval(()=>document.querySelectorAll('.msg .think').forEach(el=>{const i=(+el.dataset.i||0)+1;el.dataset.i=i;el.classList.remove('swap');void el.offsetWidth;el.textContent=L[i%L.length];el.classList.add('swap')}),2000)})();
// Header: tap Drago's dragon logo and she does a happy spin and says something friendly.
(()=>{const l=document.querySelector('.hlogo');if(!l)return;const W=['Rawr! 🐉','Hi Jackson! 👋','That tickles! 😄','🔥 Dragon power!','✨ Ready to help!'];let n=0,t;
  l.setAttribute('role','button');l.tabIndex=0;l.setAttribute('aria-label','Tap Drago');
  const b=document.createElement('span');b.className='rawr';b.setAttribute('aria-live','polite');l.insertAdjacentElement('afterend',b);
  const go=()=>{l.classList.remove('spin');void l.offsetWidth;l.classList.add('spin');b.textContent=W[n++%W.length];b.classList.add('show');clearTimeout(t);t=setTimeout(()=>b.classList.remove('show'),1600)};
  l.addEventListener('click',go);l.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})})();
// little bounce on the tab icon when you tap a tab
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{const i=b.querySelector('i');if(!i)return;i.classList.remove('bnc');void i.offsetWidth;i.classList.add('bnc')}));
document.querySelectorAll('nav i').forEach(i=>i.addEventListener('animationend',()=>i.classList.remove('bnc')));

// Settings: pick the chat text size (small / medium / big); Drago remembers it on this device
(()=>{const sizes={s:'14px',m:'16px',l:'20px'},box=document.getElementById('tsize');if(!box)return;
  const apply=k=>{if(!sizes[k])k='m';document.documentElement.style.setProperty('--msgfs',sizes[k]);box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.s===k)))};
  let saved='m';try{saved=localStorage.getItem('drago-text-size')||'m'}catch(_){}apply(saved);
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;apply(b.dataset.s);try{localStorage.setItem('drago-text-size',b.dataset.s)}catch(_){}})})();

// Settings: pick Drago's colors (changes the gradient on buttons and titles), remembered on device
(()=>{const G={sun:'linear-gradient(135deg,#ff7a18,#ff2e63 55%,#7c5cff)',sea:'linear-gradient(135deg,#22d3ee,#3b82f6 55%,#6366f1)',leaf:'linear-gradient(135deg,#a3e635,#22c55e 55%,#0d9488)',candy:'linear-gradient(135deg,#f9a8d4,#ec4899 55%,#a855f7)'},box=document.getElementById('theme');if(!box)return;
  const apply=c=>{if(!G[c])c='sun';document.documentElement.style.setProperty('--g',G[c]);box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===c?'true':'false'))};
  let saved='sun';try{saved=localStorage.getItem('drago-theme')||'sun'}catch(_){}apply(saved);
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-c]');if(!b)return;apply(b.dataset.c);try{localStorage.setItem('drago-theme',b.dataset.c)}catch(_){}})})();

// Settings: "Read answers out loud" — when On, Drago reads each new chat answer out loud by herself (remembered on device)
function autoTalk(el){try{if(localStorage.getItem('drago-auto-talk')!=='on')return}catch(_){return}const b=el&&el.querySelector('.speak');if(b&&!b.classList.contains('live'))b.click()}
(()=>{const box=document.getElementById('autoTalk');if(!box)return;
  if(!('speechSynthesis' in window)){box.previousElementSibling.hidden=true;box.hidden=true;return}
  const apply=k=>box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.a===k)));
  let saved='off';try{saved=localStorage.getItem('drago-auto-talk')||'off'}catch(_){}apply(saved);
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-a]');if(!b)return;const k=b.dataset.a;apply(k);try{localStorage.setItem('drago-auto-talk',k)}catch(_){}
    const ss=window.speechSynthesis;ss.cancel();if(k==='on'){const u=new SpeechSynthesisUtterance('Okay! I will read my answers out loud.');u.rate=talkRate();ss.speak(u)}})})();

// Settings: "Talking speed" — Slow / Normal / Fast for Read aloud (remembered on device)
function talkRate(){let r=1;try{r=parseFloat(localStorage.getItem('drago-talk-rate'))||1}catch(_){}return Math.min(1.5,Math.max(0.6,r))}
(()=>{const box=document.getElementById('talkSpeed');if(!box)return;
  if(!('speechSynthesis' in window)){box.previousElementSibling.hidden=true;box.hidden=true;return}
  const apply=r=>box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(parseFloat(b.dataset.r)===r)));apply(talkRate());
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-r]');if(!b)return;const r=parseFloat(b.dataset.r);apply(r);try{localStorage.setItem('drago-talk-rate',String(r))}catch(_){}
    const ss=window.speechSynthesis;ss.cancel();const u=new SpeechSynthesisUtterance(r<1?'I will talk slowly.':r>1?'I will talk fast!':'I will talk at normal speed.');u.lang='en-US';u.rate=r;ss.speak(u)})})();
// Settings: a small trophy line shows how many questions Drago has answered for you (counted on this device)
(()=>{const c=document.querySelector('#sheet .card'),h=c&&c.querySelector('h2');if(!h)return;const p=document.createElement('p');p.className='asked';p.setAttribute('aria-live','polite');h.after(p);
const show=()=>{let n=0;try{n=+localStorage.getItem('drago-asked')||0}catch(_){}p.textContent=n?'🏆 Drago has answered '+n+(n===1?' question':' questions')+' for you!':'🏆 Ask Drago a question to start your count!'};
show();$('#setBtn').addEventListener('click',show)})();
// Code Lab: a "Bigger" button under a running preview makes it tall, so games are easier to play
document.addEventListener('click',e=>{const r=e.target.closest('.run');if(r){const pre=r.closest('pre'),f=pre.nextElementSibling;
  if(f&&f.classList.contains('preview')){if(!(f.nextElementSibling&&f.nextElementSibling.classList.contains('bigbtn'))){const b=document.createElement('button');b.type='button';b.className='ghost bigbtn';b.textContent='⛶ Bigger';b.setAttribute('aria-label','Make the preview bigger');f.after(b)}}
  else if(f&&f.classList.contains('bigbtn'))f.remove();return}
  const b=e.target.closest('.bigbtn');if(!b)return;const f=b.previousElementSibling;if(!f||!f.classList.contains('preview'))return;
  const big=f.classList.toggle('big');b.textContent=big?'↙ Smaller':'⛶ Bigger';b.setAttribute('aria-label',big?'Make the preview smaller':'Make the preview bigger');
  f.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})});
// Image Studio: "Recent ideas" chips remember your last 4 picture ideas; tap one to use it again
(()=>{const t=$('#imgIn'),go=$('#imgGo'),st=$('#imgStyle');if(!t||!go||!st)return;const K='drago-img-recent';
const load=()=>{try{const a=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,4):[]}catch(e){return[]}};
const box=document.createElement('div');box.id='imgRecent';box.className='recent';box.setAttribute('role','group');box.setAttribute('aria-label','Recent picture ideas');st.parentNode.insertBefore(box,st);
const draw=()=>{const a=load();box.hidden=!a.length;box.innerHTML='';if(!a.length)return;const h=document.createElement('span');h.className='rlab';h.textContent='🕘 Recent:';box.appendChild(h);
a.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.length>26?p.slice(0,25)+'…':p;b.title=p;b.setAttribute('aria-label','Use this idea again: '+p);
b.onclick=()=>{t.value=p;t.dispatchEvent(new Event('input'));t.focus()};box.appendChild(b)})};
go.addEventListener('click',()=>{const p=t.value.trim();if(!p||go.disabled)return;const a=[p,...load().filter(x=>x!==p)].slice(0,4);try{localStorage.setItem(K,JSON.stringify(a))}catch(e){}draw()},true);draw()})();
// Video Studio: "Recent ideas" chips remember your last 4 video ideas; tap one to use it again
(()=>{const t=$('#vidIn'),go=$('#vidGo'),dice=$('#vidDice');if(!t||!go||!dice)return;const K='drago-vid-recent';
const load=()=>{try{const a=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,4):[]}catch(e){return[]}};
const box=document.createElement('div');box.id='vidRecent';box.className='recent';box.setAttribute('role','group');box.setAttribute('aria-label','Recent video ideas');dice.parentNode.insertBefore(box,dice);
const draw=()=>{const a=load();box.hidden=!a.length;box.innerHTML='';if(!a.length)return;const h=document.createElement('span');h.className='rlab';h.textContent='🕘 Recent:';box.appendChild(h);
a.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.length>26?p.slice(0,25)+'…':p;b.title=p;b.setAttribute('aria-label','Use this video idea again: '+p);
b.onclick=()=>{t.value=p;t.dispatchEvent(new Event('input'));t.focus()};box.appendChild(b)})};
go.addEventListener('click',()=>{const p=t.value.trim();if(!p||go.disabled)return;const a=[p,...load().filter(x=>x!==p)].slice(0,4);try{localStorage.setItem(K,JSON.stringify(a))}catch(e){}draw()},true);draw()})();
// Code Lab: "Recent ideas" chips remember your last 4 coding ideas; tap one to use it again
(()=>{const t=$('#codeIn'),go=$('#codeGo'),dice=$('#codeDice');if(!t||!go||!dice)return;const K='drago-code-recent';
const load=()=>{try{const a=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,4):[]}catch(e){return[]}};
const box=document.createElement('div');box.id='codeRecent';box.className='recent';box.setAttribute('role','group');box.setAttribute('aria-label','Recent coding ideas');dice.parentNode.insertBefore(box,dice);
const draw=()=>{const a=load();box.hidden=!a.length;box.innerHTML='';if(!a.length)return;const h=document.createElement('span');h.className='rlab';h.textContent='🕘 Recent:';box.appendChild(h);
a.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.length>26?p.slice(0,25)+'…':p;b.title=p;b.setAttribute('aria-label','Use this coding idea again: '+p);
b.onclick=()=>{t.value=p;t.dispatchEvent(new Event('input'));t.focus()};box.appendChild(b)})};
go.addEventListener('click',()=>{const p=t.value.trim();if(!p||go.disabled)return;const a=[p,...load().filter(x=>x!==p)].slice(0,4);try{localStorage.setItem(K,JSON.stringify(a))}catch(e){}draw()},true);draw()})();
// Studios: "✕ Clear" button at the end of each Recent row forgets those ideas (saved on this device)
(()=>{const K={imgRecent:'drago-img-recent',vidRecent:'drago-vid-recent',codeRecent:'drago-code-recent'};
const add=box=>{if(box.hidden||!box.children.length||box.querySelector('.rclear'))return;const b=document.createElement('button');b.type='button';b.className='rclear';b.textContent='✕ Clear';b.setAttribute('aria-label','Clear these recent ideas');box.appendChild(b)};
Object.keys(K).forEach(id=>{const box=document.getElementById(id);if(!box)return;add(box);new MutationObserver(()=>add(box)).observe(box,{childList:true})});
document.addEventListener('click',e=>{const b=e.target.closest('.rclear');if(!b)return;const box=b.closest('.recent');if(!box||!K[box.id])return;try{localStorage.removeItem(K[box.id])}catch(_){}box.innerHTML='';box.hidden=true})})();

// Settings: About Drago line at the bottom shows the app version (matches the service worker cache name)
(()=>{const card=document.querySelector('#sheet .card'),close=document.getElementById('closeSet');if(!card||!close)return;
const p=document.createElement('p');p.className='about';p.textContent='🐉 About Drago · drago-v62';
p.setAttribute('aria-label','About Drago, version drago-v62');
close.before(p)})();
