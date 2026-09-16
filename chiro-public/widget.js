/*
 * KIZUカイロAI 埋め込みウィジェット
 *
 * 公式サイトの footer にこの1行を置くだけで、右下にチャットボタンが出る。
 *
 *   <script src="https://kizuchiro7-ops.github.io/kizu-ai/chiro-public/widget.js" defer></script>
 *
 * 設計上の要点:
 * - チャット本体は iframe で読み込む。サイト側の CSS / jQuery と混ざらないため、
 *   WordPress のテーマを壊す心配がない。
 * - iframe の生成は「最初に開いたとき」まで遅らせる。閲覧者の大半はボタンを押さないので、
 *   全ページビューでチャットを読み込むのは無駄。
 * - Worker へのリクエストは iframe の中から出るので、Origin は github.io のまま。
 *   サイト側のドメインを CORS に足す必要はない。
 * - z-index は 1001（サイト側の最大値）を大きく上回る値を使う。
 */
(function () {
  "use strict";

  var CHAT_URL = "https://kizuchiro7-ops.github.io/kizu-ai/chiro-public/?embed=1";
  var Z = 2147483000;
  var ID = "kizu-ai-widget";

  if (document.getElementById(ID)) return; // 二重読み込み防止

  var css = [
    "#" + ID + "{position:fixed;z-index:" + Z + ";bottom:20px;right:20px;",
    "  font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic Medium','Noto Sans JP',sans-serif}",
    "#" + ID + " *{box-sizing:border-box}",
    /* 起動ボタン */
    "#" + ID + " .kai-btn{display:flex;align-items:center;gap:9px;height:52px;padding:0 21px 0 18px;",
    "  border:0;border-radius:26px;background:#6bbb6e;color:#fff;font-size:15px;font-weight:700;",
    "  font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.22);",
    "  transition:background .15s,transform .15s;line-height:1}",
    "#" + ID + " .kai-btn:hover{background:#4e9c51;transform:translateY(-1px)}",
    "#" + ID + " .kai-btn svg{width:21px;height:21px;flex-shrink:0}",
    /* パネル */
    "#" + ID + " .kai-panel{position:fixed;bottom:86px;right:20px;width:384px;",
    "  height:min(620px,calc(100vh - 130px));background:#fff;border-radius:16px;overflow:hidden;",
    "  box-shadow:0 12px 40px rgba(0,0,0,.26);display:flex;flex-direction:column;",
    "  opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .18s,transform .18s}",
    "#" + ID + ".kai-open .kai-panel{opacity:1;transform:none;pointer-events:auto}",
    "#" + ID + ".kai-open .kai-btn{display:none}",
    "#" + ID + " .kai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;",
    "  padding:12px 10px 12px 16px;background:#6bbb6e;color:#fff;flex-shrink:0}",
    "#" + ID + " .kai-title{font-size:14.5px;font-weight:700;line-height:1.4}",
    "#" + ID + " .kai-title span{display:block;font-size:11.5px;font-weight:500;opacity:.9}",
    "#" + ID + " .kai-close{width:34px;height:34px;border:0;border-radius:9px;background:transparent;",
    "  color:#fff;font-size:22px;line-height:1;cursor:pointer;flex-shrink:0;font-family:inherit}",
    "#" + ID + " .kai-close:hover{background:rgba(255,255,255,.2)}",
    "#" + ID + " iframe{flex:1;width:100%;border:0;display:block}",
    /* スマホは全画面。狭い画面で 384px のパネルは収まらない */
    "@media(max-width:600px){",
    "  #" + ID + " .kai-panel{top:0;right:0;bottom:0;left:0;width:auto;height:auto;border-radius:0}",
    "  #" + ID + " .kai-btn{height:48px;padding:0 17px 0 15px;font-size:14px}",
    "  #" + ID + "{bottom:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom))}",
    "  #" + ID + " .kai-head{padding-top:calc(12px + env(safe-area-inset-top))}",
    "}",
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = ID;
  root.innerHTML =
    '<button class="kai-btn" type="button" aria-label="チャットで質問する">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>' +
    "ご質問はこちら</button>" +
    '<div class="kai-panel" role="dialog" aria-modal="false" aria-label="KIZUカイロAI">' +
    '<div class="kai-head"><div class="kai-title">KIZUカイロAI<span>ご来院前のご質問にお答えします</span></div>' +
    '<button class="kai-close" type="button" aria-label="閉じる">&times;</button></div></div>';

  var btn = root.querySelector(".kai-btn");
  var panel = root.querySelector(".kai-panel");
  var closeBtn = root.querySelector(".kai-close");
  var frame = null;

  function open() {
    if (!frame) {
      // 初回だけ読み込む。押されなければチャットは一切読み込まれない。
      frame = document.createElement("iframe");
      frame.src = CHAT_URL;
      frame.title = "KIZUカイロAI";
      frame.setAttribute("allow", "clipboard-write");
      panel.appendChild(frame);
    }
    root.classList.add("kai-open");
  }

  function close() {
    root.classList.remove("kai-open");
    btn.focus();
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("kai-open")) close();
  });

  (document.body || document.documentElement).appendChild(root);
})();
