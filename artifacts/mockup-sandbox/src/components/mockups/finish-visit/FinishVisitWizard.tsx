import { useState } from "react";
import { Check, ChevronRight, FileText, Pill, FlaskConical, Calendar, Receipt, CheckCircle2, AlertCircle, Circle, IndianRupee, Printer, MessageCircle } from "lucide-react";

type StepStatus = "pending" | "ok" | "warning" | "skipped";

interface CheckItem {
  id: string;
  label: string;
  sublabel: string;
  status: StepStatus;
}

const STEPS = ["checklist", "invoice", "payment", "done"] as const;
type Step = typeof STEPS[number];

export function FinishVisitWizard() {
  const [step, setStep] = useState<Step>("checklist");
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: "notes", label: "Clinical Notes", sublabel: "Chief complaint & diagnosis saved", status: "ok" },
    { id: "prescription", label: "Prescription", sublabel: "1 prescription issued", status: "ok" },
    { id: "investigation", label: "Investigations", sublabel: "X-Ray ordered — results pending", status: "warning" },
    { id: "followup", label: "Follow-up Date", sublabel: "Not set", status: "pending" },
  ]);
  const [followupDate, setFollowupDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [amount, setAmount] = useState("500");
  const [paid, setPaid] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const invoiceTotal = 500;
  const consultationFee = 300;
  const investigationFee = 200;

  function setFollowup(date: string) {
    setFollowupDate(date);
    setChecks(prev => prev.map(c =>
      c.id === "followup"
        ? { ...c, status: "ok", sublabel: date ? `Scheduled: ${date}` : "Not set" }
        : c
    ));
  }

  function skipFollowup() {
    setChecks(prev => prev.map(c =>
      c.id === "followup" ? { ...c, status: "skipped", sublabel: "Skipped" } : c
    ));
    setStep("invoice");
  }

  const allChecksDone = checks.every(c => c.status === "ok" || c.status === "skipped" || c.status === "warning");
  const hasBlockers = checks.some(c => c.status === "pending");

  function StatusIcon({ status }: { status: StepStatus }) {
    if (status === "ok") return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (status === "warning") return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />;
    if (status === "skipped") return <Circle className="w-5 h-5 text-slate-300 shrink-0" />;
    return <Circle className="w-5 h-5 text-slate-300 shrink-0" />;
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Complete Visit</p>
              <h2 className="text-white font-semibold text-lg leading-tight">Ramesh Kumar</h2>
              <p className="text-slate-400 text-xs">Token #12 · Dr. Sharma · OPD</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-xs">Today</p>
              <p className="text-white text-sm font-mono">11:42 AM</p>
            </div>
          </div>
          {/* Step bar */}
          <div className="flex gap-1.5">
            {["Checklist", "Invoice", "Payment", "Done"].map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full transition-all ${i < stepIndex ? "bg-emerald-400" : i === stepIndex ? "bg-sky-400" : "bg-slate-700"}`} />
                <p className={`text-xs mt-1 font-medium ${i === stepIndex ? "text-sky-400" : i < stepIndex ? "text-emerald-400" : "text-slate-600"}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Step: Checklist */}
        {step === "checklist" && (
          <div className="px-6 py-5">
            <p className="text-sm text-slate-500 mb-4">Review before closing this visit.</p>
            <div className="space-y-3 mb-5">
              {checks.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${item.status === "warning" ? "border-amber-200 bg-amber-50" : item.status === "ok" ? "border-emerald-100 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}>
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>
                  </div>
                  {item.status === "warning" && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Pending</span>
                  )}
                </div>
              ))}
            </div>

            {/* Follow-up quick input */}
            {checks.find(c => c.id === "followup")?.status === "pending" && (
              <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Schedule Follow-up
                </p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={followupDate}
                    onChange={e => setFollowup(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <button
                    onClick={skipFollowup}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2"
                  >Skip</button>
                </div>
              </div>
            )}

            {checks.some(c => c.id === "investigation" && c.status === "warning") && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Investigation results are still pending. You can proceed — the radiographer will upload results separately.</span>
              </div>
            )}

            <button
              onClick={() => setStep("invoice")}
              disabled={hasBlockers}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${hasBlockers ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"}`}
            >
              Continue to Invoice <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Invoice */}
        {step === "invoice" && (
          <div className="px-6 py-5">
            <p className="text-sm text-slate-500 mb-4">Auto-generated from today's charges.</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
              <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice #INV-0042</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">Consultation Fee</span>
                  </div>
                  <span className="text-sm font-medium text-slate-800">₹{consultationFee}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">X-Ray (Chest PA)</span>
                  </div>
                  <span className="text-sm font-medium text-slate-800">₹{investigationFee}</span>
                </div>
              </div>
              <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-base font-bold text-white">₹{invoiceTotal}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("payment")}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Record Payment <ChevronRight className="w-4 h-4" />
              </button>
              <button className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-all">
                Edit
              </button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="px-6 py-5">
            <p className="text-sm text-slate-500 mb-4">Record payment for ₹{invoiceTotal}.</p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {["cash", "upi", "card"].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${paymentMode === mode ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Amount Received</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 bg-white focus-within:ring-2 focus-within:ring-sky-300">
                <IndianRupee className="w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 py-2.5 text-sm text-slate-800 font-medium focus:outline-none"
                />
                <button onClick={() => setAmount(String(invoiceTotal))} className="text-xs text-sky-600 font-medium hover:text-sky-700">Full</button>
              </div>
            </div>

            {paymentMode !== "cash" && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Transaction Reference</label>
                <input
                  type="text"
                  placeholder={paymentMode === "upi" ? "UPI transaction ID" : "Last 4 digits"}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            )}

            <div className="mb-5 flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">Send WhatsApp receipt</span>
              </div>
              <button
                onClick={() => setSendWhatsApp(!sendWhatsApp)}
                className={`relative w-10 h-5 rounded-full transition-colors ${sendWhatsApp ? "bg-green-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendWhatsApp ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <button
              onClick={() => { setPaid(true); setStep("done"); }}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Confirm Payment ₹{amount} <Check className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Visit Complete</h3>
            <p className="text-slate-500 text-sm mb-1">Ramesh Kumar · Token #12</p>
            <p className="text-emerald-600 text-sm font-medium mb-6">₹{amount} received · INV-0042 Paid</p>

            {sendWhatsApp && (
              <div className="w-full mb-6 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-left">
                <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Receipt sent via WhatsApp</p>
                  <p className="text-xs text-green-600">+91 98765 43210</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" />
              </div>
            )}

            {followupDate && (
              <div className="w-full mb-6 p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-3 text-left">
                <Calendar className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-sky-800">Follow-up scheduled</p>
                  <p className="text-xs text-sky-600">{followupDate}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => { setStep("checklist"); setChecks(prev => prev.map(c => ({ ...c, status: c.id === "notes" || c.id === "prescription" ? "ok" : "pending", sublabel: c.id === "notes" ? "Chief complaint & diagnosis saved" : c.id === "prescription" ? "1 prescription issued" : "Not set" }))); setFollowupDate(""); setPaid(false); setSendWhatsApp(true); setAmount("500"); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
              >
                Next Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
