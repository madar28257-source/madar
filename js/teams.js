import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }

  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    currentUserData = userDoc.data();
    
    if (currentUserData.teamId) {
      // الطالب في فريق بالفعل
      loadTeamData(currentUserData.teamId);
    } else {
      // الطالب مش في فريق
      document.getElementById("no-team-view").style.display = "block";
      document.getElementById("team-dashboard-view").classList.remove("active");
    }
  }
});

// إظهار الفورم
window.showForm = (type) => {
    document.querySelectorAll('.form-box').forEach(box => box.classList.remove('active'));
    document.getElementById(`\${type}-form`).classList.add('active');
};

// 🎯 إنشاء فريق جديد
window.createTeam = async () => {
    const name = document.getElementById('team-name-input').value.trim();
    if (!name) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اكتب اسم الفريق الأول!', background: '#12121f', color: '#fff' });
        return;
    }

    // توليد كود دعوة عشوائي
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const inviteCode = `#MADAR-\${randomNum}`;

    try {
        // 1. إنشاء الفريق في كولكشن teams
        const teamRef = await addDoc(collection(db, "teams"), {
            teamName: name,
            inviteCode: inviteCode,
            leaderId: auth.currentUser.uid,
            members: [auth.currentUser.uid], // القائد هو أول عضو
            totalXP: currentUserData.xp || 0, // بننقل نقاطه للفريق
            createdAt: serverTimestamp()
        });

        // 2. تحديث بيانات الطالب عشان يبقى مربوط بالفريق
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            teamId: teamRef.id,
            teamName: name,
            teamRole: 'leader'
        });

        Swal.fire({
            icon: 'success', title: 'تم إنشاء الفريق!', text: `كود الدعوة بتاعك هو: \${inviteCode}`, background: '#12121f', color: '#fff'
        }).then(() => window.location.reload());

    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء إنشاء الفريق.', background: '#12121f', color: '#fff' });
    }
};

// 🎯 الانضمام لفريق بكود
window.joinTeam = async () => {
    const code = document.getElementById('join-code-input').value.trim();
    if (!code) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اكتب كود الدعوة!', background: '#12121f', color: '#fff' });
        return;
    }

    try {
        const q = query(collection(db, "teams"), where("inviteCode", "==", code));
        const snap = await getDocs(q);

        if (snap.empty) {
            Swal.fire({ icon: 'error', title: 'كود غلط', text: 'مفيش فريق بالكود ده، اتأكد منه تاني.', background: '#12121f', color: '#fff' });
            return;
        }

        const teamDoc = snap.docs[0];
        const teamData = teamDoc.data();

        // التأكد إن الطالب مش عضو بالفعل
        if (teamData.members.includes(auth.currentUser.uid)) {
            Swal.fire({ icon: 'info', title: 'أنت عضو بالفعل', text: 'إنت موجود في الفريق ده خلاص.', background: '#12121f', color: '#fff' });
            return;
        }

        // 1. إضافة الطالب لمصفوفة الأعضاء في الفريق
        await updateDoc(doc(db, "teams", teamDoc.id), {
            members: arrayUnion(auth.currentUser.uid),
            totalXP: increment(currentUserData.xp || 0) // بنضيف نقاطه لرصيد الفريق
        });

        // 2. تحديث بيانات الطالب
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            teamId: teamDoc.id,
            teamName: teamData.teamName,
            teamRole: 'member'
        });

        Swal.fire({
            icon: 'success', title: 'تم الانضمام!', text: `أهلاً بك في فريق \${teamData.teamName}`, background: '#12121f', color: '#fff'
        }).then(() => window.location.reload());

    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء الانضمام.', background: '#12121f', color: '#fff' });
    }
};

// تحميل بيانات الفريق للعرض
async function loadTeamData(teamId) {
    document.getElementById("no-team-view").style.display = "none";
    document.getElementById("team-dashboard-view").classList.add("active");

    const teamDoc = await getDoc(doc(db, "teams", teamId));
    if (teamDoc.exists()) {
        const data = teamDoc.data();
        document.getElementById('display-team-name').textContent = data.teamName;
        document.getElementById('display-invite-code').textContent = data.inviteCode;
        document.getElementById('display-team-xp').textContent = data.totalXP || 0;
        document.getElementById('display-team-members').textContent = data.members ? data.members.length : 1;
    }
}

// نسخ كود الدعوة
window.copyCode = () => {
    const code = document.getElementById('display-invite-code').textContent;
    navigator.clipboard.writeText(code);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم نسخ الكود!', showConfirmButton: false, timer: 1500, background: '#12121f', color: '#fff' });
};
