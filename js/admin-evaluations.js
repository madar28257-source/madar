import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (user) { document.getElementById("admin-name").textContent = user.displayName || "الأدمن"; } 
  else { window.location.href = "../index.html"; }
});

document.getElementById("save-eval-btn").addEventListener("click", async () => {
  const grade = document.getElementById("eval-grade").value;
  const group = document.getElementById("eval-group").value;
  const subject = document.getElementById("eval-subject").value.trim();
  const title = document.getElementById("eval-title").value.trim();
  const imageUrl = document.getElementById("eval-image").value.trim();

  if (!grade || !subject || !title || !imageUrl) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لازم تختار السنة والمجموعة وتكتب المادة والعنوان وتحط رابط الصورة.', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("save-eval-btn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    await addDoc(collection(db, "evaluations"), {
      gradeLevel: grade,
      group: group,
      subject: subject,
      title: title,
      imageUrl: imageUrl,
      createdAt: serverTimestamp()
    });

    Swal.fire({ icon: 'success', title: 'تم بنجاح!', text: 'تم حفظ التقييم.', background: '#12121f', color: '#fff' })
    .then(() => { window.location.reload(); });

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false; btn.textContent = "حفظ التقييم في قاعدة البيانات";
  }
});
