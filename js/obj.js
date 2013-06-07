"use strict";

function OBJ(input) {
  this.vertices = [];
  this.faces = [];
  if (input) this.load(input);
}

OBJ.prototype.load = function(input) {
  var lines = input.split("\n");
  
  var vertices = [];
  var normals = [];
  var faces = [];
  
  for (var i = 0; i < lines.length; ++i) {
    var p = splitWhitespace(lines[i]);
    if (p.length < 1 || p[0][0] == "#") continue;
    switch (p[0]) {
      case "v":
        vertices.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
        break;
      case "vn":
        normals.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
        break;
      case "f":
        var face = [];
        for (var j = 1; j < p.length; ++j) {
          var f = p[j].split("/");
          face.push([parseInt(f[0]) - 1, parseInt(f[1]) - 1, parseInt(f[2]) - 1]);
        }
        faces.push(face);
        break;
    }
  }
  
  function getIndex(vtxs, v) {
    for (var i = 0; i < vtxs.length; i += 6) {
      var j = 0;
      for (; j < v.length; ++j) {
        if (vtxs[i + j] != v[j]) break;
      }
      if (j == v.length) return Math.floor(i/6);
    }
    vtxs.push(v[0], v[1], v[2], v[3], v[4], v[5]);
    return Math.floor(vtxs.length/6) - 1;
  }
  
  this.vertices = [];
  this.faces = [];
  for (var i = 0; i < faces.length; ++i) {
    var face = [];
    for (var j = 0; j < faces[i].length; ++j) {
      var v = faces[i][j];
      var vtx = vertices[v[0]].concat((v.length > 2)? normals[v[2]] : [0, 0, 0]);
      face.push(getIndex(this.vertices, vtx));
    }
    this.faces.push(face);
  }
}

OBJ.prototype.prepare = function(gl) {
  this.vertexVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
  
  var indices = [];
  for (var i = 0; i < this.faces.length; ++i) {
    for (var j = 0; j < this.faces[i].length; ++j) {
      indices.push(this.faces[i][j]);
    }
  }
  this.indexCount = indices.length;
  this.indexVBO = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexVBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
  /*var faces = [];
  for (var i = 0; i < this.faces.length; ++i) {
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces[i]), gl.STATIC_DRAW);
    faces.push([vbo, this.faces[i].length]);
  }*/
  delete this.vertices;
  delete this.faces;
  /*this.faces = faces;*/
}

OBJ.prototype.render = function(gl,prog) {
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexVBO);
  gl.vertexAttribPointer(prog.attr.pos, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(prog.attr.normal, 3, gl.FLOAT, false, 24, 12);
  /*for (var i = 0; i < this.faces.length; ++i) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.faces[i][0]);
    gl.drawElements(gl.TRIANGLES, this.faces[i][1], gl.UNSIGNED_SHORT, 0);
  }*/
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexVBO);
  gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
}
