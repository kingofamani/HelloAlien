# 檔案架構

這份文件定義了「Hello UFO」專案的建議檔案與目錄結構。

```
HelloAlien/
├── .gitignore             # Git忽略設定檔
├── README.md              # 專案說明文件
├── FRAMEWORK.md           # 檔案架構文件
├── TODO.md                # 開發待辦清單
├── FLOW.md                # 程式流程圖
│
├── web/                   # 網頁端 (遊戲主畫面)
│   ├── index.html         # 遊戲主頁面
│   ├── css/               # 樣式表目錄
│   │   └── style.css      # 主要樣式檔
│   └── js/                # JavaScript腳本目錄
│       └── game.js        # 遊戲主要邏輯
│
└── mobile/                # 手機端 (控制器)
    ├── index.html         # 手機控制器頁面
    └── js/                # JavaScript腳本目錄
        └── mobile.js      # 手機端控制器邏輯
``` 