import { db, usersTable, drugsTable, chargeTypesTable, clinicSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Seeding database...");

  // Clinic settings
  const [existingSettings] = await db.select().from(clinicSettingsTable).limit(1);
  if (!existingSettings) {
    await db.insert(clinicSettingsTable).values({
      clinicName: "City General Hospital",
      address: "123 Healthcare Ave, Medical District",
      phone: "+1-555-0100",
      email: "admin@citygeneralhospital.com",
      website: "https://citygeneralhospital.com",
      registrationNumber: "HOS-2024-001",
      currency: "INR",
      timezone: "Asia/Kolkata",
      sessionTimeoutMinutes: 15,
      defaultConsultationFee: 500,
    });
    console.log("Created clinic settings");
  }

  // Admin user
  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (!existingAdmin) {
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash: hashPassword("Admin@123"),
      role: "admin",
      fullName: "System Administrator",
      email: "admin@citygeneralhospital.com",
    });
    console.log("Created admin user: admin / Admin@123");
  }

  // Doctor user
  const [existingDoctor] = await db.select().from(usersTable).where(eq(usersTable.username, "dr.smith"));
  if (!existingDoctor) {
    await db.insert(usersTable).values({
      username: "dr.smith",
      passwordHash: hashPassword("Doctor@123"),
      role: "doctor",
      fullName: "Dr. John Smith",
      email: "john.smith@citygeneralhospital.com",
      phone: "+1-555-0101",
      registrationNumber: "MED-12345",
      specialization: "General Medicine",
    });
    console.log("Created doctor user: dr.smith / Doctor@123");
  }

  // Staff user
  const [existingStaff] = await db.select().from(usersTable).where(eq(usersTable.username, "staff.jane"));
  if (!existingStaff) {
    await db.insert(usersTable).values({
      username: "staff.jane",
      passwordHash: hashPassword("Staff@123"),
      role: "staff",
      fullName: "Jane Wilson",
      email: "jane.wilson@citygeneralhospital.com",
      phone: "+1-555-0102",
    });
    console.log("Created staff user: staff.jane / Staff@123");
  }

  // Radiographer user
  const [existingRadiographer] = await db.select().from(usersTable).where(eq(usersTable.username, "rad.kumar"));
  if (!existingRadiographer) {
    await db.insert(usersTable).values({
      username: "rad.kumar",
      passwordHash: hashPassword("Radiology@123"),
      role: "radiographer",
      fullName: "Raj Kumar",
      email: "raj.kumar@citygeneralhospital.com",
      phone: "+1-555-0103",
    });
    console.log("Created radiographer user: rad.kumar / Radiology@123");
  }

  // Charge types
  const existingCharges = await db.select().from(chargeTypesTable).limit(1);
  if (existingCharges.length === 0) {
    await db.insert(chargeTypesTable).values([
      { name: "General Consultation", category: "consultation", unitPrice: 500, taxPercent: 0 },
      { name: "Specialist Consultation", category: "consultation", unitPrice: 1000, taxPercent: 0 },
      { name: "Blood Test - CBC", category: "investigation", unitPrice: 250, taxPercent: 0 },
      { name: "Blood Test - LFT", category: "investigation", unitPrice: 400, taxPercent: 0 },
      { name: "Blood Test - RFT", category: "investigation", unitPrice: 350, taxPercent: 0 },
      { name: "Urine Routine", category: "investigation", unitPrice: 150, taxPercent: 0 },
      { name: "X-Ray Chest PA", category: "procedure", unitPrice: 300, taxPercent: 0 },
      { name: "ECG", category: "procedure", unitPrice: 200, taxPercent: 0 },
      { name: "Ultrasound Abdomen", category: "investigation", unitPrice: 800, taxPercent: 0 },
      { name: "Dressing", category: "procedure", unitPrice: 150, taxPercent: 0 },
      { name: "Injection (IM)", category: "procedure", unitPrice: 50, taxPercent: 0 },
      { name: "IV Cannulation", category: "procedure", unitPrice: 100, taxPercent: 0 },
    ]);
    console.log("Created charge types");
  }

  // Sample drugs
  const existingDrugs = await db.select().from(drugsTable).limit(1);
  if (existingDrugs.length === 0) {
    await db.insert(drugsTable).values([
      { name: "Paracetamol 500mg", genericName: "Acetaminophen", category: "Analgesic", form: "Tablet", strength: "500mg", defaultDosage: "500mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "5 days", defaultInstructions: "After food" },
      { name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "Antibiotic", form: "Capsule", strength: "500mg", defaultDosage: "500mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "7 days", defaultInstructions: "After food with water" },
      { name: "Azithromycin 500mg", genericName: "Azithromycin", category: "Antibiotic", form: "Tablet", strength: "500mg", defaultDosage: "500mg", defaultFrequency: "OD (Once daily)", defaultDuration: "3 days", defaultInstructions: "Before food" },
      { name: "Cetirizine 10mg", genericName: "Cetirizine HCl", category: "Antihistamine", form: "Tablet", strength: "10mg", defaultDosage: "10mg", defaultFrequency: "OD (Once daily)", defaultDuration: "5 days", defaultInstructions: "At bedtime" },
      { name: "Metformin 500mg", genericName: "Metformin HCl", category: "Antidiabetic", form: "Tablet", strength: "500mg", defaultDosage: "500mg", defaultFrequency: "BD (Twice daily)", defaultDuration: "30 days", defaultInstructions: "With meals" },
      { name: "Amlodipine 5mg", genericName: "Amlodipine Besylate", category: "Antihypertensive", form: "Tablet", strength: "5mg", defaultDosage: "5mg", defaultFrequency: "OD (Once daily)", defaultDuration: "30 days", defaultInstructions: "Morning" },
      { name: "Pantoprazole 40mg", genericName: "Pantoprazole", category: "Proton Pump Inhibitor", form: "Tablet", strength: "40mg", defaultDosage: "40mg", defaultFrequency: "OD (Once daily)", defaultDuration: "14 days", defaultInstructions: "Before breakfast" },
      { name: "Ibuprofen 400mg", genericName: "Ibuprofen", category: "NSAID", form: "Tablet", strength: "400mg", defaultDosage: "400mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "5 days", defaultInstructions: "After food" },
      { name: "Dolo 650", genericName: "Paracetamol", category: "Analgesic", form: "Tablet", strength: "650mg", defaultDosage: "650mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "5 days", defaultInstructions: "After food" },
      { name: "Montelukast 10mg", genericName: "Montelukast Sodium", category: "Antiasthmatic", form: "Tablet", strength: "10mg", defaultDosage: "10mg", defaultFrequency: "OD (Once daily)", defaultDuration: "30 days", defaultInstructions: "At bedtime" },
      { name: "Atorvastatin 10mg", genericName: "Atorvastatin Calcium", category: "Statin", form: "Tablet", strength: "10mg", defaultDosage: "10mg", defaultFrequency: "OD (Once daily)", defaultDuration: "30 days", defaultInstructions: "At bedtime" },
      { name: "Cefpodoxime 200mg", genericName: "Cefpodoxime Proxetil", category: "Antibiotic", form: "Tablet", strength: "200mg", defaultDosage: "200mg", defaultFrequency: "BD (Twice daily)", defaultDuration: "7 days", defaultInstructions: "After food" },
      { name: "Ondansetron 4mg", genericName: "Ondansetron HCl", category: "Antiemetic", form: "Tablet", strength: "4mg", defaultDosage: "4mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "3 days", defaultInstructions: "As needed" },
      { name: "Prednisolone 10mg", genericName: "Prednisolone", category: "Corticosteroid", form: "Tablet", strength: "10mg", defaultDosage: "10mg", defaultFrequency: "OD (Once daily)", defaultDuration: "5 days", defaultInstructions: "Morning with food" },
      { name: "Domperidone 10mg", genericName: "Domperidone", category: "Prokinetic", form: "Tablet", strength: "10mg", defaultDosage: "10mg", defaultFrequency: "TDS (Three times a day)", defaultDuration: "7 days", defaultInstructions: "30 min before meals" },
    ]);
    console.log("Created sample drugs");
  }

  console.log("\nSeed complete!");
  console.log("Login credentials:");
  console.log("  Admin:  admin / Admin@123");
  console.log("  Doctor: dr.smith / Doctor@123");
  console.log("  Staff:  staff.jane / Staff@123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
