import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {installRenderer} from './renderer.mjs';

export async function buildInjection(root){
  const read=name=>readFile(join(root,name));
  const [html,css,settings,animation]=await Promise.all(['index.html','style.css','image-settings.js','animation.js'].map(read));
  const media=async(name,fallback,mime)=>{
    const [bytes,type]=await read(name).then(data=>[data,mime]).catch(()=>read(fallback).then(data=>[data,'image/svg+xml']));
    return `data:${type};base64,${bytes.toString('base64')}`;
  };
  const [avatar,artwork,video]=await Promise.all([
    media('assets/avatar.jpg','assets/sample-avatar.svg','image/jpeg'),
    media('assets/artwork.jpg','assets/sample-artwork.svg','image/jpeg'),
    read('assets/startup.mp4').then(data=>'data:video/mp4;base64,'+data.toString('base64')).catch(()=>''),
  ]);
  const payload={
    html:html.toString().replace(/<!doctype[^>]*>/ig,'').replace(/<html[^>]*>|<\/html>/ig,'')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/ig,'').replace(/<link\b[^>]*>/ig,'')
      .replace(/<meta\b[^>]*http-equiv[^>]*>/ig,'').replace(/src="assets\/[^\"]*"/g,''),
    css:css.toString(),assets:{avatar,artwork,video}
  };
  const mount=`function(window){const document=window.document,location=window.location,performance=window.performance,indexedDB=window.indexedDB,Image=window.Image,URL=window.URL,module=undefined;const requestAnimationFrame=window.requestAnimationFrame.bind(window),cancelAnimationFrame=window.cancelAnimationFrame.bind(window);\n${settings}\n${animation}\n}`;
  return `(${installRenderer.toString()})(${JSON.stringify(payload)},${mount})`;
}
