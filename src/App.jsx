import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabase.js";

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => {
  const date = new Date();

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

const emptyForm = () => ({
  name: "",
  mobile: "",
  address: "",
  amount: "",
  paymentMode: "Cash",
  transactionId: "",
  date: getToday(),
  time: getCurrentTime(),
  remarks: "",
});

const collectionDetails = {
  money: {
    title: "Money Collection",
    description: "Manage the main community collection.",
    addLabel: "Add Money",
  },
  personal1: {
    title: "Personal Collection 1",
    description: "Manage your first personal collection.",
    addLabel: "Add to Personal Collection 1",
  },
  personal2: {
    title: "Personal Collection 2",
    description: "Manage your second personal collection.",
    addLabel: "Add to Personal Collection 2",
  },
};

const TABLES = {
  money: "money_collections",
  personal1: "personal_collection_1",
  personal2: "personal_collection_2",
  materials: "material_donations",
};

const moneyFromDb = (row) => ({
  id: row.id, created_by: row.created_by, name: row.name, mobile: row.mobile || "", address: row.address || "",
  amount: Number(row.amount), paymentMode: row.payment_mode, transactionId: row.transaction_id || "",
  date: row.collection_date, time: String(row.collection_time || "").slice(0, 5), remarks: row.remarks || "",
});
const materialFromDb = (row) => ({
  id: row.id, created_by: row.created_by, donorName: row.name, mobile: row.mobile || "", address: row.address || "",
  item: row.item, quantity: Number(row.quantity), unit: row.unit, date: row.donation_date,
  time: String(row.donation_time || "").slice(0, 5), remarks: row.remarks || "",
});

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [forcePublicHome, setForcePublicHome] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [requestRecoveryMode, setRequestRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [userRole, setUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [committeeMessage, setCommitteeMessage] = useState("");
  const [myCommittees, setMyCommittees] = useState([]);
  const [activeCommitteeId, setActiveCommitteeId] = useState("");
  const [committeeName, setCommitteeName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [committeeLoading, setCommitteeLoading] = useState(false);
  const [membersForCommittee, setMembersForCommittee] = useState("");
  const [committeeMembers, setCommitteeMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let restoreRequest = 0;

    async function restoreSession(session) {
      const requestId = ++restoreRequest;
      try {
        if (!session?.user) {
          if (isMounted && requestId === restoreRequest) {
            setLoggedIn(false);
            setUserRole("");
            setCurrentUserId("");
            setAuthChecking(false);
          }
          return;
        }

        const { data: role, error: roleError } = await supabase.rpc("get_my_role");
        if (!isMounted || requestId !== restoreRequest) return;

        if (roleError) {
          setLoginError("Unable to verify your account. Please log in again.");
          setLoggedIn(false);
          setUserRole("");
          setCurrentUserId("");
          setAuthChecking(false);
          return;
        }

        // Accounts without a legacy admin/collector role are regular members.
        setUsername(session.user.user_metadata?.username || "");
        setUserRole(["admin", "collector"].includes(role) ? role : "member");
        setCurrentUserId(session.user.id);
        setLoggedIn(true);
        // Do not reset the selected screen when Supabase restores or refreshes a session.
        // This keeps the user inside the open community when returning to the browser tab.
        setLoginError("");
        setAuthChecking(false);
      } catch (error) {
        if (isMounted && requestId === restoreRequest) {
          console.error("FestFlow session restore error:", error);
          setLoginError("Unable to restore your session. Please log in again.");
          setLoggedIn(false);
          setUserRole("");
          setCurrentUserId("");
          setAuthChecking(false);
        }
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase emits PASSWORD_RECOVERY when a user opens a valid reset link.
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setLoginError("");
        setAuthChecking(false);
      }
      // Ignore stale async results if Supabase emits multiple session events.
      Promise.resolve().then(() => restoreSession(session));
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setLoginError("Unable to check your session. Please refresh and try again.");
        setAuthChecking(false);
        return;
      }
      restoreSession(data.session);
    }).catch((error) => {
      if (isMounted) {
        console.error("FestFlow getSession error:", error);
        setLoginError("Unable to check your session. Please refresh and try again.");
        setAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [formType, setFormType] = useState("money");
  const [editingId, setEditingId] = useState(null);

  // These collections are separate from one another.
  const [collections, setCollections] = useState([]);
  const [personal1, setPersonal1] = useState([]);
  const [personal2, setPersonal2] = useState([]);
  const [materialDonations, setMaterialDonations] = useState([]);
  const [materialForm, setMaterialForm] = useState({
    donorName: "", mobile: "", address: "", item: "", quantity: "",
    unit: "Pieces", date: getToday(), time: getCurrentTime(), remarks: "",
  });
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialDateFilter, setMaterialDateFilter] = useState("All");

  const [formData, setFormData] = useState(emptyForm());
  const [searchText, setSearchText] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [reportStartDate, setReportStartDate] = useState(`${getToday().slice(0, 7)}-01`);
  const [reportEndDate, setReportEndDate] = useState(getToday());

  const collectionData = {
  money: collections,
  personal1,
  personal2,
  materials: materialDonations,
  };

  const collectionSetters = {
  money: setCollections,
  personal1: setPersonal1,
  personal2: setPersonal2,
  materials: setMaterialDonations,
  };

  const currentRecords = collectionData[formType] || [];

  const moneyTotal = collections.reduce(
    (total, record) => total + Number(record.amount || 0),
    0
  );

  const personal1Total = personal1.reduce(
    (total, record) => total + Number(record.amount || 0),
    0
  );

  const personal2Total = personal2.reduce(
    (total, record) => total + Number(record.amount || 0),
    0
  );

  const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });

  const totalDonors = [
    ...collections,
    ...personal1,
    ...personal2,
  ].length;


  // Dashboard metrics are calculated from saved Supabase records (not demo values).
  const allMoneyRecords = [...collections, ...personal1, ...personal2];
  const uniqueDonorCount = new Set(
    allMoneyRecords.map((record) => String(record.name || "").trim().toLowerCase()).filter(Boolean)
  ).size;
  const recentMoneyRecords = [...allMoneyRecords]
    .sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`))
    .slice(0, 5);
  const recentMaterialRecords = [...materialDonations]
    .sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`))
    .slice(0, 5);
  const donorTotals = Object.values(allMoneyRecords.reduce((totals, record) => {
    const key = String(record.name || "").trim();
    if (!key) return totals;
    if (!totals[key]) totals[key] = { name: key, amount: 0 };
    totals[key].amount += Number(record.amount || 0);
    return totals;
  }, {})).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const monthlyTotals = Array.from({ length: 12 }, (_, month) => {
    const amount = allMoneyRecords.reduce((sum, record) => {
      if (!record.date) return sum;
      const date = new Date(`${record.date}T12:00:00`);
      return date.getFullYear() === new Date().getFullYear() && date.getMonth() === month
        ? sum + Number(record.amount || 0)
        : sum;
    }, 0);
    return { month: new Date(2000, month, 1).toLocaleString("en-IN", { month: "short" }), amount };
  });
  const maxMonthlyTotal = Math.max(...monthlyTotals.map((item) => item.amount), 1);


  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    if (!loggedIn || !activeCommitteeId) return;
    let cancelled = false;
    async function loadCollections() {
      setDataLoading(true);
      setDataError("");
      try {
        const names = ["money", "personal1", "personal2", "materials"];
        const results = await Promise.all(names.map((key) =>
          supabase.from(TABLES[key]).select("*").eq("committee_id", activeCommitteeId).order(key === "materials" ? "donation_date" : "collection_date", { ascending: false }).order("created_at", { ascending: false })
        ));
        const failed = results.find((result) => result.error);
        if (failed) throw failed.error;
        if (cancelled) return;
        setCollections(results[0].data.map(moneyFromDb));
        setPersonal1(results[1].data.map(moneyFromDb));
        setPersonal2(results[2].data.map(moneyFromDb));
        setMaterialDonations(results[3].data.map(materialFromDb));
      } catch (error) {
        if (!cancelled) setDataError(`Could not load saved records: ${error.message}`);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }
    loadCollections();
    return () => { cancelled = true; };
  }, [loggedIn, activeCommitteeId]);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_my_committees");
      if (cancelled) return;
      if (error) {
        setLoginError("Could not load your committees. Please refresh and try again.");
        return;
      }
      setMyCommittees(Array.isArray(data) ? data : []);
    })();
    return () => { cancelled = true; };
  }, [loggedIn, userRole]);

  async function refreshMyCommittees() {
    const { data, error } = await supabase.rpc("get_my_committees");
    if (error) throw error;
    setMyCommittees(Array.isArray(data) ? data : []);
  }

  async function handleViewCommitteeMembers(committee) {
    if (membersForCommittee === committee.id) {
      setMembersForCommittee("");
      setCommitteeMembers([]);
      return;
    }

    setMembersLoading(true);
    setLoginError("");
    setCommitteeMessage("");
    try {
      const { data, error } = await supabase.rpc("get_committee_members", {
        p_committee_id: committee.id,
      });
      if (error) throw error;
      setCommitteeMembers(Array.isArray(data) ? data : []);
      setMembersForCommittee(committee.id);
    } catch (error) {
      setLoginError(error?.message || "Could not load community members.");
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleRemoveCommitteeMember(committee, member) {
    if (member.is_owner) {
      setLoginError("The community owner cannot be removed.");
      return;
    }

    const memberName = member.username || "this member";
    const confirmed = window.confirm(
      `Remove ${memberName} from ${committee.name}? They will lose access to this community's records, but existing records will not be deleted.`
    );
    if (!confirmed) return;

    setMembersLoading(true);
    setLoginError("");
    setCommitteeMessage("");
    try {
      const { error } = await supabase.rpc("remove_committee_member", {
        p_committee_id: committee.id,
        p_user_id: member.user_id,
      });
      if (error) throw error;

      setCommitteeMembers((previous) =>
        previous.filter((item) => item.user_id !== member.user_id)
      );
      setCommitteeMessage(`${memberName} was removed from ${committee.name}. Their existing records were not deleted.`);
    } catch (error) {
      setLoginError(error?.message || "Could not remove this community member.");
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleCreateCommittee(event) {
    event.preventDefault();
    const name = committeeName.trim();
    if (!name) return;
    setCommitteeLoading(true);
    setLoginError("");
    try {
      const { error } = await supabase.rpc("create_committee", { p_name: name });
      if (error) throw error;
      setCommitteeName("");
      await refreshMyCommittees();
    } catch (error) {
      setLoginError(error.message || "Could not create the committee.");
    } finally {
      setCommitteeLoading(false);
    }
  }

  async function handleCopyInviteCode(code) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("Clipboard access was blocked by the browser.");
      }
      setLoginError("");
      setCommitteeMessage(`Invitation code ${code} copied. Share it with the people you want to invite.`);
    } catch (error) {
      setCommitteeMessage("");
      setLoginError(`Could not copy the invitation code. Please select and copy it manually. ${error?.message || ""}`.trim());
    }
  }

  async function handleShareInvitation(committee) {
    const invitationText = `Join my FestFlow community: ${committee.name}\nInvitation code: ${committee.invite_code}\nOpen FestFlow and enter this code to join.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${committee.name} on FestFlow`,
          text: invitationText,
        });
        setLoginError("");
        setCommitteeMessage(`Invitation for ${committee.name} shared successfully.`);
        return;
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(invitationText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = invitationText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("Clipboard access was blocked by the browser.");
      }

      setLoginError("");
      setCommitteeMessage("Invitation details copied. Paste them into a message to share with your committee members.");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setCommitteeMessage("");
      setLoginError(`Could not share the invitation. Please use Copy invitation code instead. ${error?.message || ""}`.trim());
    }
  }

  async function handleJoinCommittee(event) {
    event.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setLoginError("Enter an invitation code first.");
      return;
    }

    setCommitteeLoading(true);
    setLoginError("");
    setCommitteeMessage("");

    try {
      const { data, error } = await supabase.rpc("join_committee", {
        p_invite_code: code,
      });

      if (error) throw error;
      if (!data?.committee_id) {
        throw new Error("The server did not confirm which community was joined. Please try again.");
      }

      const wasAlreadyMember = myCommittees.some(
        (committee) => committee.id === data.committee_id
      );

      await refreshMyCommittees();
      setInviteCode("");

      setCommitteeMessage(
        wasAlreadyMember
          ? `You're already a member of "${data.committee_name}". Select "Open this community" above to enter it.`
          : `Successfully joined "${data.committee_name}"! You can now open it from Your communities.`
      );
    } catch (error) {
      console.error("FestFlow join community error:", error);
      setLoginError(error?.message || "Could not join the community. Check the invitation code and try again.");
    } finally {
      setCommitteeLoading(false);
    }
  }

  async function handleRequestPasswordReset(event) {
    event.preventDefault();
    setLoginError("");
    const email = recoveryEmail.trim().toLowerCase();
    if (!email) {
      setLoginError("Enter the email address you used when creating your FestFlow account.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setRecoveryEmailSent(true);
    } catch (error) {
      console.error("FestFlow password reset request error:", error);
      setLoginError(error?.message || "Could not send the password-reset email. Please try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    setLoginError("");
    if (newPassword.length < 8) {
      setLoginError("Your new password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setLoginError("The new passwords do not match.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setRecoveryMode(false);
      setRequestRecoveryMode(false);
      setRecoveryEmailSent(false);
      setRecoveryEmail("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPassword("");
      setIsRegistering(false);
      setLoggedIn(false);
      setShowLanding(false);
      setLoginError("Password updated successfully. Log in with your username and new password.");
    } catch (error) {
      console.error("FestFlow password update error:", error);
      setLoginError(error?.message || "Could not update your password. Please open the latest reset email and try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    const loginUsername = username.trim().toLowerCase();
    if (!loginUsername || !password) {
      setLoginError("Please enter your username and password.");
      return;
    }

    setLoginLoading(true);
    try {
      // The Edge Function securely resolves the username to the account email.
      const { data: loginData, error: loginFunctionError } = await supabase.functions.invoke(
        "login-with-username",
        { body: { username: loginUsername, password } }
      );

      if (loginFunctionError) throw new Error("Login failed. Please check your username and password.");
      if (!loginData?.access_token || !loginData?.refresh_token) {
        throw new Error(loginData?.error || "Login failed. Please check your username and password.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
      });
      if (sessionError) throw sessionError;

      const { data: role, error: roleError } = await supabase.rpc("get_my_role");
      if (roleError) throw new Error("Could not verify your account. Please try again.");

      const { data: authData } = await supabase.auth.getUser();
      setUserRole(["admin", "collector"].includes(role) ? role : "member");
      setCurrentUserId(authData.user?.id || "");
      setLoggedIn(true);
      setActiveCommitteeId("");
      setActiveScreen("communities");
      setPassword("");
    } catch (error) {
      console.error("FestFlow login error:", error);
      setLoginError(error?.message || "Login failed. Please check your username and password.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoginError("");

    const chosenUsername = username.trim().toLowerCase();
    const email = registerEmail.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(chosenUsername)) {
      setLoginError("Choose a username with 3–30 characters: lowercase letters, numbers, or underscores.");
      return;
    }
    if (!email || !password || password.length < 8) {
      setLoginError("Enter your email and a password with at least 8 characters.");
      return;
    }

    setLoginLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "register-with-username",
        { body: { username: chosenUsername, email, password } }
      );
      if (error) throw new Error("Could not create your account. Please try again.");
      if (data?.error) throw new Error(data.error);
      setLoginError("");
      setIsRegistering(false);
      setUsername(chosenUsername);
      setRegisterEmail("");
      setPassword("");
      alert("Account created successfully! You can now log in with your username and password.");
    } catch (error) {
      setLoginError(error?.message || "Registration failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    setLoginError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(`Logout failed: ${error.message}`);
      return;
    }
    setLoggedIn(false);
    setShowLanding(true);
    setUserRole("");
    setCurrentUserId("");
    setActiveCommitteeId("");
    setPassword("");
    setUsername("");
    setActiveScreen("dashboard");
  }

  function openCollection(type) {
    setFormType(type);
    setSearchText("");
    setPaymentFilter("All");
    setDateFilter("All");
    setActiveScreen(type);
  }

  function openAddForm(type) {
    setFormType(type);
    setEditingId(null);
    setFormData(emptyForm());
    setActiveScreen(`add-${type}`);
  }

  function openEditForm(type, record) {
    setFormType(type);
    setEditingId(record.id);

    setFormData({
      ...record,
      amount: String(record.amount),
    });

    setActiveScreen(`add-${type}`);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!activeCommitteeId) return alert("Please open a community first.");
    if (!formData.name.trim()) return alert("Please enter the donor name.");
    if (formData.amount === "" || !Number.isFinite(Number(formData.amount)) || Number(formData.amount) <= 0) return alert("Please enter a valid amount greater than zero.");
    if (!formData.date || !formData.time) return alert("Please select the date and time.");
    const table = TABLES[formType];
    if (!table || formType === "materials") return alert("Unable to save this collection.");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return alert("Your session has expired. Please log in again.");
    const payload = {
      name: formData.name.trim(), mobile: formData.mobile.trim() || null,
      address: formData.address.trim() || null, amount: Number(formData.amount),
      payment_mode: formData.paymentMode, transaction_id: formData.transactionId.trim() || null,
      collection_date: formData.date, collection_time: formData.time,
      remarks: formData.remarks.trim() || null,
    };
    try {
      const result = editingId !== null
        ? await supabase.from(table).update(payload).eq("id", editingId).eq("committee_id", activeCommitteeId).select().single()
        : await supabase.from(table).insert({ ...payload, committee_id: activeCommitteeId, created_by: authData.user.id }).select().single();
      if (result.error) throw result.error;
      const saved = moneyFromDb(result.data);
      const setter = collectionSetters[formType];
      setter((previous) => editingId !== null
        ? previous.map((record) => record.id === editingId ? saved : record)
        : [saved, ...previous]);
      alert(editingId !== null ? "Collection updated and saved." : "Collection saved to the database.");
      setFormData(emptyForm()); setEditingId(null); setSearchText("");
      setPaymentFilter("All"); setDateFilter("All"); setActiveScreen(formType);
    } catch (error) {
      alert(`Could not save collection: ${error.message}`);
    }
  }

  async function handleDelete(type, id) {
    if (userRole !== "admin") return alert("Only an administrator can delete records.");
    if (!window.confirm("Are you sure you want to permanently delete this collection record?")) return;
    try {
      const { error } = await supabase.from(TABLES[type]).delete().eq("id", id).eq("committee_id", activeCommitteeId);
      if (error) throw error;
      collectionSetters[type]((previous) => previous.filter((record) => record.id !== id));
      alert("Record deleted from the database.");
    } catch (error) { alert(`Could not delete record: ${error.message}`); }
  }

  function openMaterialForm(record = null) {
    setEditingMaterialId(record?.id ?? null);
    setMaterialForm(record ? {
      donorName: record.donorName,
      mobile: record.mobile || "",
      address: record.address || "",
      item: record.item,
      quantity: String(record.quantity),
      unit: record.unit,
      date: record.date,
      time: record.time,
      remarks: record.remarks || "",
    } : {
      donorName: "", mobile: "", address: "", item: "", quantity: "",
      unit: "Pieces", date: getToday(), time: getCurrentTime(), remarks: "",
    });
    setActiveScreen("add-materials");
  }

  async function saveMaterialDonation(event) {
    event.preventDefault();
    if (!activeCommitteeId) return alert("Please open a community first.");
    const quantity = Number(materialForm.quantity);
    if (!materialForm.donorName.trim() || !materialForm.item.trim() || !Number.isFinite(quantity) || quantity <= 0) return alert("Please enter the donor name, item name, and a quantity greater than zero.");
    if (!materialForm.date || !materialForm.time) return alert("Please select the date and time.");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return alert("Your session has expired. Please log in again.");
    const payload = {
      name: materialForm.donorName.trim(), mobile: materialForm.mobile.trim() || null,
      address: materialForm.address.trim() || null, item: materialForm.item.trim(), quantity,
      unit: materialForm.unit, donation_date: materialForm.date, donation_time: materialForm.time,
      remarks: materialForm.remarks.trim() || null,
    };
    try {
      const result = editingMaterialId !== null
        ? await supabase.from(TABLES.materials).update(payload).eq("id", editingMaterialId).eq("committee_id", activeCommitteeId).select().single()
        : await supabase.from(TABLES.materials).insert({ ...payload, committee_id: activeCommitteeId, created_by: authData.user.id }).select().single();
      if (result.error) throw result.error;
      const saved = materialFromDb(result.data);
      setMaterialDonations((previous) => editingMaterialId !== null
        ? previous.map((item) => item.id === editingMaterialId ? saved : item)
        : [saved, ...previous]);
      alert(editingMaterialId ? "Material donation updated and saved." : "Material donation saved to the database.");
      setEditingMaterialId(null); setMaterialSearch(""); setActiveScreen("materials");
    } catch (error) { alert(`Could not save material donation: ${error.message}`); }
  }

  async function deleteMaterialDonation(id) {
    if (userRole !== "admin") return alert("Only an administrator can delete records.");
    if (!window.confirm("Are you sure you want to permanently delete this material donation?")) return;
    try {
      const { error } = await supabase.from(TABLES.materials).delete().eq("id", id).eq("committee_id", activeCommitteeId);
      if (error) throw error;
      setMaterialDonations((previous) => previous.filter((record) => record.id !== id));
      alert("Material donation deleted from the database.");
    } catch (error) { alert(`Could not delete material donation: ${error.message}`); }
  }

  function renderMaterialForm() {
    return (
      <section className="collection-form-page">
        <div className="page-heading">
          <div>
            <h2>{editingMaterialId ? "Edit Material Donation" : "Add Material Donation"}</h2>
            <p>Record items donated for your community celebrations.</p>
          </div>
        </div>
        <form className="collection-form" onSubmit={saveMaterialDonation}>
          <div className="form-section-heading">
            <h3>Donor and Item Information</h3>
            <p>Fields marked * are required.</p>
          </div>
          <div className="form-grid">
            <label>Donor Name <span className="required">*</span>
              <input value={materialForm.donorName} onChange={(e) => setMaterialForm({ ...materialForm, donorName: e.target.value })} placeholder="Enter donor name" required />
            </label>
            <label>Mobile Number
              <input type="tel" value={materialForm.mobile} onChange={(e) => setMaterialForm({ ...materialForm, mobile: e.target.value })} placeholder="Optional mobile number" />
            </label>
            <label className="full-width-field">Address
              <textarea rows="2" value={materialForm.address} onChange={(e) => setMaterialForm({ ...materialForm, address: e.target.value })} placeholder="Optional address" />
            </label>
            <label>Material / Item Name <span className="required">*</span>
              <input value={materialForm.item} onChange={(e) => setMaterialForm({ ...materialForm, item: e.target.value })} placeholder="e.g. Rice, flowers, coconuts" required />
            </label>
            <label>Quantity <span className="required">*</span>
              <input type="number" min="0.01" step="any" value={materialForm.quantity} onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })} placeholder="Enter quantity" required />
            </label>
            <label>Unit <span className="required">*</span>
              <select value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} required>
                <option>Pieces</option><option>Kg</option><option>Grams</option><option>Litres</option><option>Packets</option><option>Bags</option><option>Boxes</option><option>Other</option>
              </select>
            </label>
            <label>Date <span className="required">*</span>
              <input type="date" value={materialForm.date} onChange={(e) => setMaterialForm({ ...materialForm, date: e.target.value })} required />
            </label>
            <label>Time <span className="required">*</span>
              <input type="time" value={materialForm.time} onChange={(e) => setMaterialForm({ ...materialForm, time: e.target.value })} required />
            </label>
            <label className="full-width-field">Remarks
              <textarea rows="3" value={materialForm.remarks} onChange={(e) => setMaterialForm({ ...materialForm, remarks: e.target.value })} placeholder="Optional notes" />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={() => { setEditingMaterialId(null); setActiveScreen("materials"); }}>Cancel</button>
            <button type="submit" className="small-primary-button">{editingMaterialId ? "Update Donation" : "Save Material Donation"}</button>
          </div>
        </form>
      </section>
    );
  }

  function renderMaterialList() {
    const search = materialSearch.trim().toLowerCase();
    const records = materialDonations.filter((record) => {
      const matchesSearch = !search || [record.donorName, record.mobile, record.item, record.address, record.remarks, record.unit].some((value) => String(value || "").toLowerCase().includes(search));
      const matchesDate = materialDateFilter === "All" || (materialDateFilter === "Today" && record.date === getToday());
      return matchesSearch && matchesDate;
    });
    return (
      <section>
        <div className="page-heading">
          <div><h2>Material Donations</h2><p>Manage donated items and quantities.</p></div>
          <button className="small-primary-button" onClick={() => openMaterialForm()}>+ Add Donation</button>
        </div>
        <div className="collection-summary-card">
          <div><p>Total Donation Records</p><h2>{materialDonations.length}</h2></div>
          <div><p>Different Items</p><h2>{new Set(materialDonations.map((record) => record.item.toLowerCase())).size}</h2></div>
        </div>
        <div className="collection-filters">
          <input type="search" placeholder="Search donor, item, mobile, address..." value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
          <select value={materialDateFilter} onChange={(e) => setMaterialDateFilter(e.target.value)} aria-label="Filter material donations by date"><option value="All">All Dates</option><option value="Today">Today</option></select>
        </div>
        <div className="collection-list">
          {records.length === 0 ? <div className="empty-collections"><div className="empty-collection-icon">▣</div><h3>{materialDonations.length ? "No matching donations" : "No material donations yet"}</h3><p>{materialDonations.length ? "Try a different search or date filter." : "Add the first donated item to get started."}</p>{materialDonations.length === 0 && <button className="small-primary-button" onClick={() => openMaterialForm()}>+ Add Donation</button>}</div> : records.map((record) => (
            <article className="collection-record" key={record.id}>
              <div className="record-top"><div><h3>{record.item}</h3><p>Donated by: {record.donorName}</p>{record.mobile && <p>{record.mobile}</p>}</div><strong className="record-amount">{record.quantity} {record.unit}</strong></div>
              <div className="record-details"><span><strong>Date:</strong> {record.date}</span><span><strong>Time:</strong> {record.time}</span>{record.address && <span><strong>Address:</strong> {record.address}</span>}</div>
              {record.remarks && <p className="record-note"><strong>Remarks:</strong> {record.remarks}</p>}
              <div className="record-actions">
                {(userRole === "admin" || record.created_by === currentUserId) && (
                  <button type="button" onClick={() => openMaterialForm(record)}>Edit</button>
                )}
                {userRole === "admin" && (
                  <button type="button" className="delete-record-button" onClick={() => deleteMaterialDonation(record.id)}>Delete</button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderReports() {
    const allMoneyRecords = [
      ...collections.map((record) => ({ ...record, collectionName: "Main Money Collection" })),
      ...personal1.map((record) => ({ ...record, collectionName: "Personal Collection 1" })),
      ...personal2.map((record) => ({ ...record, collectionName: "Personal Collection 2" })),
    ];

    const validDateRange = reportStartDate <= reportEndDate;
    const inRange = (record) =>
      validDateRange &&
      record.date >= reportStartDate &&
      record.date <= reportEndDate;

    const filteredMoneyRecords = allMoneyRecords.filter(inRange);
    const filteredMaterialRecords = materialDonations.filter(inRange);

    const sumAmounts = (records) =>
      records.reduce((sum, record) => sum + Number(record.amount || 0), 0);

    const grandTotal = sumAmounts(filteredMoneyRecords);
    const cashTotal = sumAmounts(filteredMoneyRecords.filter((record) => record.paymentMode === "Cash"));
    const upiTotal = sumAmounts(filteredMoneyRecords.filter((record) => record.paymentMode === "UPI"));
    const bankTotal = sumAmounts(filteredMoneyRecords.filter((record) => record.paymentMode === "Bank"));
    const otherTotal = sumAmounts(filteredMoneyRecords.filter((record) => record.paymentMode === "Other"));

    const totalsByCollection = [
      { label: "Main Money Collection", records: filteredMoneyRecords.filter((record) => record.collectionName === "Main Money Collection") },
      { label: "Personal Collection 1", records: filteredMoneyRecords.filter((record) => record.collectionName === "Personal Collection 1") },
      { label: "Personal Collection 2", records: filteredMoneyRecords.filter((record) => record.collectionName === "Personal Collection 2") },
    ];

    return (
      <section className="reports-page">
        <div className="page-heading">
          <div>
            <h2>Summary & Reports</h2>
            <p>Review money collections and material donations for a selected period.</p>
          </div>
        </div>

        <div className="report-date-filter">
          <label>
            Start date
            <input type="date" value={reportStartDate} max={reportEndDate} onChange={(event) => setReportStartDate(event.target.value)} />
          </label>
          <label>
            End date
            <input type="date" value={reportEndDate} min={reportStartDate} onChange={(event) => setReportEndDate(event.target.value)} />
          </label>
          <button type="button" className="cancel-button" onClick={() => {
            setReportStartDate(`${getToday().slice(0, 7)}-01`);
            setReportEndDate(getToday());
          }}>This month</button>
          <button type="button" className="cancel-button" onClick={() => {
            setReportStartDate("2000-01-01");
            setReportEndDate(getToday());
          }}>All dates</button>
        </div>

        {!validDateRange && <p className="report-error">Start date must be on or before the end date.</p>}

        <div className="report-summary-grid">
          <article className="report-summary-card">
            <p>Grand Total Collected</p>
            <h2>{formatAmount(grandTotal)}</h2>
            <span>{filteredMoneyRecords.length} money records</span>
          </article>
          <article className="report-summary-card">
            <p>Material Donation Records</p>
            <h2>{filteredMaterialRecords.length}</h2>
            <span>Donations in selected period</span>
          </article>
          <article className="report-summary-card">
            <p>Cash</p>
            <h2>{formatAmount(cashTotal)}</h2>
          </article>
          <article className="report-summary-card">
            <p>UPI</p>
            <h2>{formatAmount(upiTotal)}</h2>
          </article>
          <article className="report-summary-card">
            <p>Bank Transfer</p>
            <h2>{formatAmount(bankTotal)}</h2>
          </article>
          <article className="report-summary-card">
            <p>Other Payment</p>
            <h2>{formatAmount(otherTotal)}</h2>
          </article>
        </div>

        <div className="dashboard-section report-section">
          <h2>Collection Breakdown</h2>
          <div className="report-breakdown-list">
            {totalsByCollection.map((item) => (
              <article className="report-breakdown-row" key={item.label}>
                <div><strong>{item.label}</strong><span>{item.records.length} records</span></div>
                <strong>{formatAmount(sumAmounts(item.records))}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="dashboard-section report-section">
          <h2>Money Collection Details</h2>
          {filteredMoneyRecords.length === 0 ? (
            <p className="report-empty">No money collection records for this date range.</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Date</th><th>Collection</th><th>Donor</th><th>Payment</th><th>Amount</th></tr></thead>
                <tbody>
                  {filteredMoneyRecords.slice().sort((a, b) => b.date.localeCompare(a.date)).map((record) => (
                    <tr key={`${record.collectionName}-${record.id}`}>
                      <td>{record.date}</td><td>{record.collectionName}</td><td>{record.name}</td><td>{record.paymentMode}</td><td>{formatAmount(record.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dashboard-section report-section">
          <h2>Material Donations Details</h2>
          {filteredMaterialRecords.length === 0 ? (
            <p className="report-empty">No material donations for this date range.</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Date</th><th>Donor</th><th>Item</th><th>Quantity</th><th>Unit</th></tr></thead>
                <tbody>
                  {filteredMaterialRecords.slice().sort((a, b) => b.date.localeCompare(a.date)).map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td><td>{record.donorName}</td><td>{record.item}</td><td>{record.quantity}</td><td>{record.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderCollectionForm(type) {
    const details = collectionDetails[type];

    return (
      <section className="collection-form-page">
        <div className="page-heading">
          <div>
            <h2>{editingId !== null ? "Edit Collection" : details.addLabel}</h2>
            <p>{details.title}</p>
          </div>
        </div>

        <form className="collection-form" onSubmit={handleSave}>
          <div className="form-section-heading">
            <h3>Donor Information</h3>
            <p>Enter the details of the person making the contribution.</p>
          </div>

          <div className="form-grid">
            <label>
              Donor Name <span className="required">*</span>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter donor name"
                required
              />
            </label>

            <label>
              Mobile Number
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleFormChange}
                placeholder="Enter mobile number"
              />
            </label>

            <label className="full-width-field">
              Address
              <textarea
                name="address"
                value={formData.address}
                onChange={handleFormChange}
                placeholder="Enter address (optional)"
                rows="2"
              />
            </label>

            <label>
              Amount (₹) <span className="required">*</span>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleFormChange}
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
                required
              />
            </label>

            <label>
              Payment Mode <span className="required">*</span>
              <select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleFormChange}
                required
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              Transaction ID
              <input
                type="text"
                name="transactionId"
                value={formData.transactionId}
                onChange={handleFormChange}
                placeholder="Optional transaction ID"
              />
            </label>

            <label>
              Date <span className="required">*</span>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Time <span className="required">*</span>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleFormChange}
                required
              />
            </label>

            <label className="full-width-field">
              Remarks
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleFormChange}
                placeholder="Additional notes (optional)"
                rows="3"
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setEditingId(null);
                setActiveScreen(type);
              }}
            >
              Cancel
            </button>

            <button type="submit" className="small-primary-button">
              {editingId !== null ? "Update Collection" : "Save Collection"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  function renderCollectionList(type) {
    const details = collectionDetails[type];
    const records = collectionData[type];

    const filteredRecords = records.filter((record) => {
      const search = searchText.trim().toLowerCase();

      const matchesSearch =
        !search ||
        record.name.toLowerCase().includes(search) ||
        String(record.mobile || "").toLowerCase().includes(search) ||
        String(record.amount).includes(search) ||
        String(record.transactionId || "").toLowerCase().includes(search);

      const matchesPayment =
        paymentFilter === "All" || record.paymentMode === paymentFilter;

      const matchesDate =
        dateFilter === "All" ||
        (dateFilter === "Today" && record.date === getToday());

      return matchesSearch && matchesPayment && matchesDate;
    });

    const total = records.reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0
    );

    return (
      <section>
        <div className="page-heading">
          <div>
            <h2>{details.title}</h2>
            <p>{details.description}</p>
          </div>

          <button
            className="small-primary-button"
            onClick={() => openAddForm(type)}
          >
            + Add Collection
          </button>
        </div>

        <div className="collection-summary-card">
          <div>
            <p>Total Collection</p>
            <h2>{formatAmount(total)}</h2>
          </div>

          <div>
            <p>Total Records</p>
            <h2>{records.length}</h2>
          </div>
        </div>

        <div className="collection-filters">
          <input
            type="search"
            placeholder="Search name, mobile, amount, transaction ID..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            aria-label="Filter by payment mode"
          >
            <option value="All">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            aria-label="Filter by date"
          >
            <option value="All">All Dates</option>
            <option value="Today">Today</option>
          </select>
        </div>

        <div className="collection-list">
          {filteredRecords.length === 0 ? (
            <div className="empty-collections">
              <div className="empty-collection-icon">₹</div>

              <h3>
                {records.length === 0
                  ? "No collections yet"
                  : "No matching records"}
              </h3>

              <p>
                {records.length === 0
                  ? "Add your first record to get started."
                  : "Try changing your search or filters."}
              </p>

              {records.length === 0 && (
                <button
                  className="small-primary-button"
                  onClick={() => openAddForm(type)}
                >
                  + Add Collection
                </button>
              )}
            </div>
          ) : (
            filteredRecords.map((record) => (
              <article className="collection-record" key={record.id}>
                <div className="record-top">
                  <div>
                    <h3>{record.name}</h3>

                    {record.mobile && <p>{record.mobile}</p>}
                  </div>

                  <strong className="record-amount">
                    {formatAmount(record.amount)}
                  </strong>
                </div>

                <div className="record-details">
                  <span>
                    <strong>Payment:</strong> {record.paymentMode}
                  </span>

                  <span>
                    <strong>Date:</strong> {record.date}
                  </span>

                  <span>
                    <strong>Time:</strong> {record.time}
                  </span>

                  {record.transactionId && (
                    <span>
                      <strong>Transaction ID:</strong> {record.transactionId}
                    </span>
                  )}

                  {record.address && (
                    <span>
                      <strong>Address:</strong> {record.address}
                    </span>
                  )}
                </div>

                {record.remarks && (
                  <p className="record-note">
                    <strong>Remarks:</strong> {record.remarks}
                  </p>
                )}

                <div className="record-actions">
                  {(userRole === "admin" || record.created_by === currentUserId) && (
                    <button
                      type="button"
                      onClick={() => openEditForm(type, record)}
                    >
                      Edit
                    </button>
                  )}

                  {userRole === "admin" && (
                    <button
                      type="button"
                      className="delete-record-button"
                      onClick={() => handleDelete(type, record.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  if (authChecking) {
    return (
      <main className="login-page">
        <div className="login-card" role="status">Checking your session…</div>
      </main>
    );
  }

  if (requestRecoveryMode && !recoveryMode && !loggedIn) {
    return (
      <main className="login-page auth-split-page">
        <section className="login-card auth-form-card" style={{ margin: "auto" }}>
          <button type="button" className="auth-mobile-home" onClick={() => { setRequestRecoveryMode(false); setRecoveryEmailSent(false); setLoginError(""); }}>← Back to Login</button>
          <div className="login-logo">🌺</div>
          <h1>Forgot Password?</h1>
          {recoveryEmailSent ? (
            <>
              <p className="login-subtitle">If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.</p>
              <button type="button" className="login-button" onClick={() => { setRequestRecoveryMode(false); setRecoveryEmailSent(false); setLoginError(""); }}>Back to Login</button>
            </>
          ) : (
            <>
              <p className="login-subtitle">Enter the email address you used when creating your FestFlow account.</p>
              <form onSubmit={handleRequestPasswordReset}>
                <label>
                  Registered email address
                  <input type="email" autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="Enter your registered email" required />
                </label>
                {loginError && <p className="login-error" role="alert">{loginError}</p>}
                <button type="submit" className="login-button" disabled={recoveryLoading}>
                  {recoveryLoading ? "Sending email…" : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    );
  }

  if (recoveryMode) {
    return (
      <main className="login-page auth-split-page">
        <section className="login-card auth-form-card" style={{ margin: "auto" }}>
          <div className="login-logo">🌺</div>
          <h1>Set a new password</h1>
          <p className="login-subtitle">Choose a new password for your FestFlow account.</p>
          <form onSubmit={handleUpdatePassword}>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                placeholder="Enter new password (8+ characters)"
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                minLength={8}
                placeholder="Re-enter new password"
                required
              />
            </label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button type="submit" className="login-button" disabled={recoveryLoading}>
              {recoveryLoading ? "Updating password…" : "Update Password"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if ((!loggedIn && showLanding) || forcePublicHome) {
    const openLogin = () => {
      setForcePublicHome(false);
      setShowLanding(false);
      setIsRegistering(false);
      setLoginError("");
      setShowLanding(false);
    };
    const openRegister = () => {
      setForcePublicHome(false);
      setShowLanding(false);
      setIsRegistering(true);
      setLoginError("");
      setShowLanding(false);
    };

    return (
      <main className="public-home">
        <header className="public-nav">
          <a className="public-brand" href="#home" aria-label="FestFlow home">
            <img className="brand-image" src="/images/festflow-brand.png" alt="FestFlow — Every Community. Every Celebration. One Platform." />
          </a>
          <nav className="public-links" aria-label="Main navigation">
            <a className="selected" href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="public-nav-actions">
            <button className="public-login" onClick={openLogin}>Log In</button>
            <button className="public-primary" onClick={openRegister}>Create Your Committee</button>
          </div>
        </header>

        <section className="public-hero" id="home">
          <div className="hero-copy">
            <p className="hero-kicker">ORGANIZE&nbsp; · &nbsp;COLLECT&nbsp; · &nbsp;MANAGE&nbsp; · &nbsp;CELEBRATE</p>
            <h1>Fest<span>Flow</span></h1>
            <h2>Every Community. Every Celebration. One Platform.</h2>
            <p className="hero-description">Manage your festival collections, organize your committee and keep your financial records in one secure place.</p>
            <div className="hero-actions">
              <button className="public-primary hero-create" onClick={openRegister}>Create Your Committee <span>→</span></button>
              <button className="public-login hero-login" onClick={openLogin}>Log In</button>
            </div>
          </div>
          <div className="festival-art" aria-hidden="true">
            <img src="/images/festival-hero.png" alt="" />
          </div>
        </section>

        <section className="feature-strip" id="features">
          <article><span className="feature-icon coral">♟</span><strong>Multiple Festivals</strong><p>Use for any festival<br/>or community event</p></article>
          <article><span className="feature-icon orange">₹</span><strong>Easy Collection</strong><p>Record monetary<br/>and material donations</p></article>
          <article><span className="feature-icon green">✓</span><strong>Secure &amp; Private</strong><p>Your data stays safe<br/>and separate</p></article>
          <article><span className="feature-icon purple">▥</span><strong>Reports &amp; Insights</strong><p>Get detailed reports<br/>anytime</p></article>
          <article><span className="feature-icon amber">♟</span><strong>Manage Collectors</strong><p>Add and manage<br/>your team easily</p></article>
          <article><span className="feature-icon violet">▣</span><strong>Accessible Anywhere</strong><p>Use on mobile,<br/>tablet or computer</p></article>
        </section>

        <section className="celebration-section" id="how-it-works">
          <h2>Perfect for Every Community and Celebration</h2>
          <p>From religious festivals to cultural events, FestFlow helps you manage your collections with transparency.</p>
          <div className="celebration-grid">
            <article><div className="category-art"><img src="/images/religious-festivals.png" alt="" /></div><strong>Religious Festivals</strong></article>
            <article><div className="category-art"><img src="/images/community-events.png" alt="" /></div><strong>Community Events</strong></article>
            <article><div className="category-art"><img src="/images/cultural-celebrations.png" alt="" /></div><strong>Cultural Celebrations</strong></article>
            <article><div className="category-art"><img src="/images/temple-events.png" alt="" /></div><strong>Temple Events</strong></article>
            <article><div className="category-art"><img src="/images/charity-drives.png" alt="" /></div><strong>Charity Drives</strong></article>
            <article><div className="category-art"><img src="/images/other-events.png" alt="" /></div><strong>Others</strong></article>
          </div>
        </section>

        <footer className="public-footer" id="about">
          <div className="footer-promises">
            <div><span>♟</span><strong>Trusted by<br/>Communities</strong></div>
            <div><span>▤</span><strong>Simple &amp; Easy<br/>to Use</strong></div>
            <div><span>▣</span><strong>Transparent<br/>Record Keeping</strong></div>
            <div><span>♡</span><strong>Built for<br/>Stronger Communities</strong></div>
          </div>
          <div className="footer-cta" id="contact">
            <small>READY TO GET STARTED?</small><h2>Create your committee today</h2><p>and manage your collections with confidence.</p>
            <button className="public-primary" onClick={openRegister}>Create Your Committee <span>→</span></button>
          </div>
        </footer>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="login-page auth-split-page">
        <section className="auth-promo-panel">
          <a className="auth-home-button" href="#home" onClick={(event) => { event.preventDefault(); setShowLanding(true); setForcePublicHome(false); setLoginError(""); }}>← Home</a>
          <div className="auth-promo-copy">
            <img className="auth-brand-image" src="/images/festflow-brand.png" alt="FestFlow" />
            <p className="auth-eyebrow">ORGANIZE · COLLECT · MANAGE · CELEBRATE</p>
            <h2>{isRegistering ? "Start your community journey" : "Every Community. Every Celebration. One Platform."}</h2>
            <p>Manage festival collections, bring your committee together, and keep every contribution organized in one secure place.</p>
            <div className="auth-benefit-list">
              <div><span>♟</span><section><strong>Multiple Festivals</strong><small>For any festival or community event</small></section></div>
              <div><span>₹</span><section><strong>Easy Collection</strong><small>Record money and material donations</small></section></div>
              <div><span>✓</span><section><strong>Secure &amp; Private</strong><small>Your community records stay separate</small></section></div>
              <div><span>▥</span><section><strong>Reports &amp; Insights</strong><small>Keep your records clear and transparent</small></section></div>
            </div>
          </div>
        </section>
        <form className="login-card auth-form-card" onSubmit={isRegistering ? handleRegister : handleLogin}>
          <button type="button" className="auth-mobile-home" onClick={() => { setShowLanding(true); setForcePublicHome(false); setLoginError(""); }}>← Home</button>
          <div className="login-logo">🌺</div>
          <h1>FestFlow</h1>
          <p className="login-subtitle">Every Community. Every Celebration. One Platform.</p>

          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={isRegistering ? "Choose a unique username" : "Enter your username"}
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]{3,30}"
              title="Use 3–30 letters, numbers, or underscores."
              required
            />
          </label>

          {isRegistering && (
            <label>
              Email address (for password recovery)
              <input
                type="email"
                autoComplete="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="Enter your email address"
                required
              />
            </label>
          )}

          <label>
            Password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isRegistering ? "Create a password (8+ characters)" : "Enter password"}
              minLength={isRegistering ? 8 : undefined}
              required
            />
          </label>

          {!isRegistering && (
            <div style={{ textAlign: "right", marginTop: "-4px", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setRecoveryMode(false);
                  setRequestRecoveryMode(true);
                  setRecoveryEmail("");
                  setRecoveryEmailSent(false);
                  setLoginError("");
                  setShowLanding(false);
                  setForcePublicHome(false);
                  setIsRegistering(false);
                }}
                style={{ border: 0, background: "none", color: "#b33112", cursor: "pointer", fontWeight: 700 }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <label className="show-password-label">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Show password
          </label>

          {loginError && <p className="login-error" role="alert">{loginError}</p>}

          <button type="submit" className="login-button" disabled={loginLoading}>
            {loginLoading ? (isRegistering ? "Creating account…" : "Signing in…") : (isRegistering ? "Create Account" : "Login")}
          </button>

          <p style={{ textAlign: "center", marginTop: "16px" }}>
            {isRegistering ? "Already have an account? " : "New to FestFlow? "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError("");
                setPassword("");
              }}
              style={{ border: 0, background: "none", color: "#b33112", cursor: "pointer", fontWeight: 700 }}
            >
              {isRegistering ? "Login" : "Create Account"}
            </button>
          </p>

          <p className="login-footer">FestFlow Community Collection Management</p>
        </form>
      </main>
    );
  }

  if (loggedIn && (!activeCommitteeId || activeScreen === "communities")) {
    return (
      <main className="login-page auth-split-page community-auth-page">
        <section className="auth-promo-panel">
          <button type="button" className="auth-home-button" onClick={() => { setForcePublicHome(true); setLoginError(""); setCommitteeMessage(""); }}>← Home</button>
          <div className="auth-promo-copy">
            <img className="auth-brand-image" src="/images/festflow-brand.png" alt="FestFlow" />
            <p className="auth-eyebrow">BRING YOUR COMMUNITY TOGETHER</p>
            <h2>Every celebration starts with a community.</h2>
            <p>Create a space for your committee or join an existing community with an invitation code.</p>
            <div className="auth-benefit-list">
              <div><span>✦</span><section><strong>Create your community</strong><small>Give your committee a shared home</small></section></div>
              <div><span>↗</span><section><strong>Invite your team</strong><small>Share your invitation code securely</small></section></div>
              <div><span>₹</span><section><strong>Track contributions</strong><small>Keep collections organized in one place</small></section></div>
              <div><span>✓</span><section><strong>Stay transparent</strong><small>Review records with your committee</small></section></div>
            </div>
          </div>
        </section>
        <section className="login-card community-form-card">
          <button type="button" className="auth-mobile-home" onClick={() => { setForcePublicHome(true); setLoginError(""); setCommitteeMessage(""); }}>← Home</button>
          <div className="login-logo">🌺</div>
          <h1>Welcome to FestFlow</h1>
          <p className="login-subtitle">Create a community or join one with an invitation code.</p>
          {loginError && <p className="login-error" role="alert">{loginError}</p>}
          {committeeMessage && <p role="status" style={{ color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", borderRadius: 8 }}>{committeeMessage}</p>}
          {myCommittees.length > 0 && (
            <div style={{ textAlign: "left", margin: "20px 0", padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <h3 style={{ marginTop: 0 }}>Your communities</h3>
              {myCommittees.map((committee) => (
                <div key={committee.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
                  <strong>{committee.name}</strong>
                  <p style={{ margin: "6px 0 0", color: "#555" }}>Invitation code: <strong>{committee.invite_code}</strong></p>
                  <button type="button" className="cancel-button" style={{ marginTop: 10 }} onClick={() => handleCopyInviteCode(committee.invite_code)}>Copy invitation code</button>
                  <button type="button" className="cancel-button" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => handleShareInvitation(committee)}>Share invitation</button>
                  <button type="button" className="cancel-button" style={{ marginTop: 10, marginLeft: 8 }} disabled={membersLoading} onClick={() => handleViewCommitteeMembers(committee)}>{membersLoading && membersForCommittee !== committee.id ? "Loading members…" : membersForCommittee === committee.id ? "Hide members" : "View members"}</button>
                  <button type="button" className="login-button" style={{ marginTop: 10 }} onClick={() => { setActiveCommitteeId(committee.id); setActiveScreen("dashboard"); setLoginError(""); }}>Open this community</button>
                  {membersForCommittee === committee.id && (
                    <div style={{ marginTop: 12, padding: 12, background: "#fff7f1", border: "1px solid #fed7aa", borderRadius: 10 }}>
                      <strong>Community members ({committeeMembers.length})</strong>
                      {committeeMembers.length === 0 ? <p style={{ marginBottom: 0 }}>No member details were returned.</p> : (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                          {committeeMembers.map((member) => (
                            <li key={member.user_id} style={{ marginBottom: 8 }}>
                              <span>{member.username || "Member"}{member.is_owner ? " — Owner" : ""}</span>
                              {!member.is_owner && committeeMembers.some((item) => item.is_owner && item.user_id === currentUserId) && (
                                <button
                                  type="button"
                                  className="cancel-button"
                                  style={{ marginLeft: 8, padding: "5px 8px", color: "#b91c1c" }}
                                  disabled={membersLoading}
                                  onClick={() => handleRemoveCommitteeMember(committee, member)}
                                >
                                  {membersLoading ? "Please wait…" : "Remove member"}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <p style={{ fontSize: 13, color: "#666" }}>Open a community to view and manage its shared collection records.</p>
            </div>
          )}
          <form onSubmit={handleCreateCommittee} style={{ textAlign: "left", marginTop: 22 }}>
            <h3>Create a community</h3>
            <label>Community name<input value={committeeName} onChange={(e) => setCommitteeName(e.target.value)} placeholder="e.g. Green Park Festival Committee" maxLength={100} required /></label>
            <button className="login-button" type="submit" disabled={committeeLoading}>{committeeLoading ? "Please wait…" : "Create Community"}</button>
          </form>
          <form onSubmit={handleJoinCommittee} style={{ textAlign: "left", marginTop: 24 }}>
            <h3>Join a community</h3>
            <label>Invitation code<input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter invitation code" maxLength={8} required /></label>
            <button className="login-button" type="submit" disabled={committeeLoading}>{committeeLoading ? "Please wait…" : "Join Community"}</button>
          </form>
          <button type="button" onClick={handleLogout} style={{ marginTop: 20, border: 0, background: "none", color: "#b33112", cursor: "pointer" }}>Log out</button>
        </section>
      </main>
    );
  }

  const isFormScreen = activeScreen.startsWith("add-");
  const currentType = isFormScreen
    ? activeScreen.replace("add-", "")
    : activeScreen;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo"><img src="/images/festflow-brand.png" alt="FestFlow logo" /></span>
          <div>
            <h2>FestFlow</h2>
            <p>Community Collection Manager</p>
          </div>
        </div>

        <nav className="sidebar-navigation">
          <button
            className={activeScreen === "dashboard" ? "nav-active" : ""}
            onClick={() => setActiveScreen("dashboard")}
          >
            <span>⌂</span> Dashboard
          </button>

          <button
            className={
              currentType === "money" && activeScreen !== "dashboard"
                ? "nav-active"
                : ""
            }
            onClick={() => openCollection("money")}
          >
            <span>₹</span> Money Collection
          </button>

          <button
            className={currentType === "personal1" ? "nav-active" : ""}
            onClick={() => openCollection("personal1")}
          >
            <span>①</span> Personal Collection 1
          </button>

          <button
            className={currentType === "personal2" ? "nav-active" : ""}
            onClick={() => openCollection("personal2")}
          >
            <span>②</span> Personal Collection 2
          </button>

          <button
            className={currentType === "materials" ? "nav-active" : ""}
            onClick={() => { setMaterialSearch(""); setMaterialDateFilter("All"); setActiveScreen("materials"); }}
          >
            <span>▣</span> Material Donations
          </button>

          <button
            className={activeScreen === "reports" ? "nav-active" : ""}
            onClick={() => setActiveScreen("reports")}
          >
            <span>▤</span> Summary & Reports
          </button>
        </nav>

        <button type="button" onClick={() => { setActiveCommitteeId(""); setActiveScreen("communities"); }} style={{ margin: "12px 16px", padding: "10px 12px", border: "1px solid #f1b99f", borderRadius: 10, background: "#fff7f1", color: "#9b3215", cursor: "pointer" }}>Switch community</button>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {username.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{username}</strong>
              <p>{userRole === "admin" ? "Administrator" : userRole === "collector" ? "Collector" : "User"}</p>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>
              {activeScreen === "dashboard"
                ? "Dashboard"
                : isFormScreen
                ? editingId !== null
                  ? "Edit Collection"
                  : "Add Collection"
                : activeScreen === "materials"
                ? "Material Donations"
                : activeScreen === "add-materials"
                ? (editingMaterialId ? "Edit Material Donation" : "Add Material Donation")
                : activeScreen === "reports"
                ? "Summary & Reports"
                : collectionDetails[activeScreen]?.title || "Dashboard"}
            </h1>

            <p>Every Community. Every Celebration. One Platform.{myCommittees.find((c) => c.id === activeCommitteeId) ? ` · ${myCommittees.find((c) => c.id === activeCommitteeId).name}` : ""}</p>
          </div>

          <div className="header-date">{getToday()}</div>
        </header>

        {activeScreen === "dashboard" && (
          <section className="dashboard-content festflow-dashboard">
            {dataError && <p className="data-error" role="alert">{dataError}</p>}
            {dataLoading && <p className="data-loading">Loading saved collections…</p>}

            <section className="dashboard-hero">
              <div className="dashboard-hero-copy">
                <p className="dashboard-eyebrow">YOUR COMMUNITY AT A GLANCE</p>
                <h2>Welcome back,<br /><span>{userRole === "admin" ? "Admin" : userRole === "collector" ? "Collector" : username || "Member"}!</span></h2>
                <p className="dashboard-community-name">
                  {myCommittees.find((committee) => committee.id === activeCommitteeId)?.name || "Your FestFlow Community"}
                </p>
                <div className="dashboard-quote"><span>“</span> Together we organize, collect and celebrate.</div>
                <div className="dashboard-hero-event dashboard-hero-event-inline">
                  <span className="dashboard-event-icon">✦</span>
                  <div><small>COMMUNITY COLLECTIONS</small><strong>Every contribution matters</strong><span>Track donations clearly and transparently.</span></div>
                </div>
              </div>
            </section>

            <section className="dashboard-metrics-grid" aria-label="Collection summary">
              <article className="dashboard-metric metric-money">
                <span className="metric-icon">₹</span>
                <div><small>Total Collections</small><strong>{formatAmount(moneyTotal + personal1Total + personal2Total)}</strong><span>Across all money collections</span></div>
              </article>
              <article className="dashboard-metric metric-donors">
                <span className="metric-icon">♧</span>
                <div><small>Unique Donors</small><strong>{uniqueDonorCount}</strong><span>Based on saved donor names</span></div>
              </article>
              <article className="dashboard-metric metric-materials">
                <span className="metric-icon">◇</span>
                <div><small>Material Donations</small><strong>{materialDonations.length}</strong><span>Saved donation records</span></div>
              </article>
              <article className="dashboard-metric metric-records">
                <span className="metric-icon">▤</span>
                <div><small>Money Records</small><strong>{allMoneyRecords.length}</strong><span>Main and personal collections</span></div>
              </article>
            </section>

            <div className="dashboard-main-grid">
              <section className="dashboard-panel dashboard-chart-panel">
                <div className="dashboard-panel-heading">
                  <div><span className="panel-heading-icon">▥</span><div><h3>Collection Overview</h3><p>Monthly money collections · {new Date().getFullYear()}</p></div></div>
                  <span className="dashboard-live-label">LIVE DATA</span>
                </div>
                <div className="monthly-chart" role="img" aria-label="Monthly collection totals for the current year">
                  {monthlyTotals.map((item) => (
                    <div className="monthly-chart-column" key={item.month} title={`${item.month}: ${formatAmount(item.amount)}`}>
                      <span className="monthly-chart-value">{item.amount > 0 ? formatAmount(item.amount) : ""}</span>
                      <div className="monthly-chart-track"><div className="monthly-chart-bar" style={{ height: `${Math.max(item.amount > 0 ? 8 : 0, (item.amount / maxMonthlyTotal) * 100)}%` }} /></div>
                      <small>{item.month}</small>
                    </div>
                  ))}
                </div>
                <div className="dashboard-chart-footer"><span><i /> Saved collection amounts</span><strong>{formatAmount(moneyTotal + personal1Total + personal2Total)}</strong></div>
              </section>

              <section className="dashboard-panel dashboard-recent-panel">
                <div className="dashboard-panel-heading">
                  <div><span className="panel-heading-icon">◷</span><div><h3>Recent Collections</h3><p>Latest saved money records</p></div></div>
                  <button className="dashboard-text-link" onClick={() => openCollection("money")}>View all →</button>
                </div>
                {recentMoneyRecords.length === 0 ? <div className="dashboard-empty">No money collections yet.<button onClick={() => openAddForm("money")}>Add first collection</button></div> : (
                  <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Date</th><th>Donor</th><th>Amount</th><th>Mode</th></tr></thead><tbody>
                    {recentMoneyRecords.map((record) => <tr key={`${record.id}-${record.date}`}><td>{record.date || "—"}</td><td>{record.name}</td><td>{formatAmount(record.amount)}</td><td><span className="payment-pill">{record.paymentMode || "—"}</span></td></tr>)}
                  </tbody></table></div>
                )}
              </section>
            </div>

            <div className="dashboard-bottom-grid">
              <section className="dashboard-panel dashboard-material-panel">
                <div className="dashboard-panel-heading">
                  <div><span className="panel-heading-icon">◇</span><div><h3>Recent Material Donations</h3><p>Latest donated items</p></div></div>
                  <button className="dashboard-text-link" onClick={() => setActiveScreen("materials")}>View all →</button>
                </div>
                {recentMaterialRecords.length === 0 ? <div className="dashboard-empty">No material donations yet.<button onClick={() => openMaterialForm()}>Add donation</button></div> : (
                  <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Donor</th></tr></thead><tbody>
                    {recentMaterialRecords.map((record) => <tr key={record.id}><td>{record.date || "—"}</td><td>{record.item}</td><td>{record.quantity} {record.unit}</td><td>{record.donorName}</td></tr>)}
                  </tbody></table></div>
                )}
              </section>

              <section className="dashboard-panel dashboard-top-donors">
                <div className="dashboard-panel-heading"><div><span className="panel-heading-icon">♛</span><div><h3>Top Donors</h3><p>By total recorded amount</p></div></div></div>
                {donorTotals.length === 0 ? <p className="dashboard-empty-text">Donor rankings appear after collections are saved.</p> : <ol className="top-donor-list">{donorTotals.map((donor, index) => <li key={donor.name}><span className={`donor-rank rank-${index + 1}`}>{index + 1}</span><strong>{donor.name}</strong><b>{formatAmount(donor.amount)}</b></li>)}</ol>}
              </section>

              <section className="dashboard-panel dashboard-quick-actions">
                <div className="dashboard-panel-heading"><div><span className="panel-heading-icon">⚡</span><div><h3>Quick Actions</h3><p>Common tasks</p></div></div></div>
                <div className="dashboard-action-grid">
                  <button onClick={() => openAddForm("money")}><span className="action-icon action-icon-money">₹</span><span>Add Money Collection</span><b>›</b></button>
                  <button onClick={() => openMaterialForm()}><span className="action-icon action-icon-material">◇</span><span>Add Material Donation</span><b>›</b></button>
                  <button onClick={() => openCollection("personal1")}><span className="action-icon action-icon-personal">①</span><span>Personal Collection 1</span><b>›</b></button>
                  <button onClick={() => openCollection("personal2")}><span className="action-icon action-icon-personal2">②</span><span>Personal Collection 2</span><b>›</b></button>
                  <button onClick={() => setActiveScreen("reports")}><span className="action-icon action-icon-reports">▥</span><span>View Reports</span><b>›</b></button>
                  <button onClick={() => { setActiveCommitteeId(""); setActiveScreen("communities"); }}><span className="action-icon action-icon-community">⚙</span><span>Switch Community</span><b>›</b></button>
                </div>
              </section>
            </div>
          </section>
        )}

        {!isFormScreen &&
          ["money", "personal1", "personal2"].includes(activeScreen) &&
          renderCollectionList(activeScreen)}

        {isFormScreen &&
          ["money", "personal1", "personal2"].includes(currentType) &&
          renderCollectionForm(currentType)}

        {activeScreen === "reports" && renderReports()}

        {activeScreen === "materials" && renderMaterialList()}

        {activeScreen === "add-materials" && renderMaterialForm()}
      </main>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <button className={activeScreen === "dashboard" ? "active" : ""} onClick={() => setActiveScreen("dashboard")}><span>⌂</span>Home</button>
        <button className={activeScreen === "money" ? "active" : ""} onClick={() => openCollection("money")}><span>₹</span>Money</button>
        <button className={activeScreen === "materials" ? "active" : ""} onClick={() => setActiveScreen("materials")}><span>◇</span>Donations</button>
        <button className={activeScreen === "reports" ? "active" : ""} onClick={() => setActiveScreen("reports")}><span>▤</span>Reports</button>
        <button onClick={handleLogout}><span>♙</span>Profile</button>
      </nav>
    </div>
  );
}

export default App;