import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  Activity,
  CheckCircle,
  Calendar
} from "lucide-react";
import { Customer, Purchase, Payment, Loan, ActivityLog, SystemSettings } from "../types";

interface DashboardProps {
  customers: Customer[];
  purchases: Purchase[];
  payments: Payment[];
  loans: Loan[];
  logs: ActivityLog[];
  settings: SystemSettings;
  activeCycle: string;
  onNavigate: (tab: string) => void;
  onQuickLog: (preset: { customerId?: string; loanId?: string }) => void;
}

export default function Dashboard({
  customers,
  purchases,
  payments,
  loans,
  logs,
  settings,
  activeCycle,
  onNavigate,
  onQuickLog
}: DashboardProps) {
  
  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency || "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // 1. Calculations for SPayLater
  const spayLaterMetrics = useMemo(() => {
    const activeCustomers = customers.filter(c => c.billingCycle === activeCycle);
    
    // Filter active purchases
    const activePurchases = purchases.filter(p => p.billingCycle === activeCycle);
    const activePayments = payments.filter(p => p.billingCycle === activeCycle);

    const totalPurchasesAmount = activePurchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCarriedOver = activeCustomers.reduce((sum, c) => sum + (c.carriedOverBalance || 0), 0);
    const totalReceivables = totalPurchasesAmount + totalCarriedOver;

    const totalPaymentsReceived = activePayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const outstanding = Math.max(0, totalReceivables - totalPaymentsReceived);

    return {
      totalCustomers: activeCustomers.length,
      receivables: totalReceivables,
      paid: totalPaymentsReceived,
      outstanding
    };
  }, [customers, purchases, payments, activeCycle]);

  // 2. Calculations for Lending
  const lendingMetrics = useMemo(() => {
    let totalPrincipal = 0;
    let totalInterest = 0;
    let totalPaid = 0;
    let activeLoansCount = 0;

    loans.forEach(loan => {
      if (loan.status !== "Completed") {
        activeLoansCount++;
      }
      
      const principal = loan.principalAmount;
      const interest = loan.interestType === "Percentage" 
        ? (principal * (loan.interestValue / 100)) 
        : loan.interestValue;

      totalPrincipal += principal;
      totalInterest += interest;
      totalPaid += loan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    });

    const totalDue = totalPrincipal + totalInterest;
    const outstanding = Math.max(0, totalDue - totalPaid);

    return {
      activeLoansCount,
      totalDue,
      outstanding,
      paid: totalPaid,
      interestEarned: totalInterest
    };
  }, [loans]);

  // Combined metrics
  const totalOutstanding = spayLaterMetrics.outstanding + lendingMetrics.outstanding;
  const totalPaidCombined = spayLaterMetrics.paid + lendingMetrics.paid;
  const totalReceivablesCombined = spayLaterMetrics.receivables + lendingMetrics.totalDue;
  
  // Completion rate
  const completionRate = useMemo(() => {
    if (totalReceivablesCombined === 0) return 0;
    return Math.round((totalPaidCombined / totalReceivablesCombined) * 100);
  }, [totalPaidCombined, totalReceivablesCombined]);

  // Overdue calculation
  const overdueMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let spayLaterOverdue = 0;
    let lendingOverdue = 0;

    purchases.forEach(p => {
      if (p.billingCycle === activeCycle && p.dueDate && p.dueDate < todayStr) {
        // Calculate paid proportion if needed, or simple total
        spayLaterOverdue += p.totalAmount;
      }
    });

    loans.forEach(loan => {
      if (loan.status === "Overdue" || (loan.dueDate && loan.dueDate < todayStr && loan.status !== "Completed")) {
        const principal = loan.principalAmount;
        const interest = loan.interestType === "Percentage" ? (principal * (loan.interestValue / 100)) : loan.interestValue;
        const paid = loan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
        lendingOverdue += Math.max(0, (principal + interest) - paid);
      }
    });

    return {
      total: spayLaterOverdue + lendingOverdue,
      spayLaterOverdue,
      lendingOverdue
    };
  }, [purchases, loans, activeCycle]);

  // "Needs Attention" - what to actually act on right now, sorted by
  // urgency, instead of having to hunt through separate tabs to notice it.
  interface AttentionItem {
    key: string;
    kind: "customer" | "loan";
    id: string;
    title: string;
    detail: string;
    urgencyRank: number; // 0 = most urgent
    amount: number;
  }

  const needsAttention = useMemo(() => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const activeCustomers = customers.filter(c => c.billingCycle === activeCycle);
    activeCustomers.forEach(c => {
      const custPurchases = purchases.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);
      const custPayments = payments.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);
      const totalDue = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (c.carriedOverBalance || 0);
      const totalPaid = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = totalDue - totalPaid;
      if (remaining <= 0) return;

      const overduePurchase = custPurchases.find(p => p.dueDate && new Date(p.dueDate).getTime() < now);
      if (overduePurchase) {
        const daysOverdue = Math.max(1, Math.ceil((now - new Date(overduePurchase.dueDate).getTime()) / (24 * 60 * 60 * 1000)));
        items.push({
          key: `cust-overdue-${c.id}`, kind: "customer", id: c.id, title: c.fullName,
          detail: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
          urgencyRank: 0, amount: remaining
        });
        return;
      }

      const dueSoonPurchase = custPurchases.find(p => {
        if (!p.dueDate) return false;
        const dueTime = new Date(p.dueDate).getTime();
        return dueTime >= now && dueTime - now <= threeDaysMs;
      });
      if (dueSoonPurchase) {
        const daysLeft = Math.max(0, Math.ceil((new Date(dueSoonPurchase.dueDate).getTime() - now) / (24 * 60 * 60 * 1000)));
        items.push({
          key: `cust-soon-${c.id}`, kind: "customer", id: c.id, title: c.fullName,
          detail: daysLeft === 0 ? "Due today" : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          urgencyRank: 1, amount: remaining
        });
      }
    });

    loans.forEach(loan => {
      if (loan.status === "Completed") return;
      const totalInterest = loan.interestType === "Percentage" ? (loan.principalAmount * (loan.interestValue / 100)) : loan.interestValue;
      const totalPaid = loan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = (loan.principalAmount + totalInterest) - totalPaid;
      if (remaining <= 0 || !loan.dueDate) return;

      const dueTime = new Date(loan.dueDate).getTime();
      if (dueTime < now) {
        const daysOverdue = Math.max(1, Math.ceil((now - dueTime) / (24 * 60 * 60 * 1000)));
        items.push({
          key: `loan-overdue-${loan.id}`, kind: "loan", id: loan.id, title: loan.borrowerName,
          detail: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
          urgencyRank: 0, amount: remaining
        });
      } else if (dueTime - now <= threeDaysMs) {
        const daysLeft = Math.max(0, Math.ceil((dueTime - now) / (24 * 60 * 60 * 1000)));
        items.push({
          key: `loan-soon-${loan.id}`, kind: "loan", id: loan.id, title: loan.borrowerName,
          detail: daysLeft === 0 ? "Due today" : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          urgencyRank: 1, amount: remaining
        });
      }
    });

    return items.sort((a, b) => a.urgencyRank - b.urgencyRank || b.amount - a.amount);
  }, [customers, purchases, payments, loans, activeCycle]);

  // Customer outstanding bar chart data
  const customerOutstandingData = useMemo(() => {
    const activeCustomers = customers.filter(c => c.billingCycle === activeCycle);
    const data = activeCustomers.map(c => {
      const custPurchases = purchases.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);
      const custPayments = payments.filter(p => p.customerId === c.id && p.billingCycle === activeCycle);

      const totalBuy = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (c.carriedOverBalance || 0);
      const totalPay = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      return {
        name: c.fullName,
        Outstanding: Math.max(0, totalBuy - totalPay),
        Paid: totalPay
      };
    });

    // Sort descending by outstanding and take top 6
    return data.sort((a, b) => b.Outstanding - a.Outstanding).slice(0, 6);
  }, [customers, purchases, payments, activeCycle]);

  // Pie chart data: Lending vs SPayLater
  const sourceComparisonData = [
    { name: "SPayLater Tracker", value: spayLaterMetrics.outstanding, color: "#a855f7" }, // Purple
    { name: "Lending Management", value: lendingMetrics.outstanding, color: "#38bdf8" }  // Cyan/Blue
  ];

  // Collection summary trend (Simulated based on actual entries by date)
  const collectionTrendData = useMemo(() => {
    const trendMap: { [key: string]: { date: string; SPayLater: number; Lending: number } } = {};
    
    // Default 5 recent days
    const last5Days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    last5Days.forEach(day => {
      trendMap[day] = { date: day.substring(5), SPayLater: 0, Lending: 0 };
    });

    payments.forEach(p => {
      const day = p.paymentDate;
      if (trendMap[day]) {
        trendMap[day].SPayLater += p.amountPaid;
      }
    });

    loans.forEach(l => {
      l.payments.forEach(p => {
        const day = p.paymentDate;
        if (trendMap[day]) {
          trendMap[day].Lending += p.amountPaid;
        }
      });
    });

    return Object.values(trendMap);
  }, [payments, loans]);

  return (
    <div className="space-y-6">
      {/* Cycle context bar - the app title already lives in the sidebar/header, no need to repeat it here */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800/80">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Active Billing Cycle: <strong className="text-brand-600 font-medium">{activeCycle}</strong> • Keep track of everyone who owes you money.
        </p>
        <div className="flex justify-center mt-3 md:mt-0">
          <button
            onClick={() => onNavigate("lending")}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Grant Cash Loan
          </button>
        </div>
      </div>

      {/* Needs Attention - what to actually act on right now */}
      {needsAttention.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-red-50/40 dark:bg-red-950/20">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Needs Attention</h2>
            <span className="text-[10px] font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full ml-auto">
              {needsAttention.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {needsAttention.slice(0, 6).map(item => (
              <div key={item.key} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</span>
                  <span className={`block text-[10px] font-medium ${item.urgencyRank === 0 ? "text-red-500" : "text-amber-600"}`}>
                    {item.detail} · {formatCurrency(item.amount)}
                  </span>
                </div>
                <button
                  onClick={() => onQuickLog(item.kind === "customer" ? { customerId: item.id } : { loanId: item.id })}
                  className="shrink-0 px-3 py-1.5 text-[10px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
                >
                  Record Payment
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Stats Cards - 2-up even on the smallest phones, so at most
          2 rows are visible before scrolling instead of 4 full-width cards. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Receivables */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group hover:border-brand-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Customers</span>
            <div className="p-1.5 sm:p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 rounded-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-950 dark:text-white">
              {spayLaterMetrics.totalCustomers + lendingMetrics.activeLoansCount}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              {spayLaterMetrics.totalCustomers} SPayLater • {lendingMetrics.activeLoansCount} Lending
            </p>
          </div>
        </div>

        {/* Card 2: Total Outstanding Balance */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group hover:border-orange-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Outstanding</span>
            <div className="p-1.5 sm:p-2 bg-orange-50 dark:bg-orange-950/30 text-orange-500 rounded-lg">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-950 dark:text-white break-words">
              {formatCurrency(totalOutstanding)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
              {formatCurrency(spayLaterMetrics.outstanding)} SPayLater • {formatCurrency(lendingMetrics.outstanding)} Lending
            </p>
          </div>
        </div>

        {/* Card 3: Total Collections Paid */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group hover:border-emerald-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Collected</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-950 dark:text-white break-words">
              {formatCurrency(totalPaidCombined)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              Completion: <strong>{completionRate}%</strong>
            </p>
          </div>
        </div>

        {/* Card 4: Overdue Receivables */}
        <div className={`rounded-xl p-3 sm:p-5 border shadow-xs relative overflow-hidden group transition ${overdueMetrics.total > 0 ? "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40" : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Overdue</span>
            <div className={`p-1.5 sm:p-2 rounded-lg ${overdueMetrics.total > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500"}`}>
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <h3 className={`text-lg sm:text-2xl font-bold break-words ${overdueMetrics.total > 0 ? "text-red-700 dark:text-red-400" : "text-slate-950 dark:text-white"}`}>
              {formatCurrency(overdueMetrics.total)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              Needs collection.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-grid: Lending vs SPayLater Split cards - kept compact since the
          same totals also appear in the stat cards above and the pie chart
          below; this is just the per-module breakdown. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* SPayLater Panel Summary */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">SPayLater Tracker</h3>
            </div>
            <button
              onClick={() => onNavigate("spaylater")}
              className="text-[10px] text-brand-600 hover:text-brand-800 flex items-center gap-0.5 font-medium"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-slate-400 dark:text-slate-500">Receivables</span>
              <span className="block text-[10px] font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{formatCurrency(spayLaterMetrics.receivables)}</span>
            </div>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-slate-400 dark:text-slate-500">Paid</span>
              <span className="block text-[10px] font-bold text-emerald-600 mt-0.5 break-words">{formatCurrency(spayLaterMetrics.paid)}</span>
            </div>
            <div className="p-1.5 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-orange-700">Remaining</span>
              <span className="block text-[10px] font-bold text-orange-600 mt-0.5 break-words">{formatCurrency(spayLaterMetrics.outstanding)}</span>
            </div>
          </div>
        </div>

        {/* Lending Panel Summary */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-brand-500 rounded-full" />
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Lending Management</h3>
            </div>
            <button
              onClick={() => onNavigate("lending")}
              className="text-[10px] text-brand-600 hover:text-brand-800 flex items-center gap-0.5 font-medium"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-slate-400 dark:text-slate-500">Total Due</span>
              <span className="block text-[10px] font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{formatCurrency(lendingMetrics.totalDue)}</span>
            </div>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-slate-400 dark:text-slate-500">Interest</span>
              <span className="block text-[10px] font-bold text-brand-600 mt-0.5 break-words">{formatCurrency(lendingMetrics.interestEarned)}</span>
            </div>
            <div className="p-1.5 bg-brand-50/50 dark:bg-brand-950/20 rounded-lg">
              <span className="block text-[8px] uppercase font-semibold text-brand-700">Outstanding</span>
              <span className="block text-[10px] font-bold text-brand-600 mt-0.5 break-words">{formatCurrency(lendingMetrics.outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Customer Outstanding Balance Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">Top Outstanding Balances</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Top 6 customers with highest pending payments</p>
            </div>
          </div>
          <div className="h-52 sm:h-64">
            {customerOutstandingData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm">
                No active outstanding customer records found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerOutstandingData} margin={{ top: 10, right: 10, left: -10, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={40}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "12px" }}
                    itemStyle={{ color: "#fff" }}
                    labelClassName="text-slate-400 dark:text-slate-500 font-medium"
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Outstanding" name="Outstanding Balance" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Paid" name="Paid Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Lending vs SPayLater Receivables Allocation Pie Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Receivables Split</h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Total active outstanding comparison</p>
          <div className="h-40 sm:h-48 relative">
            {totalOutstanding === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm">
                No outstanding balance.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceComparisonData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {totalOutstanding > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Active</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">{formatCurrency(totalOutstanding)}</span>
              </div>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {sourceComparisonData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(item.value)} ({totalOutstanding > 0 ? Math.round((item.value / totalOutstanding) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Collection trends & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend line */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs lg:col-span-2">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Collection Summary Trend</h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Recent tracking of payment receipts</p>
          <div className="h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={collectionTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="SPayLater" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Lending" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-brand-500" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">Recent Activity Log</h4>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[240px] pr-1 flex-1">
            {logs.length === 0 ? (
              <div className="text-center text-slate-300 dark:text-slate-600 text-xs py-8">
                No recent activity records.
              </div>
            ) : (
              logs.slice(0, 10).map((log) => (
                <div key={log.id} className="text-xs border-b border-slate-50 dark:border-slate-800/50 pb-2 last:border-b-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{log.action}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{log.details}</p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-50 dark:border-slate-800/50 pt-3 mt-4 text-center">
            <button 
              onClick={() => onNavigate("settings")} 
              className="text-xs text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-1"
            >
              View System Logs in Settings <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
