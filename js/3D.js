"use strict";

function Vec3() {
  this.x = this.y = this.z = 0;
}

var DEG_TO_RAD = 0.0174532925;

function Renderer(gl, canvas) {
  this.gl = gl;
  this.W = canvas.width;
  this.H = canvas.height;

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  
  this.modelView = mat4.create();
  this.projection = mat4.create();
  this.normal = mat3.create();
  this.currentProgram = null;
}

Renderer.prototype.loadShader = function(name, type) {
  var el = document.getElementById(name);
  if (!el) {
    console.log("ERROR [Shader]: shader '"+name+"' not found");
    return null;
  }
  var gl = this.gl;
  
  var type = el.getAttribute("type");
  if (type == "text/x-vertex-shader") type = gl.VERTEX_SHADER;
  else if (type == "text/x-fragment-shader") type = gl.FRAGMENT_SHADER;
  else {
    console.log("ERROR [Shader]: unknown type for shader '"+name+"'");
    return null;
  }
  
  var shader = gl.createShader(type);
  gl.shaderSource(shader, el.textContent);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log("ERROR [Shader]: unable to compile shader '"+name+"'!");
    console.log(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

Renderer.prototype.loadShaders = function(vsName, fsName) {
  var vs = this.loadShader(vsName);
  var fs = this.loadShader(fsName);
  var gl = this.gl;
  
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.log("ERROR [Program]: Unable to load shaders '"+vsName+"' and '"+fsName+"'!");
    return null;
  }
  gl.useProgram(prog);
  
  prog.attr = {};
  prog.attr.pos = gl.getAttribLocation(prog, "pos");
  prog.attr.normal = gl.getAttribLocation(prog, "normal");
  prog.attr.texCoord = gl.getAttribLocation(prog, "texCoord");
  if (prog.attr.texCoord == -1) delete prog.attr.texCoord;
  
  prog.uni = {};
  prog.uni.ModelView = gl.getUniformLocation(prog, "ModelView");
  prog.uni.Normal = gl.getUniformLocation(prog, "NormalMatrix");
  prog.uni.Projection = gl.getUniformLocation(prog, "Projection");
  prog.uni.Color = gl.getUniformLocation(prog, "Color");
  prog.uni.Sun = gl.getUniformLocation(prog, "Sun");
  
  return prog;
}

Renderer.prototype.setProgram = function(p) {
  if (this.currentProgram == p) return;
  if (this.currentProgram != null) {
    for (var i in this.currentProgram.attr) {
      this.gl.disableVertexAttribArray(this.currentProgram.attr[i]);
    }
  }
  if (p != null) {
    for (var i in p.attr) {
      this.gl.enableVertexAttribArray(p.attr[i]);
    }
  }
  this.gl.useProgram(p);
  this.currentProgram = p;
}


Renderer.prototype.updateProjection = function() {
  if (this.currentProgram.uni.Projection) {
    this.gl.uniformMatrix4fv(this.currentProgram.uni.Projection, false, this.projection);
  }
}
  
Renderer.prototype.updateModelView = function() {
  if (this.currentProgram.uni.ModelView) {
    this.gl.uniformMatrix4fv(this.currentProgram.uni.ModelView, false, this.modelView);
  }
  if (this.currentProgram.uni.Normal) {
    mat4.toInverseMat3(this.modelView, this.normal);
    mat3.transpose(this.normal);
    this.gl.uniformMatrix3fv(this.currentProgram.uni.Normal, false, this.normal);
  }
}

Renderer.prototype.loadTexture = function(img) {
  var gl = this.gl;
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

Renderer.prototype.addFace = function(ind, vert, dir, pos, scale, texCoord) {
  var v = [];
  switch (dir) {
    case 0: // +Z
      v = [
        -1.0, -1.0,  1.0,   0.0, 0.0, 1.0,   0.0, 0.0,
         1.0, -1.0,  1.0,   0.0, 0.0, 1.0,   1.0, 0.0,
         1.0,  1.0,  1.0,   0.0, 0.0, 1.0,   1.0, 1.0,
        -1.0,  1.0,  1.0,   0.0, 0.0, 1.0,   0.0, 1.0
      ]; break;
    case 1: // -Z
      v = [
        -1.0, -1.0, -1.0,   0.0, 0.0, -1.0,   0.0, 0.0,
        -1.0,  1.0, -1.0,   0.0, 0.0, -1.0,   0.0, 1.0,
         1.0,  1.0, -1.0,   0.0, 0.0, -1.0,   1.0, 1.0,
         1.0, -1.0, -1.0,   0.0, 0.0, -1.0,   1.0, 0.0
      ]; break;
    case 2: // +Y
      v = [
        -1.0,  1.0, -1.0,   0.0, 1.0, 0.0,   0.0, 0.0,
        -1.0,  1.0,  1.0,   0.0, 1.0, 0.0,   0.0, 1.0,
         1.0,  1.0,  1.0,   0.0, 1.0, 0.0,   1.0, 1.0,
         1.0,  1.0, -1.0,   0.0, 1.0, 0.0,   1.0, 0.0
      ]; break;
    case 3: // -Y
      v = [
        -1.0, -1.0, -1.0,   0.0, -1.0, 0.0,   0.0, 0.0,
         1.0, -1.0, -1.0,   0.0, -1.0, 0.0,   1.0, 0.0,
         1.0, -1.0,  1.0,   0.0, -1.0, 0.0,   1.0, 1.0,
        -1.0, -1.0,  1.0,   0.0, -1.0, 0.0,   0.0, 1.0
      ]; break;
    case 4: // +X
      v = [
         1.0, -1.0, -1.0,   1.0, 0.0, 0.0,   0.0, 0.0,
         1.0,  1.0, -1.0,   1.0, 0.0, 0.0,   0.0, 1.0,
         1.0,  1.0,  1.0,   1.0, 0.0, 0.0,   1.0, 1.0,
         1.0, -1.0,  1.0,   1.0, 0.0, 0.0,   1.0, 0.0
      ]; break;
    case 5: // -X
      v = [
        -1.0, -1.0, -1.0,   -1.0, 0.0, 0.0,   0.0, 0.0,
        -1.0, -1.0,  1.0,   -1.0, 0.0, 0.0,   1.0, 0.0,
        -1.0,  1.0,  1.0,   -1.0, 0.0, 0.0,   1.0, 1.0,
        -1.0,  1.0, -1.0,   -1.0, 0.0, 0.0,   0.0, 1.0
      ]; break;
  }
  if (v.length > 0) {
    var b = Math.floor(vert.length / 8);
    ind.push(b, b+1, b+2, b, b+2, b+3);

    for (var i = 0; i < v.length; i += 8) {
      v[i] = v[i]*scale[0] + pos[0];
      v[i+1] = v[i+1]*scale[1] + pos[1];
      v[i+2] = v[i+2]*scale[2] + pos[2];
      if (texCoord) {
        v[i+6] = v[i+6]*texCoord[2] + texCoord[0];
        v[i+7] = v[i+7]*texCoord[3] + texCoord[1];
      }
    }
    append(vert, v);
  }
}



function Model(gl, vertices, stride, count) {
  this.name = gl.createBuffer();
  this.stride = stride;
  this.count = count;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.name);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
}

Model.prototype.render = function(gl, prog) {
  gl.bindBuffer(gl.ARRAY_BUFFER, this.name);
  gl.vertexAttribPointer(prog.attr.pos, 3, gl.FLOAT, false, this.stride*4, 0);
  gl.vertexAttribPointer(prog.attr.normal, 3, gl.FLOAT, false, this.stride*4, 3*4);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
}


function ModelIndexed(gl, vertices, indices, stride, count) {
  this.vertices = gl.createBuffer();
  this.indices = gl.createBuffer();
  this.stride = stride;
  this.count = count;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

ModelIndexed.prototype.render = function(gl, prog) {
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
  gl.vertexAttribPointer(prog.attr.pos, 3, gl.FLOAT, false, this.stride*4, 0);
  gl.vertexAttribPointer(prog.attr.normal, 3, gl.FLOAT, false, this.stride*4, 3*4);
  if (prog.attr.texCoord) gl.vertexAttribPointer(prog.attr.texCoord, 2, gl.FLOAT, false, this.stride*4, 6*4);
  gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
}
