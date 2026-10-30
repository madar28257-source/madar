import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let allStudents = []; 
let currentFilter = "all";
let allowedGrades = [];
let isSuperAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
    
    // 1. التحقق من صلاحيات المدرس
    try {
        const cleanEmail = user.email.trim().toLowerCase();
        const adminSnap = await getDocs(collection(db, "admins"));
        
        adminSnap.forEach((doc) => {
            const adminData = doc.data();
            if (adminData.email && adminData.email.trim().toLowerCase() === cleanEmail) {
                if (adminData.role && adminData.role.trim() === 'super_admin') {
                    isSuperAdmin = true;
                    allowedGrades = ["all"];
                } else if (adminData.gradeLevel) {
                    allowedGrades = Array.isArray(adminData.gradeLevel) ? adminData.gradeLevel : [adminData.gradeLevel];
                }
            }
        });

        if (cleanEmail === "mohamed7@gmail.com") {
            isSuperAdmin = true;
            allowedGrades = ["all"];
        }

        // إخفاء التابات اللي مش من حقه يشوفها
        if (!isSuperAdmin) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                const grade = btn.dataset.grade;
                if (grade !== 'all' && !allowedGrades.includes(grade)) {
                    btn.style.display = 'none';
                }
            });
            // لو مش سوبر أدمن، نشيل تاب "كل الطلاب" ونخليه يبدأ بصفه
            document.querySelector('.tab-btn[data-grade="all"]').style.display = 'none';
            currentFilter = allowedGrades[0]; // نبدأ بأول صف مسموح بيه
        }

        loadStudents(); // جلب الطلاب

    } catch (error) {
        console.error(error);
    }
  } else {
    window.location.href = "../index.html";
  }
});

async function loadStudents() {
  const tbody = document.getElementById("students-table-body");
  try {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);
    allStudents = [];

    querySnapshot.forEach((doc) => {
      const s = doc.data();
      // الفلترة: لو سوبر أدمن يشوف الكل، لو مدرس يشوف طلابه بس
      if (isSuperAdmin || allowedGrades.includes(s.gradeLevel)) {
          allStudents.push({ id: doc.id, ...s });
      }
    });

    allStudents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderTable(currentFilter);

  } catch (error) {
    console.error("Error loading students:", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444;">حدث خطأ أثناء التحميل.</td></tr>`;
  }
}

function renderTable(gradeFilter) {
  const tbody = document.getElementById("students-table-body");
  tbody.innerHTML = "";

  const filteredStudents = gradeFilter === "all" 
    ? allStudents 
    : allStudents.filter(s => s.gradeLevel === gradeFilter);

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 20px;">لا يوجد طلاب في هذا الصف.</td></tr>`;
    return;
  }

  const gradeNames = {
    "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي",
    "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي"
  };

  filteredStudents.forEach((student, index) => {
    let dateStr = "غير معروف";
    if (student.createdAt) {
      dateStr = new Date(student.createdAt).toLocaleDateString('ar-EG');
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color: var(--text-muted);">${index + 1}</td>
      <td class="student-name">${student.name}</td>
      <td style="color: var(--accent); font-weight: 600; direction: ltr; text-align: right;">${student.phone || 'غير مسجل'}</td>
      <td style="color: var(--primary-light); direction: ltr; text-align: right;">${student.email}</td>
      <td><span class="subject-badge">${gradeNames[student.gradeLevel] || student.gradeLevel}</span></td>
      <td>${dateStr}</td>
      <td><button class="btn-action" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteStudent('${student.id}', '${student.name}')">إزالة</button></td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteStudent = async (userId, userName) => {
  Swal.fire({
    title: 'هل أنت متأكد؟', text: `إنت على وشك إزالة الطالب (${userName}) من المنصة نهائياً.`, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#2a2a3e',
    confirmButtonText: 'نعم، إزالة', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "users", userId));
        Swal.fire({ icon: 'success', title: 'تمت الإزالة', text: 'تم حذف بيانات الطالب من المنصة.', background: '#12121f', color: '#fff' }).then(() => {
          loadStudents(); 
        });
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء محاولة إزالة الطالب.', background: '#12121f', color: '#fff' });
      }
    }
  });
};

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.grade;
    renderTable(currentFilter);
  });
});
