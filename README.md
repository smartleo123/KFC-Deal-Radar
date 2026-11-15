# KFC Deal Radar｜肯德基優惠雷達

獨立製作的響應式 KFC 優惠查詢網站。資料優先使用本專案對肯德基點餐 API 已驗證的紀錄，尚未取得官方驗證資料時使用 [Winedays/KCouper](https://github.com/Winedays/KCouper) 社群備援。非肯德基官方網站。

## 功能
- 按折扣率、節省金額、價格、優惠碼排序
- 飲料條件：全部 / 含飲料 / 不含飲料；可選擇把「可替換選項」計入判斷
- 飲料分類：可樂、紅茶、綠茶、奶茶、咖啡、果汁、其他
- 套餐名稱、優惠碼及餐點關鍵字搜尋
- 最高預算篩選、只顯示可計算折扣之優惠、瀏覽器本地收藏
- 點擊查看完整餐點和加價選項
- 載入上游最新公開資料、顯示上游更新時間、過期優惠排除

## 折扣計算與限制

折扣率 = (單點參考價合計 − 優惠售價) / 單點參考價合計 × 100%。

優先使用來源提供的 `original_price`（若有效），否則參考公開 `single.js` 的單點價格以名稱配對估算。無法可靠匹配時顯示「原價未確認」，不捏造折扣。單點參考價不等於結帳保證價，組合內容、可替換品項、數量或名稱變動可能影響計算結果。折扣值僅供參考。

「含飲料」以預設餐點項目名稱分類；開啟「包含可替換飲料選項」後也比對 `flavors`，並不代表套餐一定附飲料。名稱分類屬啟發式規則，可能需要隨來源品項調整。

## 獨立官方 API 收集器（實驗性）

網站已改為優先載入本專案 `data/official.json`。只有經 `olo-api.kfcclub.com.tw` 回覆確認的優惠券，才會標為「肯德基 API 已驗證」。資料不存在或尚無有效驗證結果時，才以明確標示的 KCouper 公開清單當備援，絕不把社群整理的優惠券偽稱為官方驗證結果。

### 收集流程

`scripts/collect_official.py` 以 Python 標準函式庫與 CookieJar 管理點餐工作階段，查詢：

1. `QueryDeliveryShops`、`QueryDeliveryTime` 初始化門市/日期
2. `getEVoucherAPI` 查詢候選優惠碼
3. `checkCouponProduct` 驗證今日取餐方式與時段
4. `GetQueryFoodDetail` 查詢優惠餐點內容、價格、期限
5. `GetQueryMenu`、`GetQueryFood` 取得官方菜單與單點售價

每四小時 GitHub Actions 嘗試執行一次，預設每次最多檢查 35 個候選代碼，含請求間隔、超時及失敗保護。代碼候選來源包含已驗證的代碼、固定範圍輪詢，以及**可選的 KCouper 代碼發現**；後者只供發現候選，不用其價格、套餐或有效性作為官方結果。這套方法尚無法保證涵蓋全部有效優惠碼，也不保證某張優惠在每一間店與每一時段適用。

首次由官方 API 成功驗證後，結果儲存至 `data/official.json`、單點價格儲存至 `data/singles.json`，並提交至 `main` 供 GitHub Pages 部署使用。未通過驗證時保留舊快照、不覆蓋成空資料。

### 排程與資料新鮮度

- **官方 API**：預計每四小時增量查詢。資料時間以網站實際顯示的更新欄位為準；更新不是秒級即時。
- **社群備援**：原有每半小時發布的 KCouper 快照暫時保留，僅在尚無官方驗證資料時顯示。
- **使用限制**：這些是肯德基網域上的點餐端點，非經確認授權的公開第三方 API；可能拒絕請求或改版。請遵守網站適用條款，不要提高速率造成服務負擔。
- **失敗處理**：官方 API 連線、有效券數量與是否建立快照，可從 Actions 的 `Collect KFC official API data` 執行紀錄確認。僅有程式碼提交並不代表 API 已連線成功。

手動執行（需網路）：

```bash
python3 scripts/collect_official.py --out data
python3 -m http.server 8000
```

## 本機預覽

```bash
python3 -m http.server 8000
```

瀏覽 `http://localhost:8000/`。需要連網載入優惠資料。

## 發布至 GitHub Pages

1. 在 GitHub 建立 **public** repository，建議命名 `KFC-Deal-Radar`。
2. 將本資料夾所有檔案（含 `.nojekyll`）提交到預設分支根目錄。
3. 進入 **Settings → Pages → Build and deployment**，將 **Source** 設為 **GitHub Actions**（首次啟用需要 Repo 管理員在 GitHub 網站上操作）。
4. 前往 **Actions → Deploy GitHub Pages**，若沒有自動部署成功，點選 **Run workflow** 重新部署；部署成功後再開啟網站。預期網址：`https://smartleo123.github.io/KFC-Deal-Radar/`（前提是 repo 名稱和所有者相同）。

純 HTML/CSS/JS，無需 Node、後端或 API 金鑰。

## 歸屬與授權注意

此站的介面程式碼與官方資料收集器為獨立實作，參考 KCouper 公開的 API 呼叫思路，沒有直接複製其爬蟲原始碼。社群備援仍引用 KCouper 對外提供的資料。原專案檔案樹未找到根目錄 LICENSE，不能據此推定其資料可被任意重新授權；若要大量鏡像、商業使用或重散布資料，應先向原作者確認許可。