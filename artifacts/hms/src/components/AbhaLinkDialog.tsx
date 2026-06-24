import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ShieldCheck, User } from "lucide-react";
import { useAbdmGenerateOtp, useAbdmVerifyOtp, useAbdmLinkAbha, AbdmProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type Step = "mobile" | "otp" | "select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  onLinked: () => void;
}

export default function AbhaLinkDialog({ open, onOpenChange, patientId, onLinked }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [txnId, setTxnId] = useState("");
  const [otp, setOtp] = useState("");
  const [profiles, setProfiles] = useState<AbdmProfile[]>([]);

  const generateOtp = useAbdmGenerateOtp();
  const verifyOtp = useAbdmVerifyOtp();
  const linkAbha = useAbdmLinkAbha();

  function reset() {
    setStep("mobile"); setMobile(""); setTxnId(""); setOtp(""); setProfiles([]);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleGenerateOtp() {
    generateOtp.mutate({ data: { mobile } }, {
      onSuccess: (res) => {
        setTxnId(res.txnId);
        setStep("otp");
        toast({ title: "OTP sent", description: `A 6-digit OTP has been sent to ${mobile}` });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send OTP";
        toast({ title: "OTP failed", description: msg, variant: "destructive" });
      },
    });
  }

  function handleVerifyOtp() {
    verifyOtp.mutate({ data: { txnId, otp } }, {
      onSuccess: (res) => {
        if (res.profiles.length === 0) {
          toast({ title: "No ABHA found", description: "No ABHA Health ID linked to this mobile number.", variant: "destructive" });
          return;
        }
        setProfiles(res.profiles);
        setStep("select");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid OTP";
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
      },
    });
  }

  function handleLink(profile: AbdmProfile) {
    linkAbha.mutate({ patientId, data: { abhaNumber: profile.abhaNumber, abhaAddress: profile.abhaAddress } }, {
      onSuccess: () => {
        toast({ title: "ABHA linked", description: `ABHA ID ${profile.abhaNumber} linked successfully.` });
        handleClose(false);
        onLinked();
      },
      onError: () => {
        toast({ title: "Link failed", description: "Could not link ABHA. Try again.", variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Link ABHA Health ID
          </DialogTitle>
          <DialogDescription>
            Ayushman Bharat Digital Mission — M1 compliance
          </DialogDescription>
        </DialogHeader>

        {step === "mobile" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Patient mobile number</Label>
              <Input
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">An OTP will be sent to this number via ABDM gateway</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={handleGenerateOtp}
                disabled={mobile.length !== 10 || generateOtp.isPending}
              >
                {generateOtp.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send OTP
              </Button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Enter OTP sent to {mobile}</Label>
              <Input
                placeholder="6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("mobile")}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || verifyOtp.isPending}
                >
                  {verifyOtp.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verify OTP
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{profiles.length} ABHA Health ID{profiles.length !== 1 ? "s" : ""} found. Select one to link:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profiles.map(p => (
                <button
                  key={p.abhaNumber}
                  onClick={() => handleLink(p)}
                  disabled={linkAbha.isPending}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.abhaNumber}</p>
                    <p className="text-xs text-muted-foreground">{p.abhaAddress}</p>
                    {p.gender && <Badge variant="outline" className="text-[10px] mt-1">{p.gender}</Badge>}
                  </div>
                  {linkAbha.isPending && <Loader2 className="h-4 w-4 ml-auto animate-spin flex-shrink-0" />}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("mobile")}>← Start over</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AbhaLinkedBadge({ abhaId, abhaAddress }: { abhaId: string; abhaAddress?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
      <CheckCircle2 className="h-3 w-3" />
      ABHA: {abhaAddress ?? abhaId}
    </span>
  );
}
