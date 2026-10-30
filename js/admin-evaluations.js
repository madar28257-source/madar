import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let currentUserIsSuper = false;
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
                currentUserIsSuper = true; allowedGrades = ["all"];
            } else {
                allowedGrades = Array.isArray(data.gradeLevel) ? data.gradeLevel : [data.gradeLevel];
            }
        }
    });

    // قفل السنة للمدرس
    const gradeSelect = document.getElementById('eval-grade');
    if (!currentUserIsSuper) {
        gradeSelect.value = allowedGrades[0];
        gradeSelect.disabled = true; 
    }
    
    loadExistingEvals(); 
  } else { 
    window.location.href = "../index.html"; 
  }
});

document.getElementById("save-eval-btn").addEventListener("click", async () => {
  const grade = document.getElementById("eval-grade").value;
  const group = document.getElementById("eval-group").value;
  const subject = document.getElementById("eval-subject").value.trim();
  const title = document.getElementById("eval-title").value.trim();
  const imageUrl = document.getElementById("eval-image").value.trim();

  if (!grade || !subject || !title || !imageUrl) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'املا كل البيانات ورابط الصورة.', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("save-eval-btn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    await addDoc(collection(db, "evaluations"), {
      gradeLevel: grade, group: group, subject: subject, title: title, imageUrl: imageUrl, createdAt: serverTimestamp()
    });

    Swal.fire({ icon: 'success', title: 'تم بنجاح!', text: 'تم حفظ التقييم.', background: '#12121f', color: '#fff' });
    document.getElementById("eval-subject").value = ""; document.getElementById("eval-title").value = ""; document.getElementById("eval-image").value = "";
    loadExistingEvals();
  } catch (error) {
    console.error(error); Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally { btn.disabled = false; btn.textContent = "حفظ التقييم في قاعدة البيانات"; }
});

async function loadExistingEvals() {
  const tbody = document.getElementById("evals-table-body");
  try {
    const querySnapshot = await getDocs(collection(db, "evaluations"));
    tbody.innerHTML = "";
    const gradeNames = { "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي", "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي" };

    let hasData = false;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (currentUserIsSuper || allowedGrades.includes(data.gradeLevel)) {
        hasData = true;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="student-name">${data.title}</td>
          <td>${data.subject}</td>
          <td><span class="subject-badge">${gradeNames[data.gradeLevel] || data.gradeLevel}</span></td>
          <td><span class="group-badge" style="background:rgba(34,211,238,0.1);color:var(--accent);padding:4px 8px;border-radius:8px;">${data.group}</span></td>
          <td><button class="btn-action" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteEval('${docSnap.id}', '${data.title}')">مسح</button></td>
        `;
        tbody.appendChild(tr);
      }
    });
    if (!hasData) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">لا توجد تقييمات مضافة.</td></tr>`;
  } catch (error) { console.error(error); }
}

window.deleteEval = (id, title) => {
  Swal.fire({ title: 'تأكيد المسح', text: `هل أنت متأكد من مسح تقييم (${title})؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، امسح', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff' }).then(async (result) => {
    if (result.isConfirmed) { await deleteDoc(doc(db, "evaluations", id)); Swal.fire({ icon: 'success', title: 'تم المسح', background: '#12121f', color: '#fff' }); loadExistingEvals(); }
  });
};
