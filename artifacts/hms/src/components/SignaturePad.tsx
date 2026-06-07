import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eraser, Upload, Pen, X } from "lucide-react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [tab, setTab] = useState<"draw" | "upload">("draw");

  const getCtx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawing(true);
  };

  const endDraw = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawing) {
      onChange(canvas.toDataURL("image/png"));
    }
  }, [drawing, hasDrawing, onChange]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange("");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    const up = () => endDraw();
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [endDraw]);

  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={v => setTab(v as "draw" | "upload")}>
        <TabsList className="h-8">
          <TabsTrigger value="draw" className="text-xs h-7 gap-1.5">
            <Pen className="h-3 w-3" /> Draw
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs h-7 gap-1.5">
            <Upload className="h-3 w-3" /> Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-2 space-y-2">
          <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onTouchStart={startDraw}
              onTouchMove={draw}
            />
            {!hasDrawing && !value && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground select-none">
                Draw your signature here
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={clearCanvas}>
              <Eraser className="h-3 w-3" /> Clear
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click to upload signature image (PNG, JPG, SVG)</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </TabsContent>
      </Tabs>

      {value && (
        <div className="relative rounded-lg border border-border bg-white p-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground shrink-0">Preview:</span>
          <img src={value} alt="Signature preview" className="h-14 max-w-[240px] object-contain" />
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
