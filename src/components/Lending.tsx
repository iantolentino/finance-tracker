import React, { useState, useMemo } from "react";
import {
  DollarSign,
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Users,
  Phone,
  MapPin,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  TrendingUp,
  Printer,
  ChevronRight,
  Calculator
} from "lucide-react";
import { Loan, LoanPayment, SystemSettings } from "../types";

interface LendingProps {
  loans: Loan[];
  settings: SystemSettings;
  onAddLoan: (l: Partial<Loan>) => Promise<any>;
  onEditLoan: (id: string, l: Partial<Loan>) => Promise<any>;
  onDeleteLoan: (id: string) => Promise<any>;
  onAddLoanPayment: (loanId: string, pay: { paymentDate: string; amountPaid: number; paymentMethod: string; notes?: string }) => Promise<any>;
  onEditLoanPayment: (loanId: string, paymentId: string, pay: { paymentDate?: string; amountPaid?: number; paymentMethod?: string; notes?: string }) => Promise<any>;
  onDeleteLoanPayment: (loanId: string, paymentId: string) => Promise<any>;
}

export default function Lending({
  loans,
  settings,
  onAddLoan,
  onEditLoan,
  onDeleteLoan,
  onAddLoanPayment,
  onEditLoanPayment,
  onDeleteLoanPayment
}: LendingProps) {
  
  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Modals state
  const [loanModal, setLoanModal] = useState<{ open: boolean; editId?: string; borrowerName: string; contactNumber: string; address: string; principalAmount: number; loanDate: string; dueDate: string; paymentSchedule: string; interestType: "Fixed Amount" | "Percentage"; interestValue: number; notes: string }>({
    open: false,
    borrowerName: "",
    contactNumber: "",
    address: "",
    principalAmount: 0,
    loanDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // default 30 days
    paymentSchedule: "On Due Date",
    interestType: "Percentage",
    interestValue: 10,
    notes: ""
  });

  const [paymentModal, setPaymentModal] = useState<{ open: boolean; editId?: string; paymentDate: string; amountPaid: number; paymentMethod: string; notes: string }>({
    open: false,
    paymentDate: new Date().toISOString().split("T")[0],
    amountPaid: 0,
    paymentMethod: "Cash",
    notes: ""
  });

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency || "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Helper to calculate complete loan parameters dynamically
  const computedLoans = useMemo(() => {
    return loans.map(loan => {
      const principal = loan.principalAmount;
      const interestValue = loan.interestValue;
      
      const interestAmount = loan.interestType === "Percentage"
        ? (principal * (interestValue / 100))
        : interestValue;

      const totalDue = principal + interestAmount;
      const totalPaid = loan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remainingBalance = Math.max(0, totalDue - totalPaid);

      return {
        ...loan,
        interestAmount,
        totalDue,
        totalPaid,
        remainingBalance
      };
    });
  }, [loans]);

  // Filters
  const filteredLoans = useMemo(() => {
    return computedLoans.filter(l => {
      const matchesSearch = l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.contactNumber.includes(searchQuery) ||
        l.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [computedLoans, searchQuery, statusFilter]);

  // Selected Loan Profile
  const selectedLoanInfo = useMemo(() => {
    if (!selectedLoanId) return null;
    return computedLoans.find(l => l.id === selectedLoanId) || null;
  }, [selectedLoanId, computedLoans]);

  // Metric summaries for the Lending Dashboard Sidebar
  const lendingTotals = useMemo(() => {
    const totalPrincipalGranted = computedLoans.reduce((sum, l) => sum + l.principalAmount, 0);
    const totalInterestGained = computedLoans.reduce((sum, l) => sum + l.interestAmount, 0);
    const totalCollected = computedLoans.reduce((sum, l) => sum + l.totalPaid, 0);
    const totalOutstanding = computedLoans.reduce((sum, l) => sum + l.remainingBalance, 0);

    return { totalPrincipalGranted, totalInterestGained, totalCollected, totalOutstanding };
  }, [computedLoans]);

  // Save Loan
  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanModal.borrowerName.trim() || loanModal.principalAmount <= 0) return;
    setIsLoading(true);
    try {
      const payload = {
        borrowerName: loanModal.borrowerName,
        contactNumber: loanModal.contactNumber,
        address: loanModal.address,
        principalAmount: Number(loanModal.principalAmount),
        loanDate: loanModal.loanDate,
        dueDate: loanModal.dueDate,
        paymentSchedule: loanModal.paymentSchedule,
        interestType: loanModal.interestType,
        interestValue: Number(loanModal.interestValue),
        notes: loanModal.notes,
        status: "Active" as const
      };

      if (loanModal.editId) {
        await onEditLoan(loanModal.editId, payload);
      } else {
        await onAddLoan(payload);
      }
      setLoanModal({ open: false, borrowerName: "", contactNumber: "", address: "", principalAmount: 0, loanDate: new Date().toISOString().split("T")[0], dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], paymentSchedule: "On Due Date", interestType: "Percentage", interestValue: 10, notes: "" });
    } catch (err) {
      alert("Error saving loan record");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Loan
  const handleDeleteLoanClick = async (id: string, borrower: string) => {
    if (confirm(`Are you sure you want to delete the loan record of ${borrower}? This action is permanent and cannot be undone.`)) {
      setIsLoading(true);
      try {
        await onDeleteLoan(id);
        if (selectedLoanId === id) setSelectedLoanId(null);
      } catch (err) {
        alert("Error deleting loan record");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Save Loan Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || paymentModal.amountPaid <= 0) return;
    setIsLoading(true);
    try {
      const payload = {
        paymentDate: paymentModal.paymentDate,
        amountPaid: paymentModal.amountPaid,
        paymentMethod: paymentModal.paymentMethod,
        notes: paymentModal.notes
      };

      if (paymentModal.editId) {
        await onEditLoanPayment(selectedLoanId, paymentModal.editId, payload);
      } else {
        await onAddLoanPayment(selectedLoanId, payload);
      }
      setPaymentModal({ open: false, paymentDate: new Date().toISOString().split("T")[0], amountPaid: 0, paymentMethod: "Cash", notes: "" });
    } catch (err) {
      alert("Error logging loan payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Loan Payment
  const handleDeletePaymentClick = async (payId: string) => {
    if (confirm("Are you sure you want to remove this loan payment record?")) {
      setIsLoading(true);
      try {
        await onDeleteLoanPayment(selectedLoanId!, payId);
      } catch (err) {
        alert("Error deleting payment record");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Module 02</span>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-500" />
            Lending Management (Cash Loans)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Independently track cash loans, computed fixed or percentage interest values, and borrower summaries.
          </p>
        </div>
        <div>
          <button
            onClick={() => setLoanModal({ open: true, borrowerName: "", contactNumber: "", address: "", principalAmount: 0, loanDate: new Date().toISOString().split("T")[0], dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], paymentSchedule: "On Due Date", interestType: "Percentage", interestValue: 10, notes: "" })}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Issue New Cash Loan
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Borrowers List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">Active Loans ({filteredLoans.length})</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search borrower, phone, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-slate-100 text-[11px] font-medium text-slate-500 gap-1 pb-1 overflow-x-auto">
              {["All", "Active", "Completed", "Overdue"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition ${
                    statusFilter === status
                      ? "bg-brand-50 text-brand-600 font-semibold"
                      : "hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* List container */}
            <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {filteredLoans.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-300">
                  No lending records found.
                </div>
              ) : (
                filteredLoans.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLoanId(l.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedLoanId === l.id
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-100 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs leading-none">
                        {l.borrowerName}
                      </h4>
                      <p className={`text-[10px] ${selectedLoanId === l.id ? "text-slate-300" : "text-slate-400"}`}>
                        Principal: {formatCurrency(l.principalAmount)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          l.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : l.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-brand-100 text-brand-800"
                        }`}>
                          {l.status}
                        </span>
                        <span className={`text-[9px] ${selectedLoanId === l.id ? "text-slate-400" : "text-slate-400"}`}>
                          Interest: {l.interestType === "Percentage" ? `${l.interestValue}%` : formatCurrency(l.interestValue)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-bold">
                        {formatCurrency(l.remainingBalance)}
                      </span>
                      <span className={`text-[9px] block mt-0.5 ${selectedLoanId === l.id ? "text-slate-400" : "text-slate-400"}`}>
                        Due of {formatCurrency(l.totalDue)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2 text-[10px]">Lending Portfolio Metrics</h4>
            <div className="flex justify-between">
              <span>Total Principal Issued:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(lendingTotals.totalPrincipalGranted)}</span>
            </div>
            <div className="flex justify-between">
              <span>Computed Interest Revenue:</span>
              <span className="font-semibold text-brand-600">+{formatCurrency(lendingTotals.totalInterestGained)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Payments Collected:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(lendingTotals.totalCollected)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1.5" />
            <div className="flex justify-between font-bold text-slate-950 text-sm">
              <span>Remaining Portfolio Due:</span>
              <span className="text-orange-600">{formatCurrency(lendingTotals.totalOutstanding)}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Loan Details / Borrower Profile */}
        <div className="lg:col-span-2">
          {!selectedLoanInfo ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No Borrower Record Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Select an active borrower from the list panel to log loan repayments, manage interest configurations, check due schedules, or export agreements.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{selectedLoanInfo.borrowerName}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedLoanInfo.status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedLoanInfo.status === "Overdue"
                          ? "bg-red-100 text-red-800"
                          : "bg-brand-100 text-brand-800"
                      }`}>
                        {selectedLoanInfo.status}
                      </span>
                    </div>
                    {/* Contacts & Address */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      {selectedLoanInfo.contactNumber && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {selectedLoanInfo.contactNumber}
                        </span>
                      )}
                      {selectedLoanInfo.address && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {selectedLoanInfo.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setLoanModal({
                        open: true,
                        editId: selectedLoanInfo.id,
                        borrowerName: selectedLoanInfo.borrowerName,
                        contactNumber: selectedLoanInfo.contactNumber,
                        address: selectedLoanInfo.address,
                        principalAmount: selectedLoanInfo.principalAmount,
                        loanDate: selectedLoanInfo.loanDate,
                        dueDate: selectedLoanInfo.dueDate,
                        paymentSchedule: selectedLoanInfo.paymentSchedule,
                        interestType: selectedLoanInfo.interestType,
                        interestValue: selectedLoanInfo.interestValue,
                        notes: selectedLoanInfo.notes
                      })}
                      className="inline-flex items-center justify-center p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                      title="Edit Loan"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLoanClick(selectedLoanInfo.id, selectedLoanInfo.borrowerName)}
                      className="inline-flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition"
                      title="Delete Loan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setReceiptModalOpen(true)}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Loan Agreement / SOA
                    </button>
                  </div>
                </div>

                {/* Grid stats details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mt-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Principal Cash</span>
                    <span className="block text-sm font-bold text-slate-800 mt-1">{formatCurrency(selectedLoanInfo.principalAmount)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Interest Gain</span>
                    <span className="block text-sm font-bold text-brand-600 mt-1">+{formatCurrency(selectedLoanInfo.interestAmount)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Paid</span>
                    <span className="block text-sm font-bold text-emerald-600 mt-1">{formatCurrency(selectedLoanInfo.totalPaid)}</span>
                  </div>
                  <div className="p-3 bg-brand-50 rounded-xl">
                    <span className="block text-[10px] text-brand-700 uppercase tracking-wider font-semibold">Total Balance Due</span>
                    <span className="block text-sm font-bold text-brand-600 mt-1">{formatCurrency(selectedLoanInfo.remainingBalance)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 mt-4 border-t border-slate-50 pt-4">
                  <div>
                    <strong>Date Granted:</strong> <span className="text-slate-800">{selectedLoanInfo.loanDate}</span>
                  </div>
                  <div>
                    <strong>Due Schedule:</strong> <span className="text-slate-800">{selectedLoanInfo.dueDate || "N/A"}</span>
                  </div>
                  <div>
                    <strong>Repayment Plan:</strong> <span className="text-slate-800">{selectedLoanInfo.paymentSchedule}</span>
                  </div>
                </div>

                {selectedLoanInfo.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                    <strong className="block text-slate-800 mb-1">Loan Conditions & Notes:</strong>
                    <p className="whitespace-pre-line">{selectedLoanInfo.notes}</p>
                  </div>
                )}
              </div>

              {/* Repayments log */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h4 className="font-semibold text-sm text-slate-800">Repayment Installments ({selectedLoanInfo.payments.length})</h4>
                  <button
                    onClick={() => setPaymentModal({
                      open: true,
                      paymentDate: new Date().toISOString().split("T")[0],
                      amountPaid: 0,
                      paymentMethod: "Cash",
                      notes: ""
                    })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                  >
                    <Plus className="w-3 h-3" /> Record Repayment
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {selectedLoanInfo.payments.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-300">
                      No payments logged yet for this loan.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2">Payment Date</th>
                          <th className="pb-2">Method</th>
                          <th className="pb-2">Remarks / Notes</th>
                          <th className="pb-2 text-right">Amount Paid</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedLoanInfo.payments.map((py) => (
                          <tr key={py.id} className="hover:bg-slate-50/30">
                            <td className="py-2.5 text-slate-800 font-semibold">{py.paymentDate}</td>
                            <td className="py-2.5">
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                                {py.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-500 max-w-xs truncate">{py.notes || "—"}</td>
                            <td className="py-2.5 text-right font-bold text-emerald-600">
                              {formatCurrency(py.amountPaid)}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => setPaymentModal({
                                    open: true,
                                    editId: py.id,
                                    paymentDate: py.paymentDate,
                                    amountPaid: py.amountPaid,
                                    paymentMethod: py.paymentMethod,
                                    notes: py.notes
                                  })}
                                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePaymentClick(py.id)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==============================================
          MODALS & OVERLAYS
          ============================================== */}

      {/* 1. Loan Add/Edit Modal */}
      {loanModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {loanModal.editId ? "Modify Cash Loan Details" : "Record New Cash Loan"}
              </h4>
              <button onClick={() => setLoanModal({ ...loanModal, open: false })} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveLoan} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Borrower Full Name *</label>
                <input
                  type="text"
                  required
                  value={loanModal.borrowerName}
                  onChange={(e) => setLoanModal({ ...loanModal, borrowerName: e.target.value })}
                  placeholder="e.g. Maria Clara"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={loanModal.contactNumber}
                    onChange={(e) => setLoanModal({ ...loanModal, contactNumber: e.target.value })}
                    placeholder="09187654321"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Address / Location</label>
                  <input
                    type="text"
                    value={loanModal.address}
                    onChange={(e) => setLoanModal({ ...loanModal, address: e.target.value })}
                    placeholder="e.g. Manila"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Principal Amount (PHP) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={loanModal.principalAmount}
                    onChange={(e) => setLoanModal({ ...loanModal, principalAmount: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Repayment Plan</label>
                  <select
                    value={loanModal.paymentSchedule}
                    onChange={(e) => setLoanModal({ ...loanModal, paymentSchedule: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  >
                    <option value="On Due Date">Single Payment on Due</option>
                    <option value="Weekly">Weekly Installments</option>
                    <option value="Monthly">Monthly Installments</option>
                    <option value="Semi-monthly">Semi-Monthly (15th/30th)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Interest Calculation Type</label>
                  <select
                    value={loanModal.interestType}
                    onChange={(e) => setLoanModal({ ...loanModal, interestType: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  >
                    <option value="Percentage">Percentage Rate (%)</option>
                    <option value="Fixed Amount">Fixed PHP Surcharge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rate / Value</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={loanModal.interestValue}
                    onChange={(e) => setLoanModal({ ...loanModal, interestValue: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Loan Date</label>
                  <input
                    type="date"
                    required
                    value={loanModal.loanDate}
                    onChange={(e) => setLoanModal({ ...loanModal, loanDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={loanModal.dueDate}
                    onChange={(e) => setLoanModal({ ...loanModal, dueDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loan Agreement / Notes</label>
                <textarea
                  value={loanModal.notes}
                  onChange={(e) => setLoanModal({ ...loanModal, notes: e.target.value })}
                  placeholder="Record terms, bank reference IDs, special conditions..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLoanModal({ ...loanModal, open: false })}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Save Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Repayment Record Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {paymentModal.editId ? "Modify Loan Repayment" : "Log Cash Loan Repayment"}
              </h4>
              <button onClick={() => setPaymentModal({ ...paymentModal, open: false })} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Repayment Amount (PHP) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={paymentModal.amountPaid}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amountPaid: Number(e.target.value) })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Repayment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentModal.paymentDate}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={paymentModal.paymentMethod}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  >
                    <option value="Cash">Cash</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Repayment Remarks</label>
                <input
                  type="text"
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({ ...paymentModal, notes: e.target.value })}
                  placeholder="e.g. Receipt No, installment count, note..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ ...paymentModal, open: false })}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Log Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Receipt & Agreement Statement Overlay */}
      {receiptModalOpen && selectedLoanInfo && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:absolute print:inset-0">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in print:shadow-none print:rounded-none print:w-full">
            {/* Header control bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Printer className="w-4 h-4 text-slate-500" />
                Loan Agreement & Statement Of Account
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Statement
                </button>
                <button
                  onClick={() => setReceiptModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Statement of Loan Sheet */}
            <div className="p-8 space-y-6 text-slate-800 bg-white print:p-0">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h1 className="text-lg font-extrabold text-brand-600 uppercase tracking-tight">
                    {settings.personalBusinessName || "Personal Finance System"}
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Cash Lending Ledger & Agreement</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 uppercase block">Statement of Loan Account</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Agreement Reference: {selectedLoanInfo.id.substring(5, 12).toUpperCase()}</span>
                  <span className="text-[10px] text-slate-500 block">Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Parties info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-none print:p-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Lender:</span>
                  <h3 className="font-bold text-slate-900">Ian Tolentino</h3>
                  <p className="text-slate-500">Contact: System Administrator</p>
                </div>
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-none print:p-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Borrower / Payee:</span>
                  <h3 className="font-bold text-slate-900">{selectedLoanInfo.borrowerName}</h3>
                  {selectedLoanInfo.contactNumber && <p className="text-slate-500">Phone: {selectedLoanInfo.contactNumber}</p>}
                  {selectedLoanInfo.address && <p className="text-slate-500">Address: {selectedLoanInfo.address}</p>}
                </div>
              </div>

              {/* Loan parameters */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lending Terms Sheet</h4>
                <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                      <th className="py-2 px-1">Principal Amount</th>
                      <th className="py-2">Interest Agreement</th>
                      <th className="py-2">Repayment Schedule</th>
                      <th className="py-2 text-right px-1">Gross Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 px-1 text-slate-900 font-bold">{formatCurrency(selectedLoanInfo.principalAmount)}</td>
                      <td className="py-3 text-slate-600">
                        {selectedLoanInfo.interestType === "Percentage" 
                          ? `${selectedLoanInfo.interestValue}% Rate (+${formatCurrency(selectedLoanInfo.interestAmount)})`
                          : `Fixed PHP Surcharge (+${formatCurrency(selectedLoanInfo.interestAmount)})`}
                      </td>
                      <td className="py-3 text-slate-600">{selectedLoanInfo.paymentSchedule}</td>
                      <td className="py-3 text-right font-extrabold text-slate-950 px-1">{formatCurrency(selectedLoanInfo.totalDue)}</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>

              {/* Payment histories */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Repayment installment Ledgers</h4>
                {selectedLoanInfo.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No repayments logged on this ledger.</p>
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                        <th className="py-1.5 px-1">Date Paid</th>
                        <th className="py-1.5">Method</th>
                        <th className="py-1.5">Remarks / References</th>
                        <th className="py-1.5 text-right px-1">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLoanInfo.payments.map((py) => (
                        <tr key={py.id}>
                          <td className="py-2 px-1 text-slate-600">{py.paymentDate}</td>
                          <td className="py-2 text-slate-700">{py.paymentMethod}</td>
                          <td className="py-2 text-slate-400">{py.notes || "—"}</td>
                          <td className="py-2 text-right font-bold text-emerald-600 px-1">{formatCurrency(py.amountPaid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>

              {/* Layout Totals */}
              <div className="border-t border-slate-200 pt-4 flex flex-col items-end text-xs space-y-1.5">
                <div className="flex justify-between w-64 text-slate-500">
                  <span>Gross Principal + Interest Due:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(selectedLoanInfo.totalDue)}</span>
                </div>
                <div className="flex justify-between w-64 text-slate-500">
                  <span>Less Total Installments Collected:</span>
                  <span className="font-semibold text-emerald-600">-{formatCurrency(selectedLoanInfo.totalPaid)}</span>
                </div>
                <div className="h-px bg-slate-200 w-64 my-1" />
                <div className="flex justify-between w-64 text-sm font-extrabold text-slate-900 bg-brand-50/50 p-2 rounded-lg print:bg-transparent print:p-0">
                  <span>Net Outstanding Balance:</span>
                  <span className="text-brand-600">{formatCurrency(selectedLoanInfo.remainingBalance)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-[10px] text-slate-400">
                <div className="border-t border-dashed border-slate-200 pt-2">
                  Ian Tolentino <br />
                  <span className="font-medium text-slate-300">Lender Signature / Date</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-2">
                  {selectedLoanInfo.borrowerName} <br />
                  <span className="font-medium text-slate-300">Borrower Signature / Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
