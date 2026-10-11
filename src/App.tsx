/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from './services/db';
import { Medicine, InventoryTransaction, Student } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { MedicineList } from './components/MedicineList';
import { MedicineModal } from './components/MedicineModal';
import { ImportMedicine } from './components/ImportMedicine';
import { ExportMedicine } from './components/ExportMedicine';
import { StockReport } from './components/StockReport';
import { StockBalanceComponent } from './components/StockBalance';
import { InventoryCheckComponent } from './components/InventoryCheck';
import { PrintReceiptModal } from './components/PrintReceiptModal';

// Phase 3 Components
import { StudentDirectory } from './components/StudentDirectory';
import { StudentHealthProfileView } from './components/StudentHealthProfileView';
import { ClinicReception } from './components/ClinicReception';
import { StaffMedicineDispense } from './components/StaffMedicineDispense';
import { ClinicVisitsLog } from './components/ClinicVisitsLog';
import { SchoolHealthAndCheckups } from './components/SchoolHealthAndCheckups';
import { ComprehensiveReports } from './components/ComprehensiveReports';
import { MedicationUsageReport } from './components/MedicationUsageReport';
import { SupplyUsageReport } from './components/SupplyUsageReport';
import { PrintA4Templates } from './components/PrintA4Templates';
import { UserManagementAndAudit } from './components/UserManagementAndAudit';
import { BackupAndSettings } from './components/BackupAndSettings';

import { CheckCircle2, X, ShieldCheck } from 'lucide-react';

import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth, dbFirestore, logout, syncOrCreateUserProfile } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    return localStorage.getItem('school_health_auth_session') === 'true' ? true : null;
  });

  const handleLogout = async () => {
    try {
      await db.pushStateToServer();
    } catch {
      // ignore
    }
    localStorage.removeItem('school_health_auth_session');
    localStorage.removeItem('school_health_user_cache');
    db.unbindUser();
    setIsAuthenticated(false);
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error:', e);
    }
  };
  
  useEffect(() => {
    const saved = localStorage.getItem('school_health_auth_session');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }

    // Safety timeout to prevent infinite spinner if Firebase auth handshake hangs
    const safetyTimer = setTimeout(() => {
      setIsAuthenticated((prev) => {
        if (prev === null) {
          const isSaved = localStorage.getItem('school_health_auth_session') === 'true';
          return isSaved ? true : false;
        }
        return prev;
      });
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(safetyTimer);
      if (user) {
        try {
          const userData = await syncOrCreateUserProfile(user);
          db.setCurrentUser(userData);
          await db.bindUser(user.uid, userData);
        } catch (e) {
          console.error("Error fetching user data", e);
          db.bindUser(user.uid);
        }
        localStorage.setItem('school_health_auth_session', 'true');
        setIsAuthenticated(true);
      } else {
        if (localStorage.getItem('school_health_auth_session') === 'true') {
          const u = db.getCurrentUser();
          db.bindUser(u?.id || 'usr-medic');
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      }
    });
    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals & Sub-states
  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [medicineToEdit, setMedicineToEdit] = useState<Medicine | null>(null);
  const [medicineListFilter, setMedicineListFilter] = useState<string>('all');
  const [selectedMedForImport, setSelectedMedForImport] = useState<Medicine | null>(null);
  const [selectedMedForExport, setSelectedMedForExport] = useState<Medicine | null>(null);
  const [printTransaction, setPrintTransaction] = useState<InventoryTransaction | null>(null);

  // Phase 3 states
  const [selectedStudentForProfileId, setSelectedStudentForProfileId] = useState<string | null>(null);
  const [selectedStudentForIntake, setSelectedStudentForIntake] = useState<Student | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Subscribe to DB changes for real-time reactivity across all components
  const [dbVersion, setDbVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setDbVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Automatically redirect away from any tab if its permission was turned off or user switched to a role without access
  useEffect(() => {
    if (!db.canAccessTab(activeTab)) {
      setActiveTab(db.getFirstAccessibleTab());
    }
    if (!db.hasPermission('canManageMedicine') && isMedicineModalOpen) {
      setIsMedicineModalOpen(false);
      setMedicineToEdit(null);
    }
    if (!db.hasPermission('canManageStudents') && selectedStudentForProfileId) {
      setSelectedStudentForProfileId(null);
    }
  }, [activeTab, dbVersion, isMedicineModalOpen, selectedStudentForProfileId]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Quick Action Handlers
  const handleOpenAddMedicine = () => {
    if (!db.hasPermission('canManageMedicine')) return;
    setMedicineToEdit(null);
    setIsMedicineModalOpen(true);
  };

  const handleOpenEditMedicine = (med: Medicine) => {
    if (!db.hasPermission('canManageMedicine')) return;
    setMedicineToEdit(med);
    setIsMedicineModalOpen(true);
  };

  const handleOpenImport = (med?: Medicine) => {
    if (!db.hasPermission('canManageTransactions')) return;
    setSelectedMedForImport(med || null);
    setActiveTab('import_medicine');
  };

  const handleOpenExport = (med?: Medicine) => {
    if (!db.hasPermission('canManageTransactions')) return;
    setSelectedMedForExport(med || null);
    setActiveTab('export_medicine');
  };

  const handleViewAlertDetails = (type: 'expired' | 'expiring_soon' | 'low_stock') => {
    if (!db.canAccessTab('medicines')) return;
    setMedicineListFilter(type);
    setActiveTab('medicines');
  };

  const handleNavigate = (tab: string, filter?: string) => {
    let targetTab = tab;
    if (tab === 'import') {
      targetTab = 'import_medicine';
    } else if (tab === 'export') {
      targetTab = 'export_medicine';
    } else if (tab === 'stock') {
      targetTab = 'stock_report';
    } else if (tab === 'expiry_tracking') {
      setMedicineListFilter('expired');
      targetTab = 'medicines';
    } else if (tab === 'low_stock') {
      setMedicineListFilter('low_stock');
      targetTab = 'medicines';
    } else if (tab === 'supplies') {
      targetTab = 'supply_usage';
    } else if (tab === 'reports') {
      targetTab = 'comprehensive_reports';
    } else if (tab === 'usage_book') {
      targetTab = 'medication_usage';
    }

    if (!db.canAccessTab(targetTab)) {
      setActiveTab(db.getFirstAccessibleTab());
      return;
    }

    setActiveTab(targetTab);
    if (filter) {
      setMedicineListFilter(filter);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased overflow-hidden">
      {/* Top Header */}
      <Header
        currentUser={db.getCurrentUser()}
        onRoleSwitch={(role) => db.setCurrentUserRole(role)}
        onQuickAction={(action) => {
          if (action === 'add_medicine') handleOpenAddMedicine();
          else if (action === 'import') handleOpenImport();
          else if (action === 'export') handleOpenExport();
          else if (action === 'stock') handleNavigate('stock_balance');
        }}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onOpenAddMedicine={handleOpenAddMedicine}
        onOpenImport={() => handleOpenImport()}
        onOpenExport={() => handleOpenExport()}
        onLogout={handleLogout}
        schoolName="TRƯỜNG THCS ĐÔNG THẠNH"
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            handleNavigate(tab);
            setSidebarOpen(false);
          }}
          isOpenMobile={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <main id="main-content-scrollable" className="flex-1 min-h-0 overflow-y-auto bg-slate-50 overscroll-contain">
          <ErrorBoundary>
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              {/* Toast Notification Alert */}
              {toast && (
                <div
                  id="app-toast-alert"
                  className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-700 animate-in fade-in slide-in-from-top-4 duration-200 text-xs sm:text-sm font-semibold max-w-md"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-300" />
                  <span>{toast.message}</span>
                </div>
              )}

          {/* TAB 1: Tổng quan & Cảnh báo */}
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={handleNavigate}
              onOpenAddMedicine={handleOpenAddMedicine}
              onOpenImport={() => handleOpenImport()}
              onOpenExport={() => handleOpenExport()}
              onViewAlertDetails={handleViewAlertDetails}
            />
          )}

          {/* TAB 2: Tiếp nhận phòng y tế (Giai đoạn 3) */}
          {activeTab === 'clinic_reception' && db.canAccessTab('clinic_reception') && (
            <ClinicReception
              preselectedStudentId={selectedStudentForIntake?.id || undefined}
              onSuccess={(visit) => {
                showToast(`Đã lưu phiếu tiếp nhận ${visit.visitCode} & trừ kho thuốc FEFO thành công!`, 'success');
                setSelectedStudentForIntake(null);
              }}
              onCancel={() => {
                setSelectedStudentForIntake(null);
                setActiveTab('dashboard');
              }}
              onNavigateToVisitsLog={() => setActiveTab('clinic_visits')}
              onNavigateToStaffClinic={() => setActiveTab('staff_dispense')}
            />
          )}

          {/* TAB: Cho thuốc Giáo viên & Công nhân viên trường */}
          {activeTab === 'staff_dispense' && db.canAccessTab('staff_dispense') && (
            <StaffMedicineDispense
              onSuccess={(visit) => {
                showToast(`Đã lưu phiếu cấp thuốc ${visit.visitCode} cho ${visit.studentName} & trừ kho thuốc FEFO thành công!`, 'success');
              }}
              onNavigateToStudentClinic={() => setActiveTab('clinic_reception')}
            />
          )}

          {/* TAB 3: Sổ theo dõi phòng y tế (Giai đoạn 3) */}
          {activeTab === 'clinic_visits' && db.canAccessTab('clinic_visits') && (
            <ClinicVisitsLog
              onNavigateToIntake={() => {
                setSelectedStudentForIntake(null);
                setActiveTab('clinic_reception');
              }}
              onSelectStudentProfile={(stuId) => setSelectedStudentForProfileId(stuId)}
            />
          )}

          {/* TAB 4: Hồ sơ sức khỏe học sinh (Giai đoạn 3) */}
          {activeTab === 'students' && db.canAccessTab('students') && (
            <StudentDirectory
              onSelectStudentForProfile={(stuId) => setSelectedStudentForProfileId(stuId)}
              onSelectStudentForIntake={(stuId) => {
                if (!db.canAccessTab('clinic_reception')) return;
                const stu = db.getStudentById(stuId);
                setSelectedStudentForIntake(stu || null);
                setActiveTab('clinic_reception');
              }}
            />
          )}

          {/* TAB 5: Sự kiện tai nạn & Khám sức khỏe định kỳ (Giai đoạn 3) */}
          {activeTab === 'school_health' && db.canAccessTab('school_health') && <SchoolHealthAndCheckups />}

          {/* TAB 6: Danh mục thuốc (Giai đoạn 1 & 2) */}
          {activeTab === 'medicines' && db.canAccessTab('medicines') && (
            <MedicineList
              initialFilter={medicineListFilter}
              onOpenAddModal={handleOpenAddMedicine}
              onOpenEditModal={handleOpenEditMedicine}
              onOpenImportForMed={(med) => handleOpenImport(med)}
            />
          )}

          {/* TAB 7: Nhập thuốc vào tủ y tế (Giai đoạn 1 & 2) */}
          {(activeTab === 'import_medicine' || activeTab === 'import') && db.canAccessTab('import_medicine') && (
            <ImportMedicine
              initialMedicine={selectedMedForImport}
              onSuccess={(msg) => showToast(msg, 'success')}
              onPrintTransaction={(tx) => setPrintTransaction(tx)}
            />
          )}

          {/* TAB 8: Xuất / Cấp phát thuốc theo FEFO (Giai đoạn 1 & 2) */}
          {(activeTab === 'export_medicine' || activeTab === 'export') && db.canAccessTab('export_medicine') && (
            <ExportMedicine
              initialMedicine={selectedMedForExport}
              onSuccess={(msg) => showToast(msg, 'success')}
              onPrintTransaction={(tx) => setPrintTransaction(tx)}
            />
          )}

          {/* TAB 9: Sổ theo dõi Nhập - Xuất - Tồn (Giai đoạn 2) */}
          {activeTab === 'stock_balance' && db.canAccessTab('stock_balance') && <StockBalanceComponent />}

          {/* TAB 10: Biên bản kiểm kê kho (Giai đoạn 2) */}
          {activeTab === 'inventory_check' && db.canAccessTab('inventory_check') && <InventoryCheckComponent />}

          {/* TAB 11: Báo cáo tồn kho theo lô FEFO (Giai đoạn 1 & 2) */}
          {(activeTab === 'stock_report' || activeTab === 'stock') && db.canAccessTab('stock_report') && (
            <StockReport
              onOpenImportForMed={(med) => handleOpenImport(med)}
              onOpenExportForMed={(med) => handleOpenExport(med)}
            />
          )}

          {/* TAB 12 & 13: Báo cáo vật tư y tế tiêu hao (Giai đoạn 2 & 3) */}
          {(activeTab === 'supplies' || activeTab === 'supply_usage') && db.canAccessTab('supply_usage') && <SupplyUsageReport />}

          {/* TAB 14: Báo cáo công tác y tế học đường tổng hợp (Giai đoạn 3) */}
          {(activeTab === 'comprehensive_reports' || activeTab === 'reports') && db.canAccessTab('comprehensive_reports') && <ComprehensiveReports />}

          {/* TAB 15: Báo cáo truy xuất thuốc đã sử dụng - Học sinh (Giai đoạn 3) */}
          {(activeTab === 'medication_usage' || activeTab === 'usage_book') && db.canAccessTab('medication_usage') && (
            <MedicationUsageReport onSelectStudent={(stuId) => setSelectedStudentForProfileId(stuId)} />
          )}

          {/* TAB 16: Mẫu in sổ A4 chuẩn y tế trường học (Giai đoạn 2 & 3) */}
          {activeTab === 'print_templates' && db.canAccessTab('print_templates') && <PrintA4Templates />}

          {/* TAB 17: Phân quyền RBAC & Nhật ký Audit Log (Giai đoạn 3) */}
          {activeTab === 'audit_logs' && db.canAccessTab('audit_logs') && <UserManagementAndAudit />}

          {/* TAB 18: Cài đặt hệ thống & Sao lưu/Khôi phục (Giai đoạn 1, 2 & 3) */}
          {activeTab === 'settings' && db.canAccessTab('settings') && (
            <BackupAndSettings />
          )}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Modal: Thêm / Sửa Thuốc */}
      <MedicineModal
        isOpen={isMedicineModalOpen}
        onClose={() => {
          setIsMedicineModalOpen(false);
          setMedicineToEdit(null);
        }}
        medicineToEdit={medicineToEdit}
        onSuccess={(msg) => showToast(msg, 'success')}
      />

      {/* Modal: In Phiếu Thuốc A4 */}
      <PrintReceiptModal
        transaction={printTransaction}
        onClose={() => setPrintTransaction(null)}
      />

      {/* Modal: Hồ Sơ Sức Khỏe Học Sinh Toàn Diện */}
      {selectedStudentForProfileId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs">
          <div className="bg-slate-50 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <StudentHealthProfileView
              studentId={selectedStudentForProfileId}
              onClose={() => setSelectedStudentForProfileId(null)}
              onNewVisit={(stu) => {
                setSelectedStudentForProfileId(null);
                setSelectedStudentForIntake(stu);
                setActiveTab('clinic_reception');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
