import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  Phone,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  CreditCard,
  ArrowRight,
  Printer,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { Customer, Purchase, Payment, SystemSettings } from "../types";

interface SPayLaterProps {
  customers: Customer[];
  purchases: Purchase[];
  payments: Payment[];
  settings: SystemSettings;
  activeCycle: string;
  onAddCustomer: (c: Partial<Customer>) => Promise<any>;
  onEditCustomer: (id: string, c: Partial<Customer>) => Promise<any>;
  onDeleteCustomer: (id: string) => Promise<any>;
  onAddPurchase: (p: Partial<Purchase>) => Promise<any>;
  onEditPurchase: (id: string, p: Partial<Purchase>) => Promise<any>;
  onDeletePurchase: (id: string) => Promise<any>;
  onAddPayment: (py: Partial<Payment>) => Promise<any>;
  onEditPayment: (id: string, py: Partial<Payment>) => Promise<any>;
  onDeletePayment: (id: string) => Promise<any>;
  onCompleteBillingCycle: () => Promise<any>;
  // Set when arriving here via global search - pre-selects the customer once.
  initialSelectedCustomerId?: string;
  onConsumeInitialSelection?: () => void;
}

export default function SPayLater({
  customers,
  purchases,
  payments,
  settings,
  activeCycle,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onAddPurchase,
  onEditPurchase,
  onDeletePurchase,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
  onCompleteBillingCycle,
  initialSelectedCustomerId,
  onConsumeInitialSelection
}: SPayLaterProps) {

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialSelectedCustomerId ?? null);

  useEffect(() => {
    if (initialSelectedCustomerId) onConsumeInitialSelection?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modals state
  const [customerModal, setCustomerModal] = useState<{ open: boolean; editId?: string; fullName: string; contactNumber: string; messengerLink: string; notes: string; carriedOverBalance: number }>({
    open: false,
    fullName: "",
    contactNumber: "",
    messengerLink: "",
    notes: "",
    carriedOverBalance: 0
  });

  const [purchaseModal, setPurchaseModal] = useState<{ open: boolean; editId?: string; itemName: string; description: string; quantity: number; originalCost: number; totalAmount: number; dueDate: string; installmentMonths: number; remarks: string }>({
    open: false,
    itemName: "",
    description: "",
    quantity: 1,
    originalCost: 0,
    totalAmount: 0,
    dueDate: new Date().toISOString().split("T")[0],
    installmentMonths: 1,
    remarks: ""
  });

  const [paymentModal, setPaymentModal] = useState<{ open: boolean; editId?: string; paymentDate: string; amountPaid: number; paymentMethod: string; notes: string }>({
    open: false,
    paymentDate: new Date().toISOString().split("T")[0],
    amountPaid: 0,
    paymentMethod: "GCash",
    notes: ""
  });

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [completeCycleConfirmOpen, setCompleteCycleConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency || "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Filter customers to only active billing cycle
  const cycleCustomers = useMemo(() => {
    return customers.filter(c => c.billingCycle === activeCycle);
  }, [customers, activeCycle]);

  // Compute calculated balances per customer for the active cycle
  const computedCustomers = useMemo(() => {
    return cycleCustomers.map(customer => {
      const custPurchases = purchases.filter(p => p.customerId === customer.id && p.billingCycle === activeCycle);
      const custPayments = payments.filter(p => p.customerId === customer.id && p.billingCycle === activeCycle);

      const totalPurchases = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (customer.carriedOverBalance || 0);
      const totalPaid = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remainingBalance = Math.max(0, totalPurchases - totalPaid);

      return {
        ...customer,
        totalPurchases,
        totalPaid,
        remainingBalance
      };
    });
  }, [cycleCustomers, purchases, payments, activeCycle]);

  // Apply search query and status filtering
  const filteredCustomers = useMemo(() => {
    return computedCustomers.filter(c => {
      const matchesSearch = c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.contactNumber.includes(searchQuery) || 
        c.notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [computedCustomers, searchQuery, statusFilter]);

  // Selected customer profile data
  const selectedCustomerInfo = useMemo(() => {
    if (!selectedCustomerId) return null;
    const baseInfo = computedCustomers.find(c => c.id === selectedCustomerId);
    if (!baseInfo) return null;

    const custPurchases = purchases.filter(p => p.customerId === selectedCustomerId && p.billingCycle === activeCycle);
    const custPayments = payments.filter(p => p.customerId === selectedCustomerId && p.billingCycle === activeCycle);

    return {
      ...baseInfo,
      purchases: custPurchases,
      payments: custPayments
    };
  }, [selectedCustomerId, computedCustomers, purchases, payments, activeCycle]);

  // Total receivables summary for the list
  const activeTotals = useMemo(() => {
    const totalPurchases = computedCustomers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPaid = computedCustomers.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalOutstanding = computedCustomers.reduce((sum, c) => sum + c.remainingBalance, 0);

    return { totalPurchases, totalPaid, totalOutstanding };
  }, [computedCustomers]);

  // Save actions for Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerModal.fullName.trim()) return;
    setIsLoading(true);
    try {
      const payload = {
        fullName: customerModal.fullName,
        contactNumber: customerModal.contactNumber,
        messengerLink: customerModal.messengerLink,
        notes: customerModal.notes,
        carriedOverBalance: Number(customerModal.carriedOverBalance) || 0
      };

      if (customerModal.editId) {
        await onEditCustomer(customerModal.editId, payload);
      } else {
        await onAddCustomer(payload);
      }
      setCustomerModal({ open: false, fullName: "", contactNumber: "", messengerLink: "", notes: "", carriedOverBalance: 0 });
    } catch (err) {
      alert("Error saving customer");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomerClick = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This will clear all active purchases and payments for this customer.`)) {
      setIsLoading(true);
      try {
        await onDeleteCustomer(id);
        if (selectedCustomerId === id) setSelectedCustomerId(null);
      } catch (err) {
        alert("Error deleting customer");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Save actions for Purchase
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !purchaseModal.itemName.trim()) return;
    setIsLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        itemName: purchaseModal.itemName,
        description: purchaseModal.description,
        quantity: purchaseModal.quantity,
        originalCost: purchaseModal.originalCost,
        totalAmount: purchaseModal.totalAmount,
        dueDate: purchaseModal.dueDate,
        installmentMonths: purchaseModal.installmentMonths,
        remarks: purchaseModal.remarks
      };

      if (purchaseModal.editId) {
        await onEditPurchase(purchaseModal.editId, payload);
      } else {
        await onAddPurchase(payload);
      }
      setPurchaseModal({ open: false, itemName: "", description: "", quantity: 1, originalCost: 0, totalAmount: 0, dueDate: new Date().toISOString().split("T")[0], installmentMonths: 1, remarks: "" });
    } catch (err) {
      alert("Error saving purchase");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Purchase
  const handleDeletePurchaseClick = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase item?")) {
      setIsLoading(true);
      try {
        await onDeletePurchase(id);
      } catch (err) {
        alert("Error deleting purchase");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Save actions for Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || paymentModal.amountPaid <= 0) return;
    setIsLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        paymentDate: paymentModal.paymentDate,
        amountPaid: paymentModal.amountPaid,
        paymentMethod: paymentModal.paymentMethod,
        notes: paymentModal.notes
      };

      if (paymentModal.editId) {
        await onEditPayment(paymentModal.editId, payload);
      } else {
        await onAddPayment(payload);
      }
      setPaymentModal({ open: false, paymentDate: new Date().toISOString().split("T")[0], amountPaid: 0, paymentMethod: "GCash", notes: "" });
    } catch (err) {
      alert("Error saving payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Payment
  const handleDeletePaymentClick = async (id: string) => {
    if (confirm("Are you sure you want to remove this payment record?")) {
      setIsLoading(true);
      try {
        await onDeletePayment(id);
      } catch (err) {
        alert("Error removing payment");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Complete billing cycle trigger
  const handleCompleteBillingCycleClick = async () => {
    setIsLoading(true);
    try {
      await onCompleteBillingCycle();
      setCompleteCycleConfirmOpen(false);
      setSelectedCustomerId(null);
    } catch (err) {
      alert("Error completing billing cycle");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Print of Invoice
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header with cycle details and complete cycle button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" />
            SPayLater Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Current Billing Cycle: <strong className="text-brand-600 font-semibold">{activeCycle}</strong>
          </p>
        </div>
        <div>
          <button
            onClick={() => setCompleteCycleConfirmOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm hover:shadow transition"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Payment Complete (Archive Month)
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Customers list & tools */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">Customers ({filteredCustomers.length})</h3>
              <button
                onClick={() => setCustomerModal({ open: true, fullName: "", contactNumber: "", messengerLink: "", notes: "", carriedOverBalance: 0 })}
                className="p-1.5 text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
                title="Add New Customer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, contact, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
              />
            </div>

            {/* Status Tabs Filters */}
            <div className="flex border-b border-slate-100 text-[11px] font-medium text-slate-500 gap-1 pb-1 overflow-x-auto">
              {["All", "Active", "Fully Paid", "Overdue"].map((status) => (
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

            {/* Customers list container */}
            <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-300">
                  No customers found matching search filters.
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedCustomerId === c.id
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-100 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs leading-none">
                        {c.fullName}
                      </h4>
                      <p className={`text-[10px] ${selectedCustomerId === c.id ? "text-slate-300" : "text-slate-400"}`}>
                        {c.contactNumber || "No contact"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          c.status === "Fully Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-orange-100 text-orange-800"
                        }`}>
                          {c.status}
                        </span>
                        {c.carriedOverBalance > 0 && (
                          <span className="text-[9px] text-orange-500 font-medium">
                            +{formatCurrency(c.carriedOverBalance)} carry-over
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-bold">
                        {formatCurrency(c.remainingBalance)}
                      </span>
                      <span className={`text-[9px] block mt-0.5 ${selectedCustomerId === c.id ? "text-slate-400" : "text-slate-400"}`}>
                        Pending of {formatCurrency(c.totalPurchases)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mini Totals Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cycle Summary Metrics</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Receivables:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(activeTotals.totalPurchases)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Collected:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(activeTotals.totalPaid)}</span>
              </div>
              <div className="h-px bg-slate-200 my-1.5" />
              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>Total Outstanding:</span>
                <span className="text-orange-600">{formatCurrency(activeTotals.totalOutstanding)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Profile & Purchases / Payments lists */}
        <div className="lg:col-span-2">
          {!selectedCustomerInfo ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No Customer Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Select a customer from the left sidebar panel to view their detailed purchase history, payment schedules, outstanding balances, or generate statements.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Card Summary Header */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{selectedCustomerInfo.fullName}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCustomerInfo.status === "Fully Paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedCustomerInfo.status === "Overdue"
                          ? "bg-red-100 text-red-800"
                          : "bg-orange-100 text-orange-800"
                      }`}>
                        {selectedCustomerInfo.status}
                      </span>
                    </div>
                    {/* Contacts row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      {selectedCustomerInfo.contactNumber && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {selectedCustomerInfo.contactNumber}
                        </span>
                      )}
                      {selectedCustomerInfo.messengerLink && (
                        <a
                          href={selectedCustomerInfo.messengerLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-brand-600 hover:underline"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                          Chat on Messenger
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setCustomerModal({
                        open: true,
                        editId: selectedCustomerInfo.id,
                        fullName: selectedCustomerInfo.fullName,
                        contactNumber: selectedCustomerInfo.contactNumber,
                        messengerLink: selectedCustomerInfo.messengerLink,
                        notes: selectedCustomerInfo.notes,
                        carriedOverBalance: selectedCustomerInfo.carriedOverBalance
                      })}
                      className="inline-flex items-center justify-center p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                      title="Edit Customer Profile"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomerClick(selectedCustomerInfo.id, selectedCustomerInfo.fullName)}
                      className="inline-flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-100"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setInvoiceModalOpen(true)}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Invoice/SOA
                    </button>
                  </div>
                </div>

                {/* Balance Split display cards */}
                <div className="grid grid-cols-3 gap-2 text-center mt-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Purchased</span>
                    <span className="block text-sm font-bold text-slate-800 mt-1">{formatCurrency(selectedCustomerInfo.totalPurchases)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Paid</span>
                    <span className="block text-sm font-bold text-emerald-600 mt-1">{formatCurrency(selectedCustomerInfo.totalPaid)}</span>
                  </div>
                  <div className="p-3 bg-brand-50/50 rounded-xl">
                    <span className="block text-[10px] text-brand-700 uppercase tracking-wider font-semibold">Remaining Due</span>
                    <span className="block text-sm font-bold text-brand-600 mt-1">{formatCurrency(selectedCustomerInfo.remainingBalance)}</span>
                  </div>
                </div>

                {selectedCustomerInfo.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                    <strong className="block text-slate-800 mb-1">Notes:</strong>
                    <p className="whitespace-pre-line">{selectedCustomerInfo.notes}</p>
                  </div>
                )}
              </div>

              {/* Purchase History Panel */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h4 className="font-semibold text-sm text-slate-800">Purchase History ({selectedCustomerInfo.purchases.length})</h4>
                  <button
                    onClick={() => setPurchaseModal({
                      open: true,
                      itemName: "",
                      description: "",
                      quantity: 1,
                      originalCost: 0,
                      totalAmount: 0,
                      dueDate: new Date().toISOString().split("T")[0],
                      installmentMonths: 1,
                      remarks: ""
                    })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
                  >
                    <Plus className="w-3 h-3" /> Add Purchase
                  </button>
                </div>

                {/* Carried over balance block if any */}
                {selectedCustomerInfo.carriedOverBalance > 0 && (
                  <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 text-xs text-orange-800 flex justify-between items-center">
                    <div>
                      <strong className="font-semibold">Carried Over Balance:</strong>
                      <span className="block text-[10px] text-orange-600">Outstanding balance from previous billing cycle.</span>
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(selectedCustomerInfo.carriedOverBalance)}</span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {selectedCustomerInfo.purchases.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-300">
                      No active purchases added yet. Click &quot;Add Purchase&quot; to log items.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2">Item Details</th>
                          <th className="pb-2">Purchase Date</th>
                          <th className="pb-2 text-right">Cost</th>
                          <th className="pb-2 text-right">Total Amount</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedCustomerInfo.purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/30">
                            <td className="py-2.5">
                              <span className="font-bold text-slate-800 block">{p.itemName}</span>
                              {p.description && <span className="text-[10px] text-slate-400 block">{p.description}</span>}
                              {p.remarks && <span className="text-[10px] text-brand-500 italic block">*{p.remarks}</span>}
                            </td>
                            <td className="py-2.5 text-slate-500">
                              {p.purchaseDate}
                              {p.dueDate && (
                                <span className="text-[10px] block text-red-500 font-medium flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" /> Due: {p.dueDate}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right text-slate-500">
                              {formatCurrency(p.originalCost)} {p.quantity > 1 && `x${p.quantity}`}
                            </td>
                            <td className="py-2.5 text-right font-semibold text-slate-800">
                              {formatCurrency(p.totalAmount)}
                              {p.installmentMonths > 1 && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  {p.installmentMonths} mos. installment
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => setPurchaseModal({
                                    open: true,
                                    editId: p.id,
                                    itemName: p.itemName,
                                    description: p.description,
                                    quantity: p.quantity,
                                    originalCost: p.originalCost,
                                    totalAmount: p.totalAmount,
                                    dueDate: p.dueDate,
                                    installmentMonths: p.installmentMonths,
                                    remarks: p.remarks
                                  })}
                                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePurchaseClick(p.id)}
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

              {/* Payment History Panel */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h4 className="font-semibold text-sm text-slate-800">Payment Logs ({selectedCustomerInfo.payments.length})</h4>
                  <button
                    onClick={() => setPaymentModal({
                      open: true,
                      paymentDate: new Date().toISOString().split("T")[0],
                      amountPaid: 0,
                      paymentMethod: "GCash",
                      notes: ""
                    })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                  >
                    <Plus className="w-3 h-3" /> Record Payment
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {selectedCustomerInfo.payments.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-300">
                      No payments recorded yet. Click &quot;Record Payment&quot; to log collections.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-medium">
                          <th className="pb-2">Payment Date</th>
                          <th className="pb-2">Method</th>
                          <th className="pb-2">Notes</th>
                          <th className="pb-2 text-right">Amount Paid</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedCustomerInfo.payments.map((py) => (
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
          MODALS & DIALOGS
          ============================================== */}

      {/* 1. Customer Add/Edit Modal */}
      {customerModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {customerModal.editId ? "Edit Customer Details" : "Add New Customer"}
              </h4>
              <button onClick={() => setCustomerModal({ ...customerModal, open: false })} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerModal.fullName}
                  onChange={(e) => setCustomerModal({ ...customerModal, fullName: e.target.value })}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={customerModal.contactNumber}
                    onChange={(e) => setCustomerModal({ ...customerModal, contactNumber: e.target.value })}
                    placeholder="e.g. 09171234567"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Carry-Over Balance</label>
                  <input
                    type="number"
                    value={customerModal.carriedOverBalance}
                    onChange={(e) => setCustomerModal({ ...customerModal, carriedOverBalance: Number(e.target.value) })}
                    placeholder="0"
                    disabled={!!customerModal.editId}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Facebook Messenger Link</label>
                <input
                  type="url"
                  value={customerModal.messengerLink}
                  onChange={(e) => setCustomerModal({ ...customerModal, messengerLink: e.target.value })}
                  placeholder="https://m.me/username"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Profile Notes</label>
                <textarea
                  value={customerModal.notes}
                  onChange={(e) => setCustomerModal({ ...customerModal, notes: e.target.value })}
                  placeholder="Add details about billing, specific conditions..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomerModal({ ...customerModal, open: false })}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Purchase Add/Edit Modal */}
      {purchaseModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {purchaseModal.editId ? "Edit Purchase Record" : "Add Purchase Item"}
              </h4>
              <button onClick={() => setPurchaseModal({ ...purchaseModal, open: false })} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePurchase} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={purchaseModal.itemName}
                  onChange={(e) => setPurchaseModal({ ...purchaseModal, itemName: e.target.value })}
                  placeholder="e.g. Air Fryer"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Short Description</label>
                <input
                  type="text"
                  value={purchaseModal.description}
                  onChange={(e) => setPurchaseModal({ ...purchaseModal, description: e.target.value })}
                  placeholder="e.g. Xiaomi Smart 3.5L"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={purchaseModal.quantity}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, quantity: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Installment Months</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={purchaseModal.installmentMonths}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, installmentMonths: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Original Cost (PHP)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={purchaseModal.originalCost}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, originalCost: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Due Amount (PHP) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={purchaseModal.totalAmount}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, totalAmount: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={purchaseModal.dueDate}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, dueDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
                  <input
                    type="text"
                    value={purchaseModal.remarks}
                    onChange={(e) => setPurchaseModal({ ...purchaseModal, remarks: e.target.value })}
                    placeholder="e.g. GCash payments only"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPurchaseModal({ ...purchaseModal, open: false })}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Log Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Payment Add/Edit Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {paymentModal.editId ? "Edit Payment Record" : "Record Customer Payment"}
              </h4>
              <button onClick={() => setPaymentModal({ ...paymentModal, open: false })} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Paid (PHP) *</label>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
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
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Maya">Maya</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({ ...paymentModal, notes: e.target.value })}
                  placeholder="e.g. GCash reference No, remarks..."
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
                  {isLoading ? "Saving..." : "Log Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Complete Cycle Confirmation Drawer Dialog */}
      {completeCycleConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in p-5 space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-brand-50 text-brand-600 rounded-full mb-2">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Archive Billing Cycle?</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Are you sure all customer payments for this billing cycle (<strong className="text-slate-800">{activeCycle}</strong>) have been completed and finalized?
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
              <p>• Current active cycle month will be archived as <strong className="text-slate-800">Read-Only</strong>.</p>
              <p>• Unpaid customer outstanding balances will carry forward into the next billing cycle automatically.</p>
              <p>• Active workspace will reset with a clean history sheet for the new billing cycle.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCompleteCycleConfirmOpen(false)}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteBillingCycleClick}
                disabled={isLoading}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow transition disabled:opacity-50"
              >
                {isLoading ? "Archiving..." : "Confirm Payment Complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Invoices & Statements Generator Modal Overlay */}
      {invoiceModalOpen && selectedCustomerInfo && (
        <div 
          onClick={() => setInvoiceModalOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex justify-center items-center p-4 print:bg-white print:p-0 print:absolute print:inset-0"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 print:shadow-none print:rounded-none print:w-full print:max-h-none"
          >
            {/* Header: Hide when printing */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden shrink-0 bg-white dark:bg-slate-900">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                <Printer className="w-4 h-4 text-slate-500" />
                Statement Of Account / Invoice
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-white bg-slate-950 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Statement
                </button>
                <button
                  onClick={() => setInvoiceModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Print Friendly Canvas Sheet - Scrollable area inside the modal */}
            <div className="p-6 md:p-8 space-y-6 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
              {/* Print header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h1 className="text-lg font-extrabold text-brand-600 uppercase tracking-tight">
                    {settings.personalBusinessName || "Personal Finance System"}
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">SPayLater Billing & Receivable Statement</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 uppercase block">Statement of Account</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Billing Cycle: {activeCycle}</span>
                  <span className="text-[10px] text-slate-500 block">Date Generated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Customer & Billing information */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-none print:p-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Billed To:</span>
                  <h3 className="font-bold text-slate-900">{selectedCustomerInfo.fullName}</h3>
                  {selectedCustomerInfo.contactNumber && <p className="text-slate-500">Phone: {selectedCustomerInfo.contactNumber}</p>}
                </div>
                <div className="text-right space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-none print:p-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Payment Instructions:</span>
                  <p className="font-medium text-slate-900">GCash / Maya / Bank</p>
                  <p className="text-[10px] text-slate-500">Please send GCash receipts via Messenger.</p>
                </div>
              </div>

              {/* Purchases table */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Purchased Items & Outstanding Records</h4>
                <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                      <th className="py-2 px-1">Item Detail</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Original Cost</th>
                      <th className="py-2 text-right px-1">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Carried over balance line if any */}
                    {selectedCustomerInfo.carriedOverBalance > 0 && (
                      <tr>
                        <td className="py-2.5 px-1 font-semibold text-slate-700">
                          Carried over balance from previous cycles
                        </td>
                        <td className="py-2.5 text-right">—</td>
                        <td className="py-2.5 text-right">—</td>
                        <td className="py-2.5 text-right font-bold px-1 text-slate-800">
                          {formatCurrency(selectedCustomerInfo.carriedOverBalance)}
                        </td>
                      </tr>
                    )}
                    {selectedCustomerInfo.purchases.length === 0 && selectedCustomerInfo.carriedOverBalance === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">No active billing items.</td>
                      </tr>
                    ) : (
                      selectedCustomerInfo.purchases.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-1">
                            <span className="font-bold text-slate-900">{p.itemName}</span>
                            {p.description && <span className="text-[10px] text-slate-400 block">{p.description}</span>}
                          </td>
                          <td className="py-2.5 text-right text-slate-600">{p.quantity}</td>
                          <td className="py-2.5 text-right text-slate-600">{formatCurrency(p.originalCost)}</td>
                          <td className="py-2.5 text-right font-semibold text-slate-900 px-1">{formatCurrency(p.totalAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Payments log */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payment / Collection Logs</h4>
                {selectedCustomerInfo.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payments logged in this cycle yet.</p>
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                        <th className="py-1.5 px-1">Date Paid</th>
                        <th className="py-1.5">Method</th>
                        <th className="py-1.5">Notes</th>
                        <th className="py-1.5 text-right px-1">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCustomerInfo.payments.map((py) => (
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

              {/* Total calculations footer sheet */}
              <div className="border-t border-slate-200 pt-4 flex flex-col items-end text-xs space-y-1.5">
                <div className="flex justify-between w-64 text-slate-500">
                  <span>Gross Receivables Due:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(selectedCustomerInfo.totalPurchases)}</span>
                </div>
                <div className="flex justify-between w-64 text-slate-500">
                  <span>Less Total Payments Made:</span>
                  <span className="font-semibold text-emerald-600">-{formatCurrency(selectedCustomerInfo.totalPaid)}</span>
                </div>
                <div className="h-px bg-slate-200 w-64 my-1" />
                <div className="flex justify-between w-64 text-sm font-extrabold text-slate-900 bg-slate-50 p-2 rounded-lg print:bg-transparent print:p-0">
                  <span>Remaining Balance:</span>
                  <span className="text-brand-600">{formatCurrency(selectedCustomerInfo.remainingBalance)}</span>
                </div>
              </div>

              {/* Signature lines */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-[10px] text-slate-400">
                <div className="border-t border-dashed border-slate-200 pt-2">
                  {settings.personalBusinessName} <br />
                  <span className="font-medium text-slate-300">Signature / Date</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-2">
                  {selectedCustomerInfo.fullName} <br />
                  <span className="font-medium text-slate-300">Customer Signature / Date</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Footer: Hidden when printing */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 print:hidden shrink-0">
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition shadow-xs"
              >
                Close / Dismiss
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
