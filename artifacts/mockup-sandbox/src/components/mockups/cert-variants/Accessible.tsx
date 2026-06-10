import { useState } from "react";
import { FilePlus, ChevronLeft, ChevronRight, FileText } from "lucide-react";

const certs = [
  { id: "1", patient: "Test 2", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11 Jun 2026", period: "06 Apr 2026 to 12 Nov 2026" },
  { id: "2", patient: "Yogesh Anandkar", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11 Jun 2026", period: null },
  { id: "3", patient: "Amit Prakash Chaudhari", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11 Jun 2026", period: null },
  { id: "4", patient: "Priyanka", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11 Jun 2026", period: "11 Jun 2026 to 18 Jun 2026" },
];

const TYPE_LABEL: Record<string, string> = {
  sick_leave: "Sick Leave", fitness: "Fitness", medical: "Medical",
  procedure: "Procedure", vaccination: "Vaccination",
};
// High-contrast colors — WCAG AA compliant combinations
const TYPE_COLOR: Record<string, string> = {
  sick_leave: "bg-amber-100 text-amber-900 border border-amber-300",
  fitness: "bg-green-100 text-green-900 border border-green-300",
  medical: "bg-blue-100 text-blue-900 border border-blue-300",
};

export function Accessible() {
  const [date] = useState("11 Jun 2026");

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header — large target areas, strong contrast */}
      <div className="border-b-2 border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-950 leading-tight">Medical Certificates</h1>
            {/* Accessible count — not just colour */}
            <p className="text-base text-gray-600 mt-1">
              <strong className="text-gray-900">4</strong> certificates — {date}
            </p>
          </div>
          {/* Button: large tap target (min 44px height), strong contrast, text + icon */}
          <button
            className="flex items-center gap-2.5 bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Issue a new medical certificate"
          >
            <FilePlus className="h-5 w-5 shrink-0" aria-hidden="true" />
            Issue Certificate
          </button>
        </div>

        {/* Date navigation — large targets, label always visible */}
        <nav aria-label="Navigate by date" className="flex items-center gap-3 mt-5">
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-300 text-gray-700 font-medium text-sm transition-colors min-h-[44px]"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          {/* Date displayed as full text — no ambiguous dd/mm/yy */}
          <div className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-50 border-2 border-blue-400 min-h-[44px]">
            <span className="font-bold text-blue-900 text-sm">11 June 2026</span>
            <span className="text-xs font-bold text-white bg-blue-600 rounded-full px-2 py-0.5">Today</span>
          </div>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-300 text-gray-700 font-medium text-sm transition-colors min-h-[44px]"
            aria-label="Next day"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>

      {/* Table — generous row height, readable font size, high contrast */}
      <div className="px-8 py-6">
        <div className="rounded-xl border-2 border-gray-200 overflow-hidden">
          <table className="w-full text-sm" role="table" aria-label="Certificate list">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-200">
                {/* Header text in sentence case — easier to read than ALL CAPS */}
                <th scope="col" className="text-left px-5 py-4 text-sm font-bold text-gray-800">Patient</th>
                <th scope="col" className="text-left px-4 py-4 text-sm font-bold text-gray-800">Issuing doctor</th>
                <th scope="col" className="text-left px-4 py-4 text-sm font-bold text-gray-800">Certificate type</th>
                <th scope="col" className="text-left px-4 py-4 text-sm font-bold text-gray-800">Date issued</th>
                <th scope="col" className="text-left px-4 py-4 text-sm font-bold text-gray-800">Rest period</th>
                <th scope="col" className="px-5 py-4 text-sm font-bold text-gray-800 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {certs.map((c, i) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  className="hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-colors"
                  aria-label={`${c.patient}, ${TYPE_LABEL[c.type]}, issued ${c.issued}`}
                >
                  {/* Large text, strong contrast for patient name */}
                  <td className="px-5 py-4">
                    <span className="font-bold text-gray-950 text-sm">{c.patient}</span>
                  </td>
                  <td className="px-4 py-4 text-gray-700 text-sm">{c.doctor}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${TYPE_COLOR[c.type] ?? "bg-gray-100 text-gray-800 border border-gray-300"}`}>
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </td>
                  {/* Full date format — no ambiguity between dd/mm/yy and mm/dd/yy */}
                  <td className="px-4 py-4 text-gray-800 text-sm font-medium">{c.issued}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {c.period ?? <span className="text-gray-400" aria-label="No rest period">Not applicable</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {/* Button: labelled, large target, focus ring */}
                    <button
                      className="flex items-center gap-1.5 ml-auto text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300 border-2 border-blue-300 hover:border-blue-500 px-4 py-2 rounded-lg transition-all min-h-[36px]"
                      aria-label={`View certificate for ${c.patient}`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer — accessible summary */}
        <p className="text-sm text-gray-600 mt-4" aria-live="polite" aria-atomic="true">
          Showing <strong>4</strong> certificates for 11 June 2026.
        </p>
      </div>
    </div>
  );
}
