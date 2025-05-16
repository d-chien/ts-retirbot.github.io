console.log("script.js version: 2.0.1");
let isSttReady = false;
let isRecording = false;

document.addEventListener('DOMContentLoaded',()=>{
    const recordButton = document.getElementById('record-button');
    // 禁用按鈕直到登入成功
    recordButton.disabled = true;
    recordButton.textContent = "初始化中...";
    
    async function setupSTT() {
        try {
            console.log("語音功能開始初始化...");
            await navigator.mediaDevices.getUserMedia({audio:true});
            //Recorder = new ASRRecorder("ASR0421_70789634","Api042170789634","https://asrapi01.bronci.com.tw",false)
            await handleInit();
            console.log("初始化完成。");

            isSttReady = true;
            recordButton.disabled = false;
            recordButton.textContent = "🎤 開始錄音";
            console.log("錄音已準備就緒！");

        } catch (error) {
            console.error("錄音初始化或取得模型失敗:", error);
            recordButton.textContent = "錄音錯誤";
        }
    }

    // 執行錄音設置
    setupSTT();

    recordButton.addEventListener('click', async () => {
        if (!isSttReady) {
            console.warn("錄音連接尚未準備好，無法錄音。");
            return; // 如果STT未就緒，不執行任何操作
        }
    
        if (!isRecording) {
            // --- 開始錄音 ---
            try {
                console.log("嘗試開始錄音...");
                await handleStart();
                isRecording = true;
                recordButton.textContent = "⏹️ 停止錄音";
                console.log("錄音已開始。");
    
            } catch (error) {
                console.error("開始錄音失敗:", error);
                isRecording = false; // 確保狀態正確
                recordButton.textContent = "🎤 開始錄音";
            }
        } else {
            // --- 停止錄音 ---
            try {
                console.log("嘗試停止錄音...");
                await handleStop();
                isRecording = false;
                recordButton.textContent = "🎤 開始錄音";
                console.log("錄音已停止。");
                
    
            } catch (error) {
                console.error("停止錄音失敗:", error);
                 isRecording = false;
                 recordButton.textContent = "🎤 開始錄音";
            }
        }
    });
});








async function initSession() {
    try {
        const requestOptions = {
            method: "POST",
            redirect: "follow"
        };

        const response = await fetch("https://retibot-247393254326.us-central1.run.app/init", requestOptions);
        const result = await response.json();
        console.log(result);

        // 顯示回覆在 bot 對話裡面
        appendMessage('bot', result.response);

        // 獲取 session_id 的值
        const sessionId = result.session_id; 
        return sessionId;
    } catch (error) {
        console.error('初始化會話失敗:', error);
        appendMessage('bot', '初始化會話失敗');
        return null;
    }
}

let sessionId_A = null;
document.addEventListener('DOMContentLoaded', async () => {
    const sessionId = await initSession();
    if (sessionId) {
        console.log("Session 已初始化，sessionId:", sessionId);
        sessionId_A = sessionId;
    } else {
        console.error("Session 初始化失敗");
    }
});




    function toggleMenu(){
        const menu = document.getElementById('menu');
        menu.style.display = menu.style.display === 'block' ? 'none':'block';
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
            languageSelect_A = null; // 重置語言選擇
        }
    }

    function saveLanguage() {
        const languageSelect = document.getElementById('language-select').value;
        languageSelect_A = languageSelect;
    }


    const chat = document.getElementById('chat');
    function sendMessage(){
        const input = document.getElementById('textInput');
        const text = input.value.trim();
        if (text === '') return;
    
        appendMessage('user',text);
        input.value='';
    
        appendLoading();

        fetch('https://retibot-247393254326.us-central1.run.app/chat',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({session_id: sessionId_A, message: text})
        })
        .then(res => res.json())
        .then(data => {
            removeLoading();
            appendMessage('bot', data.response);
            const TTS_TW = new TTS();
            const textFromAnotherBot = data.res_for_sound;
            TTS_TW.setLanguage(languageSelect_A);
            if (document.getElementById('voice-toggle').checked) {
                TTS_TW.synthesizeSpeech(textFromAnotherBot);
            }
            if(data.ending ===1) {
                appendLoading();
                try {
                    generatePDF(data);
                } catch (error) {
                    removeLoading();
                }
                appendMessage('bot', "本次諮詢已結束，如要重新開始對話重整頁面。");
                
                const inputArea = document.querySelector(".input-area");
                inputArea.style.display = "none";

                //const button = document.querySelector("button[onclick='sendMessage()']");
                //button.disabled = true;
                //button.innerHTML = "對話已結束";
                //button.style.backgroundColor = "gray";
            }
        })
        .catch(error=>{
            removeLoading();
            console.error('Error',error);
            appendMessage('bot','很抱歉，大宇宙意識斷線中，請重整頁面以重新連接。')
        });
    }
    function appendPDFMessage(urllink) {
        const message = document.createElement('a');
        message.className = `ProposalLink`;
        message.href = urllink;
        message.textContent = '點此下載/查看您的PDF檔案(請於15分鐘內下載)';
        message.target = '_blank'; // 在新分頁打開

        const canvas = document.createElement('canvas');
        qrcode.toCanvas(canvas, urllink, {width:128});
        console.log('link and QRCODE showed.')
    }
    function appendMessage(sender,text){
        const message=document.createElement('div');
        
        const customRenderer = new marked.Renderer();
        customRenderer.link = function(href, title, text) {
          let html = `<a href="${href}"`;
          if (title) {
            html += ` title "${title}"`;
          }
          html += ` target="_blank" rel="noopener noreferrer">${text}</a>`;
          return html;
        }
 
        marked.setOptions({
          renderer: customRenderer,
          breaks: true // 使用單個換行符來分隔段落
        })

        
        message.className=`message ${sender}`;
        if (sender === 'bot'){
            const avatar = document.createElement('div');
            avatar.className = ' avatar';
            message.appendChild(avatar);
        
            const bubble = document.createElement('div');
            bubble.className = ' bubble';
            bubble.innerHTML = marked.parse(text); 
            //bubble.textContent = text;
            message.appendChild(bubble);
        
        } else if (sender === 'user'){
            const bubble =document.createElement('div');
            bubble.className=' bubble';
            //bubble.innerHTML =  marked.parse(text);
            bubble.textContent = text;
            message.appendChild(bubble);
        }
    
        chat.appendChild(message);
        chat.scrollTop=chat.scrollHeight;
    }
    
    let loadingMessage;
    function appendLoading(){
        loadingMessage = document.createElement('div');
        loadingMessage.className = 'message bot'
    
        const avatar = document.createElement('div');
        avatar.className='avatar';
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
    
    function removeLoading(){
        if (loadingMessage){
            chat.removeChild(loadingMessage);
            loadingMessage=null;
        }
    }

    async function generatePDF(data) {
      try {
        const response= await fetch('https://retibot-247393254326.us-central1.run.app/genpdf',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({session_id:data.session_id, proposal:data.response}),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const pdfdata=await response.json();
        const pdfUrl=pdfdata.url;

        if (pdfUrl){
          console.log('link Retrieved: ', pdfUrl);
          appendPDFMessage(pdfUrl);
        } else {
          console.error('fail to retrieve PDF link',pdfdata);
        }
      } catch (error) {
        console.error('generate PDF failed: ', error);
      }
    }

  
  console.log(`Function:智能機器人 Author:Daniel Chien`);
  console.log(`Function:語音輸入與輸出 Author:長問科技`);
  console.log(`Function:前端介面與串接 Author:Angela Ko`);
  // 版本資訊
  const VERSION = "1.0.5";

  let Recorder = null;
  let autoScroll = true;

  /**
   * 抓取 DOM
   */
  const username = "ASR0421_70789634";
  const password = "Api042170789634";
  const url = "https://asrapi01.bronci.com.tw";
  const recordFileCheckbox = false;
  const parserUrl = "";
  const devices = "default"


/**
* 使用代理器處理狀態
*/
    const handler = {
        set: function (obj, props, value) {
        obj[props] = value;
        },
    };
    const proxy = new Proxy({ status: false, isRecording: false }, handler);

  /**
   * 允許麥克風權限
   *
   * 此步驟只是為了獲取麥克風權限，實際操作須至 ASRRecorder.js 中執行
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

    if (!username && !password && !url) {
      console.log("username",username);
      console.log("password",password);
      console.log("url",url);
      return;
    }

    /**
     * 初始化 Recorder 參數依序為 username, password, API url, isRecord
     *
     * 請輸入提供之帳號
     * 請輸入提供之密碼
     * 請輸入提供之 API 網址
     * 請輸入是否於錄音完成後輸出錄音檔案
     */
    try {
      handleDestroy();

      Recorder = new ASRRecorder(
        username,
        password,
        url,
        recordFileCheckbox
      );
      console.log("Initialized");
      proxy.status = true;
    } catch (error) {
      console.log("初始化錯誤：",error)
      proxy.status = false;
    }
  }

  /**
   * 開始轉換聲音資料
   *
   * 重要：請使用 callback 回傳抓取翻譯結果
   */
  async function handleStart() {
    // 第一個參數為 model 若無設定 null ，則使用預設模型
    // 第二個參數為 device 若無設定請輸入 null ，則使用預設聲音設備
    // 第三個參數為 parser 的網址，若無設定則不會觸發 parser
    // 第四個參數為 callback，回傳結果
    const parserUrlValue = parserUrl;
    const model = null;
    const deviceValue = null;

    try {
      await Recorder.start(model, deviceValue, parserUrlValue, (data) => {
        handleRender(data);
      });
      await setScreenLock(); // 鎖定畫面
      proxy.isRecording = true;
    } catch (error) {
      console.log(error);
      handleStop();
    }
  }

  /**
   * 停止轉換聲音資料
   */
  async function handleStop() {
    await Recorder.stop();
    await releaseScreenLock(); // 釋放畫面
    proxy.isRecording = false;
  }

  /**
   * 當你離開頁面時，若頁面有 keep-alive 機制，請用此函式停止轉換聲音資料及回復 ASRRecorder 初始狀態
   */
  function handleDestroy() {
    if (Recorder) Recorder.destroy();
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

    // 此狀態為 ASR 啟動中，可忽略
    if (code === 100 || code === 180) return;

    // 處理錯誤
    // STATUS_UNAUTHORIZED = 401;
    // BRIDGE_STATUS_IDLE_TIMEOUT = 408;
    // BRIDGE_STATUS_UNSUPPORTED_PARAMS = 415;
    // BRIDGE_STATUS_NO_RESOURCE = 486;
    // BRIDGE_STATUS_SERVER_ERROR = 500;
    // BRIDGE_STATUS_SERVER_UNREACHED = 502;
    // BRIDGE_STATUS_SERVERBORT = 503;
    // BRIDGE_STATUS_UNKNOWN = 599;
    const errorCode = [401, 408, 415, 486, 500, 502, 503, 599];
    if (errorCode.includes(code)) {
      console.log(code)
      handleStop();
    }

    // 處理 204 處理完成情況
    if (code === 204) {
      console.log(code)
      handleStop();
    }

    // 此狀態為 ASR 轉換完成，並可渲染至頁面上
    if (code === 200) {
      console.log(code)
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
