import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// دالة تحويل لينك جوجل درايف لتحميل مباشر
function getDirectLink(url) {
  if (url && url.includes("drive.google.com")) {
    const idMatch = url.match(/\/d\/(.+?)\//) || url.match(/id=(.+?)(&|$)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    }
  }
  return url;
}

const booksContainer = document.getElementById('books-container');

// 1. الحماية وجلب بيانات المستخدم
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const name = user.displayName || "طالب مدار";
    document.getElementById("nav-name").textContent = name;
    document.getElementById("user-avatar").textContent = name.charAt(0).toUpperCase();

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        // إخفاء التقييمات لتالتة إعدادي
        if (userData.gradeLevel === "3-prep") {
          const evalTab = document.getElementById("evaluations-tab");
          if (evalTab) evalTab.style.display = "none";
        }

        // 🔥 جلب الكتب الخاصة بسنة الطالب دي بس
        loadBooks(userData.gradeLevel);

      } else {
        // لو مفيش بيانات (حساب قديم)، نجيب كل الكتب كاحتياطي
        loadBooks(null); 
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  } else {
    window.location.href = "index.html";
  }
});

// 2. تفعيل القائمة المنسدلة
const profileBtn = document.getElementById("profile-btn");
const dropdown = document.getElementById("dropdown");
if(profileBtn) {
    profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
    });
}
document.addEventListener("click", () => {
  if(dropdown) dropdown.classList.remove("show");
});

// 3. تسجيل الخروج
document.getElementById("logout-btn").addEventListener("click", (e) => {
  e.preventDefault();
  Swal.fire({
    title: 'تسجيل الخروج', text: "هل أنت متأكد من الخروج؟", icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#2a2a3e',
    confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then((result) => {
    if (result.isConfirmed) {
      signOut(auth).then(() => window.location.href = "index.html");
    }
  });
});

// 4. دالة جلب الكتب من الفايربيز (مفلترة بالسنة)
async function loadBooks(gradeLevel) {
  try {
    const booksRef = collection(db, "books");
    let booksQuery;

    // لو معانا سنة الطالب، نفلتر بيها. لو مش معانا (null)، نجيب الكل
    if (gradeLevel) {
        booksQuery = query(booksRef, where("gradeLevel", "==", gradeLevel));
    } else {
        booksQuery = booksRef;
    }

    const snapshot = await getDocs(booksQuery);
    booksContainer.innerHTML = ''; // مسح علامة التحميل

    if (snapshot.empty) {
      booksContainer.innerHTML = `
        <div class="loading-state">
          <h3>لا توجد كتب أو ملازم لصفك الدراسي حالياً 😅</h3>
          <p>المعلم لم يقم برفع أي ملفات لصفك بعد. تابعنا لاحقاً!</p>
        </div>
      `;
      return;
    }

    snapshot.forEach((doc) => {
      const book = doc.data();
      
      const card = document.createElement('div');
      card.className = 'book-card';
      
      card.innerHTML = `
        <div class="book-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        </div>
        <span class="book-subject">${book.subject}</span>
        <h3 class="book-title">${book.title}</h3>
        <p class="book-desc">${book.description || 'ملزمة تعليمية شاملة لمساعدتك في المذاكرة.'}</p>
        
        <a href="${getDirectLink(book.pdfUrl)}" target="_blank" class="btn-download">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          تحميل الملف
        </a>
      `;
      booksContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Error loading books:", error);
    booksContainer.innerHTML = `
      <div class="loading-state" style="color: #ef4444;">
        <h3>حدث خطأ في تحميل المكتبة</h3>
        <p>تأكد من اتصالك بالإنترنت.</p>
      </div>
    `;
  }
}
