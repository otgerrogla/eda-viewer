
function BattleRoyale(args, lines) {
  var v = args.version[1];
  if (!v || (v != "v1" && v != "v1.1")) throw "Unsupported game version: \""+args.version[0]+" "+v+"\"!";
  this.playerInfo = [
     ["Farmers", function(r,i) { return r.aliveFarmers[i]; }],
     ["Knights", function(r,i) { return r.aliveKnights[i]; }],
     ["CPU", function(r,i) { return r.status[i] + "%"; }]
  ];
  var l = 1;
  while (l < lines.length) {
    var parts = lines[l++].split(" ");
    if (parts.length < 2) break;
    var v = parts[1];
    switch (parts[0]) {
      case "nb_players": this.nPlayers = parseInt(v); break;
      case "nb_rounds": this.nRounds = parseInt(v); break;
      case "nb_farmers": this.nFarmers = parseInt(v); break;
      case "nb_knights": this.nKnights = parseInt(v); break;
      case "farmers_health": this.healthF = parseInt(v); break;
      case "knights_health": this.healthK = parseInt(v); break;
      case "farmers_regen": this.regenF = parseInt(v); break;
      case "knights_regen": this.regenK = parseInt(v); break;
      case "damage_min": this.damageMin = parseInt(v); break;
      case "damage_max": this.damageMax = parseInt(v); break;
      case "rows": this.rows = parseInt(v); break;
      case "cols": this.cols = parseInt(v); break;
      case "names": this.names = [parts[1], parts[2], parts[3], parts[4]]; break;
    }
  }
  this.rounds = [];
  for (var r = 0; r < this.nRounds; ) {
    var parts = lines[l++].split(" ");
    if (parts.length <= 1) continue;
    if (parts[0] != "round") throw "Parse error: expecting 'round' on line " + l;
    var round = { map: [], aliveKnights: [0, 0, 0, 0], aliveFarmers: [0, 0, 0, 0] };
    this.rounds[r++] = round;
    // Map
    for (var i = 0; i < this.rows; ++i) {
      var line = lines[l++];
      round.map.push(line);
    }
    
    // Status & Scores
    parts = lines[l++].split(" ");
    if (parts[0] != "score") throw "Parse error: expecting 'score' on line " + l;
    round.score = [parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4])];
    parts = lines[l++].split(" ");
    if (parts[0] != "status") throw "Parse error: expecting 'status' on line " + l;
    
    round.status = [
      Math.round(parseFloat(parts[1])*100),
      Math.round(parseFloat(parts[2])*100),
      Math.round(parseFloat(parts[3])*100),
      Math.round(parseFloat(parts[4])*100)
    ];
    round.units = [];
    while (true) {
      parts = lines[l++].split(" ");
      if (parts.length <= 1) break;
      var unit = {
        player: parseInt(parts[1]),
        type: parts[0],
        i: parseInt(parts[2]),
        j: parseInt(parts[3]),
        health: parseInt(parts[4]),
        dir: '',
        attacks: false,
        moves: false,
        spawns: false,
        dies: false
      };
      round.units.push(unit);
      if (unit.type == "k") ++round.aliveKnights[unit.player];
      else if (unit.type == "f") ++round.aliveFarmers[unit.player];
    }

    if (r >= this.nRounds) continue;
    if (lines[l++] != "actions") throw "Parse error: expecting 'actions' on line " + l;
    for (var ply = 0; ply < this.nPlayers; ++ply) {
      if (ply != parseInt(lines[l++])) throw "Parse error: expecting player number '" + ply + "' on line " + l;
      while (lines[l++] != "-1"); // Skip actions
    }
    
    do { v = lines[l++] } while (v == "");
    if (v != "movements") throw "Parse error: expecting 'movements' on line " + l;
    while (true) {
      var parts = lines[l++].split(" ");
      var id = parseInt(parts[0]);
      if (id == -1) break;
      var u = round.units[id];
      u.dir = parts[1];
      u.moves = true;
    }
  }
  
  // Extra attributes for units
  for (var r = 0; r < this.nRounds - 1; ++r) {
    var now = this.rounds[r].units;
    var next = this.rounds[r + 1].units;
    for (var i = 0; i < now.length; ++i) {
      if (now[i].player != next[i].player) {
        now[i].dies = true;
        next[i].spawns = true;
      }
      else {
        if (now[i].i == next[i].i && now[i].j == next[i].j) now[i].attacks = true;
      }
      if (now[i].dir == '') now[i].dir = 'b';
      if (next[i].dir == '') next[i].dir = now[i].dir;
    }
  }
  this.renderer = BR_Renderer_Basic;
}

Viewer.registerGame("battleroyale", BattleRoyale);

var BR_Renderer_Basic = {

  cellColors: {
    '0': [1.0, 0.67, 0.67],
    '1': [0.67, 1.0, 0.67],
    '2': [0.0, 0.34, 1.0],
    '3': [0.67, 0.54, 1.0],
    'X': [0.54, 0.54, 0.54],
    '.': [0.2, 0.2, 0.2]
  },
    
  playerColors: [
    [1.0, 0.0, 0.0],
    [0.3, 0.9, 0.2],
    [0.0, 1.0, 1.0],
    [0.6, 0.0, 0.8]
  ],
  
  farmer: MODELS.farmer,
  knight: MODELS.knight,
  
  farmerScale: 0.7,
  knightScale: 0.7,
  
  camSpeed: 5.0,

  moveYaw: 0,
  movePitch: 0,
  movePos: [0, 0, 0],
  
  inspectYaw: 0,
  inspectPitch: 0,
  inspectZoom: 0,
  
  camParam: 0,
  
  sun: normalize([1, -2, 1, 0.0]),
  sunTransformed: [0.0, 0.0, 0.0, 0.0],
  
  lastColor: null,
  array4f: null,
  array3f: null,
  
  game: null,
  
  preload: function(viewer) {
    this.farmerModel = viewer.loadModel(this.farmer.url);
    this.knightModel = viewer.loadModel(this.knight.url);
    
    this.texWalls = viewer.loadImage(TEXTURES.wall);
    
    if (viewer.args.music) {
      var s = viewer.args.music.toLowerCase();
      if (s == "r" || s == "random" || s == "rand") {
        var lst = [];
        for (var s in MUSIC) lst.push(s);
        s = lst[Math.floor(Math.random() * lst.length)];
      }
      else if (!MUSIC[s]) s = null;
      if (s != null) viewer.loadMusic("music/" + MUSIC[s]);
    }
    
    var cam = 1;
    if (viewer.args.cam) cam = parseInt(viewer.args.cam);
    this.setCam(isNaN(cam)? 1 : cam);
    
    if (viewer.args.camspeed) this.camSpeed = parseFloat(viewer.args.camspeed);
  },

  init: function(r,g) {
    this.__proto__ = r;
    this.game = g;
    var gl = r.gl;
    
    this.array4f = new Float32Array(4);
    this.array3f = this.array4f.subarray(0, 3);
    
    var vtx = []; var ind = [];
    r.addFace(ind, vtx, 2, [0, -1, 0], [0.5, 0.5, 0.5], [0.5, 0, 0.5, 1]);
    this.plane = new ModelIndexed(gl, vtx, ind, Math.floor(vtx.length/4), ind.length);
    
    this.prog = this.loadShaders("shader-f-vs", "shader-f-fs");
    this.progTextured = this.loadShaders("shader-vtex-vs", "shader-vtex-fs");

    this.texWalls = this.loadTexture(this.texWalls);
    this.farmerModel.prepare(gl);
    this.knightModel.prepare(gl);
    
    this.resetCam(this.camMove);
    this.resetCam(this.camInspect);
    
    // Build map
    this.map = [];
    this.buildMap(r, g.rounds[0].map);
  },

  updateSun: function() {
    var v = this.sunTransformed;
    this.array3f.set([v[0], v[1], v[2]]);
    this.gl.uniform3fv(this.currentProgram.uni.Sun, this.array3f);
  },
  
  setColor: function(color) {
    if (this.lastColor && color[0] == this.lastColor[0] && color[1] == this.lastColor[1] && color[2] == this.lastColor[2]) return;
    this.lastColor = color;
    this.array3f.set(color);
    this.gl.uniform3fv(this.currentProgram.uni.Color, this.array3f);
  },

  render: function(game, frame) {
    var gl = this.gl;
    var round = Math.floor(frame);
    var dt = frame - round;

    gl.viewport(0, 0, this.W, this.H);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Set up cam
    mat4.identity(this.projection);
    mat4.perspective(45, this.W/this.H, 0.1, 128.0, this.projection);
    
    mat4.identity(this.modelView);

    this.cam.call(this, game, frame);
    
    mat4.multiplyVec4(this.modelView, this.sun, this.sunTransformed);

    var pre = Math.max(0, Math.min(round, game.nRounds - 1));
    var post = Math.max(0, Math.min(round + 1, game.nRounds - 1));
    this.renderMap(game, game.rounds[pre], game.rounds[post], dt, round < game.nRounds);
  },
  
  setCam: function(i) {
    switch (i) {
      case 0: cam = this.camInspect; break;
      case 2: cam = this.camTop; break;
      case 3: case 4: case 5: case 6:
        this.camParam = i - 3;
        cam = this.camGroundLevel;
        break;
      case 9: cam = this.camMove; break;
      default: cam = this.camRotating;
    }
    this.cam = cam;
  },
  
  camInspect: function(game, frame) {
    mat4.translate(this.modelView, [0.0, 0.0, this.inspectZoom]);
    mat4.rotate(this.modelView, this.inspectPitch * DEG_TO_RAD, [1.0, 0.0, 0.0]);
    mat4.rotate(this.modelView, this.inspectYaw * DEG_TO_RAD, [0.0, 1.0, 0.0]);
    mat4.translate(this.modelView, [-game.rows/2 + 0.5, 0.0, -game.cols/2 + 0.5]);
  },
  
  camRotating: function(game, frame) {
    mat4.translate(this.modelView, [0.0, 0.0, -64.0]);
    mat4.rotate(this.modelView, 45.0 * DEG_TO_RAD, [1.0, 0.0, 0.0]);
    mat4.rotate(this.modelView, this.camSpeed * frame * DEG_TO_RAD, [0.0, 1.0, 0.0]);
    mat4.translate(this.modelView, [-game.rows/2 + 0.5, 0.0, -game.cols/2 + 0.5]);
  },
  
  camTop: function(game, frame) {
    mat4.translate(this.modelView, [0.0, 0.0, -64.0]);
    mat4.rotate(this.modelView, 90.0 * DEG_TO_RAD, [1.0, 0.0, 0.0]);
    mat4.translate(this.modelView, [-game.rows/2 + 0.5, 0, 2 -game.cols/2]);
  },
  
  camMove: function(game, frame) {
    mat4.rotate(this.modelView, -this.movePitch * DEG_TO_RAD, [1.0, 0.0, 0.0]);
    mat4.rotate(this.modelView, -this.moveYaw * DEG_TO_RAD, [0.0, 1.0, 0.0]);
    mat4.translate(this.modelView, this.movePos);
  },

  camGroundLevel: function(game, frame) {
    var offset = [0, -1, 0];
    var ang = 90 * this.camParam;
    var dist = 0.5;
    switch (this.camParam) {
      case 0:
        offset[0] = -game.rows/2;
        offset[2] = dist - game.cols;
        break;
      case 1:
        offset[0] = -game.cols/2;
        offset[2] = dist - 1;
        break;
      case 2:
        offset[0] = game.rows/2;
        offset[2] = dist - 1;
        break;
      case 3:
        offset[0] = game.cols/2;
        offset[2] = dist - game.rows;
        break;
    }
    mat4.rotate(this.modelView, 5.0 * DEG_TO_RAD, [1.0, 0.0, 0.0]);
    mat4.translate(this.modelView, offset);
    mat4.rotate(this.modelView, ang * DEG_TO_RAD, [0.0, 1.0, 0.0]);
  },
  
  resetCam: function(cam) {
    if (cam == this.camMove) {
      this.moveYaw = 0;
      this.movePitch = 0;
      this.movePos = [-this.game.cols/2 + 0.5, -1, -this.game.rows/2 + 0.5];
    }
    else if (cam == this.camInspect) {
      this.inspectPitch = 45;
      this.inspectYaw = 45;
      this.inspectZoom = -64;
    }
  },
  
  keyPressed: function(code) {
    var speed = 0.5;
    if (code >= 48 && code < 58) this.setCam(code - 48);
    else if (code == 81) this.resetCam(this.cam); // 'q'
    else if (this.cam == this.camMove) {
      var dx = 0; var dy = 0; var dz = 0;
      switch (code) {
        case 87: dz = -1; break;  // 'w'
        case 65: dx = -1; break;  // 'a'
        case 83: dz =  1; break;  // 's'
        case 68: dx =  1; break;  // 'd'
        case 82: dy =  1; break;  // 'r'
        case 70: dy = -1; break;  // 'f'
      }
      if (dx || dz) {
        dz *= speed; dx *= speed;
        var rad = this.moveYaw * DEG_TO_RAD;
        var sin = Math.sin(rad);
        var cos = Math.cos(rad);
        this.movePos[0] -= sin*dz + cos*dx;
        this.movePos[2] -= cos*dz - sin*dx;
      }
      if (dy) this.movePos[1] = Math.min(0, this.movePos[1] - dy * speed);
    }
  },
  
  mouseMoved: function(dx, dy) {
    if (this.cam == this.camInspect) {
      this.inspectPitch = Math.max(0, Math.min(180, this.inspectPitch + dy/2));
      this.inspectYaw += dx/2;
    }
    else if (this.cam == this.camMove) {
      this.movePitch = Math.max(-90, Math.min(90, this.movePitch - dy/2));
      this.moveYaw -= dx/2;
    }
  },
  
  mouseWheel: function(d) {
    this.inspectZoom = Math.min(-16, this.inspectZoom + d/50);
  },

  renderMap: function(game, pre, post, dt, animate) {
    var pushed = mat4.create();
    mat4.set(this.modelView, pushed);
    var gl = this.gl;
    
    // Map walls
    gl.bindTexture(gl.TEXTURE_2D, this.texWalls);
    this.setProgram(this.progTextured);
    this.updateProjection();
    this.updateModelView();
    this.updateSun();
    this.lastColor = null;
    this.setColor([1.0, 1.0, 1.0]);
    for (var i in this.map) {
      this.map[i].render(this.gl, this.progTextured);
    }
    
    // Map tiles
    for (var i = 0; i < game.rows; ++i) {
      mat4.set(pushed, this.modelView);
      mat4.translate(this.modelView, [-1.0, 0.0, 1.0*i]);
      for (var j = 0; j < game.cols; ++j) {
        var c = pre.map[i][j];
        mat4.translate(this.modelView, [1.0, 0.0, 0.0]);
        if (c == "X") continue;
        var c2 = post.map[i][j];
        this.updateModelView();
        this.setColor(lerp(this.cellColors[c], this.cellColors[c2], Math.pow(dt, 5)));
        this.plane.render(this.gl, this.progTextured);
      }
    }
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.setProgram(this.prog);
    this.updateModelView();
    this.updateProjection();
    this.updateSun();
    this.lastColor = null;
    
    // Units
    //gl.disable(gl.CULL_FACE);
    for (var i = 0; i < pre.units.length; ++i) {
      var u = pre.units[i];
      var farmer = (pre.units[i].type == "f");
      var m = farmer? this.farmer : this.knight;
      
      mat4.set(pushed, this.modelView);
      
      // Translation
      var dx = 0; var dy = 0;
      if (animate) {
        var d = dt;
        if (u.attacks) {
          if (dt > 0.5) d = 1.0 - d;
          d *= 0.3;
        }
        if (u.moves) {
          dx = (u.dir == 'l')? -d : ((u.dir == 'r')? d : 0);
          dy = (u.dir == 't')? -d : ((u.dir == 'b')? d : 0);
        }
      }
      mat4.translate(this.modelView, [u.j + dx, -0.5, u.i + dy]);

      // Rotation
      var rotY = 0.0;
      switch (u.dir) {
        case 'l': rotY = 90.0; break;
        case 'r': rotY = 270.0; break;
        case 'b': rotY = 180.0; break;
      }
      if (m.rotY) rotY += m.rotY;
      mat4.rotate(this.modelView, rotY * DEG_TO_RAD, [0.0, 1.0, 0.0]);
      if (m.rotX) mat4.rotate(this.modelView, m.rotX * DEG_TO_RAD, [1.0, 0.0, 0.0]);
      if (m.rotZ) mat4.rotate(this.modelView, m.rotZ * DEG_TO_RAD, [0.0, 0.0, 1.0]);
      
      // Scaling
      var scale = m.scale * (farmer? this.farmerScale : this.knightScale);
      if (animate) {
        if (u.spawns) scale *= dt*dt;
        else if (u.dies) scale *= (1.0 - dt*dt);
      }
      mat4.scale(this.modelView, [scale, scale, scale]);
      
      // Translate (centering)
      if (m.trans) mat4.translate(this.modelView, m.trans);
      
      this.updateModelView();
      var c = this.playerColors[u.player];
      var f = 0.4 + 0.6*(pre.units[i].health / (farmer? game.healthF : game.healthK));
      this.setColor([f*c[0], f*c[1], f*c[2]]);
      (farmer? this.farmerModel : this.knightModel).render(this.gl, this.prog);
    }
    //gl.enable(gl.CULL_FACE);
    mat4.set(pushed, this.modelView);
  },
  
  buildMap: function(r, map) {
    var vtx = [];
    var ind = [];
    
    function isNotWall(i, j) {
      return i < 0 || j < 0 || i >= map.length || j >= map[0].length || map[i][j] != 'X';
    }
    
    var scale = [0.5, 0.5, 0.5];
    var tcWall = [0, 0, 0.5, 1];
    var tcTop = [0.5, 0, 0.5, 1];
    for (var i = 0; i < map.length; ++i) {
      for (var j = 0; j < map[0].length; ++j) {
        if (map[i][j] == 'X') {
          var pos = [j, 0, i];
          r.addFace(ind, vtx, 2, pos, scale, tcTop);
          if (isNotWall(i+1, j)) r.addFace(ind, vtx, 0, pos, scale, tcWall);
          if (isNotWall(i-1, j)) r.addFace(ind, vtx, 1, pos, scale, tcWall);
          if (isNotWall(i, j+1)) r.addFace(ind, vtx, 4, pos, scale, tcWall);
          if (isNotWall(i, j-1)) r.addFace(ind, vtx, 5, pos, scale, tcWall);
        }
      }
    }

    this.map.push(new ModelIndexed(r.gl, vtx, ind, 8, ind.length));
  }

};

BattleRoyale.RENDERERS = [
  [ BR_Renderer_Basic, "Basic", {
    farmer: 'farmer',
    knight: 'knight'
  /*getTheme: function(args) {
    var t = BR_Theme_Basic;
    if (args.farmer && MODELS[args.farmer]) t.farmer = MODELS[args.farmer];
    if (args.knight && MODELS[args.knight]) t.knight = MODELS[args.knight];
    if (t.farmer == t.knight) t.farmerScale = 0.4;
    return t;
  },*/
  } ]
];
  