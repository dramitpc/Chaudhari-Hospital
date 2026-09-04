import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";
import type {
  ClinicSettings,
  Consultation,
  Invoice,
  InvoicePayment,
  Patient,
  Prescription,
} from "@workspace/api-client-react";
import { calcAge, fmtDate } from "@/lib/dateUtils";

import latinRegular from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url";
import latinBold from "@fontsource/noto-sans/files/noto-sans-latin-600-normal.woff?url";
import devanagari from "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff?url";
import gujarati from "@fontsource/noto-sans-gujarati/files/noto-sans-gujarati-gujarati-400-normal.woff?url";
import tamil from "@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff?url";
import telugu from "@fontsource/noto-sans-telugu/files/noto-sans-telugu-telugu-400-normal.woff?url";
import kannada from "@fontsource/noto-sans-kannada/files/noto-sans-kannada-kannada-400-normal.woff?url";
import bengali from "@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff?url";
import gurmukhi from "@fontsource/noto-sans-gurmukhi/files/noto-sans-gurmukhi-gurmukhi-400-normal.woff?url";

const BRAND = "#1e3a5f";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const LIGHT = "#f8fafc";
const TRANSLATED = "#1d4ed8";

const fonts: TFontDictionary = {
  NotoSans: { normal: "NotoSans.woff", bold: "NotoSansBold.woff", italics: "NotoSans.woff", bolditalics: "NotoSansBold.woff" },
  Devanagari: { normal: "Devanagari.woff", bold: "Devanagari.woff", italics: "Devanagari.woff", bolditalics: "Devanagari.woff" },
  Gujarati: { normal: "Gujarati.woff", bold: "Gujarati.woff", italics: "Gujarati.woff", bolditalics: "Gujarati.woff" },
  Tamil: { normal: "Tamil.woff", bold: "Tamil.woff", italics: "Tamil.woff", bolditalics: "Tamil.woff" },
  Telugu: { normal: "Telugu.woff", bold: "Telugu.woff", italics: "Telugu.woff", bolditalics: "Telugu.woff" },
  Kannada: { normal: "Kannada.woff", bold: "Kannada.woff", italics: "Kannada.woff", bolditalics: "Kannada.woff" },
  Bengali: { normal: "Bengali.woff", bold: "Bengali.woff", italics: "Bengali.woff", bolditalics: "Bengali.woff" },
  Gurmukhi: { normal: "Gurmukhi.woff", bold: "Gurmukhi.woff", italics: "Gurmukhi.woff", bolditalics: "Gurmukhi.woff" },
};

const fontAssets: Record<string, string> = {
  "NotoSans.woff": latinRegular,
  "NotoSansBold.woff": latinBold,
  "Devanagari.woff": devanagari,
  "Gujarati.woff": gujarati,
  "Tamil.woff": tamil,
  "Telugu.woff": telugu,
  "Kannada.woff": kannada,
  "Bengali.woff": bengali,
  "Gurmukhi.woff": gurmukhi,
};

let fontVfsPromise: Promise<Record<string, string>> | null = null;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function loadFontVfs(): Promise<Record<string, string>> {
  if (!fontVfsPromise) {
    fontVfsPromise = Promise.all(
      Object.entries(fontAssets).map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Unable to load PDF font: ${name}`);
        return [name, bufferToBase64(await response.arrayBuffer())] as const;
      }),
    ).then(entries => Object.fromEntries(entries));
  }
  return fontVfsPromise;
}

const FONT_BY_LANGUAGE: Record<string, string> = {
  hi: "Devanagari", mr: "Devanagari", gu: "Gujarati", ta: "Tamil",
  te: "Telugu", kn: "Kannada", bn: "Bengali", pa: "Gurmukhi",
};

type PrescriptionItem = {
  drugName: string;
  genericName?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
};

export type PrescriptionTranslation = {
  language: string;
  languageName?: string;
  advice?: string | null;
  notes?: string | null;
  items?: PrescriptionItem[];
};

export type PrescriptionPdfFormat = {
  showDiagnosis: boolean;
  showSoap: boolean;
  showInvestigations: boolean;
  showAdvice: boolean;
  showFollowUp: boolean;
  showReferenceTo: boolean;
  showGenericName: boolean;
  showInstructions: boolean;
  drugStyle: "table" | "list";
  headerAlign: "left" | "center";
  paperSize: "a4" | "a5" | "letter";
  fontSize: "sm" | "md" | "lg";
  displayMode: "english" | "translated" | "bilingual";
};

export type PrescriptionPdfInput = {
  prescription: Prescription;
  patient?: Patient;
  consultation?: Consultation;
  settings?: ClinicSettings;
  format: PrescriptionPdfFormat;
  translation?: PrescriptionTranslation | null;
};

export type ReceiptPdfInput = {
  invoice: Invoice;
  patient?: Patient;
  payments?: InvoicePayment[];
  settings?: ClinicSettings;
  language?: string | null;
};

const LABELS: Record<string, Record<string, string>> = {
  hi: { receipt: "भुगतान रसीद", invoice: "चालान", patient: "रोगी", patientId: "रोगी आईडी", date: "दिनांक", doctor: "डॉक्टर", status: "स्थिति", paymentMode: "भुगतान माध्यम", description: "विवरण", qty: "मात्रा", unitPrice: "इकाई मूल्य", amount: "राशि", subtotal: "उप-योग", discount: "छूट", tax: "कर", total: "कुल", paid: "भुगतान", balance: "शेष", paymentHistory: "भुगतान इतिहास", thanks: "हमारे यहाँ आने के लिए धन्यवाद।", advice: "सलाह", medications: "दवाइयाँ" },
  mr: { receipt: "पेमेंट पावती", invoice: "चलन", patient: "रुग्ण", patientId: "रुग्ण आयडी", date: "दिनांक", doctor: "डॉक्टर", status: "स्थिती", paymentMode: "पेमेंट पद्धत", description: "तपशील", qty: "प्रमाण", unitPrice: "एकक किंमत", amount: "रक्कम", subtotal: "उपएकूण", discount: "सवलत", tax: "कर", total: "एकूण", paid: "भरले", balance: "बाकी", paymentHistory: "पेमेंट इतिहास", thanks: "आमच्याकडे आल्याबद्दल धन्यवाद.", advice: "सल्ला", medications: "औषधे" },
  gu: { receipt: "ચુકવણી રસીદ", invoice: "ચલણ", patient: "દર્દી", patientId: "દર્દી આઈડી", date: "તારીખ", doctor: "ડૉક્ટર", status: "સ્થિતિ", paymentMode: "ચુકવણી રીત", description: "વિગત", qty: "જથ્થો", unitPrice: "એકમ ભાવ", amount: "રકમ", subtotal: "પેટા કુલ", discount: "ડિસ્કાઉન્ટ", tax: "કર", total: "કુલ", paid: "ચૂકવેલ", balance: "બાકી", paymentHistory: "ચુકવણી ઇતિહાસ", thanks: "અમારી મુલાકાત બદલ આભાર.", advice: "સલાહ", medications: "દવાઓ" },
  ta: { receipt: "பணம் செலுத்திய ரசீது", invoice: "விலைப்பட்டியல்", patient: "நோயாளி", patientId: "நோயாளி ஐடி", date: "தேதி", doctor: "மருத்துவர்", status: "நிலை", paymentMode: "பணம் செலுத்தும் முறை", description: "விவரம்", qty: "அளவு", unitPrice: "அலகு விலை", amount: "தொகை", subtotal: "கூட்டுத்தொகை", discount: "தள்ளுபடி", tax: "வரி", total: "மொத்தம்", paid: "செலுத்தியது", balance: "மீதம்", paymentHistory: "பணம் செலுத்திய வரலாறு", thanks: "எங்களை நாடியதற்கு நன்றி.", advice: "ஆலோசனை", medications: "மருந்துகள்" },
  te: { receipt: "చెల్లింపు రసీదు", invoice: "ఇన్వాయిస్", patient: "రోగి", patientId: "రోగి ఐడి", date: "తేదీ", doctor: "వైద్యుడు", status: "స్థితి", paymentMode: "చెల్లింపు విధానం", description: "వివరణ", qty: "పరిమాణం", unitPrice: "యూనిట్ ధర", amount: "మొత్తం", subtotal: "ఉప మొత్తం", discount: "తగ్గింపు", tax: "పన్ను", total: "మొత్తం", paid: "చెల్లించినది", balance: "బాకీ", paymentHistory: "చెల్లింపు చరిత్ర", thanks: "మమ్మల్ని సందర్శించినందుకు ధన్యవాదాలు.", advice: "సలహా", medications: "మందులు" },
  kn: { receipt: "ಪಾವತಿ ರಸೀದಿ", invoice: "ಸರಕುಪಟ್ಟಿ", patient: "ರೋಗಿ", patientId: "ರೋಗಿ ಐಡಿ", date: "ದಿನಾಂಕ", doctor: "ವೈದ್ಯರು", status: "ಸ್ಥಿತಿ", paymentMode: "ಪಾವತಿ ವಿಧಾನ", description: "ವಿವರಣೆ", qty: "ಪ್ರಮಾಣ", unitPrice: "ಘಟಕ ಬೆಲೆ", amount: "ಮೊತ್ತ", subtotal: "ಉಪಮೊತ್ತ", discount: "ರಿಯಾಯಿತಿ", tax: "ತೆರಿಗೆ", total: "ಒಟ್ಟು", paid: "ಪಾವತಿಸಿದೆ", balance: "ಬಾಕಿ", paymentHistory: "ಪಾವತಿ ಇತಿಹಾಸ", thanks: "ನಮ್ಮನ್ನು ಭೇಟಿ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.", advice: "ಸಲಹೆ", medications: "ಔಷಧಿಗಳು" },
  bn: { receipt: "পেমেন্ট রসিদ", invoice: "চালান", patient: "রোগী", patientId: "রোগী আইডি", date: "তারিখ", doctor: "ডাক্তার", status: "অবস্থা", paymentMode: "পেমেন্ট পদ্ধতি", description: "বিবরণ", qty: "পরিমাণ", unitPrice: "একক মূল্য", amount: "টাকা", subtotal: "উপমোট", discount: "ছাড়", tax: "কর", total: "মোট", paid: "পরিশোধিত", balance: "বাকি", paymentHistory: "পেমেন্ট ইতিহাস", thanks: "আমাদের কাছে আসার জন্য ধন্যবাদ।", advice: "পরামর্শ", medications: "ওষুধ" },
  pa: { receipt: "ਭੁਗਤਾਨ ਰਸੀਦ", invoice: "ਚਲਾਨ", patient: "ਮਰੀਜ਼", patientId: "ਮਰੀਜ਼ ਆਈਡੀ", date: "ਮਿਤੀ", doctor: "ਡਾਕਟਰ", status: "ਸਥਿਤੀ", paymentMode: "ਭੁਗਤਾਨ ਢੰਗ", description: "ਵੇਰਵਾ", qty: "ਮਾਤਰਾ", unitPrice: "ਇਕਾਈ ਕੀਮਤ", amount: "ਰਕਮ", subtotal: "ਉਪ-ਕੁੱਲ", discount: "ਛੋਟ", tax: "ਟੈਕਸ", total: "ਕੁੱਲ", paid: "ਭੁਗਤਾਨ", balance: "ਬਕਾਇਆ", paymentHistory: "ਭੁਗਤਾਨ ਇਤਿਹਾਸ", thanks: "ਸਾਡੇ ਕੋਲ ਆਉਣ ਲਈ ਧੰਨਵਾਦ।", advice: "ਸਲਾਹ", medications: "ਦਵਾਈਆਂ" },
};

const EN = { receipt: "PAYMENT RECEIPT", invoice: "INVOICE", patient: "Patient", patientId: "Patient ID", date: "Date", doctor: "Doctor", status: "Status", paymentMode: "Payment Mode", description: "Description", qty: "Qty", unitPrice: "Unit Price", amount: "Amount", subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total", paid: "Paid", balance: "Balance", paymentHistory: "Payment History", thanks: "Thank you for visiting us.", advice: "Advice", medications: "Rx — Medications" };

function textLabel(key: keyof typeof EN, lang: string, bilingual = true): Content {
  const translated = LABELS[lang]?.[key];
  if (!translated) return { text: EN[key] };
  return {
    text: bilingual
      ? [
          { text: EN[key], font: "NotoSans" },
          { text: " / ", font: "NotoSans" },
          { text: translated, font: FONT_BY_LANGUAGE[lang], color: TRANSLATED },
        ]
      : translated,
    font: bilingual ? undefined : FONT_BY_LANGUAGE[lang],
  };
}

async function render(definition: TDocumentDefinitions): Promise<Blob> {
  const vfs = await loadFontVfs();
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(definition, undefined, fonts, vfs).getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function commonDefinition(content: Content[], title: string, baseSize: number, fit: number): TDocumentDefinitions {
  const marginX = Math.round(34 * fit);
  const marginTop = Math.round(30 * fit);
  const marginBottom = Math.round(34 * fit);
  return {
    info: { title, creator: "ClinicOS" },
    pageSize: "A4",
    pageMargins: [marginX, marginTop, marginX, marginBottom],
    defaultStyle: { font: "NotoSans", fontSize: baseSize * fit, color: "#0f172a", lineHeight: 1.08 },
    styles: {
      clinic: { fontSize: 18 * fit, bold: true, color: BRAND },
      doctor: { fontSize: 11 * fit, bold: true, alignment: "right" },
      section: { fontSize: 7.5 * fit, bold: true, color: MUTED, characterSpacing: 0.5, margin: [0, 0, 0, 3 * fit] },
    },
    content,
    footer: (current, total) => ({
      columns: [{ text: "Generated by ClinicOS", color: MUTED }, { text: `Page ${current} of ${total}`, alignment: "right", color: MUTED }],
      font: "NotoSans", fontSize: 7 * fit, margin: [marginX, 6 * fit, marginX, 0],
    }),
  };
}

function letterhead(
  settings: ClinicSettings | undefined,
  doctorName: string | null | undefined,
  specialization: string | null | undefined = null,
  align: "left" | "center" = "center",
  fit = 1,
): Content {
  const clinicStack: Content[] = [
    { text: settings?.clinicName ?? "Hospital", style: "clinic", alignment: align },
    ...(settings?.address ? [{ text: settings.address, color: MUTED, alignment: align } as Content] : []),
    ...(settings?.phone ? [{ text: `Tel: ${settings.phone}`, color: MUTED, alignment: align } as Content] : []),
    ...(settings?.email ? [{ text: settings.email, color: MUTED, alignment: align } as Content] : []),
    ...(settings?.website ? [{ text: settings.website, color: MUTED, alignment: align } as Content] : []),
    ...(settings?.registrationNumber ? [{ text: `Reg: ${settings.registrationNumber}`, color: MUTED, fontSize: 7 * fit, alignment: align } as Content] : []),
  ];
  return {
    table: {
      widths: ["*", "*"],
      body: [[
        { stack: clinicStack, border: [false, false, false, true], borderColor: [BRAND, BRAND, BRAND, BRAND], margin: [0, 0, 0, 8 * fit] },
        { stack: [{ text: doctorName ?? "", style: "doctor" }, ...(specialization ? [{ text: specialization, color: MUTED, alignment: "right" } as Content] : [])], border: [false, false, false, true], borderColor: [BRAND, BRAND, BRAND, BRAND], margin: [0, 0, 0, 8 * fit] },
      ]],
    },
    layout: { hLineWidth: () => 1.5, hLineColor: () => BRAND, vLineWidth: () => 0 },
    margin: [0, 0, 0, 12 * fit],
  };
}

function section(label: string | Content, value: string | null | undefined, font = "NotoSans", color?: string, fit = 1): Content[] {
  if (!value?.trim()) return [];
  return [
    { text: label, style: "section", margin: [0, 0, 0, 2 * fit] },
    { text: value, font, color, margin: [0, 0, 0, 8 * fit], preserveLeadingSpaces: true },
  ];
}

function prescriptionItems(input: PrescriptionPdfInput, translatedFont: string, fit: number): Content {
  const { prescription, format, translation } = input;
  const original = prescription.items as PrescriptionItem[];
  const translated = translation?.items ?? [];
  const hasTranslation = Boolean(translation?.language && translation.language !== "en");
  const showEn = format.displayMode !== "translated" || !hasTranslation;
  const bilingual = format.displayMode === "bilingual" && hasTranslation;
  const display = format.displayMode === "translated" && hasTranslation ? translated : original;

  const cell = (english: string | null | undefined, translatedText: string | null | undefined): Content => {
    if (bilingual && translatedText && translatedText !== english) {
      return { stack: [{ text: english || "—" }, { text: translatedText, font: translatedFont, color: TRANSLATED, margin: [0, 2 * fit, 0, 0] }] };
    }
    return { text: showEn ? (english || "—") : (translatedText || english || "—"), font: showEn ? "NotoSans" : translatedFont };
  };

  if (format.drugStyle === "list") {
    return {
      ol: original.map((item, index) => {
        const tr = translated[index];
        const selected = display[index] ?? item;
        const lines: Content[] = [
          { text: [{ text: item.drugName, bold: true }, ...(format.showGenericName && item.genericName ? [{ text: ` (${item.genericName})`, color: MUTED, fontSize: 7 * fit }] : [])] },
          cell(`${item.dosage}, ${item.frequency}, ${item.duration}`, `${tr?.dosage ?? selected.dosage}, ${tr?.frequency ?? selected.frequency}, ${tr?.duration ?? selected.duration}`),
        ];
        if (format.showInstructions && (item.instructions || tr?.instructions)) lines.push(cell(item.instructions, tr?.instructions));
        return { stack: lines, margin: [0, 0, 0, 5 * fit] };
      }),
      margin: [12 * fit, 0, 0, 8 * fit],
    };
  }

  const headers = ["#", "Drug Name", "Dosage", "Frequency", "Duration", ...(format.showInstructions ? ["Instructions"] : [])];
  const rows = original.map((item, index) => {
    const tr = translated[index];
    return [
      String(index + 1),
      { text: [{ text: item.drugName, bold: true }, ...(format.showGenericName && item.genericName ? [{ text: `\n(${item.genericName})`, color: MUTED, fontSize: 7 * fit }] : [])] },
      cell(item.dosage, tr?.dosage),
      cell(item.frequency, tr?.frequency),
      cell(item.duration, tr?.duration),
      ...(format.showInstructions ? [cell(item.instructions, tr?.instructions)] : []),
    ];
  });
  return {
    table: {
      headerRows: 1,
      widths: format.showInstructions ? [18, "*", 50, 58, 50, "*"] : [18, "*", 54, 60, 54],
      body: [headers.map(value => ({ text: value, bold: true, fontSize: 7.5 * fit, fillColor: LIGHT })), ...rows],
      dontBreakRows: true,
    },
    layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, paddingLeft: () => 6 * fit, paddingRight: () => 6 * fit, paddingTop: () => 4 * fit, paddingBottom: () => 4 * fit },
    margin: [0, 0, 0, 10 * fit],
  };
}

function prescriptionFit(input: PrescriptionPdfInput): number {
  const { prescription, patient, consultation, format, translation } = input;
  const text = [
    prescription.chiefComplaint,
    prescription.soapSubjective,
    prescription.soapObjective,
    prescription.soapAssessment,
    prescription.soapPlan,
    prescription.diagnosis,
    prescription.advice,
    prescription.referenceTo,
    consultation?.investigationOrders,
    prescription.investigationOrders,
    patient?.allergies,
    translation?.advice,
  ].filter(Boolean).join(" ");
  const itemText = (prescription.items as PrescriptionItem[]).map(item =>
    [item.drugName, item.genericName, item.dosage, item.frequency, item.duration, item.instructions].filter(Boolean).join(" "),
  ).join(" ");
  const bilingualMultiplier = format.displayMode === "bilingual" && translation?.language !== "en" ? 1.65 : 1;
  const itemUnits = (prescription.items.length * 42 + itemText.length * 0.28) * bilingualMultiplier;
  const sectionUnits = text.length * 0.22 + text.split("\n").length * 8;
  const fixedUnits = 300;
  const estimatedUnits = fixedUnits + itemUnits + sectionUnits;
  return Math.min(1, Math.max(0.38, 720 / estimatedUnits));
}

export async function createPrescriptionPdf(input: PrescriptionPdfInput): Promise<Blob> {
  const { prescription, patient, consultation, settings, format, translation } = input;
  const language = translation?.language ?? "en";
  const translatedFont = FONT_BY_LANGUAGE[language] ?? "NotoSans";
  const hasTranslation = Boolean(translation?.language && translation.language !== "en");
  const showTranslated = format.displayMode !== "english" && hasTranslation;
  const bilingual = format.displayMode === "bilingual" && hasTranslation;
  const fit = prescriptionFit(input);
  const content: Content[] = [
    letterhead(settings, prescription.doctorName, prescription.doctorSpecialization, format.headerAlign, fit),
    ...(prescription.doctorConsultingHours ? [{ text: [{ text: "Consulting Hours: ", bold: true }, prescription.doctorConsultingHours], alignment: "center", color: MUTED, margin: [0, -8 * fit, 0, 8 * fit] } as Content] : []),
    {
      table: {
        widths: ["*", 72, 35, 30, ...(consultation?.visitType ? ["*"] : [])],
        body: [[
          prescription.patientName ?? "—",
          patient?.patientId ?? "—",
          String(calcAge(patient?.dateOfBirth) ?? patient?.age ?? "—"),
          ({ male: "M", female: "F", other: "O" } as Record<string, string>)[patient?.gender ?? ""] ?? "—",
          ...(consultation?.visitType ? [consultation.visitType.replaceAll("_", " ")] : []),
        ].map(text => ({ text, fillColor: LIGHT, margin: [5 * fit, 5 * fit, 5 * fit, 5 * fit] }))],
      },
      layout: { hLineColor: () => BORDER, vLineColor: () => BORDER },
      margin: [0, 0, 0, 3 * fit],
    },
    { text: `${fmtDate(prescription.visitDate)}`, alignment: "right", color: MUTED, margin: [0, 0, 0, 8 * fit] },
  ];

  if (patient?.allergies) {
    content.push({ table: { widths: ["auto", "*"], body: [[{ text: "ALLERGIES:", bold: true, color: "#991b1b" }, { text: patient.allergies, color: "#991b1b" }]] }, layout: "noBorders", fillColor: "#fef2f2", margin: [0, 0, 0, 8 * fit] });
  }
  if (format.showSoap) {
    const soap = [
      prescription.chiefComplaint ? `CC: ${prescription.chiefComplaint}` : "",
      prescription.soapSubjective ? `S: ${prescription.soapSubjective}` : "",
      prescription.soapObjective ? `O: ${prescription.soapObjective}` : "",
      prescription.soapAssessment ? `A: ${prescription.soapAssessment}` : "",
      prescription.soapPlan ? `P: ${prescription.soapPlan}` : "",
    ].filter(Boolean).join("\n");
    content.push(...section("SOAP NOTES", soap, "NotoSans", undefined, fit));
  }
  if (format.showInvestigations) content.push(...section("INVESTIGATIONS", (consultation?.investigationOrders ?? prescription.investigationOrders)?.replaceAll("\n\u200B\u200B", "\n"), "NotoSans", undefined, fit));
  if (format.showDiagnosis) content.push(...section("DIAGNOSIS", prescription.diagnosis, "NotoSans", undefined, fit));
  content.push({ text: textLabel("medications", language, bilingual), style: "section" }, prescriptionItems(input, translatedFont, fit));

  const orthotics = (() => { try { const parsed = JSON.parse(prescription.notes ?? "[]"); return Array.isArray(parsed) ? parsed.join("   •   ") : ""; } catch { return ""; } })();
  content.push(...section("ORTHOTICS", orthotics, "NotoSans", undefined, fit));
  if (format.showAdvice) {
    if (bilingual) {
      content.push(...section(textLabel("advice", language), prescription.advice, "NotoSans", undefined, fit));
      content.push(...section("", translation?.advice, translatedFont, TRANSLATED, fit));
    } else {
      content.push(...section(textLabel("advice", language, !showTranslated), showTranslated ? (translation?.advice ?? prescription.advice) : prescription.advice, showTranslated ? translatedFont : "NotoSans", undefined, fit));
    }
  }
  if (format.showFollowUp && prescription.followUpDate) content.push(...section("FOLLOW-UP", fmtDate(prescription.followUpDate), "NotoSans", undefined, fit));
  if (format.showReferenceTo) content.push(...section("REFERENCE TO", prescription.referenceTo, "NotoSans", undefined, fit));

  const signature: Content[] = [];
  if (prescription.doctorSignatureData?.startsWith("data:image/")) signature.push({ image: prescription.doctorSignatureData, width: 100 * fit, alignment: "right" });
  signature.push({ text: prescription.doctorName ?? "Doctor", bold: true, alignment: "right" });
  if (prescription.doctorRegistrationNumber) signature.push({ text: `Reg. No: ${prescription.doctorRegistrationNumber}`, color: MUTED, fontSize: 7 * fit, alignment: "right" });
  signature.push({ text: "Signature & Stamp", color: MUTED, fontSize: 7 * fit, alignment: "right" });
  content.push({ stack: signature, margin: [0, 18 * fit, 0, 0] });

  const size = format.fontSize === "lg" ? 11 : format.fontSize === "md" ? 10 : 9;
  return render(commonDefinition(content, `Prescription - ${prescription.patientName}`, size, fit));
}

function money(value: number | null | undefined, prefix = ""): Content {
  return {
    text: [
      ...(prefix ? [{ text: prefix, font: "NotoSans" }] : []),
      { text: "₹", font: "Devanagari" },
      { text: (value ?? 0).toFixed(2), font: "NotoSans" },
    ],
  };
}

export async function createReceiptPdf({ invoice, patient, payments = [], settings, language }: ReceiptPdfInput): Promise<Blob> {
  const lang = language && FONT_BY_LANGUAGE[language] ? language : "en";
  const scriptFont = FONT_BY_LANGUAGE[lang] ?? "NotoSans";
  const bilingual = lang !== "en";
  const isReceipt = (invoice.amountPaid ?? 0) > 0;
  const label = (key: keyof typeof EN) => textLabel(key, lang, bilingual);
  const content: Content[] = [
    letterhead(settings, invoice.doctorName),
    { columns: [{ text: isReceipt ? label("receipt") : label("invoice"), fontSize: 16, bold: true, color: BRAND }, { text: invoice.invoiceNumber, bold: true, alignment: "right" }], margin: [0, 0, 0, 12] },
    {
      columns: [
        { stack: [label("patient"), { text: invoice.patientName ?? "—", bold: true }, { text: `${EN.patientId}: ${patient?.patientId ?? "—"}`, color: MUTED }] },
        { stack: [label("date"), { text: fmtDate(invoice.createdAt) }, { text: invoice.status.toUpperCase(), bold: true, color: invoice.status === "paid" ? "#166534" : BRAND }] },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        headerRows: 1,
        widths: [20, "*", 42, 70, 70],
        body: [
          [{ text: "#" } as Content, label("description"), label("qty"), label("unitPrice"), label("amount")].map(cell => ({ text: cell, bold: true, fillColor: LIGHT, fontSize: 7.5 })),
          ...invoice.items.map((item, index) => [String(index + 1), item.description, String(item.quantity), money(item.unitPrice), money(item.total)]),
        ],
      },
      layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 },
      margin: [0, 0, 0, 12],
    },
    {
      columns: [
        payments.length ? {
          width: "*",
          stack: [
            { text: label("paymentHistory"), style: "section" },
            ...payments.map(payment => ({ columns: [{ text: `${fmtDate(payment.paidAt)} - ${payment.paymentMode.toUpperCase()}` }, { stack: [money(payment.amount)], alignment: "right", bold: true, color: "#166534" }], margin: [0, 0, 12, 5] } as Content)),
          ],
        } : { text: "" },
        {
          width: 190,
          table: {
            widths: ["*", "auto"],
            body: [
              [label("subtotal"), money(invoice.subtotal)],
              ...(invoice.discount ? [[label("discount"), money(invoice.discount, "-")]] : []),
              ...(invoice.tax ? [[label("tax"), money(invoice.tax)]] : []),
              [{ text: label("total"), bold: true }, { text: money(invoice.total), bold: true }],
              [{ text: label("paid"), color: "#166534" }, { text: money(invoice.amountPaid), color: "#166534", bold: true }],
              [{ text: label("balance"), color: "#b45309", bold: true }, { text: money(invoice.balance), color: "#b45309", bold: true }],
            ],
          },
          layout: { hLineColor: () => BORDER, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
        },
      ],
      columnGap: 18,
    },
    ...(invoice.notes ? section("NOTES", invoice.notes) : []),
    { text: bilingual ? [{ text: EN.thanks }, { text: `\n${LABELS[lang].thanks}`, font: scriptFont, color: TRANSLATED }] : EN.thanks, bold: true, color: BRAND, margin: [0, 18, 0, 0] },
  ];
  return render(commonDefinition(content, `${isReceipt ? "Receipt" : "Invoice"} - ${invoice.invoiceNumber}`, 9, 1));
}

export function prescriptionPdfFileName(prescription: Prescription): string {
  return safeFileName(`prescription-${prescription.patientName ?? prescription.id}.pdf`);
}

export function receiptPdfFileName(invoice: Invoice): string {
  return safeFileName(`receipt-${invoice.invoiceNumber}.pdf`);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openPdf(blob: Blob, fileName = "document.pdf"): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  if (!opened) downloadPdf(blob, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

export function pdfToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: "application/pdf" });
}