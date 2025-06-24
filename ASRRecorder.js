// 版本資訊
const ASR_VERSION = "1.0.5";
// console.log(`ASRRecorder.js version ${ASR_VERSION}`);
// const res = fetch(`https://retibot-247393254326.us-central1.run.app/get_cred`, {
//   method: "GET",
//   headers: {
//     "content-type": "application/json",
//   }
// }).catch((error) => {
//   throw new Error(`Unable to login: ${error}`);
// });
// const json = res.json();
// const username = json.ACCOUNT;
// const password = json.PASSWORD;



class ASRRecorder {
  FILE_SEND_PERIOD = 200;
  BYTE_IN_PERIOD = 8 * 1024;

  /**
   * 初始化 ASR 系統服務
   *
   * @param {string} username
   * @param {string} password
   * @param {string} url
   * @param {boolean} isRecord
   */
  constructor(username, password, url, isRecord) {
  // constructor(url, isRecord) {
    if (!username) {
      throw new Error("Please enter username");
    }

    if (!password) {
      throw new Error("Please enter password");
    }

    if (!url) {
      throw new Error("Please enter API url");
    }

    this.mode = "raw";
    this.sampleRate = 16000;
    this.model = "basic-model";
    this.channel = 1;

    this.device = "default";

    this.username = username;
    this.password = password;
    this.url = url;

    this.token = "";
    this.wsUrl = "";
    this.ticket = "";

    this.audioContext = null;
    this.websocket = null;
    this.interval = null;

    this.isRecord = isRecord;
    this.chunks = [];

    this.cb = null;

    this.parser = new Parser();
  }

  /**
   * 變更 isRecord 狀態
   *
   * @param {boolean} isRecord
   */
  set setIsRecord(isRecord) {
    this.isRecord = isRecord;
  }

  /**
   * 登入已獲確認的 ASR 服務 token
   */
  async login() {
    const res = await fetch(`${this.url}/api/v1/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    }).catch((error) => {
      throw new Error(`Unable to login: ${error}`);
    });

    const json = await res.json();

    if (json.error) {
      throw new Error(`Please check username and password`);
    }

    this.token = json.token;
  }

  /**
   * 取得 ASR 系統的 websocket 訪問資訊
   */
  async getWebsocketAccessInfo() {
    if (!this.token) {
      throw new Error("Please login ASRRecorder first");
    }

    const res = await fetch(
      `${this.url}/api/v1/streaming/transcript/access-info`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    ).catch((error) => {
      throw new Error(`Unable to get websocket access info: ${error}`);
    });

    const json = await res.json();

    if (json.error) {
      throw new Error(`Unable to get websocket info (${json.error})`);
    } else {
      this.wsUrl = json.data[0].url;
      this.ticket = json.data[0].ticket;
    }
  }

  /**
   * 連接到 ASR and Parser websocket
   */
  async connectWebsocket() {
    // 需要創建好給 rawDataHandler 做使用
    return new Promise((resolve, reject) => {
      this.wsUrl += `?ticket=${this.ticket}&rate=${this.sampleRate}&modelName=${this.model}&type=${this.mode}&minSilenceDurMs=100`;
      //this.wsUrl += `?ticket=${this.ticket}&rate=${this.sampleRate}&modelName=${this.model}&type=${this.mode}`;
      this.websocket = new WebSocket(this.wsUrl);
      this.websocket.binaryType = "arraybuffer";

      this.websocket.onopen = () => {
        this.cb({ status: "opened", message: "websocket opened" });
        console.log("ASR service websocket opened");
        resolve();
      };

      this.websocket.onmessage = (e) => {
        const data = this.parse(e.data);

        if (data.result && data.result?.[0]?.transcript?.length > 0) {
          data.result[0].transcript = data.result[0].transcript
            .replace(/<sil>/gi, "")
            .replace(/<unk>/gi, "")
            .replace(/\n/gi, "");

          if (data.result[0].transcript.length > 0) {
            this.cb(data);

            // 將最終結果傳送給 Parser
            if (data.result[0].final === 1) {
              this.parser.send(data.result[0].transcript);
            }
          }
        } else {
          this.cb(data);
        }
      };

      this.websocket.onclose = (event) => {
        this.cb({ status: "closed", message: "websocket closed" });
        this.parser.close();
        console.log("ASR service websocket closed");
      };

      this.websocket.onerror = (e) => {
        this.cb({ status: "error", message: e });
        console.log("ASR service websocket error ", e);
        this.parser.close();
        reject(error);
      };
    });
  }

  /**
   * parse ASR 回傳的資料
   *
   * @param {string} data
   * @returns {{ code: number, message: string, status: string, result: { startTime: number, endTime: number, segment: number, final: number, transcript: string }[]}}
   */
 
  
  
  parse(data) {
    console.log(data); //
    return JSON.parse(data);
  }

  /**
   * 抓取目前 ASR 系統的聲音模型
   */
  async getModelList() {
    try {
      await this.login();
      const res = await fetch(`${this.url}/api/v1/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const json = await res.json();

      if (json.error) {
        new Error(json.error);
      }

      return json;
    } catch (error) {
      throw new Error(`Unable to get model list (${error})`);
    }
  }

  /**
   * 處理檔案，並上傳至 ASR 服務
   *
   * @param {File} file
   * @param {number} fileHeaderShift
   */
  uploadStreamFile(file, fileHeaderShift) {
    const reader = new FileReader();

    reader.onloadend = () => {
      console.log("Reading file completed");
    };

    reader.onload = (e) => {
      const data = e.target.result;
      const dataLength = data.byteLength;

      const endCount = Math.ceil(
        (dataLength - fileHeaderShift) / this.BYTE_IN_PERIOD
      );

      let count = 0;
      const interval = setInterval(() => {
        if (count >= endCount) {
          const timeout = setTimeout(() => {
            this.websocket.send("EOF");
            clearTimeout(timeout);
          }, 2000);

          clearInterval(interval);
        }

        const start = fileHeaderShift + count * this.BYTE_IN_PERIOD;
        const end = fileHeaderShift + (count + 1) * this.BYTE_IN_PERIOD;

        this.websocket.send(data.slice(start, end));

        count++;
      }, this.FILE_SEND_PERIOD);
    };

    reader.readAsArrayBuffer(file);
  }

  /**
   * 處理及時性的聲音資料
   *
   * @param {MediaStream} stream
   */
  async handleStream(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
      });
    }

    const source = this.audioContext.createMediaStreamSource(stream);

    try {
      await this.audioContext.resume();

      await this.audioContext.audioWorklet.addModule(
        "./convert-bits-worklet.js"
      );
    } catch (error) {
      throw new Error(`AudioContext error: ${error}`);
    }

    const processNode = new AudioWorkletNode(
      this.audioContext,
      "convert-bits-processor",
      {
        channelCount: this.channel,
      }
    );

    processNode.port.onmessage = (e) => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        if (e.data.eventType === "data") {
          this.websocket.send(e.data.audioBuffer);

          // store chunks for download
          if (this.isRecord) {
            this.chunks.push(e.data.audioBuffer);
          }
        }

        if (e.data.eventType === "bits") {
          this.cb({ status: "bits", bits: Math.floor(e.data.bits) });
        }

        if (e.data.eventType === "volume") {
          this.cb({ status: "volume", volume: e.data.volume });
        }
      }
    };

    // get bits from audio worklet every 1 second
    this.interval = setInterval(() => {
      processNode.port.postMessage({
        eventType: "ping",
      });
    }, 1000);

    source.connect(processNode).connect(this.audioContext.destination);
  }

  /**
   * 處理麥克風資料
   */
  async rawDataHandler() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: this.device,
          },
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      await this.handleStream(stream);
    } catch (error) {
      throw new Error(`getUserMedia error: ${error}`);
    }
  }

  /**
   * ASR 系統開始啟動
   *
   * @param {string} model - model name
   * @param {string} device - device
   * @param {string} parserUrl - parser url
   * @param {function(): void} cb - callback function
   */
  async start(model = "basic-model", device, parserUrl, cb) {
    if (device) {
      this.device = device;
    }

    this.model = model;
    this.cb = cb;
    this.mode = "raw";

    await this.login();
    await this.getWebsocketAccessInfo();

    this.setupParserConfig(parserUrl);
    await this.parser.connect();

    await this.connectWebsocket();
    await this.rawDataHandler();
  }

  /**
   *
   * @param {string} url
   * @param {function(): void} cb
   */
  setupParserConfig(url) {
    if (url.length !== 0) {
      this.parser.setUrl = url;
      this.parser.setCallback = this.cb;
      this.parser.setToken = this.token;
    }
  }

  /**
   * 停止 ASR 系統服務
   */
  async stop() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioContext = null;

    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
    this.websocket = null;

    if (this.interval) {
      clearInterval(this.interval);
    }

    this.parser.close();

    this.exportFile();

    this.interval = null;
  }

  /**
   * 將檔案輸出至 ASR 系統
   *
   * @param {string} model - model name
   * @param {File} file - file object
   * @param {function():void} cb - callback function
   */
  async startSendFile(model = "basic-model", file, cb) {
    this.model = model;
    this.cb = cb;

    try {
      if (file && file.type === "audio/wav") {
        this.mode = "file";

        await this.login();
        await this.getWebsocketAccessInfo();
        await this.connectWebsocket();

        this.uploadStreamFile(file, 44);
      } else {
        new Error("File type must be WAV");
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * 停止 ASR 系統服務，並回復預設值
   */
  destroy() {
    this.stop();

    this.username = "";
    this.password = "";
    this.model = "basic-model";
    this.token = "";
    this.wsUrl = "";
    this.ticket = "";
    this.cb = null;
  }

  /**
   * 輸出 wav 檔案
   */
  async exportFile() {
    if (this.isRecord && this.chunks.length !== 0) {
      const wavRawData = [this.getWAVHeader(), ...this.chunks];

      const link = document.createElement("a");
      const blob = new Blob(wavRawData, { type: "audio/wav" });
      const audioURL = URL.createObjectURL(blob);
      link.style.display = "none";
      link.href = audioURL;
      link.download = "sample.wav";
      document.body.appendChild(link);
      link.click();

      setTimeout(async () => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(audioURL);
      }, 100);

      this.chunks = [];
    }
  }

  /**
   * 將資料寫進 DataView 內
   *
   * @param {DataView} dataView - dataView object to write a string.
   * @param {number} offset - offset in bytes
   * @param {string} string - string to write
   */
  writeString(dataView, offset, string) {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * 取得 wav file header 的資訊
   *
   * @returns {ArrayBuffer} - wav file header
   */
  getWAVHeader() {
    const BYTES_PER_SAMPLE = Int16Array.BYTES_PER_ELEMENT;
    /**
     * Get stored encoding result with Wave file format header
     * Reference: http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html
     */
    // Create header data
    const dataLength = this.chunks.reduce(
      (acc, cur) => acc + cur.byteLength,
      0
    );
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    // RIFF identifier 'RIFF'
    this.writeString(view, 0, "RIFF");
    // file length minus RIFF identifier length and file description length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type 'WAVE'
    this.writeString(view, 8, "WAVE");
    // format chunk identifier 'fmt '
    this.writeString(view, 12, "fmt ");
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, this.channel, true);
    // sample rate
    view.setUint32(24, this.sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, this.sampleRate * BYTES_PER_SAMPLE * this.channel, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, BYTES_PER_SAMPLE * this.channel, true);
    // bits per sample
    view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);
    // data chunk identifier 'data'
    this.writeString(view, 36, "data");
    // data chunk length
    view.setUint32(40, dataLength, true);

    return header;
  }
}
