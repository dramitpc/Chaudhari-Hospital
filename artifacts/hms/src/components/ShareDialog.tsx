import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientPhone?: string | null;
  patientEmail?: string | null;
  message: string;
  emailSubject: string;
};

function formatWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

export default function ShareDialog({ open, onOpenChange, patientName, patientPhone, patientEmail, message, emailSubject }: Props) {
  const [phone, setPhone] = useState(patientPhone ?? "");
  const [email, setEmail] = useState(patientEmail ?? "");

  useEffect(() => { setPhone(patientPhone ?? ""); }, [patientPhone]);
  useEffect(() => { setEmail(patientEmail ?? ""); }, [patientEmail]);

  const handleWhatsApp = () => {
    if (!phone.trim()) return;
    const formatted = formatWhatsAppPhone(phone.trim());
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEmail = () => {
    if (!email.trim()) return;
    const url = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share with {patientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* WhatsApp */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <p className="font-semibold text-sm">WhatsApp</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone number</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="h-8 text-sm"
              />
              {!patientPhone && (
                <p className="text-[11px] text-muted-foreground">No phone on record — enter manually</p>
              )}
            </div>
            <Button
              className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white"
              size="sm"
              onClick={handleWhatsApp}
              disabled={!phone.trim()}
            >
              Send on WhatsApp
            </Button>
          </div>

          {/* Email */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">✉️</span>
              <p className="font-semibold text-sm">Email</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="patient@email.com"
                className="h-8 text-sm"
              />
              {!patientEmail && (
                <p className="text-[11px] text-muted-foreground">No email on record — enter manually</p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={handleEmail}
              disabled={!email.trim()}
            >
              Send Email
            </Button>
          </div>

          {/* Message preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Message preview</Label>
            <Textarea
              readOnly
              value={message}
              rows={6}
              className="text-xs font-mono resize-none bg-muted/30"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
