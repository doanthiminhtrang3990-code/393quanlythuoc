import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Clock,
  Search,
  Download,
  Filter,
  CheckCircle2,
  Lock,
  Eye,
  Key,
} from 'lucide-react';
import { db, formatDateTimeVN } from '../services/db';
import { RoleManagement } from './RoleManagement';

export const UserManagementAndAudit: React.FC = () => {
  const [logs, setLogs] = useState(() => db.getAuditLogs());
  const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setLogs(db.getAuditLogs());
      setCurrentUser(db.getCurrentUser());
    });
    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  if (!db.canAccessTab('audit_logs') || currentUser?.role !== 'admin') {
    return null;
  }

  const handleExportLogs = () => {
    const headers = ['Thời gian', 'Nhiệm vụ thực hiện', 'Phân quyền', 'Hành động', 'Chi tiết thao tác'];
    const rows = filteredLogs.map((l) => [
      formatDateTimeVN(l.timestamp),
      l.userRole === 'admin' || (l as any).role === 'admin' ? 'Quản trị' : 'Nhân viên Y tế',
      l.userRole === 'admin' || (l as any).role === 'admin' ? 'Quản trị' : 'Nhân viên Y tế',
      l.action,
      l.details,
    ]);

    const csvContent =
      '\uFEFF' +
      [
        `"NHẬT KÝ KIỂM TOÁN HỆ THỐNG Y TẾ (AUDIT LOGS)"`,
        `"Trường THCS Đông Thạnh | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}"`,
        '',
        headers.join(','),
        ...rows.map((r) => r.map((f) => `"${f}"`).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nhat_Ky_Audit_THCS_Dong_Thanh_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
              BẢO MẬT & PHÂN QUYỀN
            </span>
            <h1 className="text-xl font-bold text-slate-900">Phân Quyền & Nhật Ký Kiểm Toán (Audit Log)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Quản lý vai trò người dùng và truy vết toàn bộ thao tác y tế
          </p>
        </div>
        <button
          onClick={handleExportLogs}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Nhật Ký Audit</span>
        </button>
      </div>

      {/* Role Management Module */}
      <RoleManagement />

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-xs uppercase text-slate-700">
              Nhật Ký Thao Tác Hệ Thống ({filteredLogs.length} sự kiện)
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm hành động, người dùng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Thời gian</th>
                <th className="py-2.5 px-3">Nhiệm vụ thực hiện</th>
                <th className="py-2.5 px-3">Mã phân quyền</th>
                <th className="py-2.5 px-3">Hành động</th>
                <th className="py-2.5 px-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isAdminRole = (log.userRole || (log as any).role) === 'admin' || (log.userRole || (log as any).role) === 'bgh';
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTimeVN(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {isAdminRole ? 'Quản trị' : 'Nhân viên Y tế'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isAdminRole ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isAdminRole ? 'Quản trị (ADMIN)' : 'Nhân viên Y tế (MEDIC)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-md truncate">{log.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
