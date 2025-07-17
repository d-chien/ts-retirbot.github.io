# TS-RetirBot

## English

This is a web-based chatbot that uses voice recognition and synthesis. It's designed to be a retirement planning assistant.

### Website Structure

The website is a single-page application with the following components:

1.  **Chat Interface**: A chat box to display the conversation between the user and the bot.
2.  **Record Button**: Allows the user to record their voice.
3.  **Synthesis Button**: Converts the bot's text response into speech.
4.  **Visual Elements**: Includes images for the robot and user avatars.

### Functions and Modules

The core functionality is divided into several JavaScript modules:

*   **`index.html`**: The main HTML file that defines the structure of the web page.
*   **`style.css`**: Contains all the styles for the user interface.
*   **`script.js`**: The main script that initializes the application and handles the overall logic. It orchestrates the interactions between the user, the ASR, the TTS, and the Parser modules.
*   **`ASRRecorder.js`**: (Automatic Speech Recognition) This module is responsible for capturing audio from the user's microphone. It uses the Web Audio API to process the audio and sends it to a speech recognition service to be converted into text.
*   **`TTS.js`**: (Text-to-Speech) This module takes text and sends it to a synthesis service to generate audio. The resulting audio is then played back to the user.
*   **`Parser.js`**: This module acts as the "brain" of the bot. It takes the text from the ASR module and sends it to a Natural Language Understanding (NLU) service (like Dialogflow). The service processes the text to understand the user's intent and returns an appropriate response.

---

## 中文 (Traditional Chinese)

這是一個基於網頁的聊天機器人，使用語音辨識和語音合成技術。它被設計成一個退休規劃助理。

### 網站結構

該網站是一個單頁應用程式，包含以下組件：

1.  **聊天介面**: 一個用於顯示使用者與機器人之間對話的聊天框。
2.  **錄音按鈕**: 允許使用者錄製他們的聲音。
3.  **合成按鈕**: 將機器人的文字回覆轉換為語音。
4.  **視覺元素**: 包括機器人和使用者頭像的圖像。

### 功能和模組

核心功能分為幾個 JavaScript 模組：

*   **`index.html`**: 定義網頁結構的主要 HTML 檔案。
*   **`style.css`**: 包含使用者介面的所有樣式。
*   **`script.js`**: 初始化應用程式並處理整體邏輯的主腳本。它協調使用者、ASR、TTS 和 Parser 模組之間的互動。
*   **`ASRRecorder.js`**: (自動語音辨識) 該模組負責從使用者的麥克風擷取音訊。它使用 Web Audio API 處理音訊，並將其傳送到語音辨識服務以轉換為文字。
*   **`TTS.js`**: (文字轉語音) 該模組接收文字並將其傳送到語音合成服務以產生音訊。然後將產生的音訊播放給使用者。
*   **`Parser.js`**: 該模組充當機器人的「大腦」。它從 ASR 模組取得文字，並將其傳送到自然語言理解 (NLU) 服務 (如 Dialogflow)。該服務處理文字以理解使用者的意圖，並傳回適當的回應。
