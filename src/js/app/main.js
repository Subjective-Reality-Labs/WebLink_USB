import { Popup } from "./popup.js";
import "../custom_select.js"
import { Terminal } from "./terminal.js"
import { Settings } from "./settings.js";
import { V003WebUSB } from "./webusb_new.js";
import * as Flasher from "./flasher.js";
import { Backups } from "./backups.js";

const maxLinesTerminal = 500;
let canFlash = true;
let chipInfo = {};
let backupSelected = "";
let tInterval;

window.mainJS = true;

let docHeight = Math.max(
  document.documentElement.clientHeight,
  window.innerHeight || 0
);

let usbBootloaderFilter = {vendorId: 0x1209, productId: 0xb003};

const usb = new V003WebUSB(
  "cnlohr rv003usb",
  usbBootloaderFilter,
  {disconnect: disconnectFlasher},
  10
);

let usbTerminalFilter = {vendorId: 0x1209, productId: 0xd003};

const usbTerminal = new V003WebUSB(
  "CNLohr RV003 Custom Device",
  usbTerminalFilter,
  {disconnect: disconnectTerminal},
  20
)
const flasher = new Flasher.Flasher(usb,
  {
    readCB: readProgress,
    writeCB: flasherProgress,
  }
);

const popup = new Popup(document.querySelector(".popup-container"));

const generalSettings = new Settings(document.querySelectorAll(".setting"));

const backups = new Backups(document.querySelector(".card.backups"), 10,
{selectBackup: selectBackup});

const terminal = new Terminal(usbTerminal,
  {
    connect: connectTerminal,
    disconnect: disconnectTerminal,
  }
)

//Selectors
const root = document.documentElement;
const micro = document.querySelector(".micro");
// const microClone = document.querySelector(".micro.clone");
const terminalDiv = document.querySelector(".terminal");
const terminalText = document.querySelector(".terminal > textarea");
const terminalConnect = document.querySelector(".terminal > .but.connect");
const terminalControls = document.querySelector(".terminal-controls");
const addressInput = document.querySelector("#address");
const sizeInput = document.querySelector("#size");
const firmware = document.querySelector("#firmware_file");
const firmwareLabel = document.querySelector(".file-label");
const firmwareContainer = document.querySelector(".file-container");
const flashButton = document.querySelector(".flash");
const about = document.querySelector(".about");
const readBut = document.querySelector("#read");
const eraseBut = document.querySelector("#erase");
const settingsBut = document.querySelector(".settings-button");
const setButs = document.querySelectorAll(".set-buttons > .but");
const moreButs = document.querySelectorAll(".more");
const settingsContainer = document.querySelector(".settings-container");
const setCards = settingsContainer.querySelectorAll(".cards > .card");
const topButtons = document.querySelector(".top-buttons");
const sideButtons = document.querySelectorAll(".side-button-square");
const topCards = document.querySelectorAll(".top-container > .card");
const tooltipables = document.querySelectorAll(".tooltip");
const tooltipContainer = document.querySelector(".tooltip-container");
const connectButton = document.querySelector("#connect-flasher");
const chipInfoContainer = document.querySelector(".chip-info-content");
const programmerContainer = document.querySelector(".card.programmer");
const backupsContainer = document.querySelector(".card.backups");
//SETTINGS
const settingsEntries = document.querySelectorAll(".settings");
const numBackups = document.querySelector("#num-baclups");
const skipFilterCheck = document.querySelector("#skip-filter");
const disableTransitionsCheck = document.querySelector("#disable-transitions");
const productNameInput = document.querySelector("#usb-bootloader-name");
const usbNameInput = document.querySelector("#usb-name");
const terminalSettings = document.querySelectorAll(".terminal.setting");

///////////////////////
/// Event listeners ///
///////////////////////

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    window.location.reload(); 
  }
});

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', function () {
      init()
  });
}

// Set window height to css variable on resize
window.addEventListener("resize", () => {
  docHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  );
  root.style.setProperty(
    "--true-height",
    Math.max(document.documentElement.clientHeight, window.innerHeight || 0) +
      "px"
  );
});

sideButtons.forEach((el) => {
  let index = Array.from(sideButtons).indexOf(el); 
  let card = Array.from(topCards).reverse()[index];
  el.addEventListener("click", () => {
    switchCards(topCards, card, sideButtons, el);
  });
});

tooltipables.forEach((el) => {
  el.addEventListener("mouseout", () => {
    showTooltip(null, tooltipContainer);
  });

  el.addEventListener("mouseover", () => {
    if (generalSettings["show-tooltips"]) showTooltip(el, tooltipContainer);
  });
});

connectButton.addEventListener("click", () => {
  connectFlasher();
});

addressInput.addEventListener("change", () => {
  addressInput.value[1].toLowerCase();
  if (!(addressInput.value[0] == "0" && addressInput.value[1] == "x")) {
        addressInput.value = "0x" + addressInput.value.toUpperCase();
      } else {
        addressInput.value = "0x" + addressInput.value.substr(2).toUpperCase();
      }
});

firmware.addEventListener("change", () => {
  if (firmware.value != "") {
    checkFirmwareFile();
  }
  if (backupSelected) {
    firmwareLabel.innerText = backupSelected;
    flashButton.classList.remove("hidden");
    sizeInput.setAttribute("placeholder", parseInt(backups.getBinarySize(backupSelected)));
  } else if (firmware.value == "") {
    firmwareLabel.innerText = "Select binary";
    flashButton.classList.add("hidden");
    sizeInput.setAttribute("placeholder", "16384");
  } else {
    firmwareLabel.innerText = firmware.files[0].name;
    flashButton.classList.remove("hidden");
    sizeInput.setAttribute("placeholder", firmware.files[0].size);
  }
});

about.addEventListener("click", () => {
  popup.draw("about");
});

terminalConnect.addEventListener("click", () => {
  // usb.connect().then(() => {
  //   tInterval = setInterval(async () => {
  //     usb.receive(0xAB).then((result) => {
  //       let arr = new Uint8Array(result.buffer);
  //       if (arr[0] & 0x80) console.log(arr);
  //     });
  //   }, 10);
  // });
  terminal.connect();
});

document.querySelector("#terminal-scroll").addEventListener("click", () => {
  document.querySelector("#terminal-scroll").classList.toggle("deactive");
});

document.querySelector("#terminal-close").addEventListener("click", () => {
  terminal.disconnect();
});

flashButton.addEventListener("click", () => {
  if (canFlash) {
    // if (customHexCheck.checked) {
    //   if (customHex.value != "" && customHex.checkValidity()) {
    //     updater.uploadHex(customHex.value);
    //   }
    // }

    let a = parseInt(addressInput.value, 16);
    if (isNaN(a)) a = parseInt(addressInput.getAttribute("placeholder"), 16);
    let s = parseInt(sizeInput.value);
    let reader = new FileReader;
    reader.onload = function() {
      let arrayBuffer = this.result,
      array = new Uint8Array(arrayBuffer);
      if (isNaN(s)) s = array.length;
      flasher.Write(a, s, array, generalSettings["do-backup-check"], generalSettings["clean-check"], generalSettings["skip-zero"]).then((image) => {
        if (generalSettings["do-backup-check"]) {
          backups.addBackup(image, `backup_${Date.now()}_${chipInfo.uuid1.toString(16).padStart(8,0)}-${chipInfo.uuid2.toString(16).padStart(8,0)}`);
          backups.updateContainer();
        }
        flasher.Boot();
        canFlash = true;
      });
    }

    if (!usb.connected || !chipInfo.uuid1 || !chipInfo.uuid1) {
      connectFlasher().then(() => {
        if (!backupSelected) reader.readAsArrayBuffer(firmware.files[0]);
        else flashBackup(backupSelected, a, s);
        canFlash = false;
      });
    } else {
      if (!backupSelected) reader.readAsArrayBuffer(firmware.files[0]);
      else flashBackup(backupSelected, a, s);
      canFlash = false;
    }
    // terminal.update(`[Uploading binary]\n`);
    // document.documentElement.style.setProperty("--flash-progress", "0%");
    // setTimeout(() => {
    //   document.documentElement.style.setProperty("--flash-progress", "100%");
    //   canFlash = true;
    // }, 3000);
  } 
});

readBut.addEventListener("click", () => {
  let a = parseInt(addressInput.value, 16);
  let s = parseInt(sizeInput.value);
  if (isNaN(a)) a = parseInt(addressInput.getAttribute("placeholder"), 16);
  if (isNaN(s)) s = parseInt(sizeInput.getAttribute("placeholder"));
  if (!usb.connected || !chipInfo.uuid1 || !chipInfo.uuid1) {
    connectFlasher().then(() => {
      flasher.Read(a, s).then((image) => {
        backups.addBackup(image, `backup_${Date.now()}_${chipInfo.uuid1.toString(16).padStart(8,0)}-${chipInfo.uuid2.toString(16).padStart(8,0)}`);
        backups.updateContainer();
        switchCards(topCards, backupsContainer, sideButtons, document.querySelector("#tooltip-backups-button"));
      });
    });
  } else {
    flasher.Read(a, s).then((image) => {
      backups.addBackup(image, `backup_${Date.now()}_${chipInfo.uuid1.toString(16).padStart(8,0)}-${chipInfo.uuid2.toString(16).padStart(8,0)}`);
      backups.updateContainer();
      switchCards(topCards, backupsContainer, sideButtons, document.querySelector("#tooltip-backups-button"));
    });
  }
  
});

eraseBut.addEventListener("click", () => {
  popup.draw("unbrick", {
    cb: () => {
      if (!usb.connected) {
        connectFlasher().then(() => {
          flasher.Erase(0, 0, 1, eraseProgress);
        });
      } else {
        flasher.Erase(0, 0, 1, eraseProgress);
      }
    }
  });
});

setButs.forEach((but) => {
  but.addEventListener("click", () => {
    const name = but.classList[0];
    const card = document.querySelector("." + name + ".card");
    // if (
    //   but.classList.contains("active") ||
    //   !settings.classList.contains("active")
    // ) {
    //   settings.classList.toggle("active");
    //   document.querySelector(".settings-background").classList.toggle("active");
    //   if (settings.classList.contains("active")) populateSettings();
    // }
    switchCard(card, but);
  });
});

moreButs.forEach((but) => {
  but.addEventListener("click", () => {
    const cont = but.nextElementSibling;
    but.classList.toggle("active");
    toggleMore(cont);
  });
});

// setCards.forEach((card) => {
//   card.childNodes.forEach((el) => {
//     el.addEventListener("change", () => {
//       card.querySelector(".confirm-buttons").classList.add("visible");
//     });
//   });
// });

settingsBut.addEventListener("click", toggleSettings, true);

history.pushState(null, null, window.location.pathname);

;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  firmwareContainer.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
})
;['dragenter', 'dragover'].forEach(eventName => {
  firmwareContainer.addEventListener(eventName, () => {
    firmwareContainer.classList.add("highlight");
  })
});
;['dragleave', 'drop'].forEach(eventName => {
  firmwareContainer.addEventListener(eventName, () => {
    firmwareContainer.classList.remove("highlight");
  })
});

firmwareContainer.addEventListener("drop", (e) => {
  firmware.files = e.dataTransfer.files;
  firmware.dispatchEvent(new InputEvent("change"))
  // firmwareLabel.innerHTML = firmware.value.split('\\').pop();
});

productNameInput.addEventListener("change", (e) => {
  usb.productName = generalSettings._getValue(e.target);
});

skipFilterCheck.addEventListener("change", () => {
  usb.skipFilter = skipFilterCheck.checked;
});

disableTransitionsCheck.addEventListener("change", (e) => {
  disableTransitions(e.target.checked);
});

terminalSettings.forEach((setting) => {
  setting.addEventListener("change", (e) => {
    e.stopPropagation();
    loadTerminalSettings();
  });
});

////////////////////////////////////
///  END of event handlers////// ///
////////////////////////////////////

function init() {
  
  // if (JSON.parse(localStorage.getItem("load_full")) === true) {
  //   showFull();
  // }
  const preloads = document.querySelectorAll(".preload-transitions");
  preloads.forEach((el) => {
    el.classList.remove("preload-transitions");
  });
  
  root.style.setProperty(
    "--true-height",
    Math.max(document.documentElement.clientHeight, window.innerHeight || 0) +
      "px"
  );
  drawCog(settingsBut);
  generalSettings.populateUI();
  console.log(generalSettings);
  if (generalSettings["disable-transitions"]) disableTransitions(true);
  animateMicro(generalSettings["disable-transitions"]);
  backups.populate();
  backups.updateContainer();
  backups.setLength(generalSettings["num-backups"]);
  usbTerminal.skipFilter = generalSettings["skip-filter"];
  usb.skipFilter = generalSettings["skip-filter"];
  usb.productName = generalSettings["usb-bootloader-name"];
  usbBootloaderFilter.vendorId = generalSettings["usb-bootloader-vid"];
  usbBootloaderFilter.productId = generalSettings["usb-bootloader-pid"];
  usbTerminalFilter.vendorId = generalSettings["usb-vid"];
  usbTerminalFilter.productId = generalSettings["usb-pid"];
  
  loadTerminalSettings();
  
  // navigator.usb.addEventListener("connect", (event) => {
  //   console.log(event);
  // });
  // navigator.usb.addEventListener("disconnect", (event) => {
  //   console.log(event)
  // });
  // navigator.hid.addEventListener("disconnect", (event) => { 
  //   console.log(event);
  // });
}

function loadTerminalSettings() {
  terminal.settings.featureID = generalSettings["terminal-feature-id"];
  terminal.settings.t1coeff = generalSettings["terminal-t1coeff"];
  terminal.settings.pollDelay = generalSettings["terminal-poll-delay"];
  terminal.settings.autoUnlock = generalSettings["terminal-unlock-check"];
  terminal.settings.maxLinesTerminal = generalSettings["terminal-max-lines"];
  terminal.unlockButton.classList.toggle("hidden", generalSettings["terminal-unlock-check"]);
  usbTerminal.skipFilter = generalSettings["skip-terminal-filter"];
  usbTerminalFilter.vendorId = generalSettings["terminal-usb-vid"];
  usbTerminalFilter.productId = generalSettings["terminal-usb-pid"];
}

function map(x, in_min, in_max, out_min, out_max) {
  const result =(x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  return Math.min(Math.max(result, out_min), out_max);
}

function convertRemToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function disconnectFlasher() {
  if (usb.connected) usb.disconnect();
  canFlash = true;
  resetButtons();
  chipInfo = {};
  connectButton.classList.remove("hide");
  chipInfoContainer.innerHTML = "";
}

async function connectFlasher() {
  return usb.connect().then(() => {console.log("Flasher connected")})
  .then(() => {
    canFlash = true;
    flasher.begin();
    flasher.getChipInfo().then((result) => {
      // console.log(result);
      chipInfo = result;
      populateChipInfo(result, chipInfoContainer);
    });
    connectButton.classList.add("hide");
  }).catch((e) => {console.log("Flasher failed to connect", e)});
}

function connectTerminal() {
  terminalConnect.classList.add("hide");
  terminalControls.classList.remove("hidden");
}

function disconnectTerminal() {
  if (usbTerminal.connected) usbTerminal.disconnect();
  if (terminal.connected) terminal.disconnect();
  terminalConnect.classList.remove("hide");
  terminalControls.classList.add("hidden");
}

function switchCard(c, b) {
  const index = Array.from(setCards).indexOf(c);
  setCards.forEach((card, i) => {
    if (card === c) {
      card.classList.add("active");
    } else {
      if (index > i) {
        card.classList.remove("hidden-down");
        card.classList.add("hidden-up");
      } else {
        card.classList.remove("hidden-up");
        card.classList.add("hidden-down");
      }
      card.classList.remove("active");
    }
  });
  setButs.forEach((but) => {
    if (but === b) {
      but.classList.add("active");
    } else {
      but.classList.remove("active");
    }
  });
}

function switchCards(cards, selectedCard, buttons, activeButton) {
  const index = Array.from(cards).indexOf(selectedCard);
  cards.forEach((card, i) => {
    if (card === selectedCard) {
      card.classList.add("active");
    } else {
      if (index < i) {
        card.classList.remove("hidden-down");
        card.classList.add("hidden-up");
      } else {
        card.classList.remove("hidden-up");
        card.classList.add("hidden-down");
      }
      card.classList.remove("active");
    }
  });
  buttons.forEach((but) => {
    if (but === activeButton) {
      but.classList.add("active");
    } else {
      but.classList.remove("active");
    }
  });
}

function animateMicro(noTransitions) {
  micro.classList.remove("closed");
  let topContent = document.querySelector(".top-cell > .content");
  let content = document.querySelector(".micro > .content");
  if (noTransitions) {
    content.classList.add("visible");
    topContent.classList.remove("hidden");
    topButtons.classList.remove("hidden");
    content.classList.remove("hidden");
    micro.classList.add("open")  
  } else {   
    micro.style.height="25rem";
    micro.addEventListener("transitionend", () => {
      content.classList.add("visible");
      topContent.classList.remove("hidden");
      topButtons.classList.remove("hidden");
      content.classList.remove("hidden");
      micro.classList.add("open")
      micro.style.height=null;
    }, {once: true});
  }
}

// const microObserver = new MutationObserver((m) => {
//   m.forEach((mu) => {
//     if (mu.type == "attributes" && mu.attributeName == "class") {
//       let state = mu.target.classList.contains("open");
//       micro.style.height = null;
//     }
//   });
// });
// setButsObserver.observe(micro, { attributes: true });

function drawLock(div) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = `<rect x="5" width="40" height="25" fill="black" stroke="white"/>
  <rect y="21" width="50" height="35" fill="black"/>
  <rect x="15" y="9" width="20" height="12" fill="white"/>
  <rect x="20" y="34" width="10" height="10" fill="white"/>`;
  svg.setAttribute("viewBox", "0 0 56 56");
  svg.setAttribute(
    "style",
    "position: absolute; right: 0rem; bottom: 0rem; height: 0.4em; width: 0.4em;"
  );
  div.appendChild(svg);
}

function drawCog(div) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = `<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" /></svg>`
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("style", "height: 100%;");
  div.appendChild(svg);
}

function getScrollWidth(el) {
  el.style.setProperty("--own-width", el.scrollWidth + "px");
  el.style.setProperty("animation-play-state", "running");
}

function toggleMore(el, state = null) {
  if (el.classList.contains("active") || state === false) {
    el.setAttribute("style", "--h:" + 0);
    el.classList.remove("active");
  } else {
    el.style.setProperty("--h", el.scrollHeight);
    el.classList.add("active");
  }
}

// function updateTerminalWindow(text) {
//   let newText = terminalText.value + text;
//   let lines = newText.split("\n");
//   if (lines.length > maxLinesTerminal) {
//     lines.splice(0, lines.length - maxLinesTerminal);
//     newText = lines.join("\n");
//   }
//   terminalText.value = newText;
//   if (!document.querySelector("#terminal-scroll").classList.contains("deactive")) {
//     terminalText.scrollTop = terminalText.scrollHeight;
//   }
// }

function settingsListener(e) {
  if (document.getElementById('settings').contains(e.target) || 
      document.querySelector(".popup-container").contains(e.target)||
      settingsBut.contains(e.target)) {
    return;
  } else {
    toggleSettings(e);
  }
}

function toggleSettings(e) {
  if (e) e.stopPropagation();
  if (settingsContainer.classList.contains("hide")) {
    generalSettings.populateUI();
    settingsContainer.classList.remove("hide");
    switchCard(settingsContainer.querySelector(".set.card"), settingsContainer.querySelector(".set.but"));
    window.addEventListener('click', settingsListener);
    window.addEventListener('touchend', settingsListener);
    topButtons.classList.add("hidden");
  } else {
    window.removeEventListener('click', settingsListener);
    window.removeEventListener('touchend', settingsListener);
    settingsContainer.classList.add("hide");
    settingsContainer.querySelector(".confirm-buttons").classList.remove("visible");
    topButtons.classList.remove("hidden");
  }
}

function resetButtons() {
  document.documentElement.style.removeProperty("--flash-progress");
  document.documentElement.style.removeProperty("--read-progress");
  document.documentElement.style.removeProperty("--erase-progress");
}

function flasherProgress(written, size) {
  let progress = Math.round((written/size) * 100);
  document.documentElement.style.setProperty("--flash-progress", `${progress}%`);
}

function readProgress(read, size) {
  // console.log(read, size);
  let progress = Math.round((read/size) * 100);
  // console.log(progress);
  document.documentElement.style.setProperty("--read-progress", `${progress}%`);
}

function eraseProgress(progress) {
  document.documentElement.style.setProperty("--erase-progress", `${progress}%`);
}

function flashBackup(name, address, size) {
  let array = new Uint8Array(backups.getBinary(name));
  if (isNaN(size)) size = array.length;
  flasher.Write(address, size, array, generalSettings["do-backup-check"], generalSettings["clean-check"], generalSettings["skip-zero"]).then((image) => {
    if (generalSettings["do-backup-check"]) {
      backups.addBackup(image, `backup_${Date.now()}_${chipInfo.uuid1.toString(16).padStart(8,0)}-${chipInfo.uuid2.toString(16).padStart(8,0)}`);
      backups.updateContainer();
    }
    flasher.Boot();
    canFlash = true;
  });
}

function selectBackup(name) {
  backupSelected = name;
  firmware.value = null;
  firmware.dispatchEvent(new InputEvent("change"));
}

function resetFileInput(el) {
  backupSelected = "";
  el.value = null;
  el.dispatchEvent(new InputEvent("change"));
}

function checkFirmwareFile() {
  backupSelected = "";
  if (firmware.files[0].type != "application/octet-stream" && firmware.files[0].type != "application/macbinary" && firmware.files[0].size <= 16384) {
    console.log("Wrong file type");
    console.log(firmware.files[0].type);
    popup.draw("ignore-file-type", {cb: ()=>{resetFileInput(firmware)}});
  } else if (firmware.files[0].size > 16384) {
    console.log("File size too big for WCH32v003");
    resetFileInput(firmware);
    flashButton.classList.add("hidden");
    firmwareLabel.innerText = "Select binary";
    popup.draw("alert", {alertText: "File size is too big for ch32v003. Max size is 16384 bytes"});
  }
}

function disableTransitions(disable) {
  if (disable) {
    settingsContainer.classList.add("notransition");
    topButtons.classList.add("notransition");
    topCards.forEach((el) => {
      el.classList.add("notransition");
    });
    document.querySelector(".popup-container").classList.add("notransition");
    micro.classList.add("notransition");
    document.querySelector(".top-cell > .content").classList.add("notransition");
    document.querySelector(".micro > .content").classList.add("notransition");
  } else {
    settingsContainer.classList.remove("notransition");
    topButtons.classList.remove("notransition");
    topCards.forEach((el) => {
      el.classList.remove("notransition");
    });
    document.querySelector(".popup-container").classList.remove("notransition");
    micro.classList.remove("notransition");
    document.querySelector(".top-cell > .content").classList.remove("notransition");
    document.querySelector(".micro > .content").classList.remove("notransition");
  }
}

function showTooltip(el, container) {
  // console.log("showing a tooltip for ", el);
  
  if (!el) {
    container.innerHTML = `<p></p>`;
    return;
  }

  let targetName = el.id.replace("tooltip-", "");
  switch (targetName) {
    case "programmer-button": 
      container.innerHTML = `<p>Programmer options and chip information</p>`;
      break;
    case "backups-button":
      container.innerHTML = `<p>List of saved backups</p>`;
      break;
    case "terminal-button":
      container.innerHTML = `<p>Debug terminal over USB</p>`;
      break;
    case "do-backup-check":
      container.innerHTML = `<p>Create a backup of a firmware from a chip before overwriting it</p>`;
      break;
    case "clean-check":
      container.innerHTML = `<p>Erase all flash before programming</p>`;
      break;
    case "file-container":
      container.innerHTML = `<p>Open a file or just drag'n'drop it here</p>`;
      break;
    case "address":
      container.innerHTML = `<p>Address in flash to write to/read from</p>`;
      break;
    case "size":
      container.innerHTML = `<p>Size in bytes to write/read</p>`;
      break;
    case "read":
      container.innerHTML = `<p>Read flash to a file</p>`;
      break;
    case "erase":
      container.innerHTML = `<p>Erase flash, without touching the bootloader partition</p>`;
      break;
    case "settings":
      container.innerHTML = `<p>Settings</p>`;
      break;
    case "about":
      container.innerHTML = `<p>About</p>`;
      break;
  }
}

function arrayToHexString(array, reverse, x) {
  let string = new String();
  if (x == true) string += "0x";
  if (reverse == true) {
    for (let i = array.length; i > 0 ; i--) {
      string += array[i-1].toString(16).padStart(2,0).toUpperCase();
    }
  } else {
    for (let i = 0; i < array.length ; i++) {
      string += array[i].toString(16).padStart(2,0).toUpperCase();
    }
  }
  return string;
}

function populateChipInfo(info, div) {
  div.innerHTML = 
  `<table>
    <tbody>
      <tr>
        <td><b>USER:</b> ${(info.user>>>16).toString(16).padStart(4, "0")}</td>
        <td><b>RDPR:</b> ${(info.user&0xffff).toString(16).padStart(4, "0")}</td>
        <td><b>DATA0:</b> ${(info.data&0xffff).toString(16).padStart(4, "0")}</td>
        <td><b>DATA1:</b> ${(info.data>>>16).toString(16).padStart(4, "0")}</td>
      </tr>
      <tr>
        <td><b>WRPR0:</b> ${(info.wrpr1>>>16).toString(16).padStart(4, "0")}</td>
        <td><b>WRPR1:</b> ${(info.wrpr1&0xffff).toString(16).padStart(4, "0")}</td>
        <td><b>WRPR2:</b> ${(info.wrpr2>>>16).toString(16).padStart(4, "0")}</td>
        <td><b>WRPR3:</b> ${(info.wrpr2&0xffff).toString(16).padStart(4, "0")}</td>
      </tr>
      <tr>
        <td colspan="4"><b>UUID:</b> ${info.uuid1.toString(16)} ${info.uuid2.toString(16)}</td>
      </tr>
    </tbody>
  </table>`;
}