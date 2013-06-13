"use strict";

// Polyfill for "localStorage"
//if (localStorage === undefined) localStorage = {};

// Polyfill for "requestAnimationFrame"
(function() {
  var lastTime = 0;
  var vendors = ['webkit', 'moz', 'ms', 'o'];
  for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
    window.requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame']
                               || window[vendors[i] + 'CancelRequestAnimationFrame'];
  }
  
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback) {
      var t = (new Date()).getTime();
      var delay = Math.max(16 - (t - lastTime), 0);
      lastTime = t + delay;
      return window.setTimeout(function() { callback(t + delay); }, delay);
    };
  }
  
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function(id) { clearTimeout(id); };
  }

}());

function $(id) { return document.getElementById(id); }

function lerp(a, b, f) {
  var r = [];
  for (var i = 0; i < a.length; ++i) {
    r.push(a[i] * (1.0 - f) + b[i] * f);
  }
  return r;
}

function append(a,b) {
  for (var i = 0; i < b.length; ++i) {
    a.push(b[i]);
  }
}

function getArguments() {
  var r = {};
  if (window.location.search && window.location.search.length > 1) {
    var args = window.location.search.substr(1).split("&");
    for (var i = 0; i < args.length; ++i) {
      var p = args[i].split("=");
      if (p[0] != "") r[p[0].toLowerCase()] = p[1];
    }
  }
  return r;
}

function splitWhitespace(str) {
  var r = [];
  var j = -1;
  for (var i = 0; i < str.length; ++i) {
    if (' \t\n\r\v'.indexOf(str[i]) > -1) {
      if (j != -1) {
        r.push(str.substring(j, i));
        j = -1;
      }
    }
    else if (j == -1) j = i;
  }
  if (j != -1) r.push(str.substring(j, i));
  return r;
}

function normalize(v) {
  var n = v.length;
  var m = 0.0;
  for (var i = 0; i < n; ++i) m += v[i]*v[i];
  m = Math.sqrt(m);
  var r = [];
  for (var i = 0; i < n; ++i) r.push(v[i] / m);
  return r;
}

function ajaxGet(url, callback) {
  var xmlHttp = null;
  if (window.XMLHttpRequest) {
    xmlHttp = new XMLHttpRequest();
    if (xmlHttp.overrideMimeType) xmlHttp.overrideMimeType("text/html");
  }
  else if (window.ActiveXObject) {
    try { xmlHttp = new ActiveXObject("Msxml2.XMLHTTP"); }
    catch (e) {
      try { xmlHttp = new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) {}
    }
  }
  
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState == 4 && xmlHttp.responseText) {
      callback(xmlHttp.responseText);
    }
  }
  
  xmlHttp.open("GET", url, false);
  xmlHttp.send();
}
