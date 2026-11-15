# KFC Deal Radar｜肯德基優惠雷達

獨立製作的響應式 KFC 優惠查詢網站，資料取自 [Winedays/KCouper](https://github.com/Winedays/KCouper) 公開發布的優惠清單。非肯德基官方網站。

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

資料在訪客瀏覽器從 `https://winedays.github.io/KCouper/coupon.js` 與 `single.js` 動態載入，因此不需自行掃描 KFC API；但上游改版、無法連線或停止更新時，本站也會受到影響。載入來源 JavaScript 的安全性依賴上游站點，請自行評估信任程度。若需要更獨立的架構，可改成自己的 CI 定時下載、驗證並將資料轉成 JSON。

## 本機預覽

```bash
python3 -m http.server 8000
```

瀏覽 `http://localhost:8000/`。需要連網載入優惠資料。

## 發布至 GitHub Pages

1. 在 GitHub 建立 **public** repository，建議命名 `KFC-Deal-Radar`。
2. 將本資料夾所有檔案（含 `.nojekyll`）提交到預設分支根目錄。
3. 進入 **Settings → Pages → Build and deployment → Deploy from a branch**，選擇 `main` / `/(root)`，儲存。
4. 等候 GitHub Pages 部署。預期網址：`https://smartleo123.github.io/KFC-Deal-Radar/`（前提是 repo 名稱和所有者相同）。

純 HTML/CSS/JS，無需 Node、後端或 API 金鑰。

## 歸屬與授權注意

此站的介面程式碼為獨立實作，並未複製 KCouper 的網頁程式碼。網站引用 KCouper 對外提供的資料。原專案檔案樹未找到根目錄 LICENSE，不能據此推定其資料可被任意重新授權；若要大量鏡像、商業使用或重散布資料，應先向原作者確認許可。