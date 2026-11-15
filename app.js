(() => {
"use strict";
const SOURCE="https://winedays.github.io/KCouper";
const $=id=>document.getElementById(id);
const drinkRE=/飲料|可樂|百事|雪碧|七喜|汽水|紅茶|綠茶|奶茶|咖啡|拿鐵|美式|檸檬茶|檸檬風味|果汁|冰茶|氣泡水|烏龍茶|無糖茶|冷泡茶|鮮奶茶|激浪|蜜桃茶/;
const foodGroups={
 "炸雞":/炸雞|咔啦脆雞|雞腿桶|雞翅|雞塊|雞米花|雞柳|雞排|雞腿排|爆脆雞|雞腿肉/,
 "漢堡":/漢堡|雞腿堡|脆雞堡|起司堡|蝦堡|牛肉堡|花生堡|烤雞堡/,
 "蛋撻":/蛋撻|原蛋|葡式蛋塔|蛋塔/,
 "薯條／點心":/薯條|香酥脆薯|雞米花|雞塊|洋蔥圈|薯球|地瓜球|點心|蝦塊/,
 "飯食／捲餅":/飯|粥|捲餅|墨西哥捲|飯糰/,
 "飲料":drinkRE
};
function matchingFoodGroups(c){
 const names=(c.items||[]).map(i=>String(i.name||""));
 return Object.fromEntries(Object.entries(foodGroups).map(([key,re])=>[key,names.some(n=>re.test(n) && (key!=="炸雞" || !/堡|捲餅/.test(n)))]));
}
function withinBudget(price,min,max){
 const low=min===""?null:Number(min),high=max===""?null:Number(max);
 return !(low!==null&&price<low || high!==null&&price>high || low!==null&&high!==null&&low>high);
}
const format=n=>new Intl.NumberFormat("zh-TW").format(n);
const money=n=>"NT$"+format(n);
const norm=s=>String(s||"").replace(/\s+/g,"").toLowerCase();
const node=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
const state={search:"",sort:"discount",budget:"",minPrice:"",maxPrice:"",food:{},knownOnly:false,favoritesOnly:false};
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
  if(state.search&&!norm([c.code,c.name,...itemNames(c)].join(" ")).includes(norm(state.search)))return false;
  if(!withinBudget(c.price,state.minPrice,state.maxPrice))return false;
  const groups=matchingFoodGroups(c);
  if(Object.entries(state.food).some(([key,mode])=>mode==="include"&&!groups[key]||mode==="exclude"&&groups[key]))return false;
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
 host.append(node("p","detail-meta",c.source==="kfc_api_verified"?"資料來源：本站查詢肯德基點餐 API 驗證":"資料來源：公開優惠彙整，本站尚未向官方 API 驗證；適用情形以官網為準"));
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
 if(drinksFor(c).length)pills.append(node("span","pill drink","🥤 含飲料"));
 pills.append(node("span","pill "+(c.source==="kfc_api_verified"?"verified":"unverified"),c.source==="kfc_api_verified"?"官方 API 已驗證":"待官方驗證"));
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
 Object.assign(state,{search:"",sort:"discount",budget:"",minPrice:"",maxPrice:"",food:{},knownOnly:false,favoritesOnly:false});
 for(const id of ["search","sort","budget","minPrice","maxPrice"])$(id).value=state[id];
 $("budgetError").textContent="";
 document.querySelectorAll("[data-food]").forEach(b=>{b.dataset.mode="all";b.textContent=b.dataset.food+" · 不限";b.setAttribute("aria-pressed","false");});
 for(const id of ["knownOnly","favoritesOnly"])$(id).checked=false;
 render();
}
function initTheme(){
 let stored="light";
 try{stored=localStorage.getItem("kfc-radar-theme")||"light";}catch{}
 const apply=mode=>{
   const dark=mode==="dark";
   document.documentElement.dataset.theme=dark?"dark":"light";
   $("themeLabel").textContent=dark?"淺色模式":"深色模式";
   $("themeToggle").setAttribute("aria-pressed",String(dark));
 };
 apply(stored);
 $("themeToggle").addEventListener("click",()=>{
   const next=document.documentElement.dataset.theme==="dark"?"light":"dark";
   apply(next);try{localStorage.setItem("kfc-radar-theme",next);}catch{}
 });
}
function bind(){
 for(const id of ["search","sort"])$(id).addEventListener(id==="search"?"input":"change",e=>{state[id]=e.target.value;render();});
 $("budget").addEventListener("change",e=>{
   state.budget=e.target.value;state.minPrice="";state.maxPrice=e.target.value;
   $("minPrice").value="";$("maxPrice").value=state.maxPrice;updateBudget();
 });
 for(const id of ["minPrice","maxPrice"])$(id).addEventListener("input",e=>{
   const v=e.target.value;
   state[id]=v===""?"":String(Math.max(0,Number(v)));
   state.budget="";$("budget").value="";updateBudget();
 });
 function updateBudget(){
   const invalid=state.minPrice!==""&&state.maxPrice!==""&&Number(state.minPrice)>Number(state.maxPrice);
   $("budgetError").textContent=invalid?"最低預算不能大於最高預算":"";
   render();
 }
 for(const name of Object.keys(foodGroups)){
   const b=node("button","food-filter",name+" · 不限");b.type="button";
   b.dataset.food=name;b.dataset.mode="all";b.setAttribute("aria-pressed","false");
   b.addEventListener("click",()=>{
     const next=({all:"include",include:"exclude",exclude:"all"})[b.dataset.mode];
     b.dataset.mode=next;b.textContent=name+" · "+({all:"不限",include:"包含",exclude:"排除"})[next];
     b.setAttribute("aria-pressed",String(next!=="all"));
     if(next==="all")delete state.food[name];else state.food[name]=next;
     render();
   });
   $("itemFilters").append(b);
 }
 initTheme();
 for(const id of ["knownOnly","favoritesOnly"])$(id).addEventListener("change",e=>{state[id]=e.target.checked;render();});
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
async function loadOfficialSnapshot(){
 const [couponResponse,priceResponse]=await Promise.all([
  fetch("./data/official.json?t="+Date.now(),{cache:"no-store"}),
  fetch("./data/singles.json?t="+Date.now(),{cache:"no-store"}).catch(()=>null)
 ]);
 if(!couponResponse.ok)throw Error("官方資料尚未建立");
 const data=await couponResponse.json();
 if(!Array.isArray(data.coupon_list)||data.coupon_list.length===0)throw Error("官方驗證優惠暫無資料");
 let singles=null;
 if(priceResponse?.ok){try{singles=await priceResponse.json();}catch{}}
 return {data,singles};
}
function mergeCouponLists(official,community){
 const byCode=new Map();
 for(const c of community||[]){
  if(c&&c.coupon_code!=null)byCode.set(String(c.coupon_code),{...c,source:"community_unverified"});
 }
 for(const c of official||[]){
  if(c&&c.coupon_code!=null)byCode.set(String(c.coupon_code),{...c,source:"kfc_api_verified"});
 }
 return [...byCode.values()];
}
function isValidOnDate(c,now=Date.now()){
 if(!c.end_date)return true;
 const stamp=Date.parse(String(c.end_date).replace(/\//g,"-").slice(0,10)+"T23:59:59+08:00");
 return Number.isFinite(stamp)&&stamp>=now;
}
function presentCoupons(data,singles,label){
 coupons=data.coupon_list.map(c=>enrich(c,singles)).filter(Boolean).filter(isValidOnDate);
 $("updated").textContent=label+(data.last_update?" · 更新："+data.last_update:"");
 $("total").textContent=format(coupons.length);
 const known=coupons.filter(c=>c.percent!==null);
 $("known").textContent=format(known.length);
 $("best").textContent=known.length?Math.max(...known.map(c=>c.percent))+"%":"—";
 $("drinks").textContent=format(coupons.filter(c=>drinksFor(c).length).length);
 render();
}
async function init(){
 bind();
 let officialData=null,officialPrices=null,communityData=null,communityPrices=null;
 let officialIssue=null,communityIssue=null;
 const refresh=()=>{
  const merged=mergeCouponLists(officialData?.coupon_list,communityData?.coupon_list);
  const prices={...(communityPrices||{}),...(officialPrices||{})};
  const confirmed=merged.filter(c=>c.source==="kfc_api_verified").length;
  const unverified=merged.length-confirmed;
  const label="已收錄：官方 API 驗證 "+confirmed+" 張 · 其他待驗證 "+unverified+" 張"
    +(officialData?.last_update?" · 官方更新："+officialData.last_update:"")
    +(communityData?.last_update?" · 補充更新："+communityData.last_update:"");
  presentCoupons({coupon_list:merged,last_update:""},prices,label);
 };
 // Show verified coupons as soon as official data arrives; don't discard
 // community coupons just because any official snapshot exists.
 const officialTask=loadOfficialSnapshot().then(({data,singles})=>{
  officialData=data;officialPrices=singles;refresh();
 }).catch(error=>{officialIssue=error;console.warn("官方資料暫時不可用",error.message)});
 const communityTask=(async()=>{
  let loaded=false;
  // Pages publishes a refreshed snapshot every 30 minutes. Display that
  // first, then replace it with the newest public source when reachable.
  for(const origin of ["snapshot","live"]){
   try{
    await Promise.all([
     loadScript("coupon.js",origin),
     loadScript("single.js",origin).catch(()=>null)
    ]);
    if(!window.COUPON_DICT||!Array.isArray(window.COUPON_DICT.coupon_list))throw Error("補充清單格式錯誤");
    communityData=window.COUPON_DICT;
    communityPrices=window.SINGLE_DICT||null;
    loaded=true;
    communityIssue=null;
    refresh();
   }catch(error){
    if(!loaded)communityIssue=error;
    console.warn("補充來源載入失敗："+origin,error.message);
   }
  }
 })();
 await Promise.allSettled([officialTask,communityTask]);
 if(!officialData&&!communityData){
  $("updated").textContent="資料暫時無法取得";
  $("status").textContent="兩個來源均無法取得，請稍後重試。";
  $("empty").hidden=false;
  $("empty").querySelector("strong").textContent="資料來源暫時不可用";
  $("empty").querySelector("p").textContent="請稍後重新整理，或前往肯德基官方優惠頁查詢。";
 }else if(officialIssue||communityIssue){
  $("status").textContent+=" · 部分來源暫不可用，現有優惠仍可查詢";
 }
}

window.__KFC_RADAR_TEST__={norm,drinksFor,referencePrice,enrich,matchingFoodGroups,withinBudget,mergeCouponLists,isValidOnDate};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();