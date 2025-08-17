// @ts-nocheck
"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_W = 900;
const CANVAS_H = 600;

const TOOLS = {
  PEN: "pen",
  ERASER: "eraser",
  SIGN: "sign",
} as const;

function useDPR(canvasRef: any) {
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = CANVAS_W + "px";
    canvas.style.height = CANVAS_H + "px";
    ctx.scale(dpr, dpr);
  }, [canvasRef]);
}

function drawGrid(ctx: CanvasRenderingContext2D, size: number, opacity = 0.25) {
  if (!size) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  for (let x = size; x < CANVAS_W; x += size) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, CANVAS_H);
    ctx.stroke();
  }
  for (let y = size; y < CANVAS_H; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CANVAS_W, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function toDataURL(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/png");
}

function fromDataURL(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function encodeEdge(ctx: CanvasRenderingContext2D, side: "L"|"R"|"T"|"B", thickness = 8) {
  const off = document.createElement("canvas");
  off.width = side === "L" || side === "R" ? thickness : CANVAS_W;
  off.height = side === "T" || side === "B" ? thickness : CANVAS_H;
  const octx = off.getContext("2d")!;
  if (side === "L") octx.drawImage(ctx.canvas, 0, 0, thickness, CANVAS_H, 0, 0, thickness, CANVAS_H);
  if (side === "R") octx.drawImage(ctx.canvas, CANVAS_W - thickness, 0, thickness, CANVAS_H, 0, 0, thickness, CANVAS_H);
  if (side === "T") octx.drawImage(ctx.canvas, 0, 0, CANVAS_W, thickness, 0, 0, CANVAS_W, thickness);
  if (side === "B") octx.drawImage(ctx.canvas, 0, CANVAS_H - thickness, CANVAS_W, thickness, 0, 0, CANVAS_W, thickness);
  return off.toDataURL("image/png");
}

async function importEdgePreview(ctx: CanvasRenderingContext2D, side: "L"|"R"|"T"|"B", dataUrl: string) {
  const img = await fromDataURL(dataUrl);
  ctx.save();
  ctx.globalAlpha = 0.5;
  if (side === "L") ctx.drawImage(img, 0, 0);
  if (side === "R") ctx.drawImage(img, CANVAS_W - img.width, 0);
  if (side === "T") ctx.drawImage(img, 0, 0);
  if (side === "B") ctx.drawImage(img, 0, CANVAS_H - img.height);
  ctx.restore();
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<(typeof TOOLS)[keyof typeof TOOLS]>(TOOLS.PEN);
  const [color, setColor] = useState("#111827");
  const [brush, setBrush] = useState(6);
  const [grid, setGrid] = useState(24);
  const [locked, setLocked] = useState(false);
  const [signText, setSignText] = useState("");
  const [room, setRoom] = useState<string>(() => typeof window !== "undefined" ? (localStorage.getItem("cc_room") || Math.random().toString(36).slice(2,10)) : "room");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [edgeCodes, setEdgeCodes] = useState<{L?: string; R?: string; T?: string; B?: string;}>({});
  const [importSide, setImportSide] = useState<"L"|"R"|"T"|"B">("R");
  const [importCode, setImportCode] = useState("");

  useDPR(canvasRef);
  useDPR(overlayRef);

  const getCtx = () => canvasRef.current?.getContext("2d")!;
  const getOverlay = () => overlayRef.current?.getContext("2d")!;

  const snapshot = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    setHistory((h) => [...h, data]);
    setRedoStack([]);
  }, []);

  useEffect(() => {
    const ctx = getCtx();
    const octx = getOverlay();
    if (!ctx || !octx) return;

    const saved = localStorage.getItem("cc_tile");
    if (saved) {
      fromDataURL(saved).then((img) => {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0);
        renderOverlay();
        snapshot();
      }).catch(() => {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        renderOverlay();
        snapshot();
      });
    } else {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderOverlay();
      snapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderOverlay = useCallback(() => {
    const octx = getOverlay();
    if (!octx) return;
    octx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(octx, grid);
  }, [grid]);

  useEffect(() => { renderOverlay(); }, [grid, renderOverlay]);

  const startDraw = (x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush;
    if (tool === TOOLS.PEN || tool === TOOLS.SIGN) {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    } else if (tool === TOOLS.ERASER) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    }
  };

  const draw = (x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
    const img = toDataURL(ctx.canvas);
    localStorage.setItem("cc_tile", img);
    snapshot();
  };

  const onPointerDown = (e: any) => {
    if (locked) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (tool === TOOLS.SIGN) {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      ctx.font = `${Math.max(14, brush * 3)}px ui-sans-serif`;
      const stamp = signText ? `${signText} — ${new Date().toLocaleString()}` : `Signed — ${new Date().toLocaleString()}`;
      ctx.fillText(stamp, x, y);
      ctx.restore();
      const img = toDataURL(ctx.canvas);
      localStorage.setItem("cc_tile", img);
      snapshot();
      return;
    }

    setIsDrawing(true);
    startDraw(x, y);
  };

  const onPointerMove = (e: any) => {
    if (!isDrawing || locked) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    draw(x, y);
  };

  const onPointerUp = () => {
    if (!isDrawing) return;
    endDraw();
  };

  const undo = () => {
    const ctx = getCtx();
    if (!ctx || history.length <= 1) return;
    const newRedo = history[history.length - 1];
    const newHist = history.slice(0, -1);
    setRedoStack((r) => [...r, newRedo]);
    setHistory(newHist);
    ctx.putImageData(newHist[newHist.length - 1], 0, 0);
    localStorage.setItem("cc_tile", toDataURL(ctx.canvas));
  };

  const redo = () => {
    const ctx = getCtx();
    if (!ctx || redoStack.length === 0) return;
    const latest = redoStack[redoStack.length - 1];
    const rest = redoStack.slice(0, -1);
    setRedoStack(rest);
    setHistory((h) => [...h, latest]);
    ctx.putImageData(latest, 0, 0);
    localStorage.setItem("cc_tile", toDataURL(ctx.canvas));
  };

  const clearAll = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    localStorage.setItem("cc_tile", toDataURL(ctx.canvas));
    snapshot();
  };

  const lockTile = () => setLocked(true);
  const unlockTile = () => setLocked(false);

  const generateEdges = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const L = encodeEdge(ctx, "L");
    const R = encodeEdge(ctx, "R");
    const T = encodeEdge(ctx, "T");
    const B = encodeEdge(ctx, "B");
    setEdgeCodes({ L, R, T, B });
    navigator.clipboard?.writeText(JSON.stringify({ L, R, T, B })).catch(() => {});
  };

  const doImportEdge = async () => {
    const ctx = getCtx();
    if (!ctx || !importCode) return;
    try {
      const parsed = importCode.startsWith("data:image") ? importCode : JSON.parse(importCode)[importSide];
      await importEdgePreview(ctx, importSide, parsed);
      localStorage.setItem("cc_tile", toDataURL(ctx.canvas));
      snapshot();
    } catch (e) {
      alert("Invalid edge code. Paste either a data URL or the full JSON from 'Copy edges'.");
    }
  };

  const downloadPNG = () => {
    const url = toDataURL(canvasRef.current!);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cocreate_${room}_${Date.now()}.png`;
    a.click();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qRoom = params.get("room");
    if (qRoom) {
      setRoom(qRoom);
      localStorage.setItem("cc_room", qRoom);
    } else {
      localStorage.setItem("cc_room", room);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold tracking-tight">CoCreate</div>
          <span className="badge">Room</span>
          <input className="w-36" value={room} onChange={(e) => setRoom(e.target.value.trim())} />
          <button onClick={async () => {
            const url = `${window.location.origin}${window.location.pathname}?room=${room}`;
            try {
              await navigator.clipboard.writeText(url);
              alert("Invite link copied!");
            } catch { alert(url); }
          }}>Invite</button>
        </div>
        <div className="text-sm text-slate-500">MVP • Local-only • Realtime-ready</div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Toolbar */}
        <div className="col-span-12 space-y-4 lg:col-span-3">
          <div className="toolbar-grid">
            <button className={tool===TOOLS.PEN ? "border-slate-900" : ""} onClick={() => setTool(TOOLS.PEN)}>✏️ Pen</button>
            <button className={tool===TOOLS.ERASER ? "border-slate-900" : ""} onClick={() => setTool(TOOLS.ERASER)}>🧽 Eraser</button>
            <button className={tool===TOOLS.SIGN ? "border-slate-900" : ""} onClick={() => setTool(TOOLS.SIGN)}>✒️ Sign</button>

            <div className="toolbar-section">
              <label>Stroke color</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>

            <div className="toolbar-section">
              <label>Brush size: {brush}px</label>
              <input type="range" min={1} max={48} step={1} value={brush} onChange={(e) => setBrush(parseInt(e.target.value))} />
            </div>

            <div className="toolbar-section">
              <label>Grid (px)</label>
              <select value={String(grid)} onChange={(e) => setGrid(parseInt(e.target.value))}>
                {[0,12,16,24,32,48,64].map((g) => <option key={g} value={g}>{g===0 ? "Off" : g}</option>)}
              </select>
            </div>

            <div className="toolbar-section">
              <label>Signature text</label>
              <input placeholder="Your name or @handle" value={signText} onChange={(e) => setSignText(e.target.value)} />
            </div>

            <div className="toolbar-grid">
              <button onClick={undo}>↩️ Undo</button>
              <button onClick={redo}>↪️ Redo</button>
            </div>

            <div className="toolbar-grid">
              {!locked ? (
                <button onClick={() => setLocked(true)}>🔒 Lock</button>
              ) : (
                <button onClick={() => setLocked(false)}>🔓 Unlock</button>
              )}
              <button onClick={clearAll}>🧹 Clear</button>
            </div>

            <div className="toolbar-grid">
              <button onClick={downloadPNG}>⬇️ PNG</button>
              <button onClick={generateEdges}>🧩 Copy edges</button>
            </div>

            <div className="toolbar-section">
              <label>Import edge (preview)</label>
              <div className="flex gap-2">
                <select value={importSide} onChange={(e) => setImportSide(e.target.value as any)}>
                  {["L","R","T","B"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="w-full" placeholder="Paste edge data URL or full JSON" value={importCode} onChange={(e) => setImportCode(e.target.value)} />
                <button onClick={doImportEdge}>Import</button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Tip: After drawing, click <b>Copy edges</b>. Share the JSON so the next artist can align their tile.</p>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="col-span-12 lg:col-span-9">
          <div className="card p-3">
            <div className="relative">
              <div className="absolute left-3 top-2 z-10 text-xs text-slate-500">{locked ? "Locked (view only)" : "Draw mode"}</div>
              <div className="relative mx-auto w-fit">
                <canvas
                  ref={overlayRef}
                  className="absolute left-0 top-0 z-10"
                  width={CANVAS_W}
                  height={CANVAS_H}
                  style={{ touchAction: "none" }}
                />
                <canvas
                  ref={canvasRef}
                  className={`relative z-0 rounded-xl ring-1 ring-slate-200 ${locked ? "opacity-95" : ""}`}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                  style={{ touchAction: "none", cursor: tool === TOOLS.ERASER ? "cell" : "crosshair" }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div>Canvas: {CANVAS_W}×{CANVAS_H}px • Room: {room}</div>
                <div>{locked ? <span className="text-amber-600">Tile is locked. Unlock to keep drawing.</span> : <span>Pro tip: make bold lines near edges so others can continue.</span>}</div>
              </div>
            </div>

            {edgeCodes.L && (
              <div className="mt-4 rounded-xl border p-3 text-xs">
                <div className="font-medium">Edge codes (data URLs)</div>
                <details className="mt-2"><summary>All (JSON)</summary>
                  <pre className="whitespace-pre-wrap break-all bg-slate-50 p-2">{JSON.stringify(edgeCodes)}</pre>
                </details>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(["L","R","T","B"] as const).map((s)=> edgeCodes[s] ? (
                    <details key={s}><summary>{s}</summary>
                      <pre className="whitespace-pre-wrap break-all bg-slate-50 p-2">{edgeCodes[s]}</pre>
                    </details>
                  ) : null)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 card p-4 text-sm text-slate-700">
            <h2>How to collaborate (no backend)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Draw your tile. Click <b>Lock</b> when done.</li>
              <li>Click <b>Copy edges</b>. Share the JSON with the next artist.</li>
              <li>They paste the JSON in <i>Import edge</i>, pick the matching side, and continue from your boundary.</li>
              <li>Use <b>PNG</b> to export a snapshot at any time.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">Note: This MVP saves locally and simulates edge continuation. For live multiuser, add a realtime backend (Supabase/Firebase/Socket.IO).</p>
          </div>
        </div>
      </div>
    </main>
  );
}
