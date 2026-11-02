// Drago's on-device brain. WebLLM (WebGPU) first, Transformers.js (wasm) fallback. Models are cached by the browser after the first download.
const WEBLLM='https://esm.run/@mlc-ai/web-llm@0.2.79';
const TFJS='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';
export const GPU_MODEL='Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const CPU_MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
let eng=null,kind=null,loading=null;
async function gpu(){try{const a=navigator.gpu&&await navigator.gpu.requestAdapter();return a?{f16:a.features.has('shader-f16')}:null}catch{return null}}
export async function load(onProg){
  if(eng)return kind; if(loading)return loading;
  loading=(async()=>{
    if(!new URLSearchParams(location.search).has('cpu')){const g=await gpu();if(g){
      try{const w=await import(WEBLLM);
        eng=await w.CreateMLCEngine(g.f16?GPU_MODEL:GPU_MODEL.replace('q4f16','q4f32'),{initProgressCallback:p=>onProg(p.progress||0,p.text||'')});
        return kind='webgpu';}catch(e){console.warn('WebLLM failed, trying wasm',e)}
    }}
    const t=await import(TFJS);
    t.env.allowLocalModels=false;
    const files={};
    eng=await t.pipeline('text-generation',CPU_MODEL,{dtype:'q4',device:'wasm',progress_callback:p=>{
      if(p.status==='progress'&&p.total){files[p.file]=[p.loaded,p.total];let a=0,b=0;for(const k in files){a+=files[k][0];b+=files[k][1]}onProg(a/b,'')}}});
    eng._t=t;return kind='wasm';
  })();
  try{return await loading}finally{loading=null}
}
export async function chat(messages,onTok,onProg){
  await load(onProg);
  let out='';
  if(kind==='webgpu'){
    const s=await eng.chat.completions.create({messages,stream:true,temperature:0.6,max_tokens:700});
    for await(const c of s){const d=c.choices[0]?.delta?.content||'';out+=d;onTok(out)}
  }else{
    const streamer=new eng._t.TextStreamer(eng.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:x=>{out+=x;onTok(out)}});
    await eng(messages,{max_new_tokens:400,do_sample:false,streamer});
  }
  return out;
}
export const status=()=>kind;
