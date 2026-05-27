import React from "react";
import { 
  Printer, 
  Share2, 
  Download, 
  Copy, 
  Calendar, 
  User, 
  Stethoscope, 
  CheckCircle2, 
  ArrowLeft,
  LayoutDashboard,
  Users,
  FileText,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AffordanceVariant() {
  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white text-sm">C</span>
            ClinicOS
          </h1>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <Users size={18} /> Patients
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md bg-teal-500/10 text-teal-400 font-medium transition-colors">
            <FileText size={18} /> Prescriptions
          </a>
        </nav>
        <div className="p-4 mt-auto">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <Settings size={18} /> Settings
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Action Bar */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors px-3 py-1.5 rounded-full border border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Rx #2026-001</span>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </div>
        </header>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6 sm:p-8">
          <div className="max-w-3xl mx-auto">
            {/* Sticky Section Nav */}
            <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur pb-6 pt-2">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-white border border-slate-200 shadow-sm p-1 rounded-lg">
                  <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">Full View</TabsTrigger>
                  <TabsTrigger value="info" className="rounded-md data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">Patient Info</TabsTrigger>
                  <TabsTrigger value="meds" className="rounded-md data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">Medications</TabsTrigger>
                  <TabsTrigger value="advice" className="rounded-md data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">Advice</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Print Document Container */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              
              {/* Header */}
              <div className="border-b border-slate-100 p-8 text-center bg-slate-50/50">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Chaudhari Hospital</h2>
                <p className="text-slate-600 mt-1">Sham Prasad 1219 Lane No 4 Dhule</p>
                <div className="flex items-center justify-center gap-4 mt-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> 27 May 2026</span>
                  <span>•</span>
                  <span>Tel: 02562 233258</span>
                  <span>•</span>
                  <span>Reg: DMC/BNA/SM-022</span>
                </div>
              </div>

              <div className="p-8 space-y-10">
                
                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-6">
                  <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default group">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Patient</p>
                        <h3 className="font-bold text-lg text-slate-900">Neel</h3>
                        <p className="text-sm text-slate-600">Age 34, Male</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default group">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="bg-teal-50 text-teal-600 p-3 rounded-xl group-hover:bg-teal-100 transition-colors">
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Doctor</p>
                        <h3 className="font-bold text-lg text-slate-900">Dr. Amit Prakash Chaudhari</h3>
                        <p className="text-sm text-slate-600">Reg. No: 2001021015</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Diagnosis */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">1</span>
                    Diagnosis
                  </h4>
                  <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-slate-800 font-medium">
                    Knee Synovitis
                  </div>
                </div>

                {/* Medications */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">2</span>
                    Medications
                  </h4>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                          <th className="py-3 px-4">Medicine</th>
                          <th className="py-3 px-4">Frequency</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="group hover:bg-blue-50/50 transition-colors cursor-pointer border-b last:border-0 border-slate-100">
                          <td className="py-4 px-4 font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                            Amoxicillin 500mg
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold border-0">
                              TDS
                            </Badge>
                            <span className="text-xs text-slate-500 ml-2">(3x / day)</span>
                          </td>
                          <td className="py-4 px-4 font-medium text-slate-700">7 days</td>
                          <td className="py-4 px-4 text-slate-600 text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                            After food with water
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Advice */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">3</span>
                    Advice & Instructions
                  </h4>
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-lg shadow-sm">
                    <p className="text-amber-900 font-medium">
                      Do not squat & sit cross legged. Rest recommended for 2 weeks.
                    </p>
                  </div>
                </div>

                {/* Footer / Follow-up / Signature */}
                <div className="flex items-end justify-between pt-8 border-t border-slate-100 mt-12">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next Follow-up</p>
                    <button className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors px-4 py-2 rounded-lg font-semibold shadow-sm">
                      <Calendar className="w-4 h-4" />
                      10 June 2026
                    </button>
                  </div>
                  
                  <div className="text-right">
                    <div className="w-48 h-16 bg-slate-50 border border-slate-200 rounded mb-2 flex flex-col items-center justify-center relative group cursor-pointer hover:border-teal-300 transition-colors">
                      <span className="font-writing text-2xl text-slate-800 opacity-60 italic">Signature</span>
                      
                      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                        <span className="text-xs font-bold text-teal-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verify Signature
                        </span>
                      </div>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Dr. Amit P. Chaudhari</p>
                    <a href="#" className="text-xs text-teal-600 hover:text-teal-800 font-medium inline-flex items-center gap-1 mt-1 underline decoration-teal-200 underline-offset-2">
                      <Download className="w-3 h-3" /> Download Signed Copy
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
