import { Hono } from 'hono'
import type { Env } from '../types'

export const tracking = new Hono<{ Bindings: Env }>()

// Minified tracking script with pageviews + custom events — stays under 2KB raw.
export const BEAM_JS = `(function(){var s=document.currentScript,id=s&&s.getAttribute('data-site-id');if(!id||navigator.doNotTrack==='1')return;var h=s.getAttribute('data-api')||'';if(!h&&s.src){try{var o=new URL(s.src);h=o.origin;}catch(e){}}var u=h+'/api/collect',q=new URLSearchParams(location.search),z=Intl.DateTimeFormat().resolvedOptions().timeZone,v={site_id:id,path:location.pathname,referrer:document.referrer,screen_width:screen.width,language:navigator.language,timezone:z,utm_source:q.get('utm_source')||undefined,utm_medium:q.get('utm_medium')||undefined,utm_campaign:q.get('utm_campaign')||undefined},x=function(o){var d=JSON.stringify(o);if(navigator.sendBeacon){navigator.sendBeacon(u,new Blob([d],{type:'application/json'}));}else{fetch(u,{method:'POST',body:d,headers:{'Content-Type':'application/json'},keepalive:true});}},b=window.beam||{};b.track=function(n,p){if(!n)return;var e={type:'event',site_id:id,event_name:String(n).slice(0,64),path:location.pathname,referrer:document.referrer,language:navigator.language,timezone:z};if(p&&typeof p==='object'&&!Array.isArray(p))e.properties=p;x(e)};window.beam=b;x(v)})();`

tracking.get('/js/beam.js', (c) => {
  return new Response(BEAM_JS, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})
