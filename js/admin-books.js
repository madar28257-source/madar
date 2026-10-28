import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// حماية الصفحة
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
  } else {
    window.location.href = "../index.html";
  }
});

document.getElementById("save-book-btn").addEventListener("click", async () => {
  const subject = document.getElementById("book-subject").value;
  const title = document.getElementById("book-title").value.trim();
  const description = document.getElementById("book-desc").value.trim();
  const pdfUrl = document.getElementById("book-url").value.trim();

  if (!title || !pdfUrl) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لازم تكتب اسم الكتاب وتلزق الرابط بتاعه.', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("save-book-btn");
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";

  try {
    // حفظ الكتاب في كولكشن books
    await addDoc(collection(db, "books"), {
      subject: subject,
      title: title,
      description: description,
      pdfUrl: pdfUrl, // حفظنا اللينك هنا
      createdAt: serverTimestamp()
    });

    Swal.fire({
      icon: 'success',
      title: 'تم بنجاح!',
      text: 'تمت إضافة الكتاب للمكتبة.',
      background: '#12121f', color: '#fff', confirmButtonColor: '#22c55e'
    }).then(() => {
      // تفريغ الخانات
      document.getElementById("book-title").value = "";
      document.getElementById("book-desc").value = "";
      document.getElementById("book-url").value = "";
    });

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ الكتاب في قاعدة البيانات";
  }
});