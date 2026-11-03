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
  const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt+', kid friendly, cartoon style')+'?safe=true&nologo=true&width=768&height=768&seed='+Math.floor(Math.random()*1e6);
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
document.addEventListener('click',e=>{if(e.target.classList.contains('copy')){navigator.clipboard?.writeText(e.target.nextSibling.textContent);e.target.textContent='Copied ✓';setTimeout(()=>e.target.textContent='Copy',1500)}});
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
function addCopy(el){el.appendChild(document.createElement('br'));const b=document.createElement('button');b.type='button';b.className='copyans';b.textContent='📋 Copy';b.setAttribute('aria-label','Copy this answer');el.appendChild(b)}
document.addEventListener('click',async e=>{const b=e.target.closest('.copyans');if(!b)return;const txt=[...b.parentNode.childNodes].filter(n=>!(n.nodeType===1&&n.matches('button,.speak,.copyans'))).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim();
  try{await navigator.clipboard.writeText(txt);b.textContent='Copied ✓'}catch(_){b.textContent='Could not copy'}setTimeout(()=>b.textContent='📋 Copy',1500)});
document.addEventListener('click',e=>{const b=e.target.closest('.speak');if(!b)return;const ss=window.speechSynthesis;
  if(b.classList.contains('live')){ss.cancel();return}
  ss.cancel();document.querySelectorAll('.speak.live').forEach(x=>{x.classList.remove('live');x.textContent='🔊 Read aloud'});
  const txt=[...b.parentNode.childNodes].filter(n=>n!==b&&!(n.nodeName==='PRE')&&!(n.nodeName==='BUTTON')).map(n=>n.textContent).join(' ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu,'').trim();
  if(!txt)return;const u=new SpeechSynthesisUtterance(txt);u.lang='en-US';u.rate=1;
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
  const t=add(msgs,typing,'bot');
  try{bubble=t;const r=await api.call('chat',{messages:hist.slice(),image,onTok:x=>{bubble=null;t.innerHTML=codeify(x);msgs.scrollTop=msgs.scrollHeight}});bubble=null;t.innerHTML=codeify(r.reply||'');addSpeak(t);hist.push({role:'assistant',content:r.reply})}
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
$('#chatF').addEventListener('submit',()=>{if(chips)chips.hidden=true});
// New chat button: clears the conversation (keeps Drago's hello and the idea chips)
$('#newChat').onclick=()=>{if(hist.length&&!confirm('Start a new chat? This clears the messages.'))return;
  window.speechSynthesis&&speechSynthesis.cancel();hist.length=0;bubble=null;
  [...msgs.children].forEach((c,i)=>{if(i>0&&c!==chips)c.remove()});if(chips)chips.hidden=false;
  document.querySelector('nav button')?.click();$('#chatIn').value='';$('#chatIn').focus()};
// Friendly hello that matches the time of day (morning / afternoon / evening)
(()=>{const h=new Date().getHours(),g=h<5?'Hi, night owl! 🦉':h<12?'Good morning! ☀️':h<17?'Good afternoon! 🌤️':'Good evening! 🌙';
  const first=msgs.firstElementChild;if(first&&first.firstChild&&first.firstChild.nodeType===3)first.firstChild.textContent=first.firstChild.textContent.replace(/^Hi!/,g)})();
// Studios: press Enter to Generate (Shift+Enter still makes a new line)
[['#imgIn','#imgGo'],['#vidIn','#vidGo'],['#codeIn','#codeGo']].forEach(([i,b])=>{const t=$(i);if(t)t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$(b).click()}})});
// Chat: "Newest" button shows when you scroll up, tap it to jump back down
(()=>{const box=$('#msgs'),tab=$('#t-chat');if(!box||!tab)return;const b=document.createElement('button');b.type='button';b.id='toBottom';b.textContent='⬇ Newest';b.setAttribute('aria-label','Jump to the newest message');tab.appendChild(b);
  const check=()=>b.classList.toggle('show',box.scrollHeight-box.scrollTop-box.clientHeight>160);box.addEventListener('scroll',check,{passive:true});new MutationObserver(check).observe(box,{childList:true,subtree:true});
  b.onclick=()=>box.scrollTo({top:box.scrollHeight,behavior:'smooth'})})();
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
