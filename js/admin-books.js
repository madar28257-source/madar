import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let isSuper = false;
let allowedGrades = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
    
    // فلترة الصلاحيات
    const cleanEmail = user.email.trim().toLowerCase();
    const adminSnap = await getDocs(collection(db, "admins"));
    adminSnap.forEach((doc) => {
        const data = doc.data();
        if (data.email && data.email.trim().toLowerCase() === cleanEmail) {
            if (data.role === 'super_admin' || cleanEmail === "mohamed7@gmail.com") {
                isSuper = true; allowedGrades = ["all"];
            } else {
                allowedGrades = Array.isArray(data.gradeLevel) ? data.gradeLevel : [data.gradeLevel];
            }
        }
    });

    // قفل السنة للمدرس
    const gradeSelect = document.getElementById('book-grade');
    if (!isSuper) {
        gradeSelect.value = allowedGrades[0];
        gradeSelect.disabled = true; 
    }

    loadExistingBooks();
  } else {
    window.location.href = "../index.html";
  }
});

// حفظ كتاب جديد
document.getElementById("save-book-btn").addEventListener("click", async () => {
  const grade = document.getElementById("book-grade").value;
  const subject = document.getElementById("book-subject").value;
  const title = document.getElementById("book-title").value.trim();
  const description = document.getElementById("book-desc").value.trim();
  const pdfUrl = document.getElementById("book-url").value.trim();

  if (!grade || !title || !pdfUrl) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لازم تختار السنة وتكتب اسم الكتاب وتلزق الرابط.', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("save-book-btn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    await addDoc(collection(db, "books"), {
      gradeLevel: grade, // حفظنا السنة هنا
      subject: subject, title: title, description: description, pdfUrl: pdfUrl, createdAt: serverTimestamp()
    });

    Swal.fire({ icon: 'success', title: 'تم بنجاح!', text: 'تمت إضافة الكتاب للمكتبة.', background: '#12121f', color: '#fff', confirmButtonColor: '#22c55e' });
    document.getElementById("book-title").value = ""; document.getElementById("book-desc").value = ""; document.getElementById("book-url").value = "";
    loadExistingBooks(); 
  } catch (error) {
    console.error(error); Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الكتاب في قاعدة البيانات";
  }
});

// عرض الكتب
async function loadExistingBooks() {
  const tbody = document.getElementById("books-table-body");
  try {
    const snap = await getDocs(collection(db, "books"));
    tbody.innerHTML = "";
    const gradeNames = { "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي", "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي" };
    
    let hasData = false;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // الفلترة
      if (isSuper || allowedGrades.includes(data.gradeLevel)) {
        hasData = true;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="student-name">${data.title}</td>
          <td>${data.subject}</td>
          <td><span class="subject-badge">${gradeNames[data.gradeLevel] || data.gradeLevel}</span></td>
          <td><button class="btn-action" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteBook('${docSnap.id}', '${data.title}')">مسح</button></td>
        `;
        tbody.appendChild(tr);
      }
    });
    if (!hasData) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">لا توجد كتب مضافة.</td></tr>`;
  } catch (error) { console.error(error); }
}

window.deleteBook = (id, title) => {
  Swal.fire({ title: 'تأكيد المسح', text: `هل أنت متأكد من مسح كتاب (${title})؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، امسح', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff' }).then(async (result) => {
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "books", id));
      Swal.fire({ icon: 'success', title: 'تم المسح', background: '#12121f', color: '#fff', timer: 1500, showConfirmButton: false });
      loadExistingBooks(); 
    }
  });
};
