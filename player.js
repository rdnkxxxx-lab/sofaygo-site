// player.js — persistent music player for SoFaygo site
(function () {
  'use strict';

  var SK = 'SF_PLAYER';
  var _ctrl = null, _playing = false, _pending = null, _pendingPlay = false;

  var PAUSE_HTML = '<span style="display:flex;gap:3px;align-items:center"><span style="width:2.5px;height:10px;background:currentColor;border-radius:1px;display:block"></span><span style="width:2.5px;height:10px;background:currentColor;border-radius:1px;display:block"></span></span>';
  var PLAY_HTML  = '<span style="display:block;width:0;height:0;border:4.5px solid transparent;border-left:8px solid currentColor;margin-left:2px"></span>';

  function $(id) { return document.getElementById(id); }

  // ── localStorage ─────────────────────────────────────
  function save(o)  { try { localStorage.setItem(SK, JSON.stringify(o)); } catch(e){} }
  function load()   { try { return JSON.parse(localStorage.getItem(SK)); } catch(e){ return null; } }
  function forget() { try { localStorage.removeItem(SK); } catch(e){} }

  // ── Gap fix ───────────────────────────────────────────
  function syncPad() {
    var ps = $('player-section');
    if (!ps) return;
    if (ps.style.display !== 'none' && window.innerWidth <= 640) {
      document.body.style.paddingBottom = ps.offsetHeight + 'px';
    } else {
      document.body.style.paddingBottom = '';
    }
  }

  // ── Button icon ───────────────────────────────────────
  function setBtn(playing) {
    var btn = $('play-pause-btn');
    if (btn) btn.innerHTML = playing ? PAUSE_HTML : PLAY_HTML;
  }

  // ── Spotify ───────────────────────────────────────────
  window._spotifyLoaded = false;
  function loadSpotify() {
    if (window._spotifyLoaded) return;
    window._spotifyLoaded = true;
    var s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    document.head.appendChild(s);
  }

  window.onSpotifyIframeApiReady = function(IFrameAPI) {
    var el = $('embed-iframe');
    if (!el) return;
    IFrameAPI.createController(el, { width: '1', height: '1', uri: 'spotify:track:6aHoPULNO7pSL2ZfUY0bU8' }, function(c) {
      _ctrl = c;
      c.addListener('playback_update', function(e) {
        _playing = !e.data.isPaused;
        setBtn(_playing);
        var st = load(); if (st) { st.playing = _playing; save(st); }
      });
      if (_pending) {
        c.loadUri('spotify:track:' + _pending);
        if (_pendingPlay) c.play();
        _pending = null; _pendingPlay = false;
      }
    });
  };

  // ── Cover art ─────────────────────────────────────────
  function fetchCover(id) {
    fetch('https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F' + id)
      .then(function(r){ return r.json(); })
      .then(function(d){
        var el = $('player-cover'); if (el) el.src = d.thumbnail_url;
        var st = load(); if (st) { st.cover = d.thumbnail_url; save(st); }
      })
      .catch(function(){});
  }

  // ── Show / hide ───────────────────────────────────────
  function showPlayer() {
    var ps = $('player-section');
    if (ps) { ps.style.display = 'block'; requestAnimationFrame(syncPad); }
  }
  function hidePlayer() {
    var ps = $('player-section'); if (ps) ps.style.display = 'none';
    document.body.style.paddingBottom = '';
  }

  // ── Public API ────────────────────────────────────────
  window.togglePlay = function() { if (_ctrl) _ctrl.togglePlay(); };

  window.closePlayer = function() {
    hidePlayer();
    if (_ctrl) _ctrl.pause();
    _playing = false; setBtn(false); forget();
    document.querySelectorAll('.track-row.playing').forEach(function(r){ r.classList.remove('playing'); });
  };

  window.playTrack = function(row, id) {
    loadSpotify();
    document.querySelectorAll('.track-row.playing').forEach(function(r){ r.classList.remove('playing'); });
    var title = '';
    if (row) { row.classList.add('playing'); var t = row.querySelector('.track-title'); if (t) title = t.textContent.trim(); }
    var td = $('player-title'); if (td) td.textContent = title;
    showPlayer(); setBtn(true); _playing = true;
    save({ id: id, title: title, cover: '', playing: true });
    if (_ctrl) { _ctrl.loadUri('spotify:track:' + id); _ctrl.play(); }
    else { _pending = id; _pendingPlay = true; }
    fetchCover(id);
  };

  // ── Inject HTML (non-home pages only) ─────────────────
  function maybeInject() {
    if ($('player-section')) return;
    var el = document.createElement('div');
    el.id = 'player-section';
    el.style.cssText = 'display:none;position:fixed;top:68px;right:44px;z-index:300;width:380px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);box-shadow:0 10px 40px rgba(0,0,0,0.6);';
    el.innerHTML =
      '<div style="background:rgba(8,8,8,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:12px;display:flex;align-items:center;gap:12px;">' +
      '<img id="player-cover" src="" alt="" style="width:80px;height:80px;border-radius:6px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,0.05);">' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-family:\'Inter\',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:5px;">Now Playing</div>' +
      '<div id="player-title" style="font-family:\'Inter\',sans-serif;font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.02em;margin-bottom:6px;"></div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="font-family:\'Inter\',sans-serif;font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.08em;">SoFaygo</div>' +
      '<button id="play-pause-btn" onclick="togglePlay()" style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s;flex-shrink:0;">' +
      PLAY_HTML + '</button>' +
      '</div></div>' +
      '<button onclick="closePlayer()" style="font-family:\'Inter\',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:0;align-self:flex-start;">Close ✕</button>' +
      '</div>';
    document.body.appendChild(el);

    if (!$('embed-iframe')) {
      var emb = document.createElement('div');
      emb.id = 'embed-iframe';
      emb.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;bottom:0;right:0;';
      document.body.appendChild(emb);
    }
  }

  // ── Mobile CSS ────────────────────────────────────────
  function injectMobileCSS() {
    if ($('sf-player-css')) return;
    var s = document.createElement('style');
    s.id = 'sf-player-css';
    s.textContent =
      '@media(max-width:640px){' +
      '#player-section{top:auto!important;right:0!important;bottom:0!important;left:0!important;' +
      'width:100%!important;border-radius:0!important;' +
      'border-top:1px solid rgba(255,255,255,0.14)!important;' +
      'border-left:none!important;border-right:none!important;border-bottom:none!important;' +
      'padding-bottom:env(safe-area-inset-bottom)!important;}' +
      '}';
    document.head.appendChild(s);
  }

  // ── Init ─────────────────────────────────────────────
  function init() {
    maybeInject();
    injectMobileCSS();
    window.addEventListener('resize', syncPad);

    var state = load();
    if (state && state.id) {
      loadSpotify();
      var td = $('player-title'); if (td) td.textContent = state.title || '';
      var cv = $('player-cover'); if (cv && state.cover) cv.src = state.cover;
      showPlayer();
      setBtn(false);
      _pending = state.id;
      _pendingPlay = false; // show paused — user taps to resume
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
