import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {connect,localSocket} from './cdp.mjs';

export function driveTarget(target){
  try{const url=new URL(target.url);return target.type==='iframe'&&url.protocol==='https:'&&url.hostname==='www.doubao.com'&&url.pathname.startsWith('/drive-iframe/drive/');}catch{return false;}
}

async function main(){
  const port=Number(process.argv[2]),kind=process.argv[3],app=process.argv[4];
  if(!Number.isInteger(port)||port<1||port>65535||!['mac','win'].includes(kind)||!app)throw new Error('无效云盘监视参数');
  const verify=kind==='mac'?(await import('./run.mjs')).verifyListener:(await import('./run-win.mjs')).verifyListener;
  const css=await readFile(new URL('./drive.css',import.meta.url),'utf8');
  const clients=new Map();let misses=0,lastVerify=0;
  try{
    while(misses<3){
      try{
        if(Date.now()-lastVerify>5000){await verify(port,app);lastVerify=Date.now();}
        const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1200),redirect:'error'});
        if(!response.ok)throw new Error('豆包调试端口已关闭');
        const targets=await response.json();if(!Array.isArray(targets))throw new Error('无效页面列表');
        const active=new Set(targets.filter(driveTarget).map(target=>target.id));
        for(const [id,client] of clients)if(!active.has(id)){client.close();clients.delete(id);}
        for(const target of targets.filter(driveTarget)){
          if(clients.has(target.id))continue;
          let client;
          try{
            client=await connect(localSocket(target.webSocketDebuggerUrl,port));
            await client.call('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
            const source=`(()=>{function apply(){let style=document.getElementById('doubao-drive-skin');if(!style){style=document.createElement('style');style.id='doubao-drive-skin';document.head.appendChild(style)}style.textContent=${JSON.stringify(css)}}document.head?apply():document.addEventListener('DOMContentLoaded',apply,{once:true})})()`;
            await client.call('Page.addScriptToEvaluateOnNewDocument',{source});
            const result=await client.call('Runtime.evaluate',{expression:source});
            if(result.exceptionDetails)throw new Error('云盘样式注入失败');
            clients.set(target.id,client);
          }catch{client?.close();}
        }
        misses=0;
      }catch{misses++;}
      await delay(1000);
    }
  }finally{for(const client of clients.values())client.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(()=>process.exitCode=1);
