import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, arrayUnion, increment, arrayRemove } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }

  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    currentUserData = { id: user.uid, ...userDoc.data() };
    
    if (currentUserData.teamId) {
      loadTeamData(currentUserData.teamId);
    } else {
      document.getElementById("no-team-view").style.display = "block";
      document.getElementById("team-dashboard-view").classList.remove("active");
    }
  }
});

window.showForm = (type) => {
    document.querySelectorAll('.form-box').forEach(box => box.classList.remove('active'));
    document.getElementById(`${type}-form`).classList.add('active');
};

window.createTeam = async () => {
    const name = document.getElementById('team-name-input').value.trim();
    if (!name) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اكتب اسم الفريق الأول!', background: '#12121f', color: '#fff' });
        return;
    }
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const inviteCode = `#MADAR-${randomNum}`;

    try {
        const teamRef = await addDoc(collection(db, "teams"), {
            teamName: name,
            inviteCode: inviteCode,
            leaderId: auth.currentUser.uid,
            members: [auth.currentUser.uid],
            totalXP: currentUserData.xp || 0,
            createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            teamId: teamRef.id,
            teamName: name,
            teamRole: 'leader'
        });

        Swal.fire({
            icon: 'success', title: 'تم إنشاء الفريق!', text: `كود الدعوة بتاعك هو: ${inviteCode}`, background: '#12121f', color: '#fff'
        }).then(() => window.location.reload());

    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء إنشاء الفريق.', background: '#12121f', color: '#fff' });
    }
};

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

        if (teamData.members.includes(auth.currentUser.uid)) {
            Swal.fire({ icon: 'info', title: 'أنت عضو بالفعل', text: 'إنت موجود في الفريق ده خلاص.', background: '#12121f', color: '#fff' });
            return;
        }

        await updateDoc(doc(db, "teams", teamDoc.id), {
            members: arrayUnion(auth.currentUser.uid),
            totalXP: increment(currentUserData.xp || 0)
        });

        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            teamId: teamDoc.id,
            teamName: teamData.teamName,
            teamRole: 'member'
        });

        Swal.fire({
            icon: 'success', title: 'تم الانضمام!', text: `أهلاً بك في فريق ${teamData.teamName}`, background: '#12121f', color: '#fff'
        }).then(() => window.location.reload());

    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء الانضمام.', background: '#12121f', color: '#fff' });
    }
};

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

        // 🔥 تحميل قائمة الأعضاء بأسمائهم
        renderMembers(data.members, data.leaderId);
    }
}

// دالة عرض الأعضاء
async function renderMembers(memberIds, leaderId) {
    const container = document.getElementById('members-container');
    container.innerHTML = "جاري تحميل الأعضاء...";

    try {
        let html = "";
        for (const uid of memberIds) {
            const userDoc = await getDoc(doc(db, "users", uid));
            let name = userDoc.exists() ? userDoc.data().name : "طالب";
            let isLeader = (uid === leaderId);
            
            // هل المستخدم الحالي هو القائد؟
            let isCurrentUserLeader = (auth.currentUser.uid === leaderId);

            html += `
                <div class="member-item">
                    <div>
                        <span class="member-name">${name}</span>
                        ${isLeader ? '<span class="leader-badge">قائد</span>' : ''}
                    </div>
                    ${(isCurrentUserLeader && !isLeader) ? `<button class="btn-kick" onclick="kickMember('${uid}', '${name}')">طرد</button>` : ''}
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading members:", error);
        container.innerHTML = "حدث خطأ في تحميل الأعضاء.";
    }
}

// 🔥 دالة طرد عضو (للقائد فقط)
window.kickMember = async (memberUid, memberName) => {
    Swal.fire({
        title: 'تأكيد الطرد',
        text: `هل أنت متأكد من طرد ${memberName} من الفريق؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#2a2a3e',
        confirmButtonText: 'نعم، اطرده',
        cancelButtonText: 'إلغاء',
        background: '#12121f', color: '#fff'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // 1. سحب العضو من الفريق
                const teamRef = doc(db, "teams", currentUserData.teamId);
                const teamSnap = await getDoc(teamRef);
                const teamData = teamSnap.data();
                
                // حساب نقاط العضو اللي بيتطرد عشان ننقصها من الفريق (اختياري)
                const kickedUserSnap = await getDoc(doc(db, "users", memberUid));
                const kickedUserXP = kickedUserSnap.exists() ? (kickedUserSnap.data().xp || 0) : 0;

                await updateDoc(teamRef, {
                    members: arrayRemove(memberUid),
                    totalXP: increment(-kickedUserXP) // ننقص نقاطه من الفريق
                });

                // 2. فصل العضو عن الفريق في بياناته
                await updateDoc(doc(db, "users", memberUid), {
                    teamId: null,
                    teamName: null,
                    teamRole: null
                });

                Swal.fire({ icon: 'success', title: 'تم الطرد', text: `تم طرد ${memberName} بنجاح.`, background: '#12121f', color: '#fff' })
                .then(() => window.location.reload());

            } catch (error) {
                console.error(error);
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء محاولة الطرد.', background: '#12121f', color: '#fff' });
            }
        }
    });
};

window.copyCode = () => {
    const code = document.getElementById('display-invite-code').textContent;
    navigator.clipboard.writeText(code);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم نسخ الكود!', showConfirmButton: false, timer: 1500, background: '#12121f', color: '#fff' });
};
