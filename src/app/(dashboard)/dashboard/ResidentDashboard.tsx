"use client";

import Link from "next/link";
import {
  Bell,
  MessageSquare,
  UserCheck,
  ReceiptText,
  Building2,
  Package,
  CalendarDays,
  MoreVertical,
  Target,
  Megaphone,
} from "lucide-react";

export default function ResidentDashboard({ user }: { user?: { name?: string; avatar?: string; societyName?: string } }) {
  return (
    <div className="bg-white min-h-screen pb-24 font-sans max-w-[420px] mx-auto overflow-hidden">
      {/* SECTION 1 - Top Header */}
      <div className="px-5 pt-10 pb-6 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"}
            alt="Profile"
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <p className="text-gray-500 text-xs font-medium flex items-center gap-1">
              Good Morning <span className="text-yellow-500 text-sm">👋</span>
            </p>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {user?.name || "Ramesh Sharma"}
            </h1>
            <p className="text-gray-500 text-[11px] font-medium mt-0.5">
              {user?.societyName || "Green Park Society"}
            </p>
          </div>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-gray-700" strokeWidth={2} />
          <div className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
            9
          </div>
        </div>
      </div>

      {/* SECTION 2 - Outstanding Balance Card */}
      <div className="px-5 mb-6">
        <div className="bg-[#F97316] rounded-[16px] p-5 shadow-[0_4px_14px_rgba(249,115,22,0.3)] flex justify-between items-center">
          <div>
            <p className="text-white/90 text-xs font-medium mb-1">Total Outstanding</p>
            <h2 className="text-white text-3xl font-bold tracking-tight">₹ 2,450</h2>
          </div>
          <Link href="/my-bills" className="bg-white text-[#F97316] hover:bg-orange-50 transition-colors font-bold text-sm px-5 py-2 rounded-full shadow-sm">
            Pay Now
          </Link>
        </div>
      </div>

      {/* SECTION 3 - Stats Row */}
      <div className="px-5 mb-8">
        <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex justify-between items-center">
          <Link href="/notices" className="flex-1 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-900 mb-1">Notices</span>
            <span className="text-2xl font-extrabold text-gray-900 leading-none">05</span>
            <span className="text-[10px] text-gray-500 mt-1 font-medium">Unread</span>
          </Link>
          <div className="w-px h-12 bg-gray-100"></div>
          <Link href="/complaints" className="flex-1 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-900 mb-1">Complaints</span>
            <span className="text-2xl font-extrabold text-gray-900 leading-none">02</span>
            <span className="text-[10px] text-gray-500 mt-1 font-medium">Open</span>
          </Link>
          <div className="w-px h-12 bg-gray-100"></div>
          <Link href="/my-visitors" className="flex-1 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-900 mb-1">Visitors</span>
            <span className="text-2xl font-extrabold text-gray-900 leading-none">03</span>
            <span className="text-[10px] text-gray-500 mt-1 font-medium">Today</span>
          </Link>
        </div>
      </div>

      {/* SECTION 4 - Quick Access Grid */}
      <div className="px-5 mb-8">
        <h3 className="text-[15px] font-bold text-gray-900 mb-4 tracking-tight">Quick Access</h3>
        <div className="grid grid-cols-4 gap-y-6 gap-x-2">
          {/* Row 1 */}
          <Link href="/my-bills" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#FFF7ED] flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-[#F97316]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">My Bills</span>
          </Link>
          <Link href="/complaints" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#FEF3C7] flex items-center justify-center">
              <Target className="w-5 h-5 text-[#D97706]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Complaints</span>
          </Link>
          <Link href="/my-visitors" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#EFF6FF] flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-[#2563EB]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Visitors</span>
          </Link>
          <Link href="/notices" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#FFF7ED] flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#F97316]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Notices</span>
          </Link>
          
          {/* Row 2 */}
          <Link href="/amenities" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#F5F3FF] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#8B5CF6]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Amenities</span>
          </Link>
          <Link href="/packages" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center">
              <Package className="w-5 h-5 text-[#EF4444]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Packages</span>
          </Link>
          <Link href="/events" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#F5F3FF] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-[#8B5CF6]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">Events</span>
          </Link>
          <Link href="/services" className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-[14px] bg-[#F3F4F6] flex items-center justify-center">
              <MoreVertical className="w-5 h-5 text-[#374151]" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-800">More</span>
          </Link>
        </div>
      </div>

      {/* SECTION 5 - Go Green Banner */}
      <div className="px-5 mb-8">
        <div className="bg-[#FFF7ED] rounded-[16px] p-5 flex items-center justify-between relative overflow-hidden shadow-sm border border-orange-50">
          <div className="relative z-10 w-2/3 pr-2">
            <h3 className="text-[#9A3412] font-bold text-[15px] leading-tight mb-1">Go Digital. Go Green.</h3>
            <p className="text-[#9A3412] opacity-80 text-[11px] font-medium leading-relaxed">
              Get e-receipts &<br/>secure payments.
            </p>
          </div>
          {/* Illustration Graphic */}
          <div className="w-1/3 relative z-10 flex justify-end">
            <div className="relative w-14 h-20 bg-white rounded-[10px] border-[3px] border-[#FED7AA] shadow-sm flex flex-col items-center overflow-hidden">
              <div className="w-4 h-1 bg-[#FED7AA] rounded-b-full mt-0"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <div className="w-6 h-6 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-1">
                   <span className="text-[#059669] text-xs font-bold font-sans">₹</span>
                 </div>
                 <div className="w-6 h-1 bg-[#D1FAE5] rounded-full"></div>
              </div>
              <div className="absolute -bottom-2 -left-3 w-8 h-8 bg-[#86EFAC] rounded-full opacity-40"></div>
              <div className="absolute -top-3 -right-2 w-8 h-8 bg-[#FDBA74] rounded-full opacity-40"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
