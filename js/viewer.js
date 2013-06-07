"use strict";

var Viewer = {

  // The arguments received
  args: {},

  // Registered game loaders
  supportedGames: {},

  // Current loaded game
  game: null,
  
  speed: 3.0, // Turns per second
  msPerFrame: 16, // Milliseconds between updates
  interval: null,
  
  playing: true,
  
  // Current time (round)
  time: 0.0,
  
  // HTML nodes (for fast access)
  overlay: null,
  infoDivs: [],
  divRound: null,
  divNarration: null,
  
  btnPlayPause: null,
  btnStop: null,
  
  // Canvas & contexts
  canvas: null,
  ctx: null,
  gl: null,
  
  // Audio
  music: null,
  
  // Number of assets to be loaded
  loading: 0,
  
  mousePressed: false,
  lastMouse: [0.0, 0.0],
  
  registerGame: function(name, gameClass) {
    this.supportedGames[name] = gameClass;
  },
  
  init: function(args) {
    this.canvas = document.getElementById("Canvas");
    window.addEventListener("resize", function(ev) { Viewer.resized(ev); }, false);

    this.divRound = $("Round");
    this.divRound.childNodes[2].addEventListener("click", function(ev) {
      Viewer.setTime(ev.layerX / ev.target.clientWidth);
    }, false);
    this.divNarration = $("Narration");

    this.btnPlayPause = $("PlayPause");
    this.btnPlayPause.onclick = function() { Viewer.togglePlay(); };
    this.btnStop = $("Stop");
    this.btnStop.onclick = function() { Viewer.stop(); };
    
    if (true) { // 3D
      try {
        this.gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
      }
      catch (ex) {}
      if (!this.gl) {
        this.showError("No WebGL! :(",
          'If you\'re using chrome, try to go to <u class="selectable">chrome://flags</u> and enable WebGL.\n'+
          'Otherwise, try upgrading your browser.'
        );
        return;
      }
    }
    else { // 2D
      try {
        this.ctx = this.canvas.getContext("2d");
      }
      catch (ex) {}
      if (!this.ctx) { this.showError("Canvas not supported! :(", "Try upgrading your browser."); return; }
    }

    this.args = getArguments();
    
    this.playing = true;
    if (this.args.wait || this.args.nostart || (this.args.start && this.args.start.toLowerCase() == "no")) {
      this.playing = false;
    }
    this.updateButtons();

    if (this.args.speed) {
      var speed = parseFloat(this.args.speed);
      if (!isNaN(speed)) this.speed = speed;
    }
    
    // Load game, if passed by url
    var game = null;
    if (this.args.web) { // Request game with ajax
      game = "index.php?game="+this.args.web+"&p="+this.args.p+"&u=1";
    }
    else if (this.args.sub) { // Arguments passed by Jutge
      if (location.host) game = location.protocol + "//" + location.host + "/";
      else game = "https://battle-royale-eda.jutge.org/";
      if (this.args.nbr) {
        game += "?cmd=lliuraments&sub="+this.args.sub+"&nbr="+this.args.nbr+"&download=partida";
      }
      else game += "?cmd=partida&sub="+this.args.sub+"&download=partida";
    }
    else game = this.args.game;
    
    if (!game) {
      $("File").addEventListener("change", function(ev) {
        if (ev.target.files.length > 0) {
          Viewer.loadFromFile(ev.target.files[0]);
        }
      }, false);
      this.showOverlay("Upload");
    }
    else this.loadFromURL(game);
  },
  
  showOverlay: function(id) {
    var ov = $("Overlay");
    for (var i = 0; i < ov.childNodes.length; ++i) {
      var c = ov.childNodes.item(i);
      if (c.nodeValue === null) {
        c.style.display = (c.getAttribute("id") == id)? "block" : "none";
      }
    }
  },
  
  showError: function(msg, desc) {
    var div = $("Error");
    div.childNodes[1].textContent = msg;
    if (desc) div.childNodes[5].innerHTML = desc;
    this.showOverlay("Error");
  },
  
  loadFromFile: function(file) {
    if (!file) return;
    this.loadStart();
    var reader = new FileReader();
    reader.onload = function(ev) { Viewer.gameLoaded(ev.target.result); };
    reader.readAsText(file);
  },
  
  loadFromURL: function(url) {
    this.loadStart();
    try {
      ajaxGet(url, function(s) { Viewer.gameLoaded(s); });
    } catch (e) {
      this.showError("UNABLE TO LOAD GAME", e);
    }
  },
  
  loadStart: function() {
    this.loading = 1;
    this.showOverlay("Loading");
  },
  
  gameLoaded: function(input) {
    try {
      var lines = input.replace("\r", "").split("\n");
      if (!input || lines.length == 1) throw "404: Game Not Found!";
      var v = splitWhitespace(lines[0]);
      var gameClass = this.supportedGames[v[0]];
      if (!gameClass) throw "Unsupported game: \""+lines[0]+"\"!";
      this.args.version = v;
      this.game = new gameClass(this.args, lines);
      this.theme = this.game.renderer; //game.getTheme(this.args);
    }
    catch (ex) {
      this.showError("Game load error", ex);
      return;
    }
    this.theme.preload(this);
    this.loaded();
  },
  
  loaded: function() {
    if (--this.loading > 0) return;
    this.renderer = new Renderer(this.gl, this.canvas);
    this.theme.init(this.renderer, this.game);
    this.resized();
    
    document.body.addEventListener("keydown", function(ev) { Viewer.keyPressed(ev); }, false); 
    this.canvas.addEventListener("mousedown", function(ev) { Viewer.mouseDown(ev); }, false);
    this.canvas.addEventListener("mouseup", function(ev) { Viewer.mouseUp(ev); }, false);
    this.canvas.addEventListener("mousemove", function(ev) { Viewer.mouseMove(ev); }, false);
    this.canvas.addEventListener("mouseout", function(ev) { Viewer.mouseOut(ev); }, false);
    this.canvas.addEventListener("mousewheel", function(ev) { Viewer.mouseWheel(ev); }, false);
    
    var root = $("Players");
    for (var i = 0; i < this.game.nPlayers; ++i) {
      var div = document.createElement("div");
      div.className = "player";
      var s =
        '<div><span class="color"></span><span class="name"></span></div>'+
        '<p>Score: <span class="score"></span></p>';
      for (var j = 0; j < this.game.playerInfo.length; ++j) {
        s += '<p>' + this.game.playerInfo[j][0] + ': <span></span></p>';
      }
      div.innerHTML = s;
      root.appendChild(div);
      this.infoDivs.push(div);
      
      div.childNodes[0].childNodes[1].textContent = this.game.names[i];
      if (this.game.names[i] == "Tonto") div.childNodes[0].childNodes[1].className += " bot";
      var c = this.theme.playerColors[i];
      div.childNodes[0].childNodes[0].style.backgroundColor = "rgb("+Math.floor(c[0]*255.0)+", "+Math.floor(c[1]*255.0)+", "+Math.floor(c[2]*255.0)+")";
    }
    
    // Ready
    $("Overlay").style.display = "none";
    if (this.music) this.music.play();

    this.tick();
    this.interval = setInterval("Viewer.tick()", this.msPerFrame);
  },
  
  tick: function() {
    // Update info
    var r = Math.max(0, Math.min(this.game.nRounds, Math.floor(this.time)));
    this.divRound.childNodes[1].textContent = r + " / " + this.game.nRounds;
    this.divRound.childNodes[0].style.width = (100 * Math.max(0, Math.min(1, this.time / this.game.nRounds))) + "%";
    
    var round = this.game.rounds[Math.min(this.game.nRounds - 1, r)];
    
    var winning = []; var maxScore = -1;
    for (var i = 0; i < this.game.nPlayers; ++i) {
      var div = this.infoDivs[i];
      div.childNodes[1].childNodes[1].textContent = round.score[i];
      for (var j = 0; j < this.game.playerInfo.length; ++j) {
        div.childNodes[2 + j].childNodes[1].textContent = this.game.playerInfo[j][1](round, i);
      }
      if (round.score[i] > maxScore) { maxScore = round.score[i]; winning = [i]; }
      else if (round.score[i] == maxScore) { winning.push(i); }
    }
    var msg = "";
    if (r > 0) {
      if (winning.length == 1) msg = this.game.names[winning[0]];
      else {
        msg = this.game.names[winning[0]];
        for (var i = 1; i < winning.length; ++i) msg += " & " + this.game.names[winning[i]];
      }
      if (r >= this.game.nRounds) {
        if (winning.length == 1) msg += " won!";
        else msg += " tied!";
      }
      else {
        if (winning.length == 1) msg += " is winning!";
        else msg += " are tied!";
      }
    }
    this.divNarration.textContent = msg;
    
    this.theme.W = this.canvas.width;
    this.theme.H = this.canvas.height;
    this.theme.render(this.game, this.time);
    
    if (this.playing) this.time += this.msPerFrame * this.speed / 1000;
  },
  
  resized: function() {
    this.canvas.width = window.innerWidth - 4;
    this.canvas.height = window.innerHeight - 4;
  },
  
  keyPressed: function(ev) {
    var code = ((ev.keyCode !== undefined)? ev.keyCode : ev.which);
    switch (code) {
      case 32: // Space
        this.togglePlay(); break;
      case 33: // Page Down
        this.advance(-10); break;
      case 34: // Page Up
        this.advance(10); break;
      case 35: // End
        this.time = this.game.nRounds; break;
      case 36: // Start
        this.time = 0; break;
      case 37: // Left
      case 38: // Up
        this.advance(-1); break;
      case 39: // Right
      case 40: // Down
        this.advance(1); break;
      case 72: // 'h'
        this.showHelp(); break;
      case 76: // 'l'
        var newSpeed = prompt("New speed? (turns per second)");
        if (newSpeed) {
          newSpeed = parseFloat(newSpeed);
          if (!isNaN(newSpeed)) this.speed = Math.max(0.1, Math.min(10.0, newSpeed));
        }
        break;
      case 80: // 'p'
        this.toggleFullscreen();
        break;
      default:
        if (this.theme && this.theme.keyPressed) this.theme.keyPressed(code);
    }
  },

  mouseDown: function(ev) {
    this.lastMouse[0] = ev.clientX;
    this.lastMouse[1] = ev.clientY;
    this.mousePressed = true;
  },
  
  mouseMove: function(ev) {
    if (this.mousePressed && this.theme && this.theme.mouseMoved) {
      var dx = ev.clientX - this.lastMouse[0];
      var dy = ev.clientY - this.lastMouse[1];
      this.lastMouse[0] = ev.clientX;
      this.lastMouse[1] = ev.clientY;
      this.theme.mouseMoved(dx, dy);
    }
  },
  
  mouseUp: function(ev) {
    this.mousePressed = false;
  },
  
  mouseOut: function(ev) {
    this.mousePressed = false;
  },
  
  mouseWheel: function(ev) {
    if (this.theme && this.theme.mouseWheel) this.theme.mouseWheel(ev.wheelDelta);
  },
  
  updateButtons: function() {
    this.btnPlayPause.textContent = this.playing? "Pause" : "Play";
  },
  
  stop: function() {
    this.pause();
    this.time = 0;
    this.updateButtons();
  },

  pause: function() {
    this.playing = false;
    this.updateButtons();
  },
  
  play: function() {
    this.playing = true;
    this.updateButtons();
  },
  
  togglePlay: function() {
    if (this.playing) this.pause();
    else this.play();
  },
  
  advance: function(t) {
    this.pause();
    this.time = Math.max(0, Math.min(this.game.nRounds, Math.round(this.time) + t));
  },
  
  setTime: function(t) {
    var wasPlaying = this.playing;
    this.pause();
    this.time = this.game.nRounds * t;
    if (wasPlaying) this.play();
  },
  
  inFullscreen: function() {
    return !(!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement);
  },
  
  enterFullscreen: function() {
    var el = document.body;
    if (el.webkitRequestFullScreen) {
      el.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
    else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    }
  },
  
  exitFullscreen: function() {
    if (document.cancelFullScreen) document.cancelFullScreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
  },
  
  toggleFullscreen: function() {
    if (this.inFullscreen()) this.exitFullscreen();
    else this.enterFullscreen();
  },
  
  loadFile: function(url) {
    ++this.loading;
    var file = { content: "" };
    try {
      ajaxGet(url, function(s) {
        file.content = s;
        Viewer.loaded();
      });
    } catch (e) {
      this.showError("UNABLE TO LOAD FILE ", url+"Could not load file \""+url+"\"<br/>"+e);
    }
    return file;
  },
  
  loadImage: function(url) {
    ++this.loading;
    var img = new Image();
    img.onload = function() { Viewer.loaded(); };
    img.src = url;
    return img;
  },
  
  loadModel: function(url) {
    ++this.loading;
    var mdl = new OBJ();
    try {
      ajaxGet(url, function(s) {
        mdl.load(s);
        Viewer.loaded();
      });
    } catch (e) {
      this.showError("UNABLE TO LOAD MODEL", "Could not load model \""+url+"\"<br/>"+e);
    }
    return mdl;
  },
  
  loadMusic: function(url) {
    ++this.loading;
    this.stopMusic();
    this.music = new Audio();
    this.music.loop = true;
    this.music.addEventListener("canplay", function() { Viewer.loaded(); }, false);
    this.music.src = url;
  },
  
  stopMusic: function() {
    if (this.music != null) {
      this.music.pause();
      this.music = null;
    }
  },
  
  showHelp: function() {
    var w = 544, h = 448;
    var x = (screen.width - w)/2;
    var y = (screen.height - h)/2;
    var win = window.open(undefined, "_blank",
      "height="+h+", width="+w+", top="+y+", left="+x+
      ", location=0, menubar=0, status=0, scrollbars=1", false);
    var html = '<!DOCTYPE html><head><title>Help</title></head><link rel="stylesheet" type="text/css" href="viewer3D.css"><body class="help">'+
    '<h1>Help</h1><ul>'+
    '<li><b>Space</b>: Play/Pause</li>'+
    '<li><b>Start</b>: Go to the first turn</li>'+
    '<li><b>End</b>: Go to the last turn</li>'+
    '<li><b>Left</b>, <b>Up</b>: Previous turn</li>'+
    '<li><b>Right</b>, <b>Down</b>: Next turn</li>'+
    '<li><b>Page Up</b>: Advance 10 turns</li>'+
    '<li><b>Page Down</b>: Go back 10 turns</li>'+
    '<li><b>h</b>: Show this help</li>'+
    '<li><b>l</b>: Change speed</li>'+
    '<li><b>0</b>-<b>9</b>: Change between cams</li>'+
    '<li><b>q</b>: Reset current cam</li>'+
    '</ul><h2>Cam Controls</h2><ul>'+
    '<li><b>Cam 0</b> (inspection): Maintain LMB and move the mouse to rotate the scene. Mouse wheel to zoom in/out.</li>'+
    '<li><b>Cam 9</b> (free movement): Move with WASD and RF, change the viewing direction with the mouse while pressing LMB.</li>'+
    '</ul>'+
    '</body>';
    win.document.write(html);
    win.document.close();
    if (win.focus) win.focus();
  }

};

window.onload = function() { Viewer.init(); };
