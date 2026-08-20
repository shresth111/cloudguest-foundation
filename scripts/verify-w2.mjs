import { chromium } from "playwright";
const P=(b)=> "data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">${b}</svg>`);
const PHOTO=P('<rect width="24" height="24" fill="#8A6E52"/>');
const WIDE="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 96"><rect width="480" height="96" fill="#0F3D2E"/><text x="240" y="60" font-size="48" fill="#E8D8A8" text-anchor="middle">ASHOKA PALACE</text></svg>');
const msgs = { none:null, one:"Complimentary WiFi for our guests.",
 three:"Welcome to our home away from home. Complimentary high-speed WiFi is included with your stay, and our front desk is here to help.",
 five:"Welcome to our home away from home. Complimentary high-speed WiFi is included with your stay, and our front desk team is available around the clock should you need anything at all during your visit."};
const cfg=(o)=>({id:"m",name:"The Grand Ashoka Residency",theme:"light",logo_url:null,background_image_url:PHOTO,primary_color:"#6366f1",secondary_color:"#1E293B",default_language:"en",supported_languages:["en","hi"],advertisement_banner_url:null,advertisement_banner_link:null,terms_and_conditions_text:"Fair use.",terms_and_conditions_url:null,privacy_policy_text:null,privacy_policy_url:null,splash_headline:null,splash_welcome_message:null,redirect_url:null,otp_sms_enabled:true,otp_email_enabled:false,otp_whatsapp_enabled:false,username_password_enabled:false,voucher_enabled:false,resolved_via_location_override:true,is_open_now:true,business_hours_closed_message:null,guest_font_choice:"system",background_overlay_strength:55,background_focal_x:50,background_focal_y:25,background_luminance:null,background_top_luminance:null,background_entropy:null,pin_login_enabled:false,location_country:"IN",...o});
const U="/portal/welcome?organizationId=11111111-1111-4111-8111-111111111111&locationId=22222222-2222-4222-8222-222222222222&routerId=33333333-3333-4333-8333-333333333333";
const b=await chromium.launch();
async function open(vw,vh,o,scale){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  await p.route("**/api/v1/**",r=>r.fulfill({status:200,contentType:"application/json",body:"null"}));
  await p.route("**/captive-portal/resolve*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(cfg(o))}));
  await p.goto("http://localhost:4320"+U,{waitUntil:"networkidle"});
  await p.waitForSelector("main h1",{timeout:20000});
  if(scale&&scale!=="1") await p.evaluate(s=>document.querySelector(".portal-runtime").style.setProperty("--pg-type-scale",s),scale);
  await p.waitForTimeout(200);
  return {ctx,p};
}
console.log("=== W2: does a long welcome message push the CTA below the fold? ===");
console.log("viewport  msg     scale  CTAtop  CTAbot  fold  verdict");
for(const [vw,vh] of [[375,667],[360,640],[390,844]]) for(const scale of ["1","1.25"]) for(const [k,m] of Object.entries(msgs)){
  const {ctx,p}=await open(vw,vh,{splash_welcome_message:m},scale);
  const btn=await p.$('main button:has-text("Send code"), main button[type=submit]');
  const box=btn?await btn.boundingBox():null;
  console.log(`${vw}x${vh} ${k.padEnd(7)} ${scale.padEnd(6)} ${String(box?Math.round(box.y):"-").padEnd(7)} ${String(box?Math.round(box.y+box.height):"-").padEnd(7)} ${String(vh).padEnd(5)} ${box?(box.y+box.height<=vh?"visible":"BELOW FOLD"):"NO BTN"}`);
  await ctx.close();
}
console.log("\n=== LOGO: wide 5:1 lockup rendered box ===");
{ const {ctx,p}=await open(390,844,{logo_url:WIDE},"1");
  const img=await p.$("main img");
  console.log("rendered:", await img.boundingBox(), " natural: 480x96 (5:1)");
  await ctx.close(); }
console.log("\n=== DEVANAGARI: pg-title line boxes vs ink at 1.15 line-height ===");
{ const {ctx,p}=await open(390,844,{name:"होटल श्री महाराजा पैलेस एवं सम्मेलन केंद्र",default_language:"hi"},"1.25");
  const h1=await p.$("main h1");
  console.log(await h1.evaluate(el=>{
    const cs=getComputedStyle(el);
    const r=document.createRange(); r.selectNodeContents(el);
    const rects=[...r.getClientRects()].map(x=>({top:+x.top.toFixed(1),bot:+x.bottom.toFixed(1),h:+x.height.toFixed(1)}));
    return {fontSize:cs.fontSize,lineHeight:cs.lineHeight,fontFamily:cs.fontFamily.slice(0,60),lines:rects.length,rects,elH:+el.getBoundingClientRect().height.toFixed(1)};
  }));
  await ctx.close(); }
await b.close();
