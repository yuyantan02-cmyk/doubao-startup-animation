// Inject the startup overlay and a persistent theme without changing Doubao's installed files.
export function installRenderer(payload,mount){
  if(window.top!==window)return {installed:false,reason:'child-frame'};
  if(window.__doubaoStartupExtension)return {installed:true,alreadyActive:true};
  let frame=null,watchdog=0,observer=null,priorFocus=null,disposed=false;
  let wall=null,skin=null,wallURL=null,media={artwork:payload.assets.artwork,video:payload.assets.video};
  let ready=false,completed=false,phase='loading';
  function playback(){
    const video=wall?.querySelector('video');if(!video)return;
    if(document.hidden||frame||!completed||window.matchMedia('(prefers-reduced-motion: reduce)').matches)video.pause();
    else if(video.src)video.play().catch(()=>{});
  }
  function wallpaper(){
    if(!wall){
      skin=document.createElement('style');skin.id='doubao-startup-skin';skin.textContent=payload.wallpaperCss;document.head.appendChild(skin);
      document.documentElement.dataset.doubaoStartupSkin='';
      wall=document.createElement('div');wall.id='doubao-startup-wallpaper';
      wall.append(document.createElement('img'),document.createElement('video'));document.body.prepend(wall);
      const video=wall.querySelector('video');video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';
      video.addEventListener('playing',()=>video.classList.add('is-playing'));
      video.addEventListener('error',()=>video.classList.remove('is-playing'));
    }
    const [image,video]=wall.children;image.src=media.artwork;
    video.pause();video.classList.remove('is-playing');video.removeAttribute('src');
    if(wallURL){URL.revokeObjectURL(wallURL);wallURL=null;}
    if(media.video){
      wallURL=typeof media.video==='string'?null:URL.createObjectURL(media.video);
      video.src=wallURL||media.video;
      playback();
    }
  }
  function removeOverlay(){
    clearTimeout(watchdog);observer?.disconnect();observer=null;
    frame?.remove();frame=null;
    if(priorFocus?.isConnected)priorFocus.focus();priorFocus=null;
  }
  function dispose(){
    if(disposed)return;disposed=true;removeOverlay();
    wall?.querySelector('video')?.pause();wall?.remove();skin?.remove();
    if(wallURL)URL.revokeObjectURL(wallURL);
    delete document.documentElement.dataset.doubaoStartupSkin;
    document.removeEventListener('visibilitychange',playback);
    window.removeEventListener('keydown',keyboard,true);
    delete window.__doubaoStartupExtension;
  }
  function show(settings=false){
    if(disposed||frame)return;
    wall?.querySelector('video')?.pause();
    priorFocus=document.activeElement;phase=settings?'settings':'loading';
    frame=document.createElement('iframe');frame.id='doubao-startup-overlay';frame.title='豆包启动动画';
    Object.assign(frame.style,{position:'fixed',inset:'0',width:'100%',height:'100%',border:'0',zIndex:'2147483646',background:'#08060d',colorScheme:'dark'});
    const current=frame;
    current.addEventListener('load',()=>{
      if(frame!==current||disposed)return;
      try{
        const win=current.contentWindow,doc=win.document;
        doc.documentElement.innerHTML=payload.html;
        const css=doc.createElement('style');css.textContent=payload.css;doc.head.appendChild(css);
        win.DOUBAO_STARTUP_EXTERNAL=true;win.DOUBAO_STARTUP_ASSETS=payload.assets;win.DOUBAO_STARTUP_OPEN_SETTINGS=settings;
        win.DOUBAO_STARTUP_SEND=data=>message({source:win,data});
        mount(win);current.focus();
      }catch(error){phase='failed';console.error('Doubao startup:',error.message);removeOverlay();}
    },{once:true});
    current.src='about:blank';document.body.appendChild(current);
    watchdog=setTimeout(()=>{phase='timeout';removeOverlay();},20000);
  }
  function message(event){
    if(!frame||event.source!==frame.contentWindow||event.data?.type!=='doubao-startup')return;
    if(event.data.action==='ready'){ready=true;phase='playing';}
    if(event.data.action==='wallpaper'){media={artwork:event.data.artwork||payload.assets.artwork,video:event.data.video||''};if(wall)wallpaper();}
    if(event.data.action==='complete'){completed=true;phase='complete';removeOverlay();wallpaper();}
    if(event.data.action==='assetError'){phase='failed';removeOverlay();}
    if(event.data.action==='settings-open'){phase='settings';clearTimeout(watchdog);}
    if(event.data.action==='settings-close'){phase='playing';watchdog=setTimeout(removeOverlay,20000);}
  }
  function keyboard(event){
    if((event.metaKey||event.ctrlKey)&&event.altKey&&event.code==='KeyB'){event.preventDefault();show(true);}
  }
  window.addEventListener('keydown',keyboard,true);
  document.addEventListener('visibilitychange',playback);
  window.__doubaoStartupExtension={dispose,openSettings:()=>show(true),status:()=>({ready,completed,phase,overlay:!!frame,wallpaper:!!wall,videoPlaying:!!wall?.querySelector('video.is-playing')&&!wall.querySelector('video').paused})};
  if(document.body)show();
  else{observer=new MutationObserver(()=>{if(document.body){observer.disconnect();observer=null;show();}});observer.observe(document,{childList:true,subtree:true});}
  return {installed:true};
}
