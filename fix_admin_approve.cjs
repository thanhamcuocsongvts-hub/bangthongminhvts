const fs = require('fs');
let code = fs.readFileSync('src/components/AdminManagementModal.tsx', 'utf8');

const actionReplacement = `                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {t.status === 'pending' && !isAdmin && (
                      <button
                        onClick={() => {
                          const updated = { ...t, status: 'approved' };
                          onUpdateTeacher(updated);
                          // Try backend sync if available
                          fetch(\`/api/teachers/\${t.id}\`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'approved' }),
                          }).catch(() => {});
                        }}
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
                      onClick={() => onDeleteTeacher(t.id)}
                      disabled={isAdmin}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 shadow-xs text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>`;

code = code.replace(/                  \{\/\* Actions \*\/\}[\s\S]*?                  <\/div>/, actionReplacement);

fs.writeFileSync('src/components/AdminManagementModal.tsx', code);
