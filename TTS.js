class TTS {
        async synthesizeSpeech(text) {
            const credentials = {
                username: 'TTS0421_70789634',
                password: 'Api042170789634',
                rememberMe: 1
            };
            const serverUrl = 'https://ttsapi03.bronci.com.tw/';
            const payload = {
                input: { text: text },
                voice: {model:"melotts", languageCode: this.languageCode, name: 'cmn-TW-vs2-F01' },
                audioConfig: { speakingRate: 1.1 },
                outputConfig:{streamMode:1,shortPauseDuration:150,longPauseDuration:300}
            };
            console.log(this.languageCode)
            const res = await fetch(`${serverUrl}/api/v1/tts/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                username: credentials.username,
                password: credentials.password,
                }),
             }).catch((error) => {
                throw new Error(`Unable to login: ${error}`);
             });

             const json = await res.json();
             if (json.error) {
               throw new Error(`Please check username and password`);
             }
             this.token = json.token;
                
            const response = await fetch(`${serverUrl}/api/v1/tts/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(payload)
            });
        
            if (response.ok) {
                const audioData = await response.arrayBuffer();
                //console.log(audioData)
                this.playAudio(audioData);
            } else {
                console.error('Failed to synthesize speech. HTTP response code:', response.status);
            }
        }
        




    async playAudio(audioData) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const float32Array = this.convertS16LEToFloat32(audioData);
        //console.log(float32Array)
        if (float32Array.length > 0) {
            const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
            audioBuffer.getChannelData(0).set(float32Array);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
        } else {
            console.error('Error: Audio data is empty or invalid.');
        }
    }

    convertS16LEToFloat32(audioData) {
        const int16Array = new Int16Array(audioData);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768;
        }

        return float32Array;
    }

       async setLanguage(languageCode) {
            this.languageCode = languageCode;
            console.log("TTS已成功設定語言：",this.languageCode)
        }

       async disable() {
            this.languageCode = null;
        }



}


window.TTS = new TTS();
