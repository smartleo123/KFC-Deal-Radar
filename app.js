(() => {
"use strict";
const SOURCE="https://winedays.github.io/KCouper";
const $=id=>document.getElementById(id);
const drinkRE=/飲料|可樂|百事|雪碧|七喜|汽水|紅茶|綠茶|奶茶|咖啡|拿鐵|美式|檸檬茶|檸檬風味|果汁|冰茶|氣泡水|烏龍茶|無糖茶|冷泡茶|鮮奶茶|激浪|蜜桃茶/;
const categories={可樂:/可樂|百事/,紅茶:/紅茶|檸檬茶|檸檬風味|冰茶|蜜桃茶/,綠茶:/綠茶|無糖茶|烏龍茶|冷泡茶/,奶茶:/奶茶|鮮奶茶/,咖啡:/咖啡|拿鐵|美式/,果汁:/果汁/,其他:/汽水|雪碧|七喜|激浪|氣泡水|飲料/};
const format=n=>new Intl.NumberFormat("zh-TW").format(n);
const money=n=>"NT$"+format(n);
const norm=s=>String(s||"").replace(/\s+/g,"").toLowerCase();
const node=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
const state={search:"",sort:"discount",budget:"",drink:"all",type:"",includeOptions:false,knownOnly:false,favoritesOnly:false};
let coupons=[],favorites;
try{favorites=new Set(JSON.parse(localStorage.getItem("kfc-radar-favorites")||"[]").map(String));}catch{favorites=new Set();}
const aliases={"原蛋":"原味蛋撻","小薯":"香酥脆薯(小)","中薯":"香酥脆薯(中)","大薯":"香酥脆薯(大)","4雞塊":"上校雞塊4塊","8雞塊":"上校雞塊8塊"};
function referencePrice(c,dict){
 const supplied=Number(c.original_price);
 if(Number.isFinite(supplied)&&supplied>0)return supplied;
 if(!dict)return null;
 let sum=0;
 for(const item of c.items||[]){
  const name=String(item.name||"").trim();
  if(/不需|響應環保|醬包|湯匙|刀叉及手套/.test(name))continue;
  let qty=Number(item.count??1);
  if(!Number.isFinite(qty)||qty<=0)return null;
  const cleaned=name.replace(/20:00前供應|\(辣\)|\(不辣\)/g,"").trim();
  let candidates=[name,cleaned,aliases[name],aliases[cleaned]].filter(Boolean);
  let found=candidates.map(k=>dict[k]).find(x=>x&&Number.isFinite(Number(x.price)));
  if(!found){
    const m=cleaned.match(/^(\d+)(?:入|塊)(.+)$/);
    if(m){qty*=Number(m[1]);found=dict[m[2]];}
  }
  if(!found||!Number.isFinite(Number(found.price)))return null;
  sum+=Number(found.price)*qty;
 }
 return sum>0?sum:null;
}
function itemNames(c,include=false){return(c.items||[]).flatMap(i=>[i.name,...(include?(i.flavors||[]).map(f=>f.name):[])]).filter(Boolean);}
function drinksFor(c,include=false){return itemNames(c,include).filter(n=>drinkRE.test(n));}
function enrich(c,dict){
 const price=Number(c.price);
 if(!Number.isFinite(price)||price<0||!c.coupon_code)return null;
 const original=referencePrice(c,dict);
 const saving=original!==null&&original>price?original-price:null;
 const percent=saving===null?null:Math.round(saving/original*1000)/10;
 return {...c,price,original,saving,percent,code:String(c.coupon_code)};
}
function getFiltered(){
 const list=coupons.filter(c=>{
  if(state.search&&!norm([c.code,c.name,...itemNames(c,state.includeOptions)].join(" ")).includes(norm(state.search)))return false;
  if(state.budget!==""&&c.price>Number(state.budget))return false;
  const drinks=drinksFor(c,state.includeOptions);
  if(state.drink==="yes"&&!drinks.length)return false;
  if(state.drink==="no"&&drinks.length)return false;
  if(state.type&&!drinks.some(n=>categories[state.type].test(n)))return false;
  if(state.knownOnly&&c.percent===null)return false;
  if(state.favoritesOnly&&!favorites.has(c.code))return false;
  return true;
 });
 list.sort((a,b)=>{
  let d=0;
  if(state.sort==="discount")d=(b.percent??-1)-(a.percent??-1);
  else if(state.sort==="saving")d=(b.saving??-1)-(a.saving??-1);
  else if(state.sort==="price-asc")d=a.price-b.price;
  else if(state.sort==="price-desc")d=b.price-a.price;
  else if(state.sort==="code")d=Number(a.code)-Number(b.code);
  return d||a.price-b.price||a.code.localeCompare(b.code,"zh-Hant",{numeric:true});
 });
 return list;
}
function detail(c){
 const host=$("detailContent");host.replaceChildren();
 host.append(node("span","code","優惠代碼 #"+c.code),node("h2","detail-title",c.name||"優惠券"));
 host.append(node("p","detail-meta","售價 "+money(c.price)+" · "+(c.percent===null?"原價未確認":("折扣 "+c.percent+"% · 省 "+money(c.saving)))));
 host.append(node("p","detail-meta","有效期間："+(c.start_date||"未提供")+" ～ "+(c.end_date||"未提供")));
 const list=node("ul","detail-list");
 for(const i of c.items||[]){
  const li=node("li","",String(i.name||"餐點")+" × "+(i.count||1));
  const variants=(i.flavors||[]).map(f=>f.name+(Number(f.addition_price)>0?" (+"+money(f.addition_price)+")":"")).join("、");
  if(variants)li.append(node("small","","可替換："+variants));
  list.append(li);
 }
 host.append(list,node("p","detail-meta","供應時段、門市適用條件與實際價格請以肯德基公告為準。"));
 $("detail").showModal();
}
function card(c){
 const a=node("article","coupon"),top=node("div","coupon-top"),head=node("div","coupon-head");
 head.append(node("span","code","# "+c.code));
 const fav=node("button","fav"+(favorites.has(c.code)?" on":""),favorites.has(c.code)?"♥":"♡");
 fav.type="button";fav.setAttribute("aria-label","收藏優惠碼 "+c.code);fav.setAttribute("aria-pressed",String(favorites.has(c.code)));
 fav.addEventListener("click",()=>{
  favorites.has(c.code)?favorites.delete(c.code):favorites.add(c.code);
  try{localStorage.setItem("kfc-radar-favorites",JSON.stringify([...favorites]));}catch{}
  render();
 });
 head.append(fav);top.append(head,node("h4","",c.name||"優惠券 "+c.code));
 const pills=node("div","pill-row");
 if(drinksFor(c,state.includeOptions).length)pills.append(node("span","pill drink","🥤 含飲料"));
 if(c.end_date)pills.append(node("span","pill","期限 "+c.end_date));
 top.append(pills,node("p","items",(c.items||[]).slice(0,6).map(i=>i.name+(Number(i.count)>1?" ×"+i.count:"")).join(" · ")));
 a.append(top);
 const bar=node("div","pricebar"),prices=node("div","price");
 prices.append(node("strong","",money(c.price)));
 if(c.original!==null)prices.append(node("span","original",money(c.original)));
 bar.append(prices);
 const saving=node("div","discount"+(c.percent===null?" unknown":""));
 saving.append(node("span","",c.percent===null?"原價未確認":c.percent+"% OFF"));
 if(c.saving!==null)saving.append(node("small","","省 "+money(c.saving)));
 bar.append(saving);a.append(bar);
 const buttons=node("div","card-actions"),open=node("button","details","查看內容");
 open.type="button";open.addEventListener("click",()=>detail(c));
 const link=node("a","order","前往肯德基 ↗");
 link.href="https://www.kfcclub.com.tw/";link.target="_blank";link.rel="noopener noreferrer";
 buttons.append(open,link);a.append(buttons);return a;
}
function render(){
 const list=getFiltered();$("resultCount").textContent=format(list.length);
 $("status").textContent="共 "+format(coupons.length)+" 張優惠券，符合條件 "+format(list.length)+" 張";
 const target=$("grid");target.replaceChildren();const fragment=document.createDocumentFragment();
 for(const c of list.slice(0,400))fragment.append(card(c));
 target.append(fragment);$("empty").hidden=list.length>0;
 if(list.length>400)$("status").textContent+=" · 先顯示前 400 筆";
}
function reset(){
 Object.assign(state,{search:"",sort:"discount",budget:"",drink:"all",type:"",includeOptions:false,knownOnly:false,favoritesOnly:false});
 for(const id of ["search","sort","budget"])$(id).value=state[id];
 for(const id of ["includeOptions","knownOnly","favoritesOnly"])$(id).checked=false;
 document.querySelectorAll("[data-drink]").forEach(b=>{const on=b.dataset.drink==="all";b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on));});
 $("drinkTypes").querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active",i===0));render();
}
function bind(){
 for(const id of ["search","sort","budget"])$(id).addEventListener(id==="search"?"input":"change",e=>{state[id]=e.target.value;render();});
 for(const id of ["includeOptions","knownOnly","favoritesOnly"])$(id).addEventListener("change",e=>{state[id]=e.target.checked;render();});
 document.querySelectorAll("[data-drink]").forEach(b=>b.addEventListener("click",()=>{
  state.drink=b.dataset.drink;document.querySelectorAll("[data-drink]").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));});render();
 }));
 for(const name of ["不限",...Object.keys(categories)]){
  const b=node("button",name==="不限"?"active":"",name);b.type="button";
  b.addEventListener("click",()=>{
   state.type=name==="不限"?"":name;
   $("drinkTypes").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));
   if(state.type&&state.drink==="no")document.querySelector('[data-drink="yes"]').click();else render();
  });$("drinkTypes").append(b);
 }
 $("reset").addEventListener("click",reset);$("emptyReset").addEventListener("click",reset);
 $("closeDetail").addEventListener("click",()=>$("detail").close());
 $("detail").addEventListener("click",e=>{if(e.target===$("detail"))$("detail").close();});
}
function loadScript(name,origin){
 return new Promise((resolve,reject)=>{
  const s=document.createElement("script");
  s.src=(origin==="live"?SOURCE+"/":"./")+name+"?t="+Date.now();
  s.async=true;
  let done=false;
  const complete=(error)=>{if(done)return;done=true;clearTimeout(timer);s.remove();error?reject(error):resolve();};
  const timer=setTimeout(()=>complete(Error("載入逾時："+name)),12000);
  s.onload=()=>complete();
  s.onerror=()=>complete(Error("無法讀取："+name));
  document.head.append(s);
 });
}
async function loadLatest(name,globalName){
  try{
    await loadScript(name,"live");
    if(!window[globalName])throw Error(name+" 缺少必要資料");
    return "live";
  }catch(err){
    // Never substitute invented coupons: use last successful published snapshot.
    window[globalName]=undefined;
    await loadScript(name,"snapshot");
    if(!window[globalName])throw Error(name+" 備援資料無效");
    return "snapshot";
  }
}
async function init(){
 bind();
 try{
  const [couponSource,priceSource]=await Promise.all([
    loadLatest("coupon.js","COUPON_DICT"),
    loadLatest("single.js","SINGLE_DICT").catch(()=> "unavailable")
  ]);
  const d=window.COUPON_DICT;
  if(!d||!Array.isArray(d.coupon_list))throw Error("優惠資料格式異常");
  coupons=d.coupon_list.map(c=>enrich(c,window.SINGLE_DICT)).filter(Boolean).filter(c=>!c.end_date||new Date(c.end_date+"T23:59:59+08:00").getTime()>=Date.now());
  $("updated").textContent=(couponSource==="live"?"即時來源":"備援快照")+" · 上游更新："+(d.last_update||"未提供")+(priceSource==="unavailable"?" · 單點價格暫無資料":"");
  $("total").textContent=format(coupons.length);
  const known=coupons.filter(c=>c.percent!==null);
  $("known").textContent=format(known.length);
  $("best").textContent=known.length?Math.max(...known.map(c=>c.percent))+"%":"—";
  $("drinks").textContent=format(coupons.filter(c=>drinksFor(c).length).length);
  render();
 }catch(e){
  $("updated").textContent="資料暫時無法取得";
  $("status").textContent="載入失敗："+e.message;
  $("empty").hidden=false;
  $("empty").querySelector("strong").textContent="資料來源暫時不可用";
  $("empty").querySelector("p").textContent="請稍後重新整理，或前往 KCouper 查詢。";
 }
}
window.__KFC_RADAR_TEST__={norm,drinksFor,referencePrice,enrich};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();