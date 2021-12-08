
function download(blob, filename) {
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.setAttribute("download", filename);
  a.click();
  window.URL.revokeObjectURL(a.href);
}

const mo = new MutationObserver((ml, o) => {
  const root = ml[0].target;
  const bar = root.getElementById("bar");
  if (bar.children.length == 0) return;

  const e = document.createElement("div");
  e.style.cssText = `
font-size: 12px;
padding-right: 10px;
line-height: 24px;
float: right;
cursor: pointer;
`;
  e.innerHTML = "⚫";

  let mr = null;

  e.addEventListener("mousedown", () => {
    const ofc = document.createElement("canvas");
    const ofc2d = ofc.getContext("2d");

    const S = 4;
    ofc.width = 1920 / S;
    ofc.height = 1080 / S;

    console.log("recording...");
    const canvas =
      root.querySelector("iframe").contentDocument.getElementById("c");

    const captutedData = [];
    mr = new MediaRecorder(ofc.captureStream(60), {
      videoBitsPerSecond: 4 * 1024 * 1024,
      mimeType: "video/webm; codecs=vp9"});
    mr.addEventListener("stop", ev => {
      const blob = new Blob(captutedData, {type: "video/webm" });
      download(blob, "video.webm", "video/webm");
    });
    mr.addEventListener("dataavailable", ev => {
      captutedData.push(ev.data);
    });

    mr.start();
    let start = performance.now();
    let frs = 0;
    function frame() {
      ofc2d.width = ofc.width;
      ofc2d.drawImage(canvas, 0, 0, ofc.width, ofc.height);

      const t = (performance.now() - start) / 1000;
      if (t > frs * 0.5) {
        frs++;
        console.log(`Elapsed time: ${Math.floor(t * 10) / 10}s`);
      }

      if (mr.state == "recording") {
        requestAnimationFrame(frame);
      }
    }
    frame();
  });

  e.addEventListener("mouseup", () => {
    mr.stop();
  });

  bar.appendChild(e);
});

for (const c of document.querySelectorAll("canvas-demo")) {
  mo.observe(c.shadowRoot, {childList: true});
}
