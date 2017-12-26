'use strict';

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    function() {
      console.log("DOM loaded after JS.");
      whenOrIfPageLoaded();
    }
  );
} else {
  console.log("DOM loaded before JS.")
  whenOrIfPageLoaded();
}

function whenOrIfPageLoaded() {


const keysPressed = new Set();
const noteKeys = [];

function getPressedKeys() {
  return Array.from(keysPressed.values());
}
function getNoteID() {
  let noteID = 0;
  for (let i=0; i < 6; ++i) {
    if (keysPressed.has(noteKeys[i])) noteID += 2**i;
  }
  return noteID;
}
function getFrequency(noteID, rootFreq=220) {
  return rootFreq*(2**(noteID/12));
}
const getNoteName = (function() {
  const sf = Symbol("A note which is a flat or sharp.");
  const baseNames = ["A", sf, "B", "C", sf, "D", sf, "E", "F", sf, "G", sf];
  const getBaseName = (index)=>baseNames[index % baseNames.length];

  return function(
    halfStepsAboveRoot, rootStep=37 /* A3 */, accidentals="both"
  ) {
    /* Subtract 1, because piano keys are 1-based rather than 0-based.
     * A0 is key 1, A1 is key 13, A2 is 25, A3 is 37, etc. */
    const noteID = halfStepsAboveRoot + rootStep - 1;

    /* Octaves start at C rather than A, so we must shift the octave
     * by 3 half-steps: */
    const octave = Math.floor((noteID - 3) / 12) + 1;
    const nameIndex = noteID % 12;
    let name = baseNames[nameIndex];
    if (name === sf) {
      switch (accidentals) {
        case "sharps": case "sharp":
          name = getBaseName(nameIndex - 1) + "♯";
          break;
        case "flats": case "flat":
          name = getBaseName(nameIndex + 1) + "♭";
          break;
        case "both": default:
          name =  getBaseName(nameIndex - 1) + "♯/";
          name += getBaseName(nameIndex + 1) + "♭";
          break
      }
    }
    return name + octave
  }
})();

function getEleById(id) {
  return document.getElementById(id);
}
const noteKeysEle    = getEleById('note-keys');
const pressedKeysEle = getEleById('pressed-keys');
const noteIDEle      = getEleById('note-id');
const noteFreqEle    = getEleById('note-freq');
const noteNameEle    = getEleById('note-name');
const volDispEle     = getEleById('vol-disp');
const volInputEle    = getEleById('vol-input');


function updateDisplays() {
  const noteID = getNoteID();
  pressedKeysEle.innerHTML = `Pressed Keys: ${getPressedKeys()}`;
  noteIDEle.innerHTML = `Note ID: ${noteID}`;
  noteFreqEle.innerHTML = `Note Frequency: ${getFrequency(noteID)}`
  noteNameEle.innerHTML = `Note Name: ${getNoteName(noteID)}`
}

const Flute = (function() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  /* Control volume: */
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;

  const oscillator = audioCtx.createOscillator();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();

  const expInterp = (pointA, pointB)=>{
    /* y = B*exp(A*x)
     * A = ln(y2/y1)/(x2-x1)
     * B = y1 * exp(-A * x1) */
    const A = Math.log(pointB[1]/pointA[1]) / (pointB[0]-pointA[0]);
    const B = pointA[1] * Math.exp(-A * pointA[0]);
    return (x)=>B * Math.exp(A * x);
  }

  /* Alter volume based on frequency so that all sound equally loud: */
  /* Use a model based on ISO-226, which is comprised of 4 splines which are
   * quadratic functions of the natural log of the frequency: */
  const volumeMultiplier = (function() {
    const breakPoints = [6.8201, 7.4470, 8.8395];
    const polyConsts = [204.5, -570.2, 1324.8, -3731.3];
    const polyCoeffs = [
      [-43.3000, 2.7916],
      [166.0733, -11.2533],
      [-320.8174, 19.9576],
      [823.1689, -44.7515]
    ];

    return function(f) {
      const logF = Math.log(f);
      const logFSqrd = logF*logF;

      /* Find which polynomial to use for the given frequency: */
      let sect = 0;
      for (; sect < 3; ) {
        if (logF < breakPoints[sect]) break;
        ++sect;
      }
      return (
        polyConsts[sect] + //Constant Term
        logF*polyCoeffs[sect][0] + //log Freq term
        logFSqrd*polyCoeffs[sect][1] //(log Freq)^2 term
      )/100;
    }
  })();

  function play(freq, volume=0.25) {
    if (freq <= 0) {
      mute();
    }
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;// * volumeMultiplier(freq);
    //console.log(volumeMultiplier(freq));
  }
  function mute() {
    gainNode.gain.value = 0;
  }
  return {play, mute};
})();
function updateFlute() {
  const volume = volInputEle.value/100;
  volDispEle.innerHTML = `Volume: ${volume}`;
  if (getNoteID() === 0) {
    Flute.mute();
  } else {
    const freq = getFrequency(getNoteID());
    Flute.play(freq, volume);
  }
}

volInputEle.addEventListener('change', updateFlute, false);

document.addEventListener('keydown', (event) => {
  const keyCode = event.code;
  /* Don't register holding a key as many presses: */
  if (keysPressed.has(keyCode)) {
    return;
  }

  console.log(`Adding keycode ${keyCode} to list ${getPressedKeys()}`);
  keysPressed.add(keyCode);
  updateDisplays();
  updateFlute();

  if (noteKeys.length < 6 && !noteKeys.includes(keyCode)) {
    noteKeys.push(keyCode);
    noteKeysEle.innerHTML = `Note Keys: [${noteKeys}]`;
    if (noteKeys.length === 6) {
      noteKeysEle.style.backgroundColor = "#cfc";
    }
    return;
  }

}, false);
document.addEventListener('keyup', (event) => {
  const keyCode = event.code;
  console.log(`Removing keycode ${keyCode} from list ${getPressedKeys()}`);
  keysPressed.delete(keyCode);

  updateDisplays();
  updateFlute();
}, false);

updateDisplays();
updateFlute();


// const equalizerEle   = getEleById('vol-equalizer');
// for (let i = 0, len = equalizerEle.children.length; i < len; ++i) {
//   const li = equalizerEle.children[i];
//   li.innerHTML += 10**(4.5*i/len);
// }

} //Close whenOrIfPageLoaded function
