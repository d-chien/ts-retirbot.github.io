console.log("Parser.js version: 1.0.1");

class Parser {
  constructor() {
    this.url = "";
    this.websocket = null;
    this.token = "";
    this.cb = null;
    this.retryCount = 0;
    this.retryTime = 3000;
    this.retryTimeout = null;
  }

  set setUrl(url) {
    this.url = url;
  }

  set setToken(token) {
    this.token = token;
  }

  set setCallback(cb) {
    this.cb = cb;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.url.length === 0) {
        resolve();
        return;
      }

      this.websocket = new WebSocket(`${this.url}?token=${this.token}`);

      this.websocket.onopen = () => {
        console.log(`ASR parser service websocket opened`);
        resolve();
      };

      this.websocket.onmessage = (event) => {
        console.log(`ASR parser service websocket message: ${event.data}`);

        const data = this.parse(event.data);
        data.type = "Parser";

        this.cb(data);
      };

      this.websocket.onerror = (error) => {
        console.log("ASR parser service websocket error ", error);
        reject(error);
      };

      this.websocket.onclose = (event) => {
        console.log(`ASR parser service websocket closed`);

        // websocket error.code 1000 - 正常關閉
        if (event.code === 1000) {
          this.reset();
        } else {
          if (this.retryCount <= 3) {
            this.cb({
              type: "Parser",
              status: "retry",
              message: `ASR parser service websocket retry times ${this.retryCount}`,
            });
            this.retryCount++;
            this.retryTimeout = setTimeout(() => {
              this.connect();
            }, this.retryTime);
          } else {
            this.cb({
              type: "Parser",
              status: "stop retry",
              message: `ASR parser service websocket stop retry`,
            });
            this.reset();
          }
        }
      };
    });
  }

  /**
   * 正常關閉 websocket.
   */
  close() {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.close(1000);
    }
  }

  /**
   * 重置 Parser 設定
   */
  reset() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.retryCount = 0;
    this.url = "";
    this.websocket = null;
    this.token = "";
    this.cb = null;
  }

  /**
   * 將 ASR final 的文字扔給 Parser.
   *
   * @param {string} data
   */
  send(data) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(data);
    }
  }

  /**
   * parse Parser 回傳的資料
   */
  parse(data) {
    console.log("Parser",data);
    return JSON.parse(data);
  }
}
