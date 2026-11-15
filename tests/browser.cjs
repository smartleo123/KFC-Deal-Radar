const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");

async function main(){
 const html=fs.readFileSync("index.html","utf8");
 const official=JSON.parse(fs.readFileSync("data/official.json","utf8"));
 const singles=JSON.parse(fs.readFileSync("data/singles.json","utf8"));
 assert(official.coupon_list.length>0,"Fixture must contain coupons");
 const dom=new JSDOM(html,{url:"https://smartleo123.github.io/KFC-Deal-Radar/?coupon="+official.coupon_list[0].coupon_code,runScripts:"outside-only"});
 const {window:w}=dom;
 const errors=[];
 let copiedLink="";
 Object.defineProperty(w.navigator,"clipboard",{configurable:true,value:{writeText:async value=>{copiedLink=value;}}});
 w.addEventListener("error",e=>errors.push(e.error||e.message));
 w.fetch=async url=>({
   ok:true,
   json:async()=>String(url).includes("singles.json")?singles:official
 });
 const sample=official.coupon_list[0];
 const extra={coupon_code:9999988,name:"合併資料測試",price:85,end_date:"2099-12-31",items:[{name:"可樂",count:1}]};
 const community={coupon_list:[extra,{...sample,price:1}],last_update:"test"};
 const originalAppend=w.document.head.append.bind(w.document.head);
 w.document.head.append=(element)=>{
   if(element.tagName==="SCRIPT"&&String(element.src).includes("coupon.js")){
     w.COUPON_DICT=community;
     queueMicrotask(()=>element.onload?.());
   }else if(element.tagName==="SCRIPT"&&String(element.src).includes("single.js")){
     w.SINGLE_DICT=singles;
     queueMicrotask(()=>element.onload?.());
   }else originalAppend(element);
 };
 w.eval(fs.readFileSync("app.js","utf8"));
 await new Promise(resolve=>setTimeout(resolve,350));
 const $=id=>w.document.getElementById(id);
 console.log("Status:",$("status").textContent);
 console.log("Rendered cards:",w.document.querySelectorAll("article.coupon").length);
 assert.equal(w.document.querySelectorAll("article.coupon").length,1,"Deep link must show only the selected coupon");
 assert.equal($("sharedView").hidden,false,"Shared coupon banner must appear");
 assert.equal($("sharedCode").textContent,"#"+official.coupon_list[0].coupon_code);
 const firstShare=w.document.querySelector("article.coupon .share");
 assert(firstShare,"Shared coupon card must include a share button");
 firstShare.click();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(copiedLink,"https://smartleo123.github.io/KFC-Deal-Radar/?coupon="+official.coupon_list[0].coupon_code,"Share must copy a deep link, not just the code");
 assert.equal(firstShare.textContent,"✓ 已複製","Copy success should be visible");
 $("showAll").click();
 assert.equal(w.location.search,"","View all must remove shared coupon query");
 assert.equal($("sharedView").hidden,true,"Shared banner should disappear after viewing all");
 assert(!w.document.querySelector("#knownOnly"),"Obsolete discount-calculable filter must not exist");
 if(errors.length)throw errors[0];
 assert.notEqual($("total").textContent,"—","Total must render");
 assert(w.document.querySelectorAll("article.coupon").length>0,"Cards must render after official data loads");
 assert.equal($("empty").hidden,true);
 assert.equal(Number($("total").textContent.replace(/,/g,"")),official.coupon_list.length+1,"Community-only coupon must appear alongside official coupons");
 assert($("grid").textContent.includes("9999988"),"Community-only coupon code must be displayed");
 assert(!w.document.body.textContent.includes("官方更新："),"Source timestamps must not appear on page");
 assert(!w.document.body.textContent.includes("補充更新："),"Supplement timestamps must not appear on page");
 const cards=[...w.document.querySelectorAll("article.coupon")];
 const extraCard=cards.find(c=>c.textContent.includes("9999988"));
 assert(extraCard && !extraCard.textContent.includes("官方驗證"),"Community-only coupon must have no verification badge");
 const officialCard=cards.find(c=>c.querySelector(".code")?.textContent.includes(String(sample.coupon_code)));
 assert(officialCard?.querySelector(".pill.verified")?.textContent==="官方驗證","Verified coupon must have official badge");
 assert(officialCard?.querySelector(".validity")?.textContent.includes(sample.end_date),"Coupon card must display end date");
 assert(officialCard?.querySelector(".validity")?.textContent.includes(sample.start_date),"Coupon card must display start date");
 assert.equal(w.document.querySelectorAll(".price-origin").length,0,"Cards must not repeat pricing source labels");
 assert.equal(w.document.querySelectorAll(".pricing-note").length,1,"One shared pricing note must exist");
 assert($("pricingNote").textContent.includes("肯德基官網單點定價"),"Pricing note must explain the comparison basis");
 assert(w.document.querySelector(".item-filter .filter-heading")?.textContent==="餐點品項","Meal category label must remain");
 const foodButton=[...w.document.querySelectorAll("[data-food]")].find(b=>b.dataset.food==="飲料");
 assert(foodButton,"Food filter must include drinks");
 foodButton.click();
 assert.equal(foodButton.dataset.mode,"include");
 $("reset").click();
 assert.equal(foodButton.dataset.mode,"all");
 $("themeToggle").click();
 assert.equal(w.document.documentElement.dataset.theme,"dark");
 dom.window.close();
 console.log("Browser DOM smoke tests passed");
}
main().catch(error=>{console.error(error);process.exitCode=1});
