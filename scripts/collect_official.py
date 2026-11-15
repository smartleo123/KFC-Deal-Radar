#!/usr/bin/env python3
"""Independently query KFC Taiwan ordering endpoints (not an endorsed public API).

Small, rate-limited incremental checks. Data is only marked official_verified
after a successful response from KFC's domain; never claim this is complete.
"""
import argparse
import json
import os
from pathlib import Path
import time
from datetime import datetime, timezone, timedelta
from urllib.request import Request, build_opener, HTTPCookieProcessor
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError

API="https://olo-api.kfcclub.com.tw"
TZ=timezone(timedelta(hours=8))
SHOP=os.environ.get("KFC_SHOP_CODE","TWI104")
DELAY=float(os.environ.get("KFC_REQUEST_DELAY","0.7"))
MAX_CHECKS=int(os.environ.get("KFC_MAX_CHECKS","80"))
CURRENT_DATE=datetime.now(TZ).strftime("%Y/%m/%d")
OPENER=build_opener(HTTPCookieProcessor(CookieJar()))

def post(path, payload):
    url=API+path
    body=json.dumps(payload).encode()
    for attempt in range(3):
        try:
            request=Request(url,body,{"Content-Type":"application/json","Accept":"application/json","Origin":"https://www.kfcclub.com.tw","Referer":"https://www.kfcclub.com.tw/","User-Agent":"KFC-Deal-Radar/1.0"})
            with OPENER.open(request,timeout=18) as response:
                if response.status!=200:raise RuntimeError(f"HTTP {response.status}")
                raw=response.read(3_000_000)
            obj=json.loads(raw)
            if not isinstance(obj,dict):raise ValueError("Unexpected response")
            time.sleep(DELAY)
            return obj
        except (HTTPError,URLError,TimeoutError,ValueError) as err:
            if isinstance(err,HTTPError) and err.code in (401,403,404):
                raise RuntimeError(f"KFC endpoint refused request: {err.code}") from err
            if attempt==2:raise RuntimeError(f"KFC endpoint unavailable: {path}: {err}") from err
            time.sleep(min(2**attempt*3,10))
    raise RuntimeError("Unreachable")

def initialize_shop():
    shop=post("/menu/v1/QueryDeliveryShops",{"shopCode":SHOP,"orderType":"2","platform":"1"})
    if shop.get("Success") is not True:raise RuntimeError("Cannot initialize KFC shop")
    times=post("/menu/v1/QueryDeliveryTime",{"shopCode":SHOP,"orderType":"2","orderDate":CURRENT_DATE,"addQt":"0","sdeQt":"0"})
    if times.get("Success") is not True:raise RuntimeError("Cannot initialize KFC ordering date")

def name(s):
    s=str(s or "").strip()
    return s[1:-1].strip() if s.startswith("(") and s.endswith(")") else s

def parsed_date(s):
    if not s:return ""
    return str(s).replace("/","-")[:10]

def discovery_codes():
    """Optional *code discovery* from KCouper; coupon facts must be KFC verified.

    This is not a source for prices, validity, items or the frontend.
    The collector can continue operating via its scan range if unavailable.
    """
    try:
        req=Request("https://winedays.github.io/KCouper/coupon.js",
                    headers={"User-Agent":"KFC-Deal-Radar/1.0"})
        with OPENER.open(req,timeout=12) as response:
            data=response.read(5_000_000).decode("utf-8")
        prefix="window.COUPON_DICT="
        if not data.lstrip().startswith(prefix):return []
        parsed=json.loads(data.strip()[len(prefix):].rstrip(";"))
        raw=parsed.get("coupon_by_code") or {}
        return sorted({int(k) for k in raw if str(k).isdigit()}, reverse=True)
    except (OSError,ValueError,UnicodeError) as exc:
        print(f"Optional code discovery unavailable: {exc}")
        return []

def seed_codes(existing):
    """Fairly rotate known/discovered codes; scan near current observed series."""
    known=sorted({int(k) for k in existing if str(k).isdigit()})
    discovered=discovery_codes()
    budget=max(1,MAX_CHECKS)
    anchor=max(known+discovered,default=int(os.environ.get("KFC_SCAN_START","24000")))
    margin=max(100,int(os.environ.get("KFC_SCAN_MARGIN","2000")))
    start=max(1,anchor-margin)
    end=anchor+margin+1
    width=end-start
    known_offset=int(existing.get("_known_offset",0))
    discovery_offset=int(existing.get("_discovery_offset",0))
    scan_cursor=existing.get("_scan_cursor")
    cursor=int(scan_cursor) if scan_cursor is not None else start
    # New series: probe *above* the newest observed code first, not thousands
    # of older codes before reaching likely future promotions.
    if not (start<=cursor<end):cursor=anchor

    known_budget=min(len(known),budget//4)
    discovered_budget=min(len(discovered),budget//2)
    scan_budget=max(1,budget-known_budget-discovered_budget)

    def rotated(values,offset,limit):
        return [values[(offset+i)%len(values)] for i in range(min(limit,len(values)))] if values else []

    selected=list(dict.fromkeys(
        rotated(known,known_offset,known_budget)+
        rotated(discovered,discovery_offset,discovered_budget)+
        [start+(cursor-start+i)%width for i in range(scan_budget)]
    ))
    advanced=scan_budget
    while len(selected)<budget and advanced<width:
        candidate=start+(cursor-start+advanced)%width
        if candidate not in selected:selected.append(candidate)
        advanced+=1
    next_meta={
        "cursor":start+(cursor-start+advanced)%width,
        "known_offset":(known_offset+known_budget)%max(1,len(known)),
        "discovery_offset":(discovery_offset+discovered_budget)%max(1,len(discovered)),
        "window_start":start,
        "window_end":end,
        "discovered_count":len(discovered),
    }
    return selected[:budget],next_meta

def fetch_coupon(code):
    voucher=post("/customer/v1/getEVoucherAPI",{"voucherNo":str(code),"phone":"","memberId":"","orderType":"2","mealPeriod":"3","shopCode":SHOP})
    if voucher.get("Success") is not True or not isinstance(voucher.get("Data"),dict):
        return None
    fcode=voucher["Data"].get("productCode")
    if not fcode:return None
    combo=None
    # Inspect limited contexts instead of 10 API calls per coupon.
    for order_type,period in ((2,3),(2,2),(1,3)):
        check=post("/customer/v1/checkCouponProduct",{"orderDate":CURRENT_DATE,"orderType":str(order_type),"mealPeriod":str(period),"shopCode":SHOP,"couponCode":str(code),"memberId":""})
        if check.get("Success") is True and check.get("Message")=="OK":
            combo=(order_type,period)
            break
    if not combo:return None
    order_type,period=combo
    result=post("/menu/v1/GetQueryFoodDetail",{"shopcode":SHOP,"fcode":fcode,"menuid":"","mealperiod":str(period),"ordertype":str(order_type),"orderdate":CURRENT_DATE})
    details=(result.get("Data") or {}).get("FoodDetail") or []
    if not isinstance(details,list) or not details:return None
    food=details[0]
    price=float(food.get("Original_Price") or 0)
    items=[]
    for line in food.get("Details") or []:
        options=line.get("MList") or []
        if not options:continue
        first=options[0]
        count=int(line.get("MinCount") or 1)
        price+=float(first.get("MListPrice") or 0)*count
        items.append({"name":name(first.get("Name")),"count":count,"addition_price":float(first.get("AddPrice") or 0),"flavors":[{"name":name(opt.get("Name")),"addition_price":float(opt.get("AddPrice") or 0)} for opt in options[1:]]})
    if price<=0 or not items:return None
    return {"coupon_code":int(code),"product_code":fcode,"name":str(food.get("Name") or fcode),"price":round(price,2),"items":items,"start_date":parsed_date(food.get("StartDate")),"end_date":parsed_date(food.get("EndDate")),"meal_periods":[period],"order_types":[order_type],"source":"kfc_api_verified","verified_at":datetime.now(TZ).isoformat(timespec="seconds")}

def fetch_singles():
    response=post("/menu/v1/GetQueryMenu",{"ismember":"0","mealperiod":"0","orderdate":"","ordertype":"0","parentid":"0","shopcode":""})
    menu=(response.get("Data") or {}).get("Menu") or []
    titles={"炸雞/紙包雞","漢堡/飯","蛋撻","點心/飲料","早餐"}
    result={}
    for m in menu:
        if m.get("Title") not in titles:continue
        foods=post("/menu/v1/GetQueryFood",{"IsPKAPP":"0","ismember":"0","mealperiod":"0","menuid":m.get("MenuID"),"orderdate":"","ordertype":"0","parentid":"0","shopcode":""})
        for section in (foods.get("Data") or {}).get("Foods") or []:
            if "套餐" in str(section.get("Title")):continue
            for d in section.get("Details") or []:
                price=d.get("Upa_Group")
                if not isinstance(price,(int,float)) or price<=0:continue
                label=name(d.get("Name"))
                if label:result[label]={"code":d.get("Fcode"),"name":label,"price":price,"nutrition":str(d.get("Nutrition") or "")}
    if not result:raise ValueError("Official single item menu empty")
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",default="data")
    args=p.parse_args()
    out=Path(args.out)
    out.mkdir(parents=True,exist_ok=True)
    file=out/"official.json"
    previous=json.loads(file.read_text()) if file.exists() else {}
    saved=dict(previous.get("coupon_by_code") or {})
    meta=dict(previous.get("scan") or {})
    codes,next_scan=seed_codes({
        **saved,
        "_scan_cursor":meta.get("cursor"),
        "_known_offset":meta.get("known_offset",0),
        "_discovery_offset":meta.get("discovery_offset",0),
    })
    # Fail safe: the collector must prove access before modifying a valid snapshot.
    initialize_shop()
    checked=0
    failed=0
    verified=0
    for code in codes[:MAX_CHECKS]:
        try:
            entry=fetch_coupon(code)
            checked+=1
            if entry:
                saved[str(code)]=entry
                verified+=1
            elif str(code) in saved:
                # Inconclusive or expired: keep old record only until end date.
                pass
        except RuntimeError as exc:
            failed+=1
            print(f"API issue with code {code}: {exc}",flush=True)
            if failed>=3 and checked==0:
                raise SystemExit("KFC official API unreachable; preserving previous snapshot")
            if failed>=8:break
    today=datetime.now(TZ).date().isoformat()
    saved={k:v for k,v in saved.items() if not v.get("end_date") or v["end_date"]>=today}
    if checked==0:
        raise SystemExit("No successful KFC API replies; preserving old snapshot")
    # Keep a complete, self-owned snapshot; do not write a zero-count file over data.
    if not saved:
        print("No confirmed codes yet; waiting for next scan cycle")
    result={"coupon_by_code":saved,"coupon_list":sorted(saved.values(),key=lambda x:x["price"]),"count":len(saved),"last_update":datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S"),"source":"KFC Taiwan ordering API (unofficial integration)","scan":{**next_scan,"checked":checked,"verified_in_run":verified,"errors":failed,"max_checks":MAX_CHECKS,"shop_code":SHOP,"date":today}}
    temp=file.with_suffix(".tmp")
    temp.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(file)
    print(f"Queried {checked} KFC codes, {verified} confirmed; {len(saved)} retained")
    try:
        single=fetch_singles()
        (out/"singles.json").write_text(json.dumps(single,ensure_ascii=False),encoding="utf-8")
        print(f"Verified {len(single)} single menu products")
    except (RuntimeError,ValueError) as exc:
        print(f"Single-price refresh skipped: {exc}")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
