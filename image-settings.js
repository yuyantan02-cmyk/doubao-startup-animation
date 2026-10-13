/* Local image import. No network or app privileges. */(function (scope) {
  'use strict';
  async function database(action,value){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('doubao-startup-assets',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('settings');
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('settings',action==='read'?'readonly':'readwrite'),store=tx.objectStore('settings');
        const request=action==='read'?store.get('images'):store.put(value,'images');
        tx.oncomplete=()=>{db.close();resolve(action==='read'?request.result||{}:value);};
        tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('保存失败'));};
      };
    });
  }
  async function importImage(file,kind){
    if(file.size>30*1024*1024)throw new Error('请选择小于 30 MB 的图片。');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=kind==='avatar'?512:1536;canvas.height=kind==='avatar'?512:1024;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#08060d';ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
      const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
      ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      const image=canvas.toDataURL('image/png');
      if(kind==='avatar')return {avatar:image};
      return {artwork:image};
    }catch(error){throw new Error(error.message||'图片无法读取，请换一张图片。');}
    finally{URL.revokeObjectURL(url);}
  }
  async function importVideo(file){
    if(!['video/mp4','video/webm'].includes(file.type)||!file.size||file.size>50*1024*1024)
      throw new Error('请选择不超过 50 MB 的 MP4 或 WebM 视频。');
    const url=URL.createObjectURL(file),video=document.createElement('video');
    try{
      video.preload='metadata';video.src=url;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('视频读取超时。')),8000);
        video.onloadedmetadata=()=>{clearTimeout(timer);resolve();};
        video.onerror=()=>{clearTimeout(timer);reject(new Error('视频无法播放，请换一个文件。'));};
      });
      if(!Number.isFinite(video.duration)||video.duration<1||video.videoWidth>1920||video.videoHeight>1080)
        throw new Error('请选择至少 1 秒、最高 1080p 的视频。');
      return {video:file};
    }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  }
  scope.imageSettings={load:()=>database('read'),save:images=>database('write',images),importImage,importVideo};
})(typeof window==='undefined'?{}:window);
