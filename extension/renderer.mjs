// Temporary overlay in the official app; the app's own styles and files are untouched.
export function installRenderer(payload,mount){
  if(window.top!==window)return {installed:false,reason:'child-frame'};
  if(window.__doubaoStartupExtension)return {installed:true,alreadyActive:true};
  let frame=null,watchdog=0,observer=null,priorFocus=null,disposed=false;
  let ready=false,completed=false,phase='loading';
  function removeOverlay(){
    clearTimeout(watchdog);observer?.disconnect();observer=null;
    frame?.remove();frame=null;
    if(priorFocus?.isConnected)priorFocus.focus();priorFocus=null;
  }
  function dispose(){
    if(disposed)return;disposed=true;removeOverlay();
    window.removeEventListener('keydown',keyboard,true);
    delete window.__doubaoStartupExtension;
  }
  function show(settings=false){
    if(disposed||frame)return;
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
    if(event.data.action==='complete'){completed=true;phase='complete';removeOverlay();}
    if(event.data.action==='assetError'){phase='failed';removeOverlay();}
    if(event.data.action==='settings-open'){phase='settings';clearTimeout(watchdog);}
    if(event.data.action==='settings-close'){phase='playing';watchdog=setTimeout(removeOverlay,20000);}
  }
  function keyboard(event){
    if((event.metaKey||event.ctrlKey)&&event.altKey&&event.code==='KeyB'){event.preventDefault();show(true);}
  }
  window.addEventListener('keydown',keyboard,true);
  window.__doubaoStartupExtension={dispose,openSettings:()=>show(true),status:()=>({ready,completed,phase,overlay:!!frame})};
  if(document.body)show();
  else{observer=new MutationObserver(()=>{if(document.body){observer.disconnect();observer=null;show();}});observer.observe(document,{childList:true,subtree:true});}
  return {installed:true};
}
