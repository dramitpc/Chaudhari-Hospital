import { useState } from "react";
import { FilePlus, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const certs = [
  { id: "1", patient: "Test 2", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: "06/04/2026 – 12/11/2026" },
  { id: "2", patient: "Yogesh Anandkar", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: null },
  { id: "3", patient: "Amit Prakash Chaudhari", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: null },
  { id: "4", patient: "Priyanka", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: "11/06/2026 – 18/06/2026" },
];

const TYPE_LABEL: Record<string, string> = {
  sick_leave: "Sick Leave", fitness: "Fitness", medical: "Medical",
  procedure: "Procedure", vaccination: "Vaccination",
};
const TYPE_COLOR: Record<string, string> = {
  sick_leave: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  fitness: "bg-green-50 text-green-700 ring-1 ring-green-200",
  medical: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
};

export function Hierarchy() {
  const [date, setDate] = useState("11 Jun 2026");
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Page header — two-level hierarchy */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            {/* Breadcrumb-style context */}
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Administration · Certificates</p>
            <h1 className="text-2xl font-bold text-gray-900">Medical Certificates</h1>
            {/* Subtitle carries secondary count info — deemphasised */}
            <p className="text-sm text-gray-500 mt-0.5">4 certificates issued on <span className="font-medium text-gray-700">{date}</span></p>
          </div>
          {/* Primary CTA — visually dominant */}
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors">
            <FilePlus className="h-4 w-4" />
            Issue Certificate
          </button>
        </div>

        {/* Date navigation — grouped as a navigation control, not floating */}
        <div className="flex items-center gap-2 mt-4">
          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <span className="text-sm font-semibold text-blue-700">11 Jun 2026</span>
            <span className="text-xs text-blue-400 bg-blue-100 rounded px-1.5 py-0.5 font-medium">Today</span>
          </div>
          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table — clear column hierarchy */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {/* Column header weight communicates hierarchy */}
                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-[30%]">Patient</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-[25%]">Issuing Doctor</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-[14%]">Type</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-[14%]">Issued</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-4 py-3.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {certs.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                  {/* Patient — primary data, heaviest weight */}
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900 text-sm">{c.patient}</span>
                  </td>
                  {/* Doctor — secondary, muted */}
                  <td className="px-4 py-4">
                    <span className="text-gray-500 text-sm">{c.doctor}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[c.type] ?? "bg-gray-100 text-gray-700"}`}>
                      {TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-mono text-gray-700">{c.issued}</td>
                  <td className="px-4 py-4">
                    {c.period
                      ? <span className="text-xs text-gray-600 font-medium bg-gray-100 rounded px-2 py-1">{c.period}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-blue-500 hover:text-blue-700 font-medium text-xs flex items-center gap-1 ml-auto">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer hierarchy: count is tertiary info */}
        <p className="text-xs text-gray-400 mt-3 text-right">Showing 4 of 4 certificates</p>
      </div>
    </div>
  );
}
