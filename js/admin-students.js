import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// حماية الصفحة
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
    loadStudents();
  } else {
    window.location.href = "../index.html";
  }
});

async function loadStudents() {
  const tbody = document.getElementById("students-table-body");

  try {
    // جلب الطلاب بس (اللي الـ role بتاعهم student)
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const querySnapshot = await getDocs(q);

    tbody.innerHTML = ""; // مسح علامة التحميل

    if (querySnapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 30px;">لا يوجد طلاب مسجلين حتى الآن.</td></tr>`;
      return;
    }

    let count = 1;
    querySnapshot.forEach((doc) => {
      const student = doc.data();
      
      // تنسيق التاريخ
      let dateStr = "غير معروف";
      if (student.createdAt) {
        // لو التاريخ متسجل كـ Timestamp في Firebase
        if (student.createdAt.toDate) {
          dateStr = student.createdAt.toDate().toLocaleDateString('ar-EG');
        } else {
          dateStr = new Date(student.createdAt).toLocaleDateString('ar-EG');
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: var(--text-muted);">${count}</td>
        <td class="student-name">${student.name}</td>
        <td style="color: var(--primary-light); direction: ltr; text-align: right;">${student.email}</td>
        <td>${dateStr}</td>
        <td><span class="status-badge active">نشط</span></td>
      `;
      tbody.appendChild(tr);
      count++;
    });

  } catch (error) {
    console.error("Error loading students:", error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 30px;">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
  }
}