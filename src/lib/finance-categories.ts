export const EXPENSE_CATEGORY_GROUPS = [
  {
    group: "Maintenance & Operations",
    categories: [
      ["maintenance", "Maintenance"],
      ["repairs", "Repairs"],
      ["civil_work", "Civil Work"],
      ["plumbing", "Plumbing"],
      ["electrical", "Electrical"],
      ["painting", "Painting"],
      ["waterproofing", "Waterproofing"],
      ["carpentry", "Carpentry"],
      ["pest_control", "Pest Control"],
      ["housekeeping", "Housekeeping"],
      ["garbage_collection", "Garbage Collection"],
      ["garden_maintenance", "Garden Maintenance"],
      ["stp_maintenance", "STP Maintenance"],
      ["lift_maintenance", "Lift Maintenance"],
      ["dg_generator_maintenance", "DG Generator Maintenance"],
      ["fire_safety_maintenance", "Fire Safety Maintenance"],
      ["cctv_maintenance", "CCTV Maintenance"],
      ["intercom_maintenance", "Intercom Maintenance"],
      ["security_system_maintenance", "Security System Maintenance"],
    ],
  },
  {
    group: "Staff & Payroll",
    categories: [
      ["security_salary", "Security Salary"],
      ["housekeeping_salary", "Housekeeping Salary"],
      ["manager_salary", "Manager Salary"],
      ["electrician_salary", "Electrician Salary"],
      ["plumber_salary", "Plumber Salary"],
      ["gardener_salary", "Gardener Salary"],
      ["admin_staff_salary", "Admin Staff Salary"],
      ["staff_bonus", "Staff Bonus"],
      ["pf_esic", "PF / ESIC"],
      ["contractor_payments", "Contractor Payments"],
    ],
  },
  {
    group: "Utilities",
    categories: [
      ["electricity_common_area", "Electricity Common Area"],
      ["water_bill", "Water Bill"],
      ["diesel", "Diesel"],
      ["gas", "Gas"],
      ["internet_wifi", "Internet / WiFi"],
      ["mobile_phone", "Mobile / Phone"],
      ["amc_charges", "AMC Charges"],
    ],
  },
  {
    group: "Amenities",
    categories: [
      ["gym", "Gym"],
      ["clubhouse", "Clubhouse"],
      ["swimming_pool", "Swimming Pool"],
      ["sports_area", "Sports Area"],
      ["kids_play_area", "Kids Play Area"],
      ["event_hall", "Event Hall"],
      ["parking_maintenance", "Parking Maintenance"],
    ],
  },
  {
    group: "Administrative",
    categories: [
      ["stationery", "Stationery"],
      ["printing", "Printing"],
      ["banking_charges", "Banking Charges"],
      ["audit_fees", "Audit Fees"],
      ["legal_fees", "Legal Fees"],
      ["consultant_fees", "Consultant Fees"],
      ["software_subscription", "Software Subscription"],
      ["website_app_charges", "Website / App Charges"],
    ],
  },
  {
    group: "Compliance & Government",
    categories: [
      ["property_tax", "Property Tax"],
      ["municipal_charges", "Municipal Charges"],
      ["pollution_board", "Pollution Board"],
      ["fire_noc", "Fire NOC"],
      ["society_registration", "Society Registration"],
      ["license_renewal", "License Renewal"],
    ],
  },
  {
    group: "Events & Community",
    categories: [
      ["festival_celebration", "Festival Celebration"],
      ["cultural_events", "Cultural Events"],
      ["society_meetings", "Society Meetings"],
      ["welfare_activities", "Welfare Activities"],
      ["decorations", "Decorations"],
    ],
  },
  {
    group: "Emergency & Misc",
    categories: [
      ["emergency_repairs", "Emergency Repairs"],
      ["insurance", "Insurance"],
      ["medical_emergency", "Medical Emergency"],
      ["disaster_recovery", "Disaster Recovery"],
      ["miscellaneous", "Miscellaneous"],
      ["other", "Other"],
    ],
  },
] as const;

export const FUND_CATEGORIES = [
  ["maintenance", "Maintenance Fund"],
  ["sinking", "Sinking Fund"],
  ["repair", "Repair Fund"],
  ["corpus", "Corpus Fund"],
  ["reserve", "Reserve Fund"],
  ["emergency", "Emergency Fund"],
  ["parking", "Parking Fund"],
  ["welfare", "Welfare Fund"],
  ["cultural_event", "Cultural / Event Fund"],
  ["gym", "Gym Fund"],
  ["clubhouse", "Clubhouse Fund"],
  ["other", "Other Fund"],
] as const;

export const EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORY_GROUPS.flatMap((group) =>
    group.categories.map(([id, label]) => [id, label] as [string, string])
  )
) as Record<string, string>;

export const EXPENSE_CATEGORY_IDS = new Set(Object.keys(EXPENSE_CATEGORY_LABELS));

export function expenseCategoryLabel(category: string) {
  return EXPENSE_CATEGORY_LABELS[category] || category.replace(/_/g, " ");
}

export function defaultExpenseCategoryForFund(type: string) {
  if (type === "maintenance") return "maintenance";
  if (type === "sinking" || type === "repair") return "repairs";
  if (type === "parking") return "parking_maintenance";
  if (type === "welfare") return "welfare_activities";
  if (type === "cultural_event") return "cultural_events";
  if (type === "gym") return "gym";
  if (type === "clubhouse") return "clubhouse";
  return "other";
}

export function salaryCategoryForStaffRole(role: string) {
  if (role === "security") return "security_salary";
  if (role === "housekeeping") return "housekeeping_salary";
  if (role === "manager") return "manager_salary";
  if (role === "gardener") return "gardener_salary";
  if (role === "electrician") return "electrician_salary";
  if (role === "plumber") return "plumber_salary";
  return "admin_staff_salary";
}

export function financeReportBucket(category: string) {
  if (
    [
      "maintenance",
      "repair",
      "repairs",
      "civil_work",
      "plumbing",
      "electrical",
      "painting",
      "waterproofing",
      "carpentry",
      "pest_control",
      "housekeeping",
      "garbage_collection",
      "garden_maintenance",
      "stp_maintenance",
      "lift_maintenance",
      "dg_generator_maintenance",
      "fire_safety_maintenance",
      "cctv_maintenance",
      "intercom_maintenance",
      "security_system_maintenance",
      "sinking",
    ].includes(category)
  ) return "maintenanceRepair";

  if (
    [
      "salary",
      "security_salary",
      "housekeeping_salary",
      "manager_salary",
      "electrician_salary",
      "plumber_salary",
      "gardener_salary",
      "admin_staff_salary",
      "staff_bonus",
      "pf_esic",
      "contractor_payments",
    ].includes(category)
  ) return "staff";

  if (
    [
      "utilities",
      "electricity_common_area",
      "water_bill",
      "diesel",
      "gas",
      "internet_wifi",
      "mobile_phone",
      "amc_charges",
    ].includes(category)
  ) return "utilities";

  if (
    [
      "events",
      "festival_celebration",
      "cultural_events",
      "society_meetings",
      "welfare_activities",
      "decorations",
      "gym",
      "clubhouse",
      "swimming_pool",
      "sports_area",
      "kids_play_area",
      "event_hall",
      "parking_maintenance",
    ].includes(category)
  ) return "events";

  return "other";
}
