import React from "react";
import { ArrowLeft, Printer, LayoutDashboard, Users, FileText, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessibilityVariant() {
  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      {/* Sidebar */}
      <aside className="w-[240px] bg-slate-900 text-white flex-shrink-0 border-r border-slate-800">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-8">ClinicOS</h1>
          <nav className="space-y-2" aria-label="Main Navigation">
            <a href="#" className="flex items-center gap-3 px-3 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-500 outline-none transition-colors">
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
              Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-500 outline-none transition-colors">
              <Users className="h-5 w-5" aria-hidden="true" />
              Patients
            </a>
            <a href="#" aria-current="page" className="flex items-center gap-3 px-3 py-3 rounded-md text-base text-white bg-blue-700 font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-500 outline-none transition-colors">
              <FileText className="h-5 w-5" aria-hidden="true" />
              Prescriptions
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-3 rounded-md text-base text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-500 outline-none transition-colors">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Settings
            </a>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-auto">
        {/* Top Action Bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <a href="#" className="inline-flex items-center gap-2 text-base font-medium text-blue-700 hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none rounded-md px-2 py-1 -ml-2 transition-colors">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back to Prescriptions
          </a>
          <Button size="lg" className="text-base font-semibold px-6 h-12 bg-blue-700 hover:bg-blue-800 text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none">
            <Printer className="h-5 w-5 mr-2" aria-hidden="true" />
            Print Prescription
          </Button>
        </header>

        {/* Prescription Document */}
        <div className="flex-1 p-8 overflow-y-auto">
          <article className="max-w-2xl mx-auto bg-white border border-gray-300 shadow-sm rounded-lg overflow-hidden">
            {/* Header section */}
            <header className="p-8 border-b border-gray-300 bg-gray-50 flex flex-col gap-4">
              <div className="flex justify-between items-start gap-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Chaudhari Hospital</h2>
                  <address className="text-lg text-gray-800 not-italic leading-relaxed">
                    Sham Prasad 1219 Lane No 4 Dhule<br />
                    <span className="font-semibold">Tel:</span> 02562 233258<br />
                    <span className="font-semibold">Reg:</span> DMC/BNA/SM-022
                  </address>
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Date</h3>
                  <p className="text-xl text-gray-800">27 May 2026</p>
                </div>
              </div>
            </header>

            {/* Doctor & Patient Info */}
            <section className="p-8 border-b border-gray-300" aria-labelledby="people-info-heading">
              <h2 id="people-info-heading" className="sr-only">Doctor and Patient Information</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 border-b-2 border-blue-700 inline-block pb-1">Doctor</h3>
                  <p className="text-xl font-semibold text-gray-900">Dr. Amit Prakash Chaudhari</p>
                  <p className="text-lg text-gray-800 mt-1">Reg. No: 2001021015</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 border-b-2 border-blue-700 inline-block pb-1">Patient</h3>
                  <p className="text-xl font-semibold text-gray-900">Neel</p>
                  <p className="text-lg text-gray-800 mt-1">Age: 34 • Gender: Male</p>
                </div>
              </div>
            </section>

            {/* Clinical Info */}
            <section className="p-8 pb-4" aria-labelledby="diagnosis-heading">
              <h2 id="diagnosis-heading" className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="h-6 w-6 text-blue-700" aria-hidden="true" />
                Diagnosis
              </h2>
              <p className="text-xl text-gray-900 bg-gray-100 p-4 rounded-md border border-gray-300 leading-relaxed font-medium">
                Knee Synovitis
              </p>
            </section>

            {/* Medications */}
            <section className="p-8 pt-4 pb-4" aria-labelledby="medications-heading">
              <h2 id="medications-heading" className="text-2xl font-bold text-gray-900 mb-6">Prescribed Medications</h2>
              <div className="overflow-x-auto focus-within:ring-2 focus-within:ring-blue-500 rounded-md">
                <table className="w-full text-left border-collapse border border-gray-300">
                  <caption className="sr-only">List of prescribed medications and instructions</caption>
                  <thead className="bg-gray-100 border-b-2 border-gray-400">
                    <tr>
                      <th scope="col" className="p-4 text-lg font-bold text-gray-900 border-r border-gray-300">Medicine Name</th>
                      <th scope="col" className="p-4 text-lg font-bold text-gray-900 border-r border-gray-300">Dosage</th>
                      <th scope="col" className="p-4 text-lg font-bold text-gray-900 border-r border-gray-300">Duration</th>
                      <th scope="col" className="p-4 text-lg font-bold text-gray-900">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    <tr>
                      <td className="p-4 text-lg text-gray-900 font-semibold border-r border-gray-300">Amoxicillin 500mg</td>
                      <td className="p-4 text-lg text-gray-800 border-r border-gray-300">TDS (Three times a day)</td>
                      <td className="p-4 text-lg text-gray-800 border-r border-gray-300">7 days</td>
                      <td className="p-4 text-lg text-gray-800">After food with water</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Advice */}
            <section className="p-8 pt-4" aria-labelledby="advice-heading">
              <div className="bg-blue-50 border-l-4 border-blue-700 p-6 rounded-r-md">
                <h2 id="advice-heading" className="text-xl font-bold text-gray-900 mb-3">Advice / Instructions</h2>
                <ul className="list-disc pl-6 space-y-2 text-lg text-gray-900 leading-relaxed">
                  <li>Do not squat & sit cross legged.</li>
                  <li>Rest recommended for 2 weeks.</li>
                </ul>
              </div>
            </section>

            {/* Footer */}
            <footer className="p-8 bg-gray-50 border-t border-gray-300 flex justify-between items-center mt-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Follow-up Date</h2>
                <p className="text-xl font-medium text-gray-900">10 June 2026</p>
              </div>
              <div className="text-right">
                <div className="h-16 w-48 border-b-2 border-gray-400 mb-2 border-dashed"></div>
                <p className="text-lg font-bold text-gray-900">Doctor's Signature</p>
              </div>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
