import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eraser, Upload, Pen, X } from "lucide-react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<"draw" | "upload">("draw");

  // ── coordinate helper ───────────────────────────────────────────────────
  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  // ── drawing handlers ────────────────────────────────────────────────────
  const onPointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current   = getPos(e, canvas);
  };

  const onPointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext("2d")!;
    const pos  = getPos(e, canvas);
    const from = lastPos.current ?? pos;

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pos.x,  pos.y);
    ctx.stroke();

    lastPos.current = pos;
  };

  // endDraw uses only refs → no stale closure even with empty dep array
  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current   = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  // Global mouseup / touchend so release outside canvas still commits
  useEffect(() => {
    window.addEventListener("mouseup",  endDraw);
    window.addEventListener("touchend", endDraw);
    return () => {
      window.removeEventListener("mouseup",  endDraw);
      window.removeEventListener("touchend", endDraw);
    };
  }, []); // safe: only uses refs and stable onChange (parent should memoise if needed)

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={v => setTab(v as "draw" | "upload")}>
        <TabsList className="h-8">
          <TabsTrigger value="draw"   className="text-xs h-7 gap-1.5"><Pen    className="h-3 w-3" /> Draw</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs h-7 gap-1.5"><Upload className="h-3 w-3" /> Upload Image</TabsTrigger>
        </TabsList>

        {/* ── Draw tab ───────────────────────────────────────────────── */}
        <TabsContent value="draw" className="mt-2 space-y-2">
          <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden select-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className="w-full cursor-crosshair"
              style={{ touchAction: "none" }}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
            />
            {!value && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 select-none">
                Draw your signature here
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={clearCanvas}
          >
            <Eraser className="h-3 w-3" /> Clear
          </Button>
        </TabsContent>

        {/* ── Upload tab ─────────────────────────────────────────────── */}
        <TabsContent value="upload" className="mt-2">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground text-center">
              Click to upload signature image<br />(PNG, JPG, SVG)
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </TabsContent>
      </Tabs>

      {/* ── Preview ────────────────────────────────────────────────────── */}
      {value && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Preview:</span>
          <img
            src={value}
            alt="Signature preview"
            className="h-12 max-w-[220px] object-contain"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => { clearCanvas(); onChange(""); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
