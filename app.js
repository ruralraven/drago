// Drago — front end only. Uses free keyless Pollinations by default; Settings API URL overrides.
// Expected backend: POST {api}/chat {messages,image?} -> {reply}; /image {prompt} -> {url}; /video {prompt} -> {url}; /code {prompt} -> {reply}
const $=s=>document.querySelector(s);
// Free mode (default): Pollinations.ai — free, no API key, kid-safe settings. A custom server in Settings overrides it.
const KID="You are Drago, a friendly dragon AI helper for a 10-year-old kid. Be kind, patient, helpful, clear and simple. Use short sentences and simple words, and a few fun emojis. Keep everything kid-safe. If asked about anything unsafe, scary, violent, adult, or about personal information, gently say you can't help with that and suggest asking a trusted grown-up. Never ask for personal info. Do not call the user 'little one'. Keep answers under 120 words and make sure facts are correct.";
const CODER="You are Drago's code helper for a 10-year-old kid. Write complete, runnable code (for web things, ONE full HTML file with CSS and JS inside) in a single code block, then explain it in 2-3 simple sentences. Keep it kid-safe.";
const FREE='https://text.pollinations.ai/openai';
async function freeText(sys,messages){
  let last;
  for(let i=0;i<2;i++){try{
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),90000);
    const r=await fetch(FREE,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({model:'openai',messages:[{role:'system',content:sys},...messages.slice(-12)],safe:true,referrer:'drago'})});
    clearTimeout(tm);
    if(r.status===429)throw new Error('busy');
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();const t=j.choices?.[0]?.message?.content;if(!t)throw new Error('empty');return t;
  }catch(e){last=e;await new Promise(z=>setTimeout(z,2500))}}
  throw last;
}
function freeImage(prompt){return new Promise((ok,no)=>{
  const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(prompt+', kid friendly, cartoon style')+'?safe=true&nologo=true&width=768&height=768&seed='+Math.floor(Math.random()*1e6);
  const im=new Image();const tm=setTimeout(()=>no(new Error('slow')),120000);
  im.onload=()=>{clearTimeout(tm);ok({url:u})};im.onerror=()=>{clearTimeout(tm);no(new Error('img'))};im.src=u;})}
// On-device AI (free, private, no key). Falls back to the free online AI if this device can't run it.
let bubble=null;
function prog(f){if(!bubble)return;const pc=Math.round(f*100);bubble.innerHTML='🐉 Downloading Drago\'s brain… use Wi-Fi<div class="pbar"><i style="width:'+pc+'%"></i></div><small>'+pc+'% · only the first time</small>'}
async function brain(sys,messages,onTok){
  if(localStorage.getItem('drago.local')!=='off'){
    try{const L=await import('./local.js');
      return await L.chat([{role:'system',content:sys},...messages],t=>{onTok&&onTok(t)},prog);
    }catch(e){console.warn('on-device AI unavailable',e)}
  }
  const t=await freeText(sys,messages);onTok&&onTok(t);return t;
}
const api={
  get url(){return localStorage.getItem('drago.api')||''},
  async call(path,body){
    if(this.url){
      const r=await fetch(this.url.replace(/\/$/,'')+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,onTok:undefined})});
      if(!r.ok) throw new Error('HTTP '+r.status); return r.json();
    }
    if(path==='chat'){if(body.image)throw new Error('novision');return{reply:await brain(KID,body.messages.slice(-8),body.onTok)}}
    if(path==='code')return{reply:await brain(CODER,[{role:'user',content:body.prompt}],body.onTok)};
    if(path==='image')return freeImage(body.prompt);
    if(path==='video')throw new Error('novideo');
    throw new Error('nc');
  }
};
const errText=e=>({novision:"📷 I can't look at pictures yet in free mode — but tell me about it in words and I'll help!",
  novideo:"🎬 Video making is coming soon! For now, try the Image tab to make a picture. 🐉",
  busy:"🐉💤 Lots of people are using the free AI right now. Wait a few seconds and try again!",
  slow:"🐢 The picture is taking too long. Please try again!",
  img:"😕 I couldn't make that picture. Try different words!",
  AbortError:"🐢 That took too long. Please try again!"})[e.message==='nc'?'':(e.name==='AbortError'?'AbortError':e.message)]||"😕 Oops, I couldn't reach the AI. Check the internet and try again!";
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function add(box,html,cls){const d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
const typing='<span class="typing"><b></b><b></b><b></b></span>';
function codeify(t){return esc(t).replace(/```\w*\n?([\s\S]*?)```/g,(_,c)=>'<pre><button class="copy">Copy</button><code>'+c+'</code></pre>').replace(/\n/g,'<br>')}
document.addEventListener('click',e=>{if(e.target.classList.contains('copy')){navigator.clipboard?.writeText(e.target.nextSibling.textContent);e.target.textContent='Copied ✓';setTimeout(()=>e.target.textContent='Copy',1500)}});
// read-aloud button on Drago's chat replies (browser voice, no key needed)
function addSpeak(el){if(!('speechSynthesis' in window))return;const b=document.createElement('button');b.type='button';b.className='speak';b.textContent='🔊 Read aloud';b.setAttribute('aria-label','Read this answer out loud');el.appendChild(b)}
document.addEventListener('click',e=>{const b=e.target.closest('.speak');if(!b)return;const ss=window.speechSynthesis;
  if(b.classList.contains('live')){ss.cancel();return}
  ss.cancel();document.querySelectorAll('.speak.live').forEach(x=>{x.classList.remove('live');x.textContent='🔊 Read aloud'});
  const txt=[...b.parentNode.childNodes].filter(n=>n!==b&&!(n.nodeName==='PRE')).map(n=>n.textContent).join(' ').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu,'').trim();
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
  catch(e){t.innerHTML=errText(e);t.classList.add('notice')}
}
$('#chatF').onsubmit=e=>{e.preventDefault();const v=$('#chatIn').value.trim();if(!v)return;$('#chatIn').value='';add(msgs,esc(v),'me');hist.push({role:'user',content:v});ask(v)};
$('#pic').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{add(msgs,'<img src="'+rd.result+'">','me');hist.push({role:'user',content:'What is in this picture?'});ask('',rd.result)};rd.readAsDataURL(f);e.target.value=''};
// studios
function studio(btn,inp,out,path,render){$(btn).onclick=async()=>{const p=$(inp).value.trim()||$(inp).placeholder;const o=$(out);o.innerHTML='';const t=add(o,typing+(path==='image'?' 🎨 Drawing… (can take ~20s)':path==='code'?' 💻 Writing code…':''),'bot');try{bubble=t;t.innerHTML=render(await api.call(path,{prompt:p,onTok:x=>{bubble=null;t.innerHTML=codeify(x)}}));bubble=null}catch(e){t.innerHTML=errText(e);t.classList.add('notice')}}}
studio('#imgGo','#imgIn','#imgOut','image',r=>'<img src="'+esc(r.url)+'" style="width:100%;border-radius:14px">');
studio('#vidGo','#vidIn','#vidOut','video',r=>'<video src="'+esc(r.url)+'" controls autoplay loop playsinline style="width:100%;border-radius:14px"></video>');
studio('#codeGo','#codeIn','#codeOut','code',r=>codeify(r.reply||''));
// settings
$('#setBtn').onclick=()=>{$('#apiUrl').value=api.url;$('#sheet').classList.add('on')};
$('#closeSet').onclick=()=>$('#sheet').classList.remove('on');
$('#saveApi').onclick=()=>{localStorage.setItem('drago.api',$('#apiUrl').value.trim());$('#sheet').classList.remove('on')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
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
$('#chatF').addEventListener('submit',()=>chips&&chips.remove());
