import React, { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  ShieldAlert,
  Database,
  Download,
  Upload,
  Activity,
  Trash2,
  RefreshCw,
  X,
  CheckCircle,
  FileText,
  Lock,
  Plus,
  HelpCircle,
  Clock,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import { SystemSettings, ActivityLog, BackupRecord } from "../types";
import { api } from "../api";

interface SettingsProps {
  settings: SystemSettings;
  logs: ActivityLog[];
  backups: BackupRecord[];
  onUpdateSettings: (settings: Partial<SystemSettings>) => Promise<any>;
  onChangePassword: (oldPass: string, newPass: string) => Promise<any>;
  onRefreshBackups: () => Promise<any>;
  onRefreshLogs: () => Promise<any>;
}

export default function Settings({
  settings,
  logs,
  backups,
  onUpdateSettings,
  onChangePassword,
  onRefreshBackups,
  onRefreshLogs
}: SettingsProps) {
  
  // Settings edit state
  const [personalBusinessName, setPersonalBusinessName] = useState(settings.personalBusinessName);
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultBillingDate, setDefaultBillingDate] = useState(settings.defaultBillingDate);
  const [defaultDueDate, setDefaultDueDate] = useState(settings.defaultDueDate);
  const [backupPreference, setBackupPreference] = useState(settings.backupPreference);

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Loading states
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState<string | null>(null);
  const [isDeletingBackup, setIsDeletingBackup] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPersonalBusinessName(settings.personalBusinessName);
    setCurrency(settings.currency);
    setDefaultBillingDate(settings.defaultBillingDate);
    setDefaultDueDate(settings.defaultDueDate);
    setBackupPreference(settings.backupPreference);
  }, [settings]);

  // Handle Save general settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        personalBusinessName,
        currency,
        defaultBillingDate,
        defaultDueDate,
        backupPreference
      });
      alert("System configurations successfully saved!");
    } catch (err) {
      alert("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters long.");
      return;
    }
    setIsChangingPass(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("Password successfully updated!");
    } catch (err: any) {
      alert(err.message || "Incorrect current password");
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Create Backup
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await api.createBackup();
      if (res.success) {
        await onRefreshBackups();
        await onRefreshLogs();
        alert("System backup file generated successfully!");
      }
    } catch (err) {
      alert("Failed to generate backup.");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async (id: string, name: string) => {
    if (confirm(`CRITICAL: Restoring backup "${name}" will overwrite all current system data! Are you absolutely sure you want to proceed?`)) {
      setIsRestoringBackup(id);
      try {
        const res = await api.restoreBackup(id);
        if (res.success) {
          alert("System successfully restored! Reloading workspace...");
          window.location.reload();
        }
      } catch (err) {
        alert("Failed to restore backup.");
      } finally {
        setIsRestoringBackup(null);
      }
    }
  };

  // Handle Delete Backup
  const handleDeleteBackup = async (id: string) => {
    if (confirm(`Are you sure you want to permanently delete this backup file?`)) {
      setIsDeletingBackup(id);
      try {
        const res = await api.deleteBackup(id);
        if (res.success) {
          await onRefreshBackups();
          await onRefreshLogs();
        }
      } catch (err) {
        alert("Failed to delete backup file.");
      } finally {
        setIsDeletingBackup(null);
      }
    }
  };

  // Handle Export download - Blob based & fully safe for iframe sandboxes
  const handleExportData = async () => {
    try {
      const response = await fetch(api.getExportUrl());
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `pfms_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export database: " + err.message);
    }
  };

  // Handle Import JSON file
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let json;
        try {
          json = JSON.parse(event.target?.result as string);
        } catch (parseErr) {
          alert("Failed to parse file. Please upload a valid JSON file.");
          return;
        }

        if (confirm("Importing this JSON will overwrite your current active records! Are you sure you want to import?")) {
          const res = await api.importBackup(json);
          if (res.success) {
            alert("External system JSON successfully imported! Reloading workspace...");
            window.location.reload();
          } else {
            alert("Import failed. No success response received from the server.");
          }
        }
      } catch (err: any) {
        alert("Import failed: " + (err.message || "Unknown error occurred. Must be a valid PFMS export JSON file."));
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle 1-Click SPayLater Seeder
  const handleSeedSPayLater = async () => {
    if (confirm("Seeding this data will overwrite all current active SPayLater records with your custom table summary (Ian, Shannen, Claudine, etc.)! Are you sure you want to proceed?")) {
      setIsSeeding(true);
      try {
        const res = await api.seedSPayLater();
        if (res.success) {
          alert("SPayLater summary data successfully seeded into your workspace! Reloading workspace...");
          window.location.reload();
        } else {
          alert("Seeding failed. Please check if spaylater_import.json is present on the server.");
        }
      } catch (err) {
        alert("An error occurred while seeding sample data.");
      } finally {
        setIsSeeding(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brand-500" />
          System Settings &amp; Backups
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure personal credentials, manage billing and due schedules, export reports, and control JSON database backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Config */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">System Profile Configuration</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Personal / Business Name</label>
                <input
                  type="text"
                  required
                  value={personalBusinessName}
                  onChange={(e) => setPersonalBusinessName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Currency Unit</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  >
                    <option value="PHP">Philippine Peso (₱)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Backup Synchronization Preferences</label>
                  <select
                    value={backupPreference}
                    onChange={(e) => setBackupPreference(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  >
                    <option value="manual">Manual Backup Operations Only</option>
                    <option value="daily">Trigger Automatic Daily Backups</option>
                    <option value="disabled">Disable All Backups Actions</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Billing Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={defaultBillingDate}
                    onChange={(e) => setDefaultBillingDate(e.target.value)}
                    placeholder="15"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Default Payment Due Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={defaultDueDate}
                    onChange={(e) => setDefaultDueDate(e.target.value)}
                    placeholder="30"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isSavingSettings ? "Saving Settings..." : "Save General Configurations"}
                </button>
              </div>
            </form>
          </div>

          {/* Password Settings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2 flex items-center gap-1.5 text-red-700">
              <Lock className="w-4 h-4 text-red-500" />
              Change Master Access Password
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Must match new password"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isChangingPass ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Activity logs section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">System Audit & Activity Logs</h3>
              </div>
              <button
                onClick={onRefreshLogs}
                className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
              >
                Refresh Logs
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
              {logs.map((log) => (
                <div key={log.id} className="text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Backups panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-brand-500" />
              Backup &amp; Restore
            </h3>

            {/* Quick Export/Import buttons */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <button
                onClick={handleExportData}
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:border-brand-500 rounded-xl bg-slate-50/50 hover:bg-white text-xs gap-1.5 transition font-semibold"
              >
                <Download className="w-5 h-5 text-brand-500" />
                Export DB JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-3 border border-slate-200 hover:border-brand-500 rounded-xl bg-slate-50/50 hover:bg-white text-xs gap-1.5 transition font-semibold"
              >
                <Upload className="w-5 h-5 text-brand-500" />
                Import JSON
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileChange}
                accept=".json"
                className="hidden"
              />
            </div>

            {/* 1-Click SPayLater Tracker Data Seeder */}
            <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/40 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900 dark:text-brand-400">
                <Sparkles className="w-4 h-4 text-brand-500 animate-pulse" />
                <span>SPayLater Tracker Seeder</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                Instantly seed your system with SPayLater summary data for Ian, Shannen, Claudine, and others.
              </p>
              <button
                onClick={handleSeedSPayLater}
                disabled={isSeeding}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isSeeding ? "Seeding Data..." : "Load SPayLater Data (1-Click)"}
              </button>
            </div>

            {/* Create Manual Backup Trigger */}
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {isCreatingBackup ? "Generating Backup..." : "Create System Backup"}
            </button>

            {/* Backups Lists */}
            <div className="space-y-2 border-t border-slate-50 pt-3">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Backup Files ({backups.length})</h4>
              
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                {backups.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-300">
                    No backup records found.
                  </div>
                ) : (
                  backups.map((bak) => (
                    <div key={bak.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 truncate" title={bak.filename}>
                          {bak.filename}
                        </span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">
                          {bak.type === "automatic" ? "Auto" : "Manual"} • {(bak.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleRestoreBackup(bak.id, bak.filename)}
                          disabled={!!isRestoringBackup}
                          className="p-1 text-slate-500 hover:text-brand-600 hover:bg-white border border-transparent hover:border-slate-200 rounded transition"
                          title="Restore System to this state"
                        >
                          {isRestoringBackup === bak.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(bak.id)}
                          disabled={!!isDeletingBackup}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-white border border-transparent hover:border-red-100 rounded transition"
                          title="Delete backup file"
                        >
                          {isDeletingBackup === bak.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
