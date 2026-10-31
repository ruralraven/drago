// Lumora AI — front end only. Plug a backend in via Settings (API URL) later.
// Expected backend: POST {api}/chat {messages,image?} -> {reply}; /image {prompt} -> {url}; /video {prompt} -> {url}; /code {prompt} -> {reply}
const $=s=>document.querySelector(s);
const NOT_CONNECTED="🔌 AI not connected yet — a grown-up needs to set it up.";
const api={
  get url(){return localStorage.getItem('lumora.api')||''},
  async call(path,body){
    if(!this.url) throw new Error('nc');
    const r=await fetch(this.url.replace(/\/$/,'')+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok) throw new Error('HTTP '+r.status); return r.json();
  }
};
const errText=e=>e.message==='nc'?NOT_CONNECTED:"😕 Couldn't reach the AI server ("+e.message+").";
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function add(box,html,cls){const d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
const typing='<span class="typing"><b></b><b></b><b></b></span>';
function codeify(t){return esc(t).replace(/```\w*\n?([\s\S]*?)```/g,(_,c)=>'<pre><button class="copy">Copy</button><code>'+c+'</code></pre>').replace(/\n/g,'<br>')}
document.addEventListener('click',e=>{if(e.target.classList.contains('copy')){navigator.clipboard?.writeText(e.target.nextSibling.textContent);e.target.textContent='Copied ✓';setTimeout(()=>e.target.textContent='Copy',1500)}});
// splash
$('#start').onclick=()=>{$('#splash').classList.add('gone');localStorage.setItem('lumora.seen',1)};
if(localStorage.getItem('lumora.seen')&&!location.search.includes('splash'))$('#splash').classList.add('gone');
// tabs
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#t-'+b.dataset.t).classList.add('on')});
// chat
const msgs=$('#msgs'),hist=[];
async function ask(text,image){
  const t=add(msgs,typing,'bot');
  try{const r=await api.call('chat',{messages:hist,image});t.innerHTML=codeify(r.reply||'');hist.push({role:'assistant',content:r.reply})}
  catch(e){t.innerHTML=errText(e);t.classList.add('notice')}
}
$('#chatF').onsubmit=e=>{e.preventDefault();const v=$('#chatIn').value.trim();if(!v)return;$('#chatIn').value='';add(msgs,esc(v),'me');hist.push({role:'user',content:v});ask(v)};
$('#pic').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{add(msgs,'<img src="'+rd.result+'">','me');hist.push({role:'user',content:'What is in this picture?'});ask('',rd.result)};rd.readAsDataURL(f);e.target.value=''};
// studios
function studio(btn,inp,out,path,render){$(btn).onclick=async()=>{const p=$(inp).value.trim()||$(inp).placeholder;const o=$(out);o.innerHTML='';const t=add(o,typing,'bot');try{t.innerHTML=render(await api.call(path,{prompt:p}))}catch(e){t.innerHTML=errText(e);t.classList.add('notice')}}}
studio('#imgGo','#imgIn','#imgOut','image',r=>'<img src="'+esc(r.url)+'" style="width:100%;border-radius:14px">');
studio('#vidGo','#vidIn','#vidOut','video',r=>'<video src="'+esc(r.url)+'" controls autoplay loop playsinline style="width:100%;border-radius:14px"></video>');
studio('#codeGo','#codeIn','#codeOut','code',r=>codeify(r.reply||''));
// settings
$('#setBtn').onclick=()=>{$('#apiUrl').value=api.url;$('#sheet').classList.add('on')};
$('#closeSet').onclick=()=>$('#sheet').classList.remove('on');
$('#saveApi').onclick=()=>{localStorage.setItem('lumora.api',$('#apiUrl').value.trim());$('#sheet').classList.remove('on')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
