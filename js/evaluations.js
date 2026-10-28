import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const container = document.getElementById('evaluations-container');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("nav-name").textContent = user.displayName || "طالب";
    document.getElementById("user-avatar").textContent = (user.displayName || "M").charAt(0).toUpperCase();

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      // 🔥 التعديل هنا: لو بيانات الطالب موجودة كمل، لو مش موجودة طلع رسالة
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.gradeLevel === "3-prep") {
          Swal.fire({
            icon: 'info', title: 'عفواً', text: 'صفحة التقييمات غير متاحة لصفك الدراسي حالياً.',
            background: '#12121f', color: '#fff', confirmButtonColor: '#7c3aed', allowOutsideClick: false
          }).then(() => { window.location.href = "dashboard.html"; });
          return;
        }

        loadEvaluations(userData);
      } else {
        container.innerHTML = `<div class="glass-panel" style="text-align: center; padding: 40px; color: #f59e0b;"><h3>لم نتمكن من العثور على بيانات حسابك.</h3><p>تواصل مع المعلم لتحديث بياناتك.</p></div>`;
      }
    } catch (error) {
      console.error("Error:", error);
      container.innerHTML = `<div class="glass-panel" style="text-align: center; padding: 40px; color: #ef4444;"><h3>حدث خطأ في الاتصال.</h3></div>`;
    }
  } else {
    window.location.href = "index.html";
  }
});

async function loadEvaluations(userData) {
  try {
    const q = query(collection(db, "evaluations"), where("gradeLevel", "==", userData.gradeLevel));
    const querySnapshot = await getDocs(q);
    container.innerHTML = '';

    if (querySnapshot.empty) {
      container.innerHTML = `
        <div class="loading-state">
          <h3>لا توجد تقييمات متاحة حالياً 😅</h3>
          <p>المعلم لم يقم بإضافة تقييمات لصفك الدراسي بعد.</p>
        </div>
      `;
      return;
    }

    let validEvals = 0;

    querySnapshot.forEach((doc) => {
      const evalData = doc.data();
      
      if (evalData.gradeLevel === "2-sec" && evalData.system === "baccalaureate" && userData.system === "baccalaureate") {
        if (evalData.track !== userData.track) return; 
      }

      validEvals++;
      const card = document.createElement('div');
      card.className = 'eval-card';
      
      card.innerHTML = `
        <div class="eval-header">
          <div class="eval-icon">📝</div>
          <span class="eval-status pending">لم يبدأ</span>
        </div>
        <h3 class="eval-title">${evalData.title}</h3>
        <div class="eval-subject">📚 ${evalData.subject}</div>
        <div class="eval-meta">
          <span>⏱️ ${evalData.duration} دقيقة</span>
          <span>⭐ ${evalData.totalMarks} درجة</span>
        </div>
        <a href="exam.html?examId=${doc.id}&name=${encodeURIComponent(evalData.subject)}" class="btn-eval">
          بدء التقييم
        </a>
      `;
      container.appendChild(card);
    });

    if (validEvals === 0) {
       container.innerHTML = `<div class="loading-state"><h3>لا توجد تقييمات متاحة لمسارك حالياً.</h3></div>`;
    }

  } catch (error) {
    console.error("Error loading evaluations:", error);
    container.innerHTML = `<div class="loading-state" style="color: #ef4444;"><h3>حدث خطأ في تحميل التقييمات.</h3></div>`;
  }
}

// القائمة المنسدلة والخروج
const profileBtn = document.getElementById("profile-btn");
const dropdown = document.getElementById("dropdown");
if(profileBtn) {
    profileBtn.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("show"); });
}
document.addEventListener("click", () => { if(dropdown) dropdown.classList.remove("show"); });

document.getElementById("logout-btn").addEventListener("click", (e) => {
  e.preventDefault();
  Swal.fire({
    title: 'تسجيل الخروج', text: "هل أنت متأكد من الخروج؟", icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#2a2a3e',
    confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then((result) => {
    if (result.isConfirmed) { signOut(auth).then(() => window.location.href = "index.html"); }
  });
});