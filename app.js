const $ = (s) => document.querySelector(s);
const maskDefs = [
 {id:"model",name:"Model",sub:"Subject exposure & contrast",icon:"◉",desc:"Brighten the central subject region. Refine the oval geometry below to fit the person.",values:{exposure:.5,contrast:25}},
 {id:"background",name:"Background",sub:"Background tone & color",icon:"▧",desc:"Adjust the area outside the subject oval. This is an inverse soft-ellipse approximation, not AI background segmentation.",values:{exposure:-.5,contrast:20,saturation:-20,temperature:18}},
 {id:"gradient",name:"Linear Gradient",sub:"Directional tonal wash",icon:"◒",desc:"Apply a diagonal, feathered tonal gradient across the photograph.",values:{exposure:-.4,saturation:15,temperature:20}},
 {id:"rimlight",name:"Rimlight",sub:"Edge light enhancement",icon:"✧",desc:"Add a soft elliptical edge band around the subject region. This approximates rim light; it does not detect real hair or clothing edges.",values:{exposure:.3,temperature:5,saturation:30}},
 {id:"sunlight",name:"Sunlight",sub:"Warm highlight bloom",icon:"☼",desc:"Add a warm radial light wash from the upper-left of the frame.",values:{exposure:.85,contrast:20,temperature:50,saturation:57}}
];
const specs = {
 exposure:{label:"Exposure",min:-2,max:2,step:.05,unit:" EV",left:"−2.00",right:"+2.00"},
 contrast:{label:"Contrast",min:-100,max:100,step:1,unit:"",left:"−100",right:"+100"},
 saturation:{label:"Saturation",min:-100,max:100,step:1,unit:"",left:"−100",right:"+100"},
 temperature:{label:"Temperature",min:-100,max:100,step:1,unit:"",left:"Cool",right:"Warm"}
};
const defaultGeometry={cx:50,cy:48,width:58,height:78,feather:18};
let state=maskDefs.map(m=>({id:m.id,enabled:true,values:{...m.values},geometry:m.id==="model"?{...defaultGeometry}:null}));
let active="model",imageBitmap=null,imageName="",showCompare=true,compare=50,raf=0;
const maskList=$("#maskList"),controls=$("#controls"),canvas=$("#photoCanvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
function fmt(k,v){return (k==="exposure"?(v>0?"+":"")+Number(v).toFixed(2):((v>0?"+":"")+Math.round(v)))+(specs[k].unit||"");}
function getState(id){return state.find(s=>s.id===id);}
function renderList(){
 maskList.innerHTML="";
 maskDefs.forEach(def=>{
  const s=getState(def.id),b=document.createElement("button");
  b.className="mask-item"+(active===def.id?" selected":"");
  b.innerHTML='<span class="mask-icon">'+def.icon+'</span><span class="meta"><strong>'+def.name+'</strong><small>'+def.sub+'</small></span>'+(s.enabled?'<span class="enabled"></span>':'');
  b.onclick=()=>{active=def.id;renderList();renderInspector();};maskList.append(b);
 });
}
function addRange(parent,label,value,min,max,step,onInput,ends=["−","+"]){
 const wrap=document.createElement("div");wrap.className="control";
 wrap.innerHTML='<div class="control-head"><label>'+label+'</label><output>'+Math.round(value)+'</output></div><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><div class="range-ends"><span>'+ends[0]+'</span><span>'+ends[1]+'</span></div>';
 const range=wrap.querySelector("input"),out=wrap.querySelector("output");
 const paint=()=>range.style.setProperty("--fill",((Number(range.value)-min)/(max-min)*100)+"%");
 paint();range.addEventListener("input",()=>{const v=Number(range.value);out.textContent=Math.round(v);paint();onInput(v);scheduleDraw();});parent.append(wrap);
}
function renderInspector(){
 const def=maskDefs.find(m=>m.id===active),s=getState(active);
 $("#activeMaskTitle").textContent=def.name;$("#maskDescription").textContent=def.desc;
 $("#toggleMask").classList.toggle("on",s.enabled);controls.innerHTML="";
 Object.entries(s.values).forEach(([key,val])=>{
  const sp=specs[key],p=(val-sp.min)/(sp.max-sp.min)*100;
  const wrap=document.createElement("div");wrap.className="control";
  wrap.innerHTML='<div class="control-head"><label>'+sp.label+'</label><output>'+fmt(key,val)+'</output></div><input type="range" min="'+sp.min+'" max="'+sp.max+'" step="'+sp.step+'" value="'+val+'" style="--fill:'+p+'%"><div class="range-ends"><span>'+sp.left+'</span><span>'+sp.right+'</span></div>';
  const range=wrap.querySelector("input"),out=wrap.querySelector("output");
  range.addEventListener("input",()=>{s.values[key]=Number(range.value);out.textContent=fmt(key,s.values[key]);range.style.setProperty("--fill",((s.values[key]-sp.min)/(sp.max-sp.min)*100)+"%");scheduleDraw();});
  controls.append(wrap);
 });
 const geo=$("#geometryControls");geo.innerHTML="";
 if(active==="model"){
  geo.hidden=false;
  addRange(geo,"Center X",s.geometry.cx,0,100,1,v=>s.geometry.cx=v,["Left","Right"]);
  addRange(geo,"Center Y",s.geometry.cy,0,100,1,v=>s.geometry.cy=v,["Top","Bottom"]);
  addRange(geo,"Mask width",s.geometry.width,15,100,1,v=>s.geometry.width=v,["Narrow","Wide"]);
  addRange(geo,"Mask height",s.geometry.height,15,100,1,v=>s.geometry.height=v,["Short","Tall"]);
  addRange(geo,"Feather",s.geometry.feather,0,45,1,v=>s.geometry.feather=v,["Hard","Soft"]);
 }else geo.hidden=true;
}
function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
function weightsAt(nx,ny){
 const g=getState("model").geometry,rx=Math.max(.075,g.width/200),ry=Math.max(.075,g.height/200);
 const dx=(nx-g.cx/100)/rx,dy=(ny-g.cy/100)/ry,d=Math.sqrt(dx*dx+dy*dy);
 const feather=.025+(g.feather/100)*.20;
 const model=1-smoothstep(1-feather,1+feather,d);
 const ring=Math.exp(-Math.pow((d-1.015)/(.025+(g.feather/100)*.045),2));
 const gradient=Math.max(0,Math.min(1,.78-.60*((nx*.55)+(ny*.45))));
 const sun=Math.exp(-((nx-.16)*(nx-.16)+(ny-.13)*(ny-.13))/(2*.34*.34));
 return {model,background:1-model,gradient,rimlight:ring,sunlight:sun};
}
function renderTo(target,w,h,withCompare){
 target.width=w;target.height=h;const c=target.getContext("2d",{willReadFrequently:true});
 c.drawImage(imageBitmap,0,0,w,h);
 const img=c.getImageData(0,0,w,h),d=img.data;
 const activeMasks=state.filter(s=>s.enabled);
 const ms=Object.fromEntries(activeMasks.map(s=>[s.id,s]));
 const needModel=!!ms.model,needBG=!!ms.background,needGrad=!!ms.gradient,needRim=!!ms.rimlight,needSun=!!ms.sunlight;
 for(let y=0;y<h;y++){
  const ny=h>1?y/(h-1):0;
  for(let x=0;x<w;x++){
   const nx=w>1?x/(w-1):0,i=(y*w+x)*4;
   const weights=weightsAt(nx,ny);
   let ev=0,contrast=0,saturation=0,temp=0;
   for(const id of ["model","background","gradient","rimlight","sunlight"]){
    const m=ms[id];if(!m)continue;
    const wt=weights[id];
    ev+=(m.values.exposure||0)*wt;
    contrast+=(m.values.contrast||0)*wt;
    saturation+=(m.values.saturation||0)*wt;
    temp+=(m.values.temperature||0)*wt;
   }
   let r=d[i],gg=d[i+1],b=d[i+2];
   const exposure=Math.pow(2,ev);r*=exposure;gg*=exposure;b*=exposure;
   // Contrast is weighted around middle gray (128).
   const cf=Math.max(0,Math.min(4,1+contrast/100));
   r=(r-128)*cf+128;gg=(gg-128)*cf+128;b=(b-128)*cf+128;
   // Temperature is a restrained warm/cool channel bias, not camera WB metadata.
   r+=temp*.34;b-=temp*.34;
   // Saturation uses luma-preserving RGB interpolation.
   const luma=.2126*r+.7152*gg+.0722*b, sf=Math.max(0,Math.min(3,1+saturation/100));
   r=luma+(r-luma)*sf;gg=luma+(gg-luma)*sf;b=luma+(b-luma)*sf;
   d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,gg));d[i+2]=Math.max(0,Math.min(255,b));
  }
 }
 c.putImageData(img,0,0);
 if(withCompare&&showCompare){
  c.save();c.beginPath();c.rect(0,0,w*compare/100,h);c.clip();c.drawImage(imageBitmap,0,0,w,h);c.restore();
 }
}
function draw(){
 if(!imageBitmap)return;
 const maxPreview=1700,scale=Math.min(1,maxPreview/Math.max(imageBitmap.naturalWidth,imageBitmap.naturalHeight));
 renderTo(canvas,Math.max(1,Math.round(imageBitmap.naturalWidth*scale)),Math.max(1,Math.round(imageBitmap.naturalHeight*scale)),true);
 $("#compareLine").hidden=!showCompare;$(".before-label").hidden=!showCompare;$(".after-label").hidden=!showCompare;
 $("#compareLine").style.left=compare+"%";
}
function scheduleDraw(){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);}
function resetSelected(){
 const def=maskDefs.find(m=>m.id===active),s=getState(active);
 s.values={...def.values};s.enabled=true;if(active==="model")s.geometry={...defaultGeometry};
 renderInspector();renderList();scheduleDraw();
}
function loadImage(file){
 if(!file||!file.type.startsWith("image/"))return;
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{imageBitmap=img;imageName=file.name;$("#photoName").textContent=imageName;$("#emptyState").hidden=true;$("#photoWrap").hidden=false;$("#statusText").textContent=img.naturalWidth+" × "+img.naturalHeight+" px";URL.revokeObjectURL(url);scheduleDraw();};
 img.onerror=()=>{alert("File gambar tidak dapat dibuka.");URL.revokeObjectURL(url);};img.src=url;
}
$("#fileInput").addEventListener("change",e=>loadImage(e.target.files[0]));
$("#toggleMask").onclick=()=>{const s=getState(active);s.enabled=!s.enabled;renderInspector();renderList();scheduleDraw();};
$("#resetMask").onclick=resetSelected;
$("#resetAll").onclick=()=>{state=maskDefs.map(m=>({id:m.id,enabled:true,values:{...m.values},geometry:m.id==="model"?{...defaultGeometry}:null}));renderList();renderInspector();scheduleDraw();};
$("#compareBtn").onclick=()=>{showCompare=!showCompare;$("#compareBtn").classList.toggle("active",showCompare);$("#compareSlider").disabled=!showCompare;scheduleDraw();};
$("#compareSlider").addEventListener("input",e=>{compare=Number(e.target.value);scheduleDraw();});
$("#fitBtn").onclick=()=>{$("#photoWrap").style.maxWidth="94%";$("#photoWrap").style.maxHeight="92%";};
$("#exportBtn").onclick=()=>{
 if(!imageBitmap){alert("Upload foto terlebih dahulu.");return;}
 $("#statusText").textContent="Rendering full-resolution JPEG…";
 const out=document.createElement("canvas");
 try{renderTo(out,imageBitmap.naturalWidth,imageBitmap.naturalHeight,false);
  out.toBlob(blob=>{if(!blob){$("#statusText").textContent="Export failed";return;}
   const a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=(imageName.replace(/\.[^.]+$/,"")||"photo")+"_MMOS-edit.jpg";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);$("#statusText").textContent="Exported · "+out.width+" × "+out.height+" px";
  },"image/jpeg",.95);
 }catch(err){console.error(err);$("#statusText").textContent="Export failed — image may be too large for device memory";alert("Perangkat kehabisan memori saat export ukuran penuh. Coba foto dengan resolusi lebih kecil.");}
};
renderList();renderInspector();