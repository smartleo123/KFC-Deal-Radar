const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");

async function main(){
 const html=fs.readFileSync("index.html","utf8");
 const official=JSON.parse(fs.readFileSync("data/official.json","utf8"));
 const singles=JSON.parse(fs.readFileSync("data/singles.json","utf8"));
 assert(official.coupon_list.length>0,"Fixture must contain coupons");
 const dom=new JSDOM(html,{url:"https://smartleo123.github.io/KFC-Deal-Radar/",runScripts:"outside-only"});
 const {window:w}=dom;
 const errors=[];
 w.addEventListener("error",e=>errors.push(e.error||e.message));
 w.fetch=async url=>({
   ok:true,
   json:async()=>String(url).includes("singles.json")?singles:official
 });
 w.eval(fs.readFileSync("app.js","utf8"));
 await new Promise(resolve=>setTimeout(resolve,350));
 const $=id=>w.document.getElementById(id);
 console.log("Updated:",$("updated").textContent);
 console.log("Status:",$("status").textContent);
 console.log("Rendered cards:",w.document.querySelectorAll("article.coupon").length);
 if(errors.length)throw errors[0];
 assert.notEqual($("total").textContent,"—","Total must render");
 assert(w.document.querySelectorAll("article.coupon").length>0,"Cards must render after official data loads");
 assert.equal($("empty").hidden,true);
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
