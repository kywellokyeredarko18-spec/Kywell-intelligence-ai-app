/* KYWELL INTELLIGENCE AI APP
 * A fully offline advanced-maths assistant.
 * - Lock screen: fingerprint / face (WebAuthn) or a local password.
 * - Maths engine: powered by nerdamer (algebra, calculus, equation solving, ...).
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   *  Element helpers
   * ------------------------------------------------------------------ */
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    lock: $("lock"),
    setupView: $("setupView"),
    unlockView: $("unlockView"),
    setupBiometric: $("setupBiometric"),
    setupPass: $("setupPass"),
    setupPass2: $("setupPass2"),
    setupPassBtn: $("setupPassBtn"),
    setupMsg: $("setupMsg"),
    unlockBiometric: $("unlockBiometric"),
    unlockOr: $("unlockOr"),
    unlockPass: $("unlockPass"),
    unlockPassBtn: $("unlockPassBtn"),
    unlockMsg: $("unlockMsg"),
    resetBtn: $("resetBtn"),
    appBar: $("appBar"),
    chat: $("chat"),
    chips: $("chips"),
    composer: $("composer"),
    input: $("input"),
    clearBtn: $("clearBtn"),
    installBtn: $("installBtn")
  };

  /* ------------------------------------------------------------------ *
   *  PWA install prompt ("Add to Home Screen")
   * ------------------------------------------------------------------ */
  var deferredInstall = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    if (els.installBtn) els.installBtn.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", function () {
    deferredInstall = null;
    if (els.installBtn) els.installBtn.classList.add("hidden");
  });
  if (els.installBtn) {
    els.installBtn.addEventListener("click", function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.finally(function () {
        deferredInstall = null;
        els.installBtn.classList.add("hidden");
      });
    });
  }

  var KEY_PASS = "kywell_ai_pass";
  var KEY_CRED = "kywell_ai_cred";

  /* ------------------------------------------------------------------ *
   *  Binary / base64 helpers (for WebAuthn)
   * ------------------------------------------------------------------ */
  function randomBytes(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a;
  }
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return window.btoa(s);
  }
  function b64ToBuf(b64) {
    var s = window.atob(b64), bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  /* ------------------------------------------------------------------ *
   *  Password hashing (SHA-256 + random salt, stored locally only)
   * ------------------------------------------------------------------ */
  function hashPassword(pass, saltB64) {
    var enc = new TextEncoder();
    var salt = saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : randomBytes(16);
    var data = enc.encode(pass + "::" + bufToB64(salt.buffer));
    return window.crypto.subtle.digest("SHA-256", data).then(function (digest) {
      return { salt: bufToB64(salt.buffer), hash: bufToB64(digest) };
    });
  }
  function savePassword(pass) {
    return hashPassword(pass).then(function (rec) {
      localStorage.setItem(KEY_PASS, JSON.stringify(rec));
    });
  }
  function verifyPassword(pass) {
    var raw = localStorage.getItem(KEY_PASS);
    if (!raw) return Promise.resolve(false);
    var rec = JSON.parse(raw);
    return hashPassword(pass, rec.salt).then(function (check) {
      return check.hash === rec.hash;
    });
  }

  /* ------------------------------------------------------------------ *
   *  WebAuthn (fingerprint / face) — local biometric gate
   * ------------------------------------------------------------------ */
  function biometricSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials &&
              window.isSecureContext);
  }
  function registerBiometric() {
    var publicKey = {
      challenge: randomBytes(32),
      rp: { name: "KYWELL INTELLIGENCE AI" },
      user: { id: randomBytes(16), name: "kywell-user", displayName: "KYWELL User" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred"
      },
      timeout: 60000,
      attestation: "none"
    };
    return navigator.credentials.create({ publicKey: publicKey }).then(function (cred) {
      localStorage.setItem(KEY_CRED, bufToB64(cred.rawId));
      return true;
    });
  }
  function unlockBiometric() {
    var idB64 = localStorage.getItem(KEY_CRED);
    if (!idB64) return Promise.reject(new Error("No biometric registered"));
    var publicKey = {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: b64ToBuf(idB64), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000
    };
    return navigator.credentials.get({ publicKey: publicKey }).then(function (assertion) {
      return !!assertion;
    });
  }

  /* ------------------------------------------------------------------ *
   *  Lock-screen flow
   * ------------------------------------------------------------------ */
  function hasPassword() { return !!localStorage.getItem(KEY_PASS); }
  function hasBiometric() { return !!localStorage.getItem(KEY_CRED); }
  function isConfigured() { return hasPassword() || hasBiometric(); }

  function showMsg(el, text, ok) {
    el.textContent = text || "";
    el.className = "lock-msg" + (ok ? " ok" : "");
  }

  function initLock() {
    if (!biometricSupported()) {
      els.setupBiometric.disabled = true;
      els.setupBiometric.textContent = "Fingerprint / face not available on this device";
    }
    if (isConfigured()) showUnlock(); else showSetup();
  }

  function showSetup() {
    els.unlockView.classList.add("hidden");
    els.setupView.classList.remove("hidden");
  }

  function showUnlock() {
    els.setupView.classList.add("hidden");
    els.unlockView.classList.remove("hidden");
    if (hasBiometric() && biometricSupported()) {
      els.unlockBiometric.classList.remove("hidden");
    }
    if (hasPassword()) {
      els.unlockOr.classList.toggle("hidden", !hasBiometric());
      els.unlockPass.classList.remove("hidden");
      els.unlockPassBtn.classList.remove("hidden");
    }
    // Auto-prompt biometrics on load if that is the only method.
    if (hasBiometric() && !hasPassword() && biometricSupported()) {
      tryUnlockBiometric();
    }
  }

  function enterApp() {
    els.lock.classList.add("hidden");
    els.appBar.classList.remove("hidden");
    els.chat.classList.remove("hidden");
    els.chips.classList.remove("hidden");
    els.composer.classList.remove("hidden");
    if (!els.chat.dataset.greeted) {
      greet();
      els.chat.dataset.greeted = "1";
    }
    els.input.focus();
  }

  function tryUnlockBiometric() {
    showMsg(els.unlockMsg, "Waiting for fingerprint / face…", true);
    unlockBiometric().then(function () {
      enterApp();
    }).catch(function (e) {
      showMsg(els.unlockMsg, "Biometric unlock failed. " + (e && e.message ? "" : "") + "Try your password.", false);
    });
  }

  /* Setup handlers */
  els.setupBiometric.addEventListener("click", function () {
    if (!biometricSupported()) return;
    showMsg(els.setupMsg, "Follow your device prompt…", true);
    registerBiometric().then(function () {
      showMsg(els.setupMsg, "Fingerprint / face registered. Entering…", true);
      setTimeout(enterApp, 600);
    }).catch(function (e) {
      showMsg(els.setupMsg, "Could not register biometrics: " + (e.message || e.name), false);
    });
  });

  els.setupPassBtn.addEventListener("click", function () {
    var p1 = els.setupPass.value, p2 = els.setupPass2.value;
    if (p1.length < 4) { showMsg(els.setupMsg, "Password must be at least 4 characters.", false); return; }
    if (p1 !== p2) { showMsg(els.setupMsg, "Passwords do not match.", false); return; }
    savePassword(p1).then(function () {
      showMsg(els.setupMsg, "Password saved. Entering…", true);
      els.setupPass.value = els.setupPass2.value = "";
      setTimeout(enterApp, 500);
    });
  });

  /* Unlock handlers */
  els.unlockBiometric.addEventListener("click", tryUnlockBiometric);
  els.unlockPassBtn.addEventListener("click", function () {
    verifyPassword(els.unlockPass.value).then(function (ok) {
      if (ok) { els.unlockPass.value = ""; enterApp(); }
      else showMsg(els.unlockMsg, "Wrong password. Try again.", false);
    });
  });
  els.unlockPass.addEventListener("keydown", function (e) {
    if (e.key === "Enter") els.unlockPassBtn.click();
  });
  els.resetBtn.addEventListener("click", function () {
    if (!window.confirm("Reset removes your password and biometric. Continue?")) return;
    localStorage.removeItem(KEY_PASS);
    localStorage.removeItem(KEY_CRED);
    els.unlockBiometric.classList.add("hidden");
    els.unlockOr.classList.add("hidden");
    els.unlockPass.classList.add("hidden");
    els.unlockPassBtn.classList.add("hidden");
    showMsg(els.unlockMsg, "", false);
    showSetup();
  });

  /* ================================================================== *
   *  MATHS ENGINE
   * ================================================================== */

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Pretty-print a maths expression string into light HTML.
  function pretty(s) {
    s = escapeHTML(s);
    s = s.replace(/\^\(([^()]+)\)/g, "<sup>$1</sup>");
    s = s.replace(/\^(-?\d+(?:\.\d+)?)/g, "<sup>$1</sup>");
    s = s.replace(/\bsqrt\(/g, "&radic;(");
    s = s.replace(/\bpi\b/g, "&pi;");
    s = s.replace(/\*/g, " &middot; ");
    return s;
  }

  // Normalise human input into nerdamer-friendly syntax.
  function normalize(raw) {
    var s = " " + raw + " ";
    s = s
      .replace(/[×✕✖]/g, "*").replace(/[÷]/g, "/")
      .replace(/[−–—]/g, "-").replace(/√/g, "sqrt")
      .replace(/π/g, "pi").replace(/∞/g, "Infinity")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4")
      .replace(/⁰/g, "^0").replace(/¹/g, "^1").replace(/⁵/g, "^5")
      .replace(/⁶/g, "^6").replace(/⁷/g, "^7").replace(/⁸/g, "^8").replace(/⁹/g, "^9");
    // word operators
    s = s.replace(/\bto the power of\b/gi, "^")
         .replace(/\braised to\b/gi, "^")
         .replace(/\bsquared\b/gi, "^2")
         .replace(/\bcubed\b/gi, "^3")
         .replace(/\btimes\b/gi, "*")
         .replace(/\bmultiplied by\b/gi, "*")
         .replace(/\bdivided by\b/gi, "/")
         .replace(/\bover\b/gi, "/")
         .replace(/\bplus\b/gi, "+")
         .replace(/\bminus\b/gi, "-")
         .replace(/\bmod\b/gi, "%");
    return s.trim();
  }

  // Decimal approximation of a nerdamer result, if it differs from the exact form.
  function approx(exactStr) {
    try {
      var d = nerdamer(exactStr).evaluate();
      var num = Number(d.toDecimal ? d.toDecimal(10) : d.text());
      if (isFinite(num)) {
        var rounded = Math.round(num * 1e8) / 1e8;
        var rs = String(rounded);
        if (rs !== exactStr && rs !== exactStr.replace(/\s/g, "")) return rs;
      }
    } catch (e) {}
    return null;
  }

  function buildAnswer(label, exact, opts) {
    opts = opts || {};
    var html = '<span class="label">' + escapeHTML(label) + "</span>";
    html += '<span class="result">' + pretty(exact) + "</span>";
    var ap = opts.noApprox ? null : approx(exact);
    if (ap) html += '<div class="steps">&approx; ' + escapeHTML(ap) + "</div>";
    if (opts.note) html += '<div class="steps">' + escapeHTML(opts.note) + "</div>";
    return html;
  }

  // Try to find the variable to operate on (default x).
  function pickVariable(text, expr) {
    var m = text.match(/\b(?:for|with respect to|wrt|in terms of)\s+([a-zA-Z])\b/);
    if (m) return m[1];
    if (/\bx\b/.test(expr)) return "x";
    var vars = expr.match(/[a-zA-Z]/g);
    if (vars) {
      for (var i = 0; i < vars.length; i++) {
        if (!/[eit]/.test(vars[i]) || true) return vars[i];
      }
    }
    return "x";
  }

  function stripLead(s, patterns) {
    for (var i = 0; i < patterns.length; i++) s = s.replace(patterns[i], "");
    return s.trim();
  }

  // Core resolver: takes raw text, returns { label, html } or throws.
  function solveMath(raw) {
    var lower = raw.toLowerCase().trim();

    // Greetings / non-maths guard
    var mathSignal = /[0-9]|[+\-*/^=]|√|π|²|³|sqrt|sin|cos|tan|sec|csc|cot|log|ln|exp|abs|pi|integr|deriv|differen|antideriv|solve|root|factor|expand|simplif|limit|matrix|determinant|gcd|lcm|factorial|combinat|permut|\b[xyz]\b/i;
    if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|how are you)\b/.test(lower)) {
      return { label: "KYWELL Intelligence", html: "Hello! I'm KYWELL INTELLIGENCE — your advanced maths assistant. Ask me anything in maths: arithmetic, algebra, calculus, equations, factoring, limits and more." };
    }
    if (!mathSignal.test(raw)) {
      return { label: "Maths only", html: "I'm KYWELL INTELLIGENCE, and I only handle <b>mathematics</b> (basic and advanced). Please ask a maths question — e.g. <i>differentiate x^3</i>, <i>solve x^2 = 9</i>, or <i>integrate cos(x)</i>." };
    }

    var expr, variable, res;

    /* ---- Derivative ---- */
    if (/\b(differentiate|derivative|d\/dx|d\/dy|diff)\b/.test(lower)) {
      expr = normalize(stripLead(raw, [
        /d\s*\/\s*d[a-z]/gi, /differentiate/gi, /the\s+derivative\s+of/gi,
        /derivative\s+of/gi, /derivative/gi, /\bdiff\b/gi, /\bwith respect to [a-z]\b/gi,
        /\bfor [a-z]\b/gi, /\bof\b/gi
      ]));
      variable = pickVariable(lower, expr);
      res = nerdamer.diff(expr, variable).toString();
      return { label: "Derivative (d/d" + variable + ")", html: buildAnswer("Derivative (d/d" + variable + ")", res, { noApprox: true }) };
    }

    /* ---- Integral ---- */
    if (/\b(integrate|integral|antiderivative|∫)\b/.test(lower) || /∫/.test(raw)) {
      var bounds = lower.match(/from\s+(-?[\d.]+|[a-z])\s+to\s+(-?[\d.]+|[a-z])/);
      expr = normalize(stripLead(raw, [
        /integrate/gi, /the\s+integral\s+of/gi, /integral\s+of/gi, /integral/gi,
        /antiderivative\s+of/gi, /antiderivative/gi, /∫/g, /\bd[a-z]\b/gi,
        /from\s+\S+\s+to\s+\S+/gi, /\bof\b/gi
      ]));
      variable = pickVariable(lower, expr);
      var anti = nerdamer.integrate(expr, variable).toString();
      if (bounds) {
        var a = bounds[1], b = bounds[2];
        var defVal = nerdamer("(" + anti + ")").sub(variable, b)
          .subtract(nerdamer("(" + anti + ")").sub(variable, a)).toString();
        return { label: "Definite integral", html: buildAnswer("Definite integral [" + a + ", " + b + "]", defVal) };
      }
      return { label: "Integral", html: buildAnswer("Integral &int; d" + variable, anti + " + C", { noApprox: true }) };
    }

    /* ---- Limit ---- */
    if (/\blimit\b/.test(lower)) {
      var lm = lower.match(/as\s+([a-z])\s+(?:approaches|->|tends to|goes to)\s+(-?[\w.]+|infinity|-infinity)/);
      variable = lm ? lm[1] : "x";
      var point = lm ? lm[2] : "0";
      point = point.replace(/^-?infinity$/, function (m) { return m[0] === "-" ? "-Infinity" : "Infinity"; });
      expr = normalize(stripLead(raw, [
        /the\s+limit\s+of/gi, /limit\s+of/gi, /\blimit\b/gi,
        /as\s+[a-z]\s+(?:approaches|->|tends to|goes to)\s+\S+/gi, /\bof\b/gi
      ]));
      res = nerdamer("limit(" + expr + ", " + variable + ", " + point + ")").toString();
      return { label: "Limit", html: buildAnswer("Limit as " + variable + " &rarr; " + point, res) };
    }

    /* ---- Solve ---- */
    if (/\b(solve|roots? of|find [a-z]|zeros? of)\b/.test(lower) || /=/.test(raw) && !/^\s*[\d.]/.test(raw)) {
      expr = normalize(stripLead(raw, [
        /solve(?:\s+for\s+[a-z])?/gi, /the\s+roots?\s+of/gi, /roots?\s+of/gi,
        /the\s+zeros?\s+of/gi, /zeros?\s+of/gi, /find\s+[a-z]\s+(?:in|when|if)?/gi,
        /\bfor\s+[a-z]\b/gi, /\bwhere\b/gi
      ]));
      variable = pickVariable(lower, expr.replace(/=.*/, ""));
      var sols;
      if (expr.indexOf("=") >= 0) sols = nerdamer.solveEquations(expr, variable);
      else sols = nerdamer.solve(expr, variable);
      var arr = (sols && sols.toString) ? sols.toString() : String(sols);
      arr = arr.replace(/^\[/, "").replace(/\]$/, "");
      var parts = arr.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var html = '<span class="label">Solution for ' + escapeHTML(variable) + "</span>";
      if (!parts.length) {
        html += '<span class="result">No real solution found</span>';
      } else if (parts.length === 1) {
        html += '<span class="result">' + escapeHTML(variable) + " = " + pretty(parts[0]) + "</span>";
        var ap = approx(parts[0]); if (ap) html += '<div class="steps">&approx; ' + escapeHTML(ap) + "</div>";
      } else {
        html += '<span class="result">' + escapeHTML(variable) + " = " + parts.map(pretty).join(",&nbsp; ") + "</span>";
      }
      return { label: "Solution", html: html };
    }

    /* ---- Factor ---- */
    if (/\bfactor(ise|ize)?\b/.test(lower)) {
      expr = normalize(stripLead(raw, [/factor(ise|ize)?/gi, /\bof\b/gi]));
      res = nerdamer("factor(" + expr + ")").toString();
      return { label: "Factored", html: buildAnswer("Factored", res, { noApprox: true }) };
    }

    /* ---- Expand ---- */
    if (/\bexpand\b/.test(lower)) {
      expr = normalize(stripLead(raw, [/expand/gi, /\bof\b/gi]));
      res = nerdamer("expand(" + expr + ")").toString();
      return { label: "Expanded", html: buildAnswer("Expanded", res, { noApprox: true }) };
    }

    /* ---- Simplify ---- */
    if (/\bsimplif(y|ies|ication)\b/.test(lower)) {
      expr = normalize(stripLead(raw, [/simplif(y|ies|ication)/gi, /\bof\b/gi]));
      res = nerdamer("simplify(" + expr + ")").toString();
      return { label: "Simplified", html: buildAnswer("Simplified", res) };
    }

    /* ---- Default: evaluate / simplify an expression ---- */
    expr = normalize(stripLead(raw, [
      /what\s+is/gi, /whats/gi, /calculate/gi, /compute/gi, /evaluate/gi,
      /the\s+value\s+of/gi, /value\s+of/gi, /how much is/gi, /\?+/g
    ]));
    var evaluated = nerdamer(expr).evaluate().toString();
    if (/[a-zA-Z]/.test(evaluated) && evaluated.length) {
      // still symbolic -> try a simplify
      try { evaluated = nerdamer("simplify(" + expr + ")").toString(); } catch (e) {}
    }
    return { label: "Result", html: buildAnswer("Result", evaluated) };
  }

  /* ================================================================== *
   *  CHAT UI
   * ================================================================== */
  function addMessage(role, html, isHTML) {
    var wrap = document.createElement("div");
    wrap.className = "msg " + role;
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    if (isHTML) bubble.innerHTML = html; else bubble.textContent = html;
    wrap.appendChild(bubble);
    var meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (role === "user" ? "You" : "KYWELL AI") + " · " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    wrap.appendChild(meta);
    els.chat.appendChild(wrap);
    els.chat.scrollTop = els.chat.scrollHeight;
    return wrap;
  }

  function addTyping() {
    var wrap = document.createElement("div");
    wrap.className = "msg ai typing";
    wrap.innerHTML = '<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    els.chat.appendChild(wrap);
    els.chat.scrollTop = els.chat.scrollHeight;
    return wrap;
  }

  function greet() {
    addMessage("ai",
      "Welcome to <b>KYWELL INTELLIGENCE AI</b> — your advanced maths assistant. " +
      "I solve arithmetic, algebra, calculus (derivatives &amp; integrals), equations, " +
      "factoring, limits and more. I only answer <b>maths</b>. Tap an example below or type a question.",
      true);
  }

  function handleAsk(raw) {
    if (!raw.trim()) return;
    addMessage("user", raw, false);
    var typing = addTyping();
    // Defer so the typing indicator paints before (synchronous) maths runs.
    setTimeout(function () {
      var out;
      try {
        out = solveMath(raw);
      } catch (e) {
        out = { html: "I couldn't work that out. Please check the syntax — e.g. use <code>^</code> for powers and <code>*</code> for multiply. Example: <i>differentiate x^2 + 3*x</i>." , isErr: true };
      }
      typing.remove();
      addMessage("ai", out.html, true);
    }, 220);
  }

  els.composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = els.input.value;
    els.input.value = "";
    handleAsk(v);
  });

  els.chips.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    handleAsk(btn.getAttribute("data-q"));
  });

  els.clearBtn.addEventListener("click", function () {
    els.chat.innerHTML = "";
    greet();
  });

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */
  initLock();
})();
