import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن";
    loadTeams();
  } else {
    window.location.href = "../index.html";
  }
});

async function loadTeams() {
  const tbody = document.getElementById("teams-table-body");
  
  try {
    // 1. جلب كل الطلاب عشان نربط الـ ID بالاسم
    const usersSnap = await getDocs(collection(db, "users"));
    const usersMap = {};
    usersSnap.forEach(doc => {
        usersMap[doc.id] = doc.data().name || "طالب";
    });

    // 2. جلب كل الفرق
    const teamsSnap = await getDocs(collection(db, "teams"));
    let teamsArray = [];
    
    teamsSnap.forEach(doc => {
        teamsArray.push({ id: doc.id, ...doc.data() });
    });

    // 3. ترتيب الفرق حسب الـ XP
    teamsArray.sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));

    tbody.innerHTML = "";

    if (teamsArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 30px;">لا توجد فرق مسجلة حتى الآن.</td></tr>`;
        return;
    }

    teamsArray.forEach((team, index) => {
        // تجهيز أسماء الأعضاء
        let memberNames = team.members.map(uid => {
            let name = usersMap[uid] || "طالب محذوف";
            if (uid === team.leaderId) name += " (قائد)";
            return name;
        }).join(" - ");

        // شكل الميدالية للترتيب
        let rankDisplay = index + 1;
        if (index === 0) rankDisplay = "🥇 1";
        if (index === 1) rankDisplay = "🥈 2";
        if (index === 2) rankDisplay = "🥉 3";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:bold; font-size:1.1rem; color: ${index < 3 ? '#f59e0b' : '#fff'};">${rankDisplay}</td>
            <td class="student-name">${team.teamName}</td>
            <td style="direction: ltr; text-align: center; color: var(--accent); font-weight:bold;">${team.inviteCode}</td>
            <td><span class="score-badge pass" style="font-size:1.1rem;">${team.totalXP || 0} XP</span></td>
            <td style="text-align:center;">${team.members.length}</td>
            <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${memberNames}">${memberNames}</td>
        `;
        tbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Error loading teams:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 30px;">حدث خطأ في تحميل البيانات.</td></tr>`;
  }
}
