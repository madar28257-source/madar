import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
    loadAdmins();
  } else {
    window.location.href = "../index.html";
  }
});

// تحميل جدول الأدمن
async function loadAdmins() {
  const tbody = document.getElementById("admins-table-body");
  try {
    const snap = await getDocs(collection(db, "admins"));
    tbody.innerHTML = "";
    
    const roleNames = { "super_admin": "مدير عام", "sub_admin": "مدرس" };
    const gradeNames = { "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي", "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي", "all": "الكل" };

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      let gradesText = Array.isArray(data.gradeLevel) ? data.gradeLevel.map(g => gradeNames[g] || g).join(" و ") : (gradeNames[data.gradeLevel] || data.gradeLevel);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="student-name" style="direction: ltr; text-align: right;">${data.email}</td>
        <td><span class="subject-badge">${roleNames[data.role]}</span></td>
        <td>${gradesText}</td>
        <td><button class="btn-action" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteAdmin('${docSnap.id}', '${data.email}')">مسح</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
  }
}

// إضافة أدمن
document.getElementById("add-admin-btn").addEventListener("click", async () => {
  const email = document.getElementById("new-admin-email").value.trim();
  const role = document.getElementById("new-admin-role").value;
  const grade = document.getElementById("new-admin-grade").value;

  if (!email) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اكتب الإيميل الأول', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("add-admin-btn");
  btn.disabled = true; btn.textContent = "جاري الإضافة...";

  try {
    // بنحفظ كـ Array عشان لو مسؤول عن أكتر من سنة
    await addDoc(collection(db, "admins"), {
      email: email,
      role: role,
      gradeLevel: role === 'super_admin' ? "all" : [grade]
    });

    Swal.fire({ icon: 'success', title: 'تمت الإضافة', text: 'تم إضافة الأدمن بنجاح.', background: '#12121f', color: '#fff' });
    document.getElementById("new-admin-email").value = "";
    loadAdmins();

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false; btn.textContent = "إضافة الحساب";
  }
});

// مسح أدمن
window.deleteAdmin = (id, email) => {
  Swal.fire({
    title: 'تأكيد المسح',
    text: `هل تريد إزالة صلاحيات الأدمن من (${email})؟ (ملاحظة: الحساب سيبقى موجود في Authentication لكنه لن يستطيع دخول لوحة التحكم).`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'نعم، امسح',
    cancelButtonText: 'إلغاء',
    background: '#12121f', color: '#fff'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "admins", id));
      Swal.fire({ icon: 'success', title: 'تم المسح', background: '#12121f', color: '#fff' });
      loadAdmins();
    }
  });
};
