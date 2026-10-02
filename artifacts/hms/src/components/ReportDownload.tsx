import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { DownloadableReport } from "@/lib/reportData";
import { downloadReport, type ReportFormat } from "@/lib/reportDownloads";

export default function ReportDownload({ report, disabled }: { report?: DownloadableReport; disabled?: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();
  const download = async (format: ReportFormat) => {
    if (!report || downloading || disabled) return;
    setDownloading(true);
    try {
      await downloadReport(report, format);
      toast({ title: "Download started", description: `${report.title} · ${format.toUpperCase()}` });
    } catch (error) {
      toast({ title: "Could not download report", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || downloading || !report} aria-label="Download report"
          data-testid="download-report">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? "Preparing…" : "Download"}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void download("pdf")}>PDF (.pdf)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download("csv")}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}