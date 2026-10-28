import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// 1. حماية الصفحة وجلب البيانات
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("nav-name").textContent = user.displayName || "طالب";
    document.getElementById("user-avatar").textContent = (user.displayName || "M").charAt(0).toUpperCase();
    
    // جلب البيانات من Firestore
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        document.getElementById("profile-name").value = data.name || "";
        document.getElementById("profile-email").value = data.email || "";
        document.getElementById("profile-phone").value = data.phone || "";
        
        // ترجمة السنة الدراسية
        const gradeNames = {
          "1-prep": "الصف الأول الإعدادي", "2-prep": "الصف الثاني الإعدادي", "3-prep": "الصف الثالث الإعدادي",
          "1-sec": "الصف الأول الثانوي", "2-sec": "الصف الثاني الثانوي"
        };
        let gradeText = gradeNames[data.gradeLevel] || data.gradeLevel;
        if (data.system === 'baccalaureate' && data.track) {
          gradeText += ` (بكالوريا - ${data.track === 'medicine' ? 'طب' : data.track === 'engineering' ? 'هندسة' : data.track === 'business' ? 'أعمال' : 'آداب'})`;
        } else if (data.system === 'general') {
          gradeText += " (عام)";
        }
        document.getElementById("profile-grade").value = gradeText;
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  } else {
    window.location.href = "index.html";
  }
});

// 2. تفعيل القائمة المنسدلة والخروج
const profileBtn = document.getElementById("profile-btn");
const dropdown = document.getElementById("dropdown");
profileBtn.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("show"); });
document.addEventListener("click", () => { dropdown.classList.remove("show"); });

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

// 3. تحديث رقم الهاتف
document.getElementById("update-phone-btn").addEventListener("click", async () => {
  const newPhone = document.getElementById("profile-phone").value.trim();
  if (!newPhone) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اكتب رقم الهاتف الأول.', background: '#12121f', color: '#fff' });
    return;
  }
  
  const btn = document.getElementById("update-phone-btn");
  btn.textContent = "...";
  btn.disabled = true;

  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { phone: newPhone });
    Swal.fire({ icon: 'success', title: 'تم التحديث', text: 'تم حفظ رقم الهاتف بنجاح.', background: '#12121f', color: '#fff', confirmButtonColor: '#7c3aed' });
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء التحديث.', background: '#12121f', color: '#fff' });
  } finally {
    btn.textContent = "تحديث";
    btn.disabled = false;
  }
});

// 4. تغيير كلمة المرور
document.getElementById("update-password-btn").addEventListener("click", async () => {
  const newPass = document.getElementById("new-password").value;
  const confirmPass = document.getElementById("confirm-password").value;
  const btn = document.getElementById("update-password-btn");

  if (newPass.length < 6) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', background: '#12121f', color: '#fff' });
    return;
  }
  if (newPass !== confirmPass) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'كلمتا المرور غير متطابقتين.', background: '#12121f', color: '#fff' });
    return;
  }

  btn.textContent = "جاري الحفظ...";
  btn.disabled = true;

  try {
    await updatePassword(auth.currentUser, newPass);
    Swal.fire({ icon: 'success', title: 'تم بنجاح', text: 'تم تغيير كلمة المرور بنجاح.', background: '#12121f', color: '#fff', confirmButtonColor: '#7c3aed' });
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-password").value = "";
  } catch (error) {
    console.error(error);
    // لو ظهر خطأ بيطلب تسجيل دخول حديث
    if (error.code === 'auth/requires-recent-login') {
      Swal.fire({ icon: 'info', title: 'أمان إضافي', text: 'لأسباب أمنية، يرجى تسجيل الخروج والدخول مرة أخرى ثم تغيير الباسورد.', background: '#12121f', color: '#fff' });
    } else {
      Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء التغيير.', background: '#12121f', color: '#fff' });
    }
  } finally {
    btn.textContent = "تغيير كلمة المرور";
    btn.disabled = false;
  }
});