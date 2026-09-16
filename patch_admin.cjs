const fs = require('fs');
let code = fs.readFileSync('src/components/AdminManagementModal.tsx', 'utf8');

const badgesReplacement = `                        {isAdmin && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            QUẢN TRỊ VIÊN
                          </span>
                        )}
                        {t.status === 'pending' && !isAdmin && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-black border border-orange-300 animate-pulse">
                            CHỜ DUYỆT
                          </span>
                        )}
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                            Đang Đăng Nhập
                          </span>
                        )}`;

code = code.replace(/                        \{isAdmin && \([\s\S]*?                        \)\}\n                        \{isActive && \([\s\S]*?                        \)\}/, badgesReplacement);

const actionReplacement = `                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {t.status === 'pending' && !isAdmin && (
                      <button
                        onClick={() => handleUpdateTeacher(t.id, { status: 'approved' })}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-md text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                    )}
                    <button
                      onClick={() => setEditingTeacherId(t.id)}
                      disabled={isAdmin && activeTeacher?.id !== t.id}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 shadow-xs text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(t.id)}
                      disabled={isAdmin}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 shadow-xs text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>`;

code = code.replace(/                  \{\/\* Actions \*\/\}[\s\S]*?                  <\/div>/, actionReplacement);

fs.writeFileSync('src/components/AdminManagementModal.tsx', code);
