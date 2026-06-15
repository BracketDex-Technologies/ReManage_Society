export interface SocietyType {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  totalFlats: number;
  maintenanceAmt: number;
  dueDayOfMonth: number;
  lateFee: number;
  upiId: string | null;
  bankDetails: string | null;
  planTier: string;
  openingBalance: number;
  createdAt: Date;
}

export interface FlatType {
  id: string;
  societyId: string;
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  ownerName: string;
  tenantName: string | null;
  contact: string;
  email: string | null;
  vehicleNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceBillType {
  id: string;
  flatId: string;
  societyId: string;
  amount: number;
  billType?: string;
  billingCycle?: string;
  description?: string | null;
  lateFee: number;
  gstAmount: number;
  totalAmount: number | null;
  period: string;
  dueDate: Date;
  status: string;
  paidAt: Date | null;
  paidVia: string | null;
  paidAmount: number | null;
  receiptNote: string | null;
  receiptNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  flat?: FlatType;
}

export interface BillWithFlat extends MaintenanceBillType {
  flat: FlatType;
  billingRecipient?: {
    flatId: string;
    unitId: string;
    flatNumber: string;
    wing: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    tenantName: string | null;
    tenantPhone: string | null;
    privateMonthlyRent: number | null;
    billingResponsibility: string;
    payerName: string;
    payerRole: string;
    payerPhone: string | null;
    payerEmail: string | null;
    userIds: string[];
  } | null;
}

export interface UserType {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  societyId: string | null;
  flatId: string | null;
  createdAt: Date;
}

export interface ExpenseType {
  id: string;
  societyId: string;
  title: string;
  amount: number;
  category: string;
  paidTo: string | null;
  paidOn: Date;
  notes: string | null;
  billProofFileName: string | null;
  billProofFileType: string | null;
  billProofDataUrl: string | null;
  billProofUploadedAt: Date | null;
  billProofVerifiedAt: Date | null;
  billProofVerifiedBy: string | null;
  approvalStatus: string;
  submittedBy: string | null;
  submittedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface ReminderLogType {
  id: string;
  flatId: string;
  billId: string | null;
  channel: string;
  sentAt: Date;
  status: string;
  messageBody: string;
}

export interface BillingSummary {
  paid: number;
  pending: number;
  total: number;
  collectedAmount: number;
  pendingAmount: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// ===== NEW TYPES =====

export interface VisitorType {
  id: string;
  societyId: string;
  flatId: string | null;
  flatNumber: string;
  visitorName: string;
  phone: string | null;
  purpose: string;
  vehicleNo: string | null;
  entryTime: string;
  exitTime: string | null;
  approvedBy: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface ParkingSlotType {
  id: string;
  societyId: string;
  slotNumber: string;
  slotType: string;
  wing: string | null;
  flatId: string | null;
  isAssigned: boolean;
  vehicleNo: string | null;
  flat?: FlatType;
}

export interface FacilityType {
  id: string;
  societyId: string;
  name: string;
  description: string | null;
  capacity: number | null;
  ratePerHour: number;
  isActive: boolean;
  rules: string | null;
}

export interface FacilityBookingType {
  id: string;
  facilityId: string;
  bookedBy: string;
  flatNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: string;
  amount: number;
  facility?: FacilityType;
}

export interface MeetingMinutesType {
  id: string;
  societyId: string;
  title: string;
  date: string;
  meetingType: string;
  attendees: string | null;
  agenda: string;
  minutes: string;
  decisions: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface EmergencyContactType {
  id: string;
  societyId: string;
  name: string;
  phone: string;
  category: string;
  address: string | null;
  isAvailable: boolean;
  notes: string | null;
}

export interface PollType {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  options: string;
  votes: string;
  voters: string;
  createdBy: string;
  status: string;
  closesAt: string | null;
  createdAt: string;
}
