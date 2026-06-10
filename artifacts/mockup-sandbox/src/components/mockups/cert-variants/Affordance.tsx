import { useState } from "react";
import { FilePlus, ChevronLeft, ChevronRight, Eye, Printer, Calendar } from "lucide-react";

const certs = [
  { id: "1", patient: "Test 2", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: "06/04/2026 – 12/11/2026" },
  { id: "2", patient: "Yogesh Anandkar", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: null },
  { id: "3", patient: "Amit Prakash Chaudhari", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: null },
  { id: "4", patient: "Priyanka", doctor: "Amit Prakash Chaudhari", type: "sick_leave", issued: "11/06/2026", period: "11/06/2026 – 18/06/2026" },
];

const TYPES = ["All types", "Sick Leave", "Fitness", "Medical", "Procedure", "Vaccination"];
const DATES = ["Yesterday", "Today", "Custom"];

const TYPE_COLOR: Record<string, string> = {
  sick_leave: "bg-amber-100 text-amber-700",
  fitness: "bg-green-100 text-green-700",
  medical: "bg-blue-100 text-blue-700",
};
const TYPE_LABEL: Record<string, string> = {
  sick_leave: "Sick Leave", fitness: "Fitness", medical: "Medical",
};

export function Affordance() {
  const [activeDate, setActiveDate] = useState("Today");
  const [activeType, setActiveType] = useState("All types");
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans">
      {/* Top bar with high-affordance CTA */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medical Certificates</h1>
          <p className="text-xs text-gray-500 mt-0.5">4 certificates</p>
        </div>
        {/* Large, pill-shaped CTA with explicit label — high affordance */}
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold px-6 py-3 rounded-full shadow-md shadow-blue-200 transition-all hover:shadow-lg hover:shadow-blue-200">
          <FilePlus className="h-4 w-4" />
          Issue Certificate
        </button>
      </div>

      {/* Filter toolbar — segmented controls make affordance explicit */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        {/* Date segmented control */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Calendar className="h-3.5 w-3.5 text-gray-400 ml-1" />
          {DATES.map(d => (
            <button
              key={d}
              onClick={() => setActiveDate(d)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                activeDate === d
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Type filter as pill buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
                activeType === t
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table — row actions revealed on hover (high affordance, low noise) */}
      <div className="px-6 py-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Doctor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Issued Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Period</th>
                {/* Action column with clear header label */}
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(c => (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{c.patient}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.doctor}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLOR[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 tabular-nums">{c.issued}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.period ?? <span className="text-gray-300">—</span>}</td>
                  {/* Actions: always-visible View + hover-revealed Print */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className={`flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-all ${hovered === c.id ? "opacity-100" : "opacity-0"}`}
                        title="Print"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
