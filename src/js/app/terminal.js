const MAXLINES = 500;
const T1COEFF = 2;
const POLLDELAY = 10;
// let dataCounter = 0;
let dataArray = new Uint8Array(4096);


function arrayToText(array) {
  let text = "";
  for (let i = 0; i < array.length; i++) {
    if (array[i] == 0) break;
    text += String.fromCharCode(array[i]);
  }
  // console.log(array);
  return text;
}

function arrayToHex(array) {
  let text = "";
  for (let i = 0; i < array.length; i++) {
    text += array[i].toString(16).padStart(2,0);
    if (i == 3) text += "\n";
  }
  text += "\n";
  // console.log(array);
  return text;
}

function downloadData() {
  console.log("Downloading data");
  console.log(dataArray);
  const blob = new Blob([dataArray.buffer], {type: 'application/octet-stream'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dmdata.bin`;
  document.body.appendChild(a);
  a.style.display = 'none';
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export class Terminal {  
  constructor(usb, callbacks) {
    this.usb = usb;
    this.connected = false;
    this.callbacks = callbacks
    this.sendButton = document.querySelector("#terminal-send");
    this.unlockButton = document.querySelector("#terminal-unlock");
    this.input = document.querySelector("#terminal-input");
    this.window = document.querySelector(".terminal-text");
    this.sendButton.addEventListener("click", () => {
      this.send();
    });
    this.unlockButton.addEventListener("click", () => {
      this.unlockDM(T1COEFF);
    });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.send();
      }
    });
    this.running;
    this.settings = {
      maxLinesTerminal: MAXLINES,
      t1coeff: T1COEFF,
      pollDelay: POLLDELAY,
      autoUnlock: true,
    }
  }

  connect() {                                                                                                                                                                                                                                                                                                         
    this.usb.connect().then(() => {
      if (this.settings.autoUnlock) this.unlockDM(this.settings.t1coeff);
      this.connected = true;
      this.running = setInterval(() => {
        this.usb.receive(0xAB).then((result) => {
          let arr = new Uint8Array(result.buffer);
          
          // dataArray.set(arr, dataCounter);
          // dataCounter += 8;
          // console.log(arr);
          // this.update(dataCounter.toString() + "\n");
          // if (dataCounter >= 4096) {
          // if (dataCounter >= 8) {
            // clearInterval(this.running);
            // this.disconnect();
          // }

          if (arr[0] & 0x80) {
            
            let text = arrayToText(arr.subarray(1,8));
            this.update(text);
          }
          this.usb.receiveErrorCnt = 0;
        }).catch((e) => {});
      }, this.settings.pollDelay);
      this.sendButton.classList.remove("deactive");
      if (this.callbacks.connect) this.callbacks.connect();
    });
    
  }

  disconnect() {
    this.connected = false;
    clearInterval(this.running);
    if (this.usb.running) this.usb.disconnect();
    if (this.callbacks.disconnect) this.callbacks.disconnect();
    // downloadData();
    dataArray.fill(0);
    // dataCounter = 0;
  }

  unlockDM(t1coeff) {
    let arr = new Uint8Array(79).fill(0);
    arr[0] =  0xA5;
    arr[1] = t1coeff;
    console.log(`T1COEFF = ${t1coeff}`);
    // T1COEFF++;
    this.usb.send(0xAA, arr).then(() => {
    });
  }

  send(message = "") {
    if (this.connected == true) {
      if (message == "") {
        this.update(`>_  ${this.input.value}\n`);
        let arr = new Uint8Array(7).fill(0);
        for (let i = 0; i < 7; i++) {
          arr[i] = this.input.value.charCodeAt(i);
        }
        this.usb.send(0xAB, arr).then(() => {
          this.sendButton.classList.remove("deactive");
          this.usb.sendErrorCnt = 0;
        }).catch((e) => {});
        this.input.value = "";
      } else {
        //usb.send here
        this.update(`>_ ${message}\n`);
      }
      this.sendButton.classList.add("deactive");
      // setTimeout(() => {
      //   this.sendButton.classList.remove("deactive");
      // }, 1000);
      
      
    }
    // let arr = new Uint8Array(79).fill(0);
    // arr[0] =  0xA5;
    // arr[1] = t1coeff;
    // this.usb.send(0xAA, arr).then(() => {
      // this.update(`${t1coeff}\n`);
      // t1coeff++;
      // this.usb.receive(0xAB).then((result) => {
      //   let arr = new Uint8Array(result.buffer);
      //   dataArray.set(arr, 8);
      //   console.log(arr);
      //   // this.update(dataCounter.toString() + "\n");
      // });
    // });
  }

  update(text) {
    let newText = this.window.value + text;
    let lines = newText.split("\n");
    if (lines.length > this.settings.maxLinesTerminal) {
      lines.splice(0, lines.length - this.settings.maxLinesTerminal);
      newText = lines.join("\n");
    }
    this.window.value = newText;
    if (!document.querySelector("#terminal-scroll").classList.contains("deactive")) {
      this.window.scrollTop = this.window.scrollHeight;
    }
    if (this.callbacks.update) this.callbacks.update();
  }
}