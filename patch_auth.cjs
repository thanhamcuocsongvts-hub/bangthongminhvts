const fs = require('fs');
let code = fs.readFileSync('src/components/EducationalAuthScreen.tsx', 'utf8');

const loginReplacement = `    if (matched) {
      if (matched.role !== 'admin' && matched.status === 'pending') {
        setLoginError('Tài khoản của bạn đang chờ phê duyệt. Vui lòng liên hệ quản trị viên.');
        return;
      }
      onSelectTeacher(matched);
      showToast('Đăng nhập thành công!');`;

code = code.replace(/    if \(matched\) \{\n      onSelectTeacher\(matched\);\n      showToast\('Đăng nhập thành công!'\);/, loginReplacement);

const regReplacement = `    const newTeacher: TeacherProfile = {
      id: username,
      name: regName.trim(),
      username: username,
      email: \`\${username}@smartboard.local\`,
      phone: regPhone,
      subject: regSubject,
      school: regSchool.trim() || 'Trường THPT',
      password: regPassword,
      avatar: regSubject === 'Toán học' || regSubject === 'Vật lý' || regSubject === 'Tin học' ? '👨‍🏫' : '👩‍🏫',
      status: 'pending',
      classes: [],
      createdAt: new Date().toISOString(),
    };

    onAddNewTeacher(newTeacher);
    
    // Switch back to login panel and show pending toast
    setMode('login');
    setLoginIdentifier(username);
    setLoginPassword('');
    showToast('Đăng ký thành công! Vui lòng chờ Quản trị viên phê duyệt.');
  };`;

code = code.replace(/    const newTeacher: TeacherProfile = \{[\s\S]*?onAddNewTeacher\(newTeacher\);\n    onSelectTeacher\(newTeacher\);\n    showToast\('Tạo tài khoản giáo viên thành công!'\);\n    if \(onClose\) setTimeout\(onClose, 600\);\n  \};/, regReplacement);

fs.writeFileSync('src/components/EducationalAuthScreen.tsx', code);
