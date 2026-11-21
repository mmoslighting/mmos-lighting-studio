const $ = (s) => document.querySelector(s);
const maskDefs = [
 {id:"model",name:"Model",sub:"Subject exposure & contrast",icon:"◉",desc:"Lift the subject exposure and add controlled contrast.",values:{exposure:.5,contrast:25}},
 {id:"background",name:"Background",sub:"Background tone & color",icon:"▧",desc:"Darken and reshape the background color independently.",values:{exposure:-.5,contrast:20,saturation:-20,temperature:18}},
 {id:"gradient",name:"Linear Gradient",sub:"Directional tonal wash",icon:"◒",desc:"Add a directional tonal wash with a warm color bias.",values:{exposure:-.4,saturation:15,temperature:20}},
 {id:"rimlight",name:"Rimlight",sub:"Edge light enhancement",icon:"✧",desc:"Increase edge-light intensity and localized color.",values:{exposure:.3,temperature:5,saturation:30}},
 {id:"sunlight",name:"Sunlight",sub:"Warm highlight bloom",icon:"☼",desc:"Create a warm highlight impression with controlled intensity.",values:{exposure:.85,contrast:20,temperature:50,saturation:57}}
];
const specs = {
 exposure:{label:"Exposure",min:-2,max:2,step:.05,unit:" EV",left:"−2.00",right:"+2.00"},
 contrast:{label:"Contrast",min:-100,max:100,step:1,unit:"",left:"−100",right:"+100"},
 saturation:{label:"Saturation",min:-100,max:100,step:1,unit:"",left:"−100",right:"+100"},
 temperature:{label:"Temperature",min:-100,max:100,step:1,unit:"",left:"Cool",right:"Warm"}
};
let state = maskDefs.map(m=>({id:m.id,enabled:true,values:{...m.values}}));
let active = "model", original = null, imageName = "", showCompare = true, compare = 50;
let imageBitmap = null;
const maskList=$("#maskList"), controls=$("#controls"), canvas=$("#photoCanvas"), ctx=canvas.getContext("2d");
function fmt(k,v){return (k==="exposure"?(v>0?"+":"")+Number(v).toFixed(2):((v>0?"+":"")+Math.round(v)))+(specs[k].unit||"");}
function renderList(){
 maskList.innerHTML="";
 maskDefs.forEach(def=>{
  const s=state.find(x=>x.id===def.id), b=document.createElement("button");
  b.className="mask-item"+(active===def.id?" selected":"");
  b.innerHTML='<span class="mask-icon">'+def.icon+'</span><span class="meta"><strong>'+def.name+'</strong><small>'+def.sub+'</small></span>'+(s.enabled?'<span class="enabled"></span>':'');
  b.onclick=()=>{active=def.id;renderList();renderInspector();};maskList.append(b);
 });
}
function renderInspector(){
 const def=maskDefs.find(m=>m.id===active),s=state.find(m=>m.id===active);
 $("#activeMaskTitle").textContent=def.name;$("#maskDescription").textContent=def.desc;
 $("#toggleMask").classList.toggle("on",s.enabled);
 controls.innerHTML="";
 Object.entries(s.values).forEach(([key,val])=>{
  const sp=specs[key],p=(val-sp.min)/(sp.max-sp.min)*100;
  const wrap=document.createElement("div");wrap.className="control";
  wrap.innerHTML='<div class="control-head"><label>'+sp.label+'</label><output>'+fmt(key,val)+'</output></div><input type="range" min="'+sp.min+'" max="'+sp.max+'" step="'+sp.step+'" value="'+val+'" style="--fill:'+p+'%"><div class="range-ends"><span>'+sp.left+'</span><span>'+sp.right+'</span></div>';
  const range=wrap.querySelector("input"),out=wrap.querySelector("output");
  range.addEventListener("input",()=>{s.values[key]=Number(range.value);out.textContent=fmt(key,s.values[key]);range.style.setProperty("--fill",((s.values[key]-sp.min)/(sp.max-sp.min)*100)+"%");draw();});
  controls.append(wrap);
 });
}
function resetSelected(){const def=maskDefs.find(m=>m.id===active);const s=state.find(m=>m.id===active);s.values={...def.values};s.enabled=true;renderInspector();renderList();draw();}
function loadImage(file){
 if(!file||!file.type.startsWith("image/"))return;
 const url=URL.createObjectURL(file);const img=new Image();
 img.onload=()=>{imageBitmap=img;imageName=file.name;$("#photoName").textContent=imageName;$("#emptyState").hidden=true;$("#photoWrap").hidden=false;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;original=document.createElement("canvas");original.width=canvas.width;original.height=canvas.height;original.getContext("2d").drawImage(img,0,0);$("#statusText").textContent=canvas.width+" × "+canvas.height+" px";draw();URL.revokeObjectURL(url);};
 img.onerror=()=>{alert("File gambar tidak dapat dibuka.");URL.revokeObjectURL(url)};img.src=url;
}
function draw(){
 if(!original)return;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(original,0,0);
 const w=canvas.width,h=canvas.height;
 const m=Object.fromEntries(state.map(s=>[s.id,s]));
 // A practical browser approximation: global tonal base plus soft spatial light overlays.
 // Region segmentation / semantic subject masks require a dedicated segmentation model.
 const enabled=state.filter(s=>s.enabled);
 const avg=enabled.reduce((a,s)=>a+(s.values.exposure||0),0)/Math.max(1,enabled.length);
 const globalExposure=enabled.length?avg*.22:0;
 if(globalExposure!==0){ctx.fillStyle=globalExposure>0?'rgba(255,255,255,'+Math.min(.24,globalExposure*.12)+')':'rgba(0,0,0,'+Math.min(.24,-globalExposure*.12)+')';ctx.fillRect(0,0,w,h);}
 // Background mask approximation: vignette/edge falloff, not semantic background detection.
 if(m.background.enabled){
  const v=m.background.values.exposure||0;
  const g=ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.18,w*.5,h*.48,Math.max(w,h)*.72);
  g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(5,8,12,"+Math.min(.36,Math.max(0,-v)*.38)+")");
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }
 if(m.gradient.enabled){
  const v=m.gradient.values.exposure||0;
  const g=ctx.createLinearGradient(0,0,w*.9,h);
  g.addColorStop(0,"rgba(8,12,18,"+Math.min(.34,Math.max(0,-v)*.4)+")");g.addColorStop(.55,"rgba(10,12,18,0)");g.addColorStop(1,"rgba(10,12,18,.04)");
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }
 if(m.rimlight.enabled){
  const v=m.rimlight.values.exposure||0;
  const a=Math.min(.14,Math.max(0,v)*.14);
  if(a){ctx.save();ctx.globalCompositeOperation="screen";const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,"rgba(255,220,165,"+a+")");g.addColorStop(.12,"rgba(255,220,165,0)");g.addColorStop(.88,"rgba(255,220,165,0)");g.addColorStop(1,"rgba(255,220,165,"+a+")");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();}
 }
 if(m.sunlight.enabled){
  const s=m.sunlight.values;const power=Math.min(.28,Math.max(0,s.exposure)*.18);
  if(power){ctx.save();ctx.globalCompositeOperation="screen";const g=ctx.createRadialGradient(w*.16,h*.12,0,w*.16,h*.12,Math.max(w,h)*.68);g.addColorStop(0,"rgba(255,205,125,"+power+")");g.addColorStop(.35,"rgba(255,190,110,"+(power*.3)+")");g.addColorStop(1,"rgba(255,185,100,0)");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();}
 }
 // Preserve original preview for wipe comparison; edited view uses native CSS canvas.
 if(showCompare){ctx.save();ctx.beginPath();ctx.rect(0,0,w*compare/100,h);ctx.clip();ctx.clearRect(0,0,w*compare/100,h);ctx.drawImage(original,0,0);ctx.restore();$("#compareLine").style.left=compare+"%";$("#compareLine").hidden=false;$(".before-label").hidden=false;$(".after-label").hidden=false;}
 else{$("#compareLine").hidden=true;$(".before-label").hidden=true;$(".after-label").hidden=true;}
}
$("#fileInput").addEventListener("change",e=>loadImage(e.target.files[0]));
$("#toggleMask").onclick=()=>{const s=state.find(m=>m.id===active);s.enabled=!s.enabled;renderInspector();renderList();draw();};
$("#resetMask").onclick=resetSelected;
$("#resetAll").onclick=()=>{state=maskDefs.map(m=>({id:m.id,enabled:true,values:{...m.values}}));renderList();renderInspector();draw();};
$("#compareBtn").onclick=()=>{showCompare=!showCompare;$("#compareBtn").classList.toggle("active",showCompare);draw();};
$("#fitBtn").onclick=()=>{if(!imageBitmap)return;$("#photoWrap").style.maxWidth="94%";$("#photoWrap").style.maxHeight="92%";};
$("#exportBtn").onclick=()=>{
 if(!original){alert("Upload foto terlebih dahulu.");return;}
 const out=document.createElement("canvas");out.width=canvas.width;out.height=canvas.height;const c=out.getContext("2d");
 // Export edited-only (comparison wipe is preview-only).
 const was=showCompare;showCompare=false;draw();c.drawImage(canvas,0,0);showCompare=was;draw();
 out.toBlob(blob=>{if(!blob)return;const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(imageName.replace(/\.[^.]+$/,"")||"photo")+"_MMOS-edit.jpg";a.click();URL.revokeObjectURL(a.href);},"image/jpeg",.95);
};
renderList();renderInspector();