// script.js
console.log("script.js version: 2.2.1");


let isSttReady = false;
let isRecording = false;

// 定義 ASR 相關的變數，但暫不賦值
let username_ASR = "";
let password_ASR = "";
const url_ASR = "https://asrapi01.bronci.com.tw";
const recordFileCheckbox = false;
const parserUrl = "";
const devices = "default";

let Recorder = null; // 初始化為 null

let autoScroll = true; // 確保這個變數有被宣告

/**
 * 使用代理器處理狀態
 */
const handler = {
    set: function (obj, props, value) {
        obj[props] = value;
    },
};
const proxy = new Proxy({ status: false, isRecording: false }, handler);

let sessionId_A = null;

// --- 新增: CSRF 管理器 ---
// 確保這是您的 Flask 後端 URL，特別是端口號
const BACKEND_FLASK_URL = "https://retibot-247393254326.us-central1.run.app"; // 請根據您的實際後端地址調整

class CsrfManager {
  constructor() {
      this.csrfToken = null;
      this.isFetchingToken = false; // 防止重複獲取
  }

  async fetchCsrfToken() {
      if (this.csrfToken && !this.isFetchingToken) {
          // 如果已經有 token 且沒有在獲取中，則直接返回
          return this.csrfToken;
      }
      if (this.isFetchingToken) {
          // 如果正在獲取中，等待獲取完成
          return new Promise(resolve => {
              const checkInterval = setInterval(() => {
                  if (!this.isFetchingToken && this.csrfToken) {
                      clearInterval(checkInterval);
                      resolve(this.csrfToken);
                  }
              }, 100);
          });
      }

      this.isFetchingToken = true;
      try {
          console.log("嘗試獲取 CSRF Token...");
          const response = await fetch(`${BACKEND_FLASK_URL}/want_csrft`,{credentials: 'include'});
          if (!response.ok) {
              throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          this.csrfToken = data.csrf_token;
          console.log("CSRF Token 獲取成功。");
          return this.csrfToken;
      } catch (error) {
          console.error("獲取 CSRF Token 時發生錯誤:", error);
          this.csrfToken = null; // 確保失敗時清空
          throw error; // 重新拋出錯誤
      } finally {
          this.isFetchingToken = false;
      }
  }

  getCsrfHeaders() {
      if (!this.csrfToken) {
          console.warn("CSRF token is not available. Please ensure fetchCsrfToken() was called and successful.");
          // 在嚴格模式下，這裡可以拋出錯誤，阻止未受保護的請求
          // throw new Error("CSRF token missing.");
          return {};
      }
      return {
          "X-CSRFToken": this.csrfToken,
      };
  }
}

const csrfManager = new CsrfManager(); // 實例化 CSRF 管理器

// 將所有 DOM 相關的初始化和事件綁定放在這一個 DOMContentLoaded 監聽器中
document.addEventListener('DOMContentLoaded', async () => {
    // 抓取 DOM 元素
    const recordButton = document.getElementById('record-button');
    const settingsButton = document.getElementById('settings-button');
    const voiceToggle = document.getElementById('voice-toggle');
    const languageSelect = document.getElementById('language-select');
    const sendButton = document.getElementById('send-button');
    const hideBannerButton = document.getElementById('hide-banner-button');
    const textInput = document.getElementById('textInput');

    // **重要：在頁面載入時就獲取 CSRF Token**
    try {
        await csrfManager.fetchCsrfToken();
    } catch (error) {
        console.error("應用程式啟動時獲取 CSRF Token 失敗，部分功能可能受限。", error);
        // 這裡可以選擇顯示一個用戶友好的錯誤訊息，或者禁用某些功能
    }

    // **在這裡安全地獲取憑證**
    // try {
    //     console.log("嘗試獲取 ASR 憑證...");
    //     const credResponse = await callGetCredApi();
    //     const response = await fetch(`https://retibot-247393254326.us-central1.run.app/get_cred`, {
    //         method: "GET",
    //         headers: {
    //             "content-type": "application/json",
    //         }
    //     });
    //     const json = await response.json(); // 確保 await
    //     BOB = json.BOB;
    //     STEVE = json.STEVE;
    //     console.log('ASR 憑證獲取成功。');
    //     console.log('Account aquired');

    // } catch (error) {
    //     console.error(`無法獲取 ASR 憑證: ${error}`);
    //     // 顯示錯誤訊息給使用者或禁用功能
    //     recordButton.textContent = "憑證錯誤";
    //     return; // 無法獲取憑證則停止初始化
    // }
    // **在這裡安全地獲取憑證 (這部分邏輯似乎是您原始檔案中關於 ASR 憑證的獲取，請確認其安全性)**
    // 由於後端 /get_cred 現在是 POST 且受 CSRF 保護，這裡需要調用 callGetCredApi
    try {
        console.log("嘗試獲取 ASR 憑證...");
        const credResponse = await callGetCredApi(); // 調用調整後的函數，它會包含 CSRF Token
        if (credResponse) {
            BOB = credResponse.BOB; // 假設這是用戶名
            STEVE = credResponse.STEVE; // 假設這是密碼
            console.log("ASR 憑證獲取成功。");
        } else {
            console.warn("未能獲取 ASR 憑證。");
        }
    } catch (error) {
        console.error("獲取 ASR 憑證時發生錯誤:", error);
    }

    // 禁用按鈕直到登入成功
    // recordButton.disabled = true;
    // recordButton.textContent = "初始化中...";

    // 處理 session 初始化
    const sessionId = await initSession();
    if (sessionId) {
        console.log("Session 已初始化，sessionId:", sessionId);
        sessionId_A = DOMPurify.sanitize(sessionId);
    } else {
        console.error("Session 初始化失敗");
    }

    // 確保 handleInit 在憑證獲取後執行
    // async function setupSTT() {
    //     try {
    //         console.log("語音功能開始初始化...");
    //         await navigator.mediaDevices.getUserMedia({ audio: true });
    //         await handleInit(); // 這裡會使用到 username_ASR 和 password_ASR
    //         console.log("初始化完成。");

    //         isSttReady = true;
    //         recordButton.disabled = false;
    //         recordButton.textContent = "🎤 語音輸入";
    //         console.log("錄音已準備就緒！");

    //     } catch (error) {
    //         console.error("錄音初始化或取得模型失敗:", error);
    //         recordButton.textContent = "錄音錯誤";
    //         // 如果初始化失敗，確保 Recorder 設為 null 或保持為 null
    //         Recorder = null; // 確保 Recorder 狀態正確
    //     }
    // }

    // // 執行錄音設置
    // setupSTT();

    // recordButton.addEventListener('click', async () => {
    //     if (!isSttReady) {
    //         console.warn("錄音連接尚未準備好，無法錄音。");
    //         return;
    //     }

    //     if (!isRecording) {
    //         // --- 開始錄音 ---
    //         try {
    //             console.log("嘗試開始錄音...");
    //             await handleStart();
    //             isRecording = true;
    //             recordButton.textContent = "⏹️ 停止輸入";
    //             console.log("錄音已開始。");

    //         } catch (error) {
    //             console.error("開始錄音失敗:", error);
    //             isRecording = false;
    //             recordButton.textContent = "🎤 語音輸入";
    //         }
    //     } else {
    //         // --- 停止錄音 ---
    //         try {
    //             console.log("嘗試停止錄音...");
    //             await handleStop();
    //             isRecording = false;
    //             recordButton.textContent = "🎤 語音輸入";
    //             console.log("錄音已停止。");

    //         } catch (error) {
    //             console.error("停止錄音失敗:", error);
    //             isRecording = false;
    //             recordButton.textContent = "🎤 語音輸入";
    //         }
    //     }
    // });

    // 綁定事件監聽器
    settingsButton.addEventListener('click', toggleMenu);
    // voiceToggle.addEventListener('change', toggleVoice);
    // languageSelect.addEventListener('change', saveLanguage);
    sendButton.addEventListener('click', sendMessage);
    hideBannerButton.addEventListener('click', hideBanner);

    // keyboard watching
    textInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && isDesktopDevice()) {
            event.preventDefault();
            sendMessage();
        }
    });
});

// 新增: 調整 callServePdfApi 函數以包含 CSRF Token
async function callServePdfApi(sessionId) {
  // 確保 CSRF Token 已經獲取
  // 這裡調用 fetchCsrfToken() 以防萬一在調用此函數時 CSRF Token 尚未載入
  try {
      await csrfManager.fetchCsrfToken();
  } catch (error) {
      console.error("無法獲取 CSRF Token，PDF 服務 API 調用將被取消。", error);
      return null; // 或者拋出錯誤
  }

  try {
      const response = await fetch(`${BACKEND_FLASK_URL}/serve_pdf_by_session`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              ...csrfManager.getCsrfHeaders(), // <-- 添加 CSRF Token 頭部
          },
          body: JSON.stringify({ session_id: sessionId }), // 根據後端要求，將 session_id 放在 body 中
          credentials: 'include',
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PDF service API call failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("PDF service response:", data);
      return data;
  } catch (error) {
      console.error("Error calling serve_pdf_by_session:", error);
      throw error; // 重新拋出錯誤
  }
}

// 新增: 調整 callGetCredApi 函數以包含 CSRF Token
async function callGetCredApi() {
  // 確保 CSRF Token 已經獲取
  // 這裡調用 fetchCsrfToken() 以防萬一在調用此函數時 CSRF Token 尚未載入
  try {
      await csrfManager.fetchCsrfToken();
  } catch (error) {
      console.error("無法獲取 CSRF Token，獲取憑證 API 調用將被取消。", error);
      return null; // 或者拋出錯誤
  }

  try {
      console.log('start fetching cred')
      const response = await fetch(`${BACKEND_FLASK_URL}/wake_up_and_work`, {
          method: "GET", // 後端已改為 GET
          credentials: 'include',
          headers: {
              "Content-Type": "application/json",
              ...csrfManager.getCsrfHeaders(), // <-- 添加 CSRF Token 頭部
          },
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Get credentials API call failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      // console.log("Get credentials response:", data);
      return data;
  } catch (error) {
      console.error("Error calling get_cred:", error);
      throw error; // 重新拋出錯誤，讓調用方 (如 DOMContentLoaded 裡面的 try-catch) 處理
  }
}


async function initSession() {
    try {
        const requestOptions = {
            method: "POST",
            // redirect: "follow",
            credentials: 'include'
        };

        const response = await fetch("https://retibot-247393254326.us-central1.run.app/init",
          requestOptions
        );
        const result = await response.json();
        console.log(result);

        appendMessage('bot', result.response);

        const sessionId = DOMPurify.sanitize(result.session_id);
        return sessionId;
    } catch (error) {
        console.error('初始化會話失敗:', error);
        appendMessage('bot', '初始化會話失敗');
        return null;
    }
}

/**
 * 判斷是否為桌面裝置
 */
function isDesktopDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|windows phone|iemobile|opera mini/i.test(userAgent);
    return !isMobile;
}

function toggleMenu() {
    const menu = document.getElementById('menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

let languageSelect_A = null;

function toggleVoice() {
    const voiceToggle = document.getElementById('voice-toggle').checked;
    const languageContainer = document.getElementById('language-container');
    if (voiceToggle) {
        languageContainer.style.display = 'block';
        const languageSelect = document.getElementById('language-select').value;
        languageSelect_A = languageSelect;
    } else {
        languageContainer.style.display = 'none';
        languageSelect_A = null;
    }
}

function saveLanguage() {
    const languageSelect = document.getElementById('language-select').value;
    languageSelect_A = languageSelect;
}

const chat = document.getElementById('chat');
async function sendMessage() {
    const input = document.getElementById('textInput');
    const text = input.value.trim();
    if (text === '') return;

    if (text.length>300) {
      alert('訊息過長');
      return;
    };

    appendMessage('user', text);
    input.value = '';

    appendLoading();

    fetch('https://retibot-247393254326.us-central1.run.app/chat', {
        method: 'POST',
        credentials:'include',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ session_id: sessionId_A, message: text })
    })
        .then(res => res.json())
        .then(async data => {
            removeLoading();
            appendMessage('bot', DOMPurify.sanitize(data.response));
            const TTS_TW = new TTS();
            const textFromAnotherBot = data.res_for_sound;
            TTS_TW.setLanguage(languageSelect_A);
            // if (document.getElementById('voice-toggle').checked) {
            //     TTS_TW.synthesizeSpeech(textFromAnotherBot);
            // }
            if (data.ending !== 0) {
                appendLoading();
                if (data.ending === 1) {
                    try {
                        await generatePDF(data);
                    } catch (error) {
                        console.error("Error generating PDF:", error);
                        appendMessage('bot', "PDF 報告生成失敗。");
                    }
                };

                removeLoading();
                appendMessage('bot', "本次諮詢已結束，如要重新開始對話重整頁面。");

                const inputArea = document.querySelector(".input-area");
                inputArea.style.display = "none";
            }
        })
        .catch(error => {
            removeLoading();
            console.error('Error', error);
            appendMessage('bot', '很抱歉，大宇宙意識斷線中，請重整頁面以重新連接。')
        });
}
async function appendPDFMessage(urllink) {
    const message = document.createElement('div');
    message.className = 'message bot';

    const avatar = document.createElement('div');
    avatar.className = ' avatar';
    message.appendChild(avatar);

    const content = document.createElement('a');
    content.className = `ProposalLink`;
    content.href = urllink;
    content.textContent = '點此下載/查看您的PDF檔案(請於15分鐘內下載)';
    content.target = '_blank';
    content.download = '文件.pdf'; // 修正下載時檔名為 '文件.pdf'
    const bubble = document.createElement('div');
    bubble.className = ' bubble';
    bubble.appendChild(content);
    message.appendChild(bubble);

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;

    const message2 = document.createElement('div');
    message2.className = 'message bot';
    const avatar2 = document.createElement('div');
    avatar2.className = ' avatar';
    message2.appendChild(avatar2);
    const bubble2 = document.createElement('div');
    bubble2.className = 'bubble';
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, urllink, {
        width: 200,
        color: {
            dark: '#ffffff',
            light: '#e53935',
        },
        correctLevel: 'H',
    });
    bubble2.appendChild(canvas);
    message2.appendChild(bubble2);
    chat.appendChild(message2);
    chat.scrollTop = chat.scrollHeight;

    console.log('link and QRCODE showed.');
}

function appendMessage(sender, text) {
    const message = document.createElement('div');

    const customRenderer = new marked.Renderer();
    customRenderer.link = function (href, title, text) {
        let html = `<a href="${href}"`;
        if (title) {
            html += ` title "${title}"`;
        }
        html += ` target="_blank" rel="noopener noreferrer">${text}</a>`;
        return html;
    }

    marked.setOptions({
        renderer: customRenderer,
        breaks: true
    })

    message.className = `message ${sender}`;
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = ' avatar';
        message.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = ' bubble';
        
        const unsafeHTML = marked.parse(text);
        const sanitizedHTML = DOMPurify.sanitize(unsafeHTML);

        bubble.innerHTML = sanitizedHTML;
        message.appendChild(bubble);

    } else if (sender === 'user') {
        const bubble = document.createElement('div');
        bubble.className = ' bubble';
        bubble.textContent = text;
        message.appendChild(bubble);
    }

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
}

let loadingMessage;
function appendLoading() {
    loadingMessage = document.createElement('div');
    loadingMessage.className = 'message bot'

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    loadingMessage.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.innerHTML = '<span></span><span></span><span></span>';

    bubble.appendChild(loading);
    loadingMessage.appendChild(bubble);

    chat.appendChild(loadingMessage);
    chat.scrollTop = chat.scrollHeight;
}

function removeLoading() {
    if (loadingMessage) {
        chat.removeChild(loadingMessage);
        loadingMessage = null;
    }
}

async function generatePDF(data) {
    // 確保 CSRF Token 已經獲取
    try {
        await csrfManager.fetchCsrfToken(); // 重新獲取或確保已獲取最新 token
    } catch (error) {
        console.error("無法獲取 CSRF Token，/genpdf API 調用將被取消。", error);
        return null; // 或者拋出錯誤
    }

    try {
        const response = await fetch('https://retibot-247393254326.us-central1.run.app/genpdf', {
            method: 'POST',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              ...csrfManager.getCsrfHeaders(), // <-- 添加 CSRF Token 頭部
             },
            body: JSON.stringify({ session_id: data.session_id, proposal: data.response }),
            
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const pdfdata = await response.json();
        const pdfUrl = pdfdata.url;

        if (pdfUrl) {
            console.log('link Retrieved: ', pdfUrl);
            appendPDFMessage(pdfUrl);
        } else {
            console.error('fail to retrieve PDF link', pdfdata);
        }
    } catch (error) {
        console.error('generate PDF failed: ', error);
    }
}

/**
 * 允許麥克風權限
 */
let tempStream = null;
async function getUserMediaPermission() {
    tempStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            noiseSuppression: false,
            autoGainControl: false,
        },
        video: false,
    });
}

/**
 * 初始化
 */
async function handleInit() {
    try {
        handleDestroy();

        // 關鍵修正：確保傳入 username_ASR, password_ASR, url_ASR, recordFileCheckbox
        Recorder = new ASRRecorder(
            BOB, // 傳遞 username
            STEVE, // 傳遞 password
            url_ASR,
            recordFileCheckbox
        );
        console.log("Initialized");
        proxy.status = true;
    } catch (error) {
        console.log("初始化錯誤：", error);
        proxy.status = false;
        Recorder = null; // 初始化失敗時確保 Recorder 為 null
    }
}

/**
 * 開始轉換聲音資料
 */
async function handleStart() {
    const parserUrlValue = parserUrl;
    const model = null;
    const deviceValue = null;

    try {
        // 確保 Recorder 存在才呼叫 start
        if (Recorder) {
            await Recorder.start(model, deviceValue, parserUrlValue, (data) => {
                handleRender(data);
            });
        } else {
            // 這個錯誤很可能是因為 handleInit 失敗了
            throw new Error("Recorder is not initialized.");
        }
        await setScreenLock();
        proxy.isRecording = true;
    } catch (error) {
        console.error(error); // 改為 console.error 更清晰
        handleStop();
    }
}

/**
 * 停止轉換聲音資料
 */
async function handleStop() {
    // 確保 Recorder 存在才呼叫 stop
    if (Recorder) {
        await Recorder.stop();
    } else {
        console.warn("Recorder is null, cannot stop.");
    }
    await releaseScreenLock();
    proxy.isRecording = false;
}

/**
 * 當你離開頁面時，若頁面有 keep-alive 機制，請用此函式停止轉換聲音資料及回復 ASRRecorder 初始狀態
 */
function handleDestroy() {
    if (Recorder) {
        Recorder.destroy();
        Recorder = null; // 銷毀後將 Recorder 設為 null
    }
}

/**
 * Demo 如何將翻譯好的資料渲染到畫面上
 */
function handleRender(data) {
    const { code, result, status, message2, bits, volume } = data;

    if (status) {
        if (status === "opened") {
            console.log(status);
        } else if (status === "closed") {
            console.log(status);
            handleStop();
        } else if (status === "bits") {
            console.log(status);
        } else if (status === "volume") {
            console.log(status);
        }
        return;
    }

    if (code === 100 || code === 180) return;

    const errorCode = [401, 408, 415, 486, 500, 502, 503, 599];
    if (errorCode.includes(code)) {
        console.log(code);
        handleStop();
    }

    if (code === 204) {
        console.log(code);
        handleStop();
    }

    if (code === 200) {
        console.log(code);
        const { segment, transcript, final } = result[0];
        const textInput = document.getElementById('textInput');
        textInput.value = result[0].transcript;
        console.log("錄音結果", result[0].transcript);
    }
}

/**
 * 確認瀏覽器是否支援 screen wake lock
 */
function isScreenLockSupported() {
    return "wakeLock" in navigator;
}

/**
 * 設定瀏覽器 screen lock
 */
let screenLock;
async function setScreenLock() {
    if (isScreenLockSupported()) {
        try {
            screenLock = await navigator.wakeLock.request("screen");
            console.log(`screen lock ${screenLock}`);
        } catch (error) {
            console.log(error.name, error.message2);
        }
    }
}

/**
 * 釋放瀏覽器 screen lock
 */
async function releaseScreenLock() {
    if (typeof screenLock !== "undefined" && screenLock !== null) {
        await screenLock.release();
        console.log(`screen lock released`);
        screenLock = null;
    }
}

/**
 * 變更 isRecord 狀態
 */
function handleChangeRecordFile() {
    if (Recorder) {
        Recorder.setIsRecord = recordFileCheckbox.checked;
    }
}

// 這個函式會在點擊「確定」按鈕時執行
function hideBanner() {
    const cookieBanner = document.getElementById('cookie-banner');
    if (cookieBanner) {
        cookieBanner.style.display = 'none';
    }
}

console.log(`Function:智能機器人 Author:Daniel Chien`);
console.log(`Function:語音輸入與輸出 Author:長問科技`);
console.log(`Function:前端介面與串接 Author:Angela Ko`);
const VERSION = "1.0.5";