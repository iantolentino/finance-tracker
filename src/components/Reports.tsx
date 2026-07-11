import React, { useState, useMemo } from "react";
import {
  FileText,
  Printer,
  TrendingUp,
  AlertTriangle,
  Users,
  Search,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  DollarSign,
  TrendingDown
} from "lucide-react";
import { Customer, Purchase, Payment, Loan, SystemSettings } from "../types";

interface ReportsProps {
  customers: Customer[];
  purchases: Purchase[];
  payments: Payment[];
  loans: Loan[];
  settings: SystemSettings;
  activeCycle: string;
}

export default function Reports({
  customers,
  purchases,
  payments,
  loans,
  settings,
  activeCycle
}: ReportsProps) {
  
  // States
  const [reportType, setReportType] = useState<"outstanding" | "collections" | "overdue" | "loans">("outstanding");
  const [searchQuery, setSearchQuery] = useState("");

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency || "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Compute customer summaries for active cycle
  const computedCustomers = useMemo(() => {
    const cycleCustomers = customers.filter(c => c.billingCycle === activeCycle);
    return cycleCustomers.map(c => {
      const custPurchases = purchases.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);
      const custPayments = payments.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);

      const totalBuy = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (c.carriedOverBalance || 0);
      const totalPaid = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remainingBalance = Math.max(0, totalBuy - totalPaid);

      return {
        ...c,
        totalBuy,
        totalPaid,
        remainingBalance
      };
    });
  }, [customers, purchases, payments, activeCycle]);

  // Outstanding Receivables report
  const outstandingReportData = useMemo(() => {
    return computedCustomers
      .filter(c => c.remainingBalance > 0 && c.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [computedCustomers, searchQuery]);

  // Collections received report (list of actual payments made in active cycle)
  const collectionsReportData = useMemo(() => {
    return payments
      .filter(p => p.billingCycle === activeCycle)
      .map(p => {
        const customer = customers.find(c => c.id === p.customerId);
        return {
          ...p,
          customerName: customer ? customer.fullName : "Unknown Customer"
        };
      })
      .filter(p => p.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, customers, activeCycle, searchQuery]);

  // Overdue Customers report (active customers with overdue status or containing overdue items)
  const overdueReportData = useMemo(() => {
    return computedCustomers
      .filter(c => {
        const hasOverduePurchases = purchases.some(p => p.customerId === c.id && p.billingCycle === activeCycle && p.dueDate && new Date(p.dueDate).getTime() < Date.now());
        const isOverdue = c.status === "Overdue" || hasOverduePurchases;
        return isOverdue && c.remainingBalance > 0 && c.fullName.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [computedCustomers, purchases, activeCycle, searchQuery]);

  // Cash Loans Report (Lending summary including payments, interest earned)
  const loansReportData = useMemo(() => {
    return loans
      .map(loan => {
        const principal = loan.principalAmount;
        const interest = loan.interestType === "Percentage" 
          ? (principal * (loan.interestValue / 100)) 
          : loan.interestValue;
        const totalDue = principal + interest;
        const paid = loan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
        const outstanding = Math.max(0, totalDue - paid);

        return {
          ...loan,
          interestAmount: interest,
          totalDue,
          totalPaid: paid,
          remainingBalance: outstanding
        };
      })
      .filter(l => l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [loans, searchQuery]);

  // Aggregated totals
  const reportTotals = useMemo(() => {
    if (reportType === "outstanding") {
      return outstandingReportData.reduce((sum, r) => sum + r.remainingBalance, 0);
    } else if (reportType === "collections") {
      return collectionsReportData.reduce((sum, r) => sum + r.amountPaid, 0);
    } else if (reportType === "overdue") {
      return overdueReportData.reduce((sum, r) => sum + r.remainingBalance, 0);
    } else {
      return loansReportData.reduce((sum, r) => sum + r.remainingBalance, 0);
    }
  }, [reportType, outstandingReportData, collectionsReportData, overdueReportData, loansReportData]);

  const totalInterestEarnedOnLoans = useMemo(() => {
    return loansReportData.reduce((sum, r) => sum + r.interestAmount, 0);
  }, [loansReportData]);

  // Trigger Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header with control filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500" />
            Financial Report Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Active Cycle: <strong className="text-slate-800">{activeCycle}</strong> • View summaries, outstanding ledgers, collections logs, or export.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </button>
        </div>
      </div>

      {/* Select Report Type Cards - Hide on print */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        {[
          { id: "outstanding", title: "Outstanding Receivables", desc: "SPayLater pending amounts due", color: "green" },
          { id: "collections", title: "Monthly Collections", desc: "GCash/cash payments received", color: "emerald" },
          { id: "overdue", title: "Overdue Customers", desc: "Overdue payments require focus", color: "red" },
          { id: "loans", title: "Cash Loans (Lending)", desc: "Outstanding principal and interest", color: "green" }
        ].map((rep) => (
          <button
            key={rep.id}
            onClick={() => {
              setReportType(rep.id as any);
              setSearchQuery("");
            }}
            className={`p-4 rounded-2xl border text-left transition relative overflow-hidden group ${
              reportType === rep.id
                ? "bg-slate-900 border-slate-900 text-white shadow-md"
                : "bg-white border-slate-100 hover:bg-slate-50"
            }`}
          >
            <h4 className="font-bold text-xs">{rep.title}</h4>
            <p className={`text-[10px] mt-1 ${reportType === rep.id ? "text-slate-300" : "text-slate-400"}`}>
              {rep.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Filter bar - Hide on print */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 print:hidden">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Filter report records by name...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
          />
        </div>
        <div className="text-right text-xs text-slate-500">
          Showing <strong className="text-slate-800">{
            reportType === "outstanding" ? outstandingReportData.length :
            reportType === "collections" ? collectionsReportData.length :
            reportType === "overdue" ? overdueReportData.length : loansReportData.length
          }</strong> records
        </div>
      </div>

      {/* Active Print Canvas Area */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Print Header details */}
        <div className="hidden print:flex justify-between items-start border-b border-slate-200 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{settings.personalBusinessName}</h1>
            <span className="text-xs text-slate-400 block mt-0.5">Automated System Financial Ledger Report</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold uppercase text-brand-600 block">
              {reportType === "outstanding" && "Outstanding Receivables Report"}
              {reportType === "collections" && "Monthly Collections Report"}
              {reportType === "overdue" && "Overdue Receivables Report"}
              {reportType === "loans" && "Cash Loans (Lending) Summary"}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Billing Cycle: {activeCycle}</span>
            <span className="text-[10px] text-slate-500 block">Date Printed: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Section title */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {reportType === "outstanding" && "Outstanding Receivables Report"}
              {reportType === "collections" && "Monthly Collection Logs"}
              {reportType === "overdue" && "Overdue Collection Targets"}
              {reportType === "loans" && "Lending Portfolio Ledger"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 print:hidden">
              {reportType === "outstanding" && "List of customers with active remaining SPayLater dues for this billing month."}
              {reportType === "collections" && "Payment transactions logged by customers in this billing cycle."}
              {reportType === "overdue" && "Warning: Active customers with missed payment schedules or overdue items."}
              {reportType === "loans" && "Independent tracker of all personal cash loans granted, interest earned, and collection rate."}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Report Summary Sum:</span>
            <span className="text-lg font-bold text-slate-950">{formatCurrency(reportTotals)}</span>
          </div>
        </div>

        {/* Tables based on report selection */}
        <div className="overflow-x-auto">
          {reportType === "outstanding" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                  <th className="py-2.5 px-2">Customer Full Name</th>
                  <th className="py-2.5">Contact Number</th>
                  <th className="py-2.5 text-right">Total Charged</th>
                  <th className="py-2.5 text-right">Total Collected</th>
                  <th className="py-2.5 text-right px-2">Outstanding Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outstandingReportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-300">No active outstanding receivables.</td>
                  </tr>
                ) : (
                  outstandingReportData.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 px-2 font-bold text-slate-900">{row.fullName}</td>
                      <td className="py-3 text-slate-500">{row.contactNumber || "—"}</td>
                      <td className="py-3 text-right text-slate-600">{formatCurrency(row.totalBuy)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatCurrency(row.totalPaid)}</td>
                      <td className="py-3 text-right font-extrabold text-brand-600 px-2">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === "collections" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                  <th className="py-2.5 px-2">Payment Date</th>
                  <th className="py-2.5">Customer Name</th>
                  <th className="py-2.5">Method</th>
                  <th className="py-2.5">Remarks / Reference Details</th>
                  <th className="py-2.5 text-right px-2">Amount Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collectionsReportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-300">No collections transactions recorded this month.</td>
                  </tr>
                ) : (
                  collectionsReportData.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 px-2 text-slate-600 font-medium">{row.paymentDate}</td>
                      <td className="py-3 font-bold text-slate-900">{row.customerName}</td>
                      <td className="py-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[9px] uppercase">
                          {row.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 max-w-xs truncate">{row.notes || "—"}</td>
                      <td className="py-3 text-right font-extrabold text-emerald-600 px-2">{formatCurrency(row.amountPaid)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === "overdue" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                  <th className="py-2.5 px-2">Overdue Customer</th>
                  <th className="py-2.5">Dues Breakdown</th>
                  <th className="py-2.5 text-right">Total Charged</th>
                  <th className="py-2.5 text-right">Paid to Date</th>
                  <th className="py-2.5 text-right px-2">Urgent Overdue Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueReportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-300">Congratulations! No overdue customers.</td>
                  </tr>
                ) : (
                  overdueReportData.map((row) => (
                    <tr key={row.id} className="bg-red-50/20 print:bg-transparent">
                      <td className="py-3 px-2 font-bold text-slate-900">
                        {row.fullName}
                        <span className="block text-[9px] text-red-500 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> Overdue Status Tagged
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 text-[10px] max-w-xs whitespace-pre-line">{row.notes || "No remarks"}</td>
                      <td className="py-3 text-right text-slate-600">{formatCurrency(row.totalBuy)}</td>
                      <td className="py-3 text-right text-slate-500">{formatCurrency(row.totalPaid)}</td>
                      <td className="py-3 text-right font-extrabold text-red-600 px-2">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === "loans" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium bg-slate-50/50 print:bg-transparent">
                  <th className="py-2.5 px-2">Borrower Name</th>
                  <th className="py-2.5">Loan & Due Dates</th>
                  <th className="py-2.5 text-right">Principal</th>
                  <th className="py-2.5 text-right">Interest Gained</th>
                  <th className="py-2.5 text-right">Total Paid</th>
                  <th className="py-2.5 text-right px-2">Outstanding Dues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loansReportData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-300">No lending profiles on record.</td>
                  </tr>
                ) : (
                  loansReportData.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 px-2 font-bold text-slate-900">
                        {row.borrowerName}
                        <span className={`block mt-0.5 text-[9px] font-semibold text-slate-400`}>
                          Terms: {row.paymentSchedule}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">
                        <span className="block">Granted: {row.loanDate}</span>
                        <span className="block text-[10px] text-red-500 font-medium mt-0.5">Due: {row.dueDate || "N/A"}</span>
                      </td>
                      <td className="py-3 text-right text-slate-600">{formatCurrency(row.principalAmount)}</td>
                      <td className="py-3 text-right text-brand-600 font-medium">+{formatCurrency(row.interestAmount)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatCurrency(row.totalPaid)}</td>
                      <td className="py-3 text-right font-extrabold text-brand-600 px-2">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Extra Lending stats block */}
        {reportType === "loans" && loansReportData.length > 0 && (
          <div className="mt-6 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex flex-col sm:flex-row justify-between items-center text-xs gap-4 print:hidden">
            <div>
              <span className="font-bold text-brand-900">Computed Lending Interest Summary:</span>
              <p className="text-slate-500 text-[10px]">Total revenue interest generated across all cash loans granted.</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold">Total Revenue Interest:</span>
              <span className="text-sm font-black text-brand-700">{formatCurrency(totalInterestEarnedOnLoans)}</span>
            </div>
          </div>
        )}

        {/* Printed Footer Signatures */}
        <div className="hidden print:grid grid-cols-2 gap-12 pt-16 text-center text-[10px] text-slate-400">
          <div className="border-t border-dashed border-slate-200 pt-2">
             Juan dela Cruz <br />
            <span className="font-medium text-slate-300">PFMS Report Comptroller</span>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-2">
            Signature of Verification <br />
            <span className="font-medium text-slate-300">Lending & SPayLater Auditor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
