import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, LayoutDashboard, Users, FileText, Settings } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function HierarchyVariant() {
  return (
    <div className="flex h-screen bg-neutral-100 font-sans text-neutral-900">
      {/* Sidebar */}
      <aside className="w-60 bg-neutral-900 text-neutral-300 flex flex-col shrink-0">
        <div className="p-6">
          <div className="text-white font-bold text-xl tracking-tight">ClinicOS</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium text-sm">Dashboard</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
            <Users className="w-5 h-5" />
            <span className="font-medium text-sm">Patients</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md bg-neutral-800 text-white transition-colors">
            <FileText className="w-5 h-5" />
            <span className="font-medium text-sm">Prescriptions</span>
          </a>
        </nav>
        <div className="p-4">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Settings</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-neutral-200 bg-white flex items-center justify-between px-8 shrink-0">
          <a href="#" className="text-neutral-500 hover:text-neutral-900 flex items-center gap-2 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Prescriptions
          </a>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            Print Prescription
          </Button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto bg-white shadow-sm border border-neutral-200 p-12 min-h-[800px]">
            {/* Prescription Document - Hierarchy Variant */}
            
            {/* Clinic Header */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-extrabold text-black tracking-tight mb-2">CHAUDHARI HOSPITAL</h1>
              <p className="text-neutral-600 text-sm leading-snug">
                Sham Prasad 1219 Lane No 4 Dhule<br />
                Tel: 02562 233258<br />
                Reg: DMC/BNA/SM-022
              </p>
            </div>

            <hr className="border-t-2 border-black mb-4" />

            {/* Document Meta */}
            <div className="text-right text-sm text-neutral-500 mb-8">
              <span className="font-medium">Date:</span> 27 May 2026<span className="mx-3">|</span><span className="font-medium">Rx No:</span> #10492
            </div>

            {/* Patient & Doctor Band */}
            <div className="flex justify-between items-start mb-12">
              <div>
                <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Patient</div>
                <div className="text-xl font-bold text-black mb-1">Neel</div>
                <div className="text-neutral-600 text-sm">Age 34, M</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Prescribing Doctor</div>
                <div className="text-xl font-bold text-black mb-1">Dr. Amit Prakash Chaudhari</div>
                <div className="text-neutral-600 text-sm">Reg. No: 2001021015</div>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="mb-10">
              <h2 className="text-xs font-bold text-black uppercase tracking-widest border-l-2 border-black pl-3 mb-4">Diagnosis</h2>
              <p className="text-lg font-medium pl-4">Knee Synovitis</p>
            </div>

            {/* Medications */}
            <div className="mb-10">
              <h2 className="text-xs font-bold text-black uppercase tracking-widest border-l-2 border-black pl-3 mb-4 flex items-center gap-2">
                <span className="text-2xl font-serif leading-none -mt-1">Rx</span> — Medications
              </h2>
              <div className="pl-4">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-neutral-300 hover:bg-transparent">
                      <TableHead className="w-1/3 text-neutral-900 font-semibold h-10 px-0">Drug Name</TableHead>
                      <TableHead className="text-neutral-500 font-medium h-10">Dosage</TableHead>
                      <TableHead className="text-neutral-500 font-medium h-10">Duration</TableHead>
                      <TableHead className="text-neutral-500 font-medium h-10">Instructions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b border-neutral-100 hover:bg-transparent">
                      <TableCell className="font-bold text-black px-0 py-4 align-top">Amoxicillin 500mg</TableCell>
                      <TableCell className="text-neutral-600 py-4 align-top">TDS (three times a day)</TableCell>
                      <TableCell className="text-neutral-600 py-4 align-top">7 days</TableCell>
                      <TableCell className="text-neutral-600 py-4 align-top">After food with water</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Advice & Follow-up */}
            <div className="mb-16 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Advice</h3>
                <p className="text-neutral-800">Do not squat & sit cross legged. Rest recommended for 2 weeks.</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Follow-up</h3>
                <p className="text-neutral-800 font-medium">10 June 2026</p>
              </div>
            </div>

            {/* Signature Block */}
            <div className="flex justify-end mt-20">
              <div className="w-64 text-center">
                <div className="border-t border-neutral-400 pt-3">
                  <div className="font-bold text-black">Dr. Amit Prakash Chaudhari</div>
                  <div className="text-sm text-neutral-500">Signature</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
