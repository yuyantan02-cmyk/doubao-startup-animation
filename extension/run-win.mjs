import {execFile as rawExec,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import {realpath} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {buildInjection} from './payload.mjs';
import {connect,pageTarget,localSocket} from './cdp.mjs';

const exec=promisify(rawExec);
const root=dirname(dirname(fileURLToPath(import.meta.url)));
async function freePort(){
  return new Promise((resolve,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolve(port));});});
}
export function validateListeners(records,exe,port){
  if(!Array.isArray(records)||!records.length||records.some(record=>record.LocalAddress!=='127.0.0.1'||record.ExecutablePath?.toLowerCase()!==exe.toLowerCase()||Number(record.LocalPort)!==port))throw new Error('调试端口不属于选定的豆包程序，或没有限定在 127.0.0.1');
}
export async function verifyListener(port,exe){
  const script=`$items = @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop | ForEach-Object { $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"; [pscustomobject]@{ LocalAddress = $_.LocalAddress; LocalPort = $_.LocalPort; ExecutablePath = $p.ExecutablePath } }); ConvertTo-Json -InputObject $items -Compress`;
  const {stdout}=await exec('powershell.exe',['-NoProfile','-Command',script],{timeout:4000,maxBuffer:65536});
  validateListeners(JSON.parse(stdout),exe,port);
}
async function main(){
  const i=process.argv.indexOf('--exe');
  if(i<0||!process.argv[i+1])throw new Error('请从 Windows/豆包动态启动.cmd 启动');
  if(typeof WebSocket!=='function')throw new Error('需要 Node.js 22 或更新版本');
  const exe=await realpath(process.argv[i+1]),source=await buildInjection(root),port=await freePort();
  const child=spawn(exe,['--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`],{detached:true,stdio:'ignore'});
  child.on('error',error=>console.error('豆包启动失败：'+error.message));child.unref();
  const deadline=Date.now()+45000;let lastError='等待豆包页面';
  while(Date.now()<deadline){
    let client;
    try{
      await verifyListener(port,exe);
      const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1200),redirect:'error'});
      if(!response.ok)throw new Error('调试页面尚未就绪');
      const targets=await response.json();if(!Array.isArray(targets))throw new Error('无效页面列表');
      const target=targets.find(item=>pageTarget(item)&&item.url.startsWith('doubao://doubao-chat/'))||targets.find(pageTarget);if(!target)throw new Error('尚未找到主窗口');
      client=await connect(localSocket(target.webSocketDebuggerUrl,port));
      const result=await client.call('Runtime.evaluate',{expression:source,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails||result.result?.value?.installed!==true)throw new Error('外观脚本未能加载');
      for(let attempt=0;attempt<50;attempt++){
        const answer=await client.call('Runtime.evaluate',{expression:'globalThis.__doubaoStartupExtension?.status()',returnByValue:true});
        const state=answer.result?.value;
        if(state?.ready){const watcher=spawn(process.execPath,[fileURLToPath(new URL('./drive.mjs',import.meta.url)),String(port),'win',exe],{detached:true,stdio:'ignore',windowsHide:true});watcher.unref();console.log('已开始播放。按 Ctrl+Alt+B 更换素材，Esc 跳过动画。');return;}
        if(state?.phase==='failed'||state?.phase==='timeout')throw new Error('动画素材加载失败，覆盖层已移除');
        await delay(100);
      }
      throw new Error('动画启动确认超时');
    }catch(error){lastError=error.message;}
    finally{client?.close();}
    await delay(150);
  }
  throw new Error('接入失败：'+lastError+'。完全退出后，从豆包原图标打开即可关闭调试端口。');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(error=>{console.error(error.message);process.exitCode=1;});
