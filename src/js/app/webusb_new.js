export class V003WebUSB {
  
  constructor(productName, filter, callbacks, maxErrorCnt, pingID) {
    this.productName = productName;
    this.filter = filter;
    if (callbacks) this.callbacks = callbacks;
    else this.callbacks = {};
    this.connected = false;
    this.sendErrorCnt = 0;
    this.receiveErrorCnt = 0;
    this.maxErrorCnt = maxErrorCnt;
    this.running;
    this.pingID = pingID;
    this.skipFilter = false;
    if (pingID == undefined) this.pingID = 0xAA;
  }

  async connect(productName, filter) {
    this.sendErrorCnt = 0;
    this.receiveErrorCnt = 0;
    if (!productName) productName = this.productName;
    if (!filter) filter = this.filter;
    return new Promise((resolve, reject) => {
      if (!navigator.hid) {
        this.error("Browser does not support HID.");
        reject(-1);
      }
      if (!this.dev) {
        navigator.hid.getDevices().then((devices) => {
          if (devices.length == 0) {
            // this.error("Device not found");
            this.selectDevice(productName, filter).then((result) => {
              this.running = setInterval(this.ping.bind(this), 1000);
              resolve(result);
            }, reject);
          } else {
            // console.log(devices);
            if (devices.length > 1) {
              this.selectDevice(productName, filter).then((result) => {
                this.running = setInterval(this.ping.bind(this), 1000);
                resolve(result);
              }, reject);
            } else {
              if(devices[0].productName != productName && !this.skipFilter) {
                this.error("No correct device connected");
                reject(-2);
              } else {
                this.openDevice(devices[0]).then((result) => {
                  this.running = setInterval(this.ping.bind(this), 1000);
                  resolve(result);
                });
              }
            }
          }
        })
      } 
    })
    if (!navigator.hid) {
      this.error("Browser does not support HID.");
      return -1;
    }
    if (!this.dev) {
      navigator.hid.getDevices().then((devices) => {
        if (devices.length == 0) {
          this.error("Device not found");
          this.selectDevice();
        } else {
          // console.log(devices);
          devices.forEach(this.openDevice.bind(this));
        }
      })
    }
    return 0;
  }

  async selectDevice(productName, filter) {
    if (!productName) productName = this.productName;
    if (!filter) filter = this.filter;
    if (this.skipFilter) filter = {'vendorId': 0x1209};
    return new Promise ((resolve, reject) => {
      navigator.hid.requestDevice({filters: [filter]}).then((result) => {
        if (result.length < 1) {
          this.error("No devices found");
          reject(-2);
        } else {
          if (result[0].productName != productName && !this.skipFilter) {
            this.error("Not correct device name");
            reject(-3);
          } else {
            this.openDevice(result[0]).then(resolve);
          }
        }
      }).catch((e) => {
        this.error(e);
        reject(e);
      });
    });
  }

  async openDevice(device) {
    return new Promise ((resolve, reject) => {
      device.open().then((result) => {
        if(result === undefined) {
          if(this.dev) this.disconnect();
          this.connected = true;
          this.dev = device;
          if(this.callbacks.connect) this.callbacks.connect("Connected.");
          console.log("Connected");
          resolve();
        } else {
          this.error("Could not open: " + result);
          reject("Could not open device: " + result);
        }
      }).catch((e) => {
        this.error(e)
        reject(e);
      });
    });
  }

  async disconnect() {
    clearInterval(this.running);
    if (this.dev) await this.dev.close();
    this.connected = false;
    this.dev = null;
    console.log("USB disconnected");
    if (this.callbacks.disconnect) this.callbacks.disconnect("Disconnected");
    
  }

  error(msg) {
    console.error(`[WebUSB] ${msg}`);
    // if (this.callbacks.error) this.callbacks.error(msg);
  }

  async sendError(error) {
    this.error(`[Send error]: ${error}`);
    this.sendErrorCnt++;
    if (this.maxErrorCnt && (this.sendErrorCnt >= this.maxErrorCnt)) {
      console.log("[WebUSB] Maximum number of send error reached");
      await this.disconnect();
    }
  }

  async receiveError(error) {
    this.error(`[Receive error]: ${error}`);
    this.receiveErrorCnt++;
    if (this.maxErrorCnt && (this.receiveErrorCnt >= this.maxErrorCnt)) {
      console.log("[WebUSB] Maximum number of receive error reached");
      await this.disconnect();
    }
  }

  async send(feature, buffer) {
    return this.dev.sendFeatureReport(feature, buffer).catch((e) => {
      this.receiveError(e);
      throw(e);
    });
  }

  async receive(feature) {
    return this.dev.receiveFeatureReport(feature).catch((e) => {
      this.receiveError(e);
      throw(e);
    });
  }

  ping() {
    let timeout = setTimeout(() => {
      this.disconnect();
    }, 500);
    this.receive(this.pingID).then(() => {
      clearTimeout(timeout);
    });
    // if (!this.dev) {
    //   console.log("device lost");
    //   clearInterval(this.running);
    //   if (this.connected) this.disconnect();
    // }
  }

}