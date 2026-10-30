import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, getDocs, query, orderBy, limit, where, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let recentResultsData = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
        const cleanEmail = user.email.trim().toLowerCase();
        const adminSnap = await getDocs(collection(db, "admins"));
        
        let isAdmin = false;
        let isSuper = false;

        adminSnap.forEach((doc) => {
            const adminData = doc.data();
            if (adminData.email && adminData.email.trim().toLowerCase() === cleanEmail) {
                isAdmin = true;
                if (adminData.role && adminData.role.trim() === 'super_admin') {
                    isSuper = true;
                }
            }
        });

        // 🔥 حل الطوارئ: لو الإيميل ده بتاعك، اعتبره سوبر أدمن واظهر الزرار
        if (cleanEmail === "mohamed7@gmail.com") {
            isSuper = true;
            isAdmin = true;
        }

        if (isAdmin) {
            document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
            if (isSuper) {
                document.getElementById("admins-tab").style.display = "flex";
            }
            loadDashboardData();
        } else {
            Swal.fire({
                icon: 'error', title: 'ممنوع الدخول', text: 'هذه الصفحة مخصصة للمعلمين فقط.',
                background: '#12121f', color: '#fff', allowOutsideClick: false
            }).then(() => { window.location.href = "../dashboard.html"; });
        }
    } catch (error) {
        console.error(error);
        window.location.href = "../dashboard.html";
    }
  } else {
    window.location.href = "../index.html";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  Swal.fire({
    title: 'تسجيل الخروج', text: "هل أنت متأكد من الخروج؟", icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#2a2a3e',
    confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then((result) => {
    if (result.isConfirmed) { signOut(auth).then(() => window.location.href = "../index.html"); }
  });
});

async function loadDashboardData() {
  const tbody = document.getElementById("results-table-body");
  
  try {
    const usersQ = query(collection(db, "users"), where("role", "==", "student"));
    const usersSnap = await getDocs(usersQ);
    document.getElementById("stat-students").textContent = usersSnap.size;

    const examsSnap = await getDocs(collection(db, "exams"));
    document.getElementById("stat-exams").textContent = examsSnap.size;

    const evalsSnap = await getDocs(collection(db, "evaluations"));
    document.getElementById("stat-evals").textContent = evalsSnap.size;

    const resultsQ = query(collection(db, "results"), orderBy("submittedAt", "desc"), limit(5));
    const resultsSnap = await getDocs(resultsQ);

    tbody.innerHTML = '';
    recentResultsData = [];

    if (resultsSnap.empty) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 30px;">لا توجد نتائج مسجلة حتى الآن.</td></tr>`;
      return;
    }

    const gradeNames = {
      "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي",
      "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي", "unknown": "غير محدد"
    };

    resultsSnap.forEach((doc, index) => {
      const res = doc.data();
      res.id = doc.id;
      recentResultsData.push(res);

      let dateStr = "غير معروف";
      if (res.submittedAt) { dateStr = res.submittedAt.toDate().toLocaleDateString('ar-EG'); }

      const isPass = res.percentage >= 50;
      const gradeText = gradeNames[res.studentGrade] || res.studentGrade || "غير محدد";
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="student-name">${res.studentName}</td>
        <td><span class="subject-badge" style="background: rgba(34, 211, 238, 0.1); color: var(--accent);">${gradeText}</span></td>
        <td><span class="subject-badge">${res.subject}</span></td>
        <td>${res.examTitle}</td>
        <td>
          <span class="score-badge ${isPass ? 'pass' : 'fail'}">${res.score} / ${res.totalMarks}</span>
          <span class="score-percent">(${res.percentage}%)</span>
        </td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
        <td style="display: flex; gap: 5px;">
          <button class="btn-action" onclick="showAnswers(${index})">الإجابات</button>
          <button class="btn-action" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteResult('${res.id}', '${res.studentName}')">مسح</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Error loading dashboard:", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 30px;">حدث خطأ في تحميل البيانات.</td></tr>`;
  }
}

window.showAnswers = (index) => {
  const student = recentResultsData[index];
  
  let htmlContent = `
    <div style="margin-bottom: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
      <h3 style="color: #fff; margin-bottom: 5px;">${student.studentName}</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem;">الدرجة النهائية: <b style="color: #22c55e; font-size:1.2rem;">${student.score} / ${student.totalMarks}</b></p>
    </div>
  `;

  // تأمين الكود: لو النتيجة قديمة ومفيهاش إجابات، ميعملش كراش
  if (!student.studentAnswers || student.studentAnswers.length === 0) {
    htmlContent += `<div style="text-align: center; padding: 20px; color: #f59e0b;"><p>هذه النتيجة قديمة، لم يتم تسجيل تفاصيل الإجابات لها.</p></div>`;
  } else {
    htmlContent += `<div style="max-height: 400px; overflow-y: auto; padding-left: 10px;">`;
    student.studentAnswers.forEach((ans, i) => {
      const isCorrect = ans.pointsEarned === ans.maxPoints;
      htmlContent += `
        <div class="answer-row">
          <div style="flex: 1;">
            <div class="q-text">${i + 1}. ${ans.questionText}</div>
            <div class="a-text">إجابة الطالب: <span class="${isCorrect ? 'correct' : 'wrong'}">${ans.studentAnswer}</span>${!isCorrect ? `<br>الإجابة الصحيحة: <span class="correct">${ans.correctAnswer}</span>` : ''}</div>
          </div>
          <div class="q-score" style="color: ${isCorrect ? '#22c55e' : '#ef4444'};">${ans.pointsEarned} / ${ans.maxPoints}</div>
        </div>
      `;
    });
    htmlContent += `</div>`;
  }

  Swal.fire({ html: htmlContent, width: 600, background: '#12121f', showCloseButton: true, confirmButtonText: 'إغلاق', confirmButtonColor: '#7c3aed' });
};

// 🔥 دالة مسح النتيجة
window.deleteResult = (id, name) => {
  Swal.fire({
    title: 'تأكيد المسح', text: `هل أنت متأكد من مسح نتيجة الطالب (${name})؟`, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، امسح', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "results", id));
      Swal.fire({ icon: 'success', title: 'تم المسح', background: '#12121f', color: '#fff', timer: 1500, showConfirmButton: false });
      loadDashboardData(); // تحديث الجدول
    }
  });
};
