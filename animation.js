(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 1200 : 9000;
  const native = !window.DOUBAO_STARTUP_EXTERNAL && Boolean(window.webkit?.messageHandlers?.launcher);
  const embedded = window.parent!==window && (window.DOUBAO_STARTUP_EXTERNAL || new URLSearchParams(location.search).has('embedded'));
  const assets=window.DOUBAO_STARTUP_ASSETS||{artwork:'assets/sample-artwork.svg',avatar:'assets/sample-avatar.svg',video:''};
  if(embedded)document.body.classList.add('embedded');
  const root = $('.window'), art = $('.artwork'), video = $('.artwork-video'), scene = $('.scene');
  video.addEventListener('error',()=>{root.dataset.videoError=String(video.error?.code||'unknown');});
  video.addEventListener('loadeddata',()=>{delete root.dataset.videoError;});
  const hud = $('.hud'), intro = $('.intro');
  const code = $('.code-overlay');
  const slider = $('#timeline'), pause = $('#pause'), subtitle = $('.subtitle');
  slider.max=String(duration/1000);
  let playing = false, elapsed = 0, origin = 0, frame = 0, lastUI = -Infinity;
  let customVideoURL=null,defaultVideoURL=null,previewVideoURL=null;
  let completed = false, hiddenPause = false, mode = 'preview', loaded = false, revealed = false;
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t*t*(3-2*t); };
  const send = (action, details={}) => {
    if(native)window.webkit.messageHandlers.launcher.postMessage(action);
    if(embedded){const data={type:'doubao-startup',action,...details};if(window.DOUBAO_STARTUP_EXTERNAL)window.DOUBAO_STARTUP_SEND(data);else window.parent.postMessage(data,'*');}
  };
  const milestones = [[0,0],[.2,.08],[.45,.58],[.7,.92],[.92,1],[1,1]];
  function progress(t) {
    const p = t / duration;
    for (let i=1;i<milestones.length;i++) {
      if (p <= milestones[i][0]) {
        const [a,x] = milestones[i-1], [b,y] = milestones[i];
        return x+(y-x)*smooth((p-a)/(b-a));
      }
    }
    return 1;
  }
  for(let i=0;i<60;i++){
    const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
    const angle=i*Math.PI/30,inner=i%5===0?181:184;
    tick.setAttribute('x1',200+Math.sin(angle)*inner);tick.setAttribute('y1',200-Math.cos(angle)*inner);
    tick.setAttribute('x2',200+Math.sin(angle)*(i%5===0?199:192));tick.setAttribute('y2',200-Math.cos(angle)*(i%5===0?199:192));
    tick.style.opacity=i%5===0?'.9':'.55';$('.ticks').appendChild(tick);
  }
  function render(t) {
    const s=t/1000, p=progress(t);
    if(reduced){
      intro.style.opacity='0';art.style.opacity='1';video.style.opacity='0';code.style.opacity='0';hud.style.opacity='1';
      scene.style.opacity=t>=duration?'0':'1';
      if(t>=duration&&!revealed){revealed=true;send('reveal');}
      root.dataset.stage='portrait';root.dataset.elapsed=s.toFixed(2);return;
    }
    const portrait=smooth((s-2.8)/1.1), movie=smooth((s-5.35)/.55);
    const closing=smooth((s-8.25)/.5);
    root.classList.toggle('closing',s>=8.25);document.body.classList.toggle('closing',s>=8.25);
    scene.style.opacity=String(1-closing);
    if(s>=8.25&&!revealed){revealed=true;send('reveal');}
    intro.style.opacity=String(1-smooth((s-2.9)/.8));
    $('.identity').style.opacity=String(smooth((s-.65)/.5)*(1-smooth((s-2.8)/.8)));
    $('.boot-title').style.clipPath=`inset(0 ${(1-clamp((s-1.1)/.6))*100}% 0 0)`;
    $('.boot-caption').style.opacity=String(smooth((s-1.55)/.3)*.5);
    $('.boot-grid').style.opacity=String((1-portrait)*.6);
    $('.boot-corners').style.opacity=String(1-portrait);
    $('.boot-logs').style.opacity=String((1-portrait)*.55);
    art.style.opacity=String(portrait);
    code.style.opacity=String(portrait*(1-smooth((s-7.75)/.3)));
    video.style.opacity=String(video.hidden||video.readyState<2?0:movie);
    if(!video.hidden&&playing&&s>=5.35&&s<8.25&&video.paused){
      video.play().catch(error=>{root.dataset.videoError=error.name;video.style.opacity='0';});
    }
    if((s<5.35||s>=8.25)&&!video.paused)video.pause();
    $('.shade').style.opacity=String(portrait);
    hud.style.opacity=String(smooth((s-3.15)/.5));
    $('.sync-fill').style.transform=`scaleX(${p})`;
    subtitle.style.opacity=String(smooth((s-4)/.5)*(1-smooth((s-7.9)/.3)));
    if(Math.abs(t-lastUI)>80||t===0||t>=duration){
      lastUI=t;
      $('#ratio').textContent=`${(p*100).toFixed(2).padStart(5,'0')}%`;
      $('.sync-phase').textContent=s<5.35?'INITIALIZING':p<1?'SYNCHRONIZING':'SYNC COMPLETE';
      $('#timecode').textContent=`00:${String(Math.floor(s)).padStart(2,'0')}:${String(Math.floor(s%1*30)).padStart(2,'0')}`;
      slider.value=String(s);
      $('#elapsed').innerHTML=`${s.toFixed(1).padStart(4,'0')} <span>/ ${(duration/1000).toFixed(1)}s</span>`;
      root.dataset.elapsed=s.toFixed(2);
      root.dataset.stage=s>=8.25?'closing':s<2.8?'identity':s<5.35?'portrait':'video';
    }
  }
  function updateButton() { pause.textContent=playing?'暂停':'继续'; root.dataset.playing=String(playing); }
  function stop() { playing=false; video.pause(); cancelAnimationFrame(frame); frame=0; updateButton(); }
  function finish(skipped=false) {
    stop(); elapsed=duration; render(elapsed); completed=true;
    root.classList.add('finished'); root.dataset.completed='true';
    pause.textContent='已结束'; pause.disabled=true;
    $('.end-description').textContent=mode==='launch'?'正在显示豆包…':skipped?'已跳过开场动画':'开场预览结束';
    send('complete');
  }
  let lastPaint=-Infinity;
  function tick(now) {
    if(!playing)return;
    elapsed=Math.min(duration,now-origin);
    // The MP4 has its own clock; fewer DOM updates during playback leave room for video decode.
    if(now-lastPaint>=50 || elapsed>=duration){lastPaint=now;render(elapsed);}
    if(elapsed>=duration){finish();return;}
    frame=requestAnimationFrame(tick);
  }
  function play() {
    if(!loaded)return;
    if(elapsed>=duration)elapsed=0;
    completed=false; root.classList.remove('finished'); root.dataset.completed='false';
    pause.disabled=false; origin=performance.now()-elapsed; playing=true;lastPaint=-Infinity;updateButton();
    cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
  }
  function replay(){revealed=false;hiddenPause=false;stop();if(video.src)video.currentTime=0;elapsed=0;lastUI=-Infinity;render(0);play();}
  $('#replay').addEventListener('click',replay);$('.replay-end').addEventListener('click',replay);
  pause.addEventListener('click',()=>{hiddenPause=false;if(playing){elapsed=Math.min(duration,performance.now()-origin);stop();render(elapsed);}else play();});
  $('.skip').addEventListener('click',()=>finish(true));
  slider.addEventListener('input',()=>{hiddenPause=false;stop();elapsed=Number(slider.value)*1000;if(video.src)video.currentTime=Math.max(0,(elapsed-5350)/1000);if(elapsed>=duration){finish();return;}lastUI=-Infinity;completed=false;root.classList.remove('finished');root.dataset.completed='false';pause.disabled=false;render(elapsed);});
  window.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.altKey&&event.code==='KeyB'){
      event.preventDefault();if(!$('#settings-dialog').open)openSettings();return;
    }
    if($('#settings-dialog').open)return;
    if(event.key==='Escape'){event.preventDefault();finish(true);}
    if(event.code==='Space'&&event.target.tagName!=='INPUT'&&event.target.tagName!=='BUTTON'){event.preventDefault();pause.click();}
  });
  document.addEventListener('visibilitychange',()=>{
    if(native)return;
    if(document.hidden&&playing){elapsed=Math.min(duration,performance.now()-origin);hiddenPause=true;stop();}
    else if(!document.hidden&&hiddenPause&&!completed){hiddenPause=false;play();}
  });
  // Narrow native bridge: the host may select launch mode or report its own launch error.
  window.launcherUI={
    openSettings,
    beginLaunch(){mode='launch';document.body.classList.add('launch-mode');replay();},
    error(message){stop();scene.style.opacity='0';root.classList.add('finished');$('.end-description').textContent=message;$('.eyebrow').textContent='LAUNCH UNAVAILABLE';$('.end-screen h1').textContent='暂时无法打开豆包';},
    waiting(){ $('.end-description').textContent='正在等待豆包打开…'; }
  };
  if(native){
    document.body.classList.add('native');
  }
  function wallpaperData(images){return {artwork:images.artwork||assets.artwork,video:images.video instanceof Blob?images.video:images.artwork?'':assets.video};}
  function ready(){if(loaded)return;loaded=true;render(0);send('wallpaper',wallpaperData(savedImages));send('ready');if(window.DOUBAO_STARTUP_OPEN_SETTINGS||new URLSearchParams(location.search).has('settings'))openSettings();else play();}
  function failed(){stop();$('#asset-error').hidden=false;send('assetError');}
  let savedImages={},pendingImages={},busy=false;
  const settings=$('#settings-dialog'),status=$('#settings-status');
  const textFields=[
    {key:'introTitle',input:'#intro-title',target:'.boot-title',fallback:'欢迎回来',limit:16},
    {key:'introCaption',input:'#intro-caption',target:'.boot-caption',fallback:'DOUBAO INITIALIZE / TYPE-0',limit:48},
    {key:'artworkSubtitle',input:'#artwork-subtitle',target:'#subtitle',fallback:'从这里，开始你的下一次创作。',limit:60}
  ];
  const textValue=(images,field)=>typeof images[field.key]==='string'?images[field.key].slice(0,field.limit):field.fallback;
  function thumbnails(){
    $('#avatar-preview').src=pendingImages.avatar||assets.avatar;
    $('#artwork-preview').src=pendingImages.artwork||assets.artwork;
    if(previewVideoURL)URL.revokeObjectURL(previewVideoURL);
    previewVideoURL=pendingImages.video instanceof Blob?URL.createObjectURL(pendingImages.video):null;
    const preview=$('#video-preview');preview.src=previewVideoURL||(!pendingImages.artwork?assets.video:'')||'';
    preview.hidden=!preview.src;if(preview.src)preview.play().catch(()=>{});
    for(const field of textFields)$(field.input).value=textValue(pendingImages,field);
  }
  function openSettings(){
    if(mode==='launch'||settings.open)return;
    hiddenPause=false;stop();pendingImages={...savedImages};thumbnails();
    status.textContent='素材保存在本机。修改后点击「保存并预览」；关闭则放弃本次修改。';
    settings.returnValue='';settings.showModal();send('settings-open');
  }
  function setBusy(value){
    busy=value;
    settings.querySelectorAll('input,button').forEach(node=>node.disabled=value);
  }
  async function applyImages(images){
    art.src=images.artwork||assets.artwork;$('.avatar').src=images.avatar||assets.avatar;
    let source='';
    if(images.video instanceof Blob){
      source=URL.createObjectURL(images.video);
    }else if(!images.artwork&&assets.video){
      if(assets.video.startsWith('data:')){
        if(!defaultVideoURL){const bytes=Uint8Array.fromBase64(assets.video.slice(assets.video.indexOf(',')+1));defaultVideoURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));}
        source=defaultVideoURL;
      }else source=assets.video;
    }
    video.pause();video.hidden=!source;video.src=source;video.load();
    if(customVideoURL)URL.revokeObjectURL(customVideoURL);
    customVideoURL=images.video instanceof Blob?source:null;
    await Promise.all([art,$('.avatar')].map(img=>img.decode()));
    for(const field of textFields)$(field.target).textContent=textValue(images,field);
    $('.boot-title').classList.toggle('long-title',Array.from(textValue(images,textFields[0])).length>6);
  }
  for(const field of textFields)$(field.input).addEventListener('input',event=>{
    pendingImages[field.key]=event.target.value.slice(0,field.limit);
  });
  $('#image-settings').addEventListener('click',openSettings);
  settings.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  settings.addEventListener('close',()=>{
    if(!loaded)return;
    if(settings.returnValue==='preview'){send('settings-close');replay();}
    else finish(true);
  });
  for(const kind of ['avatar','artwork'])$('#'+kind+'-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    setBusy(true);status.textContent='正在准备图片…';
    try{
      pendingImages={...pendingImages,...await window.imageSettings.importImage(file,kind)};thumbnails();
      status.textContent='图片已准备好，点击「保存并预览」应用。';
    }catch(error){status.textContent=error.message;}
    finally{setBusy(false);event.target.value='';}
  });
  $('#video-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    setBusy(true);status.textContent='正在检查视频…';
    try{pendingImages={...pendingImages,...await window.imageSettings.importVideo(file)};thumbnails();status.textContent='视频已准备好，点击「保存并预览」应用。';}
    catch(error){status.textContent=error.message;}
    finally{setBusy(false);event.target.value='';}
  });
  $('#reset-images').addEventListener('click',()=>{pendingImages={};thumbnails();status.textContent='已选用默认素材和文字，点击「保存并预览」应用。';});
  $('#preview-images').addEventListener('click',async()=>{
    setBusy(true);status.textContent='正在保存…';
    try{
      await applyImages(pendingImages);await window.imageSettings.save(pendingImages);savedImages={...pendingImages};send('wallpaper',wallpaperData(savedImages));settings.close('preview');
    }catch(error){await applyImages(savedImages);status.textContent='保存失败，原设置已保留：'+error.message;}
    finally{setBusy(false);}
  });
  window.imageSettings.load().catch(()=>({})).then(async images=>{
    delete images.contours; savedImages=images;
    try{await applyImages(images);}catch{savedImages={};await applyImages({});}
    ready();
  }).catch(failed);
})();
