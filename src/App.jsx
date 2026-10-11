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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function restoreSession(session) {
      if (!session?.user) {
        if (isMounted) {
          setLoggedIn(false);
          setUserRole("");
          setCurrentUserId("");
          setAuthChecking(false);
        }
        return;
      }

      const { data, error } = await supabase.rpc("get_my_role");
      if (!isMounted) return;

      if (error || !["admin", "collector"].includes(data)) {
        await supabase.auth.signOut();
        setLoggedIn(false);
        setUserRole("");
        setCurrentUserId("");
        setLoginError("Your account does not have an authorized app role. Please contact the administrator.");
      } else {
        setUsername(session.user.email || "");
        setUserRole(data);
        setCurrentUserId(session.user.id);
        setLoggedIn(true);
        setLoginError("");
      }
      setAuthChecking(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (isMounted) {
          setLoginError("Unable to check your session. Please refresh and try again.");
          setAuthChecking(false);
        }
        return;
      }
      restoreSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer the role lookup so the auth callback does not block Supabase's auth lock.
      Promise.resolve().then(() => restoreSession(session));
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


  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    async function loadCollections() {
      setDataLoading(true);
      setDataError("");
      try {
        const names = ["money", "personal1", "personal2", "materials"];
        const results = await Promise.all(names.map((key) =>
          supabase.from(TABLES[key]).select("*").order(key === "materials" ? "donation_date" : "collection_date", { ascending: false }).order("created_at", { ascending: false })
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
  }, [loggedIn]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    const email = username.trim();
    if (!email || !password) {
      setLoginError("Please enter your registered email and password.");
      return;
    }

    setLoginLoading(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const { data: role, error: roleError } = await supabase.rpc("get_my_role");
      if (roleError || !["admin", "collector"].includes(role)) {
        await supabase.auth.signOut();
        throw new Error("This account is not assigned an authorized admin or collector role.");
      }

      setUsername(signInData.user?.email || email);
      setUserRole(role);
      setCurrentUserId(signInData.user.id);
      setLoggedIn(true);
      setActiveScreen("dashboard");
      setPassword("");
    } catch (error) {
      setLoginError(error?.message || "Login failed. Please check your email and password.");
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
    setUserRole("");
    setCurrentUserId("");
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
        ? await supabase.from(table).update(payload).eq("id", editingId).select().single()
        : await supabase.from(table).insert({ ...payload, created_by: authData.user.id }).select().single();
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
      const { error } = await supabase.from(TABLES[type]).delete().eq("id", id);
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
        ? await supabase.from(TABLES.materials).update(payload).eq("id", editingMaterialId).select().single()
        : await supabase.from(TABLES.materials).insert({ ...payload, created_by: authData.user.id }).select().single();
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
      const { error } = await supabase.from(TABLES.materials).delete().eq("id", id);
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

  if (!loggedIn) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-logo">🎉</div>

          <h1>FestFlow</h1>
          <p className="login-subtitle">Every Community. Every Celebration. One Platform.</p>

          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your registered email"
              required
            />
          </label>

          <label>
            Password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

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
            {loginLoading ? "Signing in…" : "Login"}
          </button>

          <p className="login-footer">
            FestFlow Community Collection Management
          </p>
        </form>
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
          <span className="sidebar-logo">🎉</span>
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

            <p>Every Community. Every Celebration. One Platform.</p>
          </div>

          <div className="header-date">{getToday()}</div>
        </header>

        {activeScreen === "dashboard" && (
          <section className="dashboard-content reference-dashboard">
            <div className="reference-welcome">
              <h2>Welcome, {userRole === "admin" ? "Admin" : "Collector"} 👋</h2>
              <p>Here's today's collection overview</p>
            </div>
            {dataError && <p className="data-error" role="alert">{dataError}</p>}
            {dataLoading && <p className="data-loading">Loading saved collections…</p>}
            <article className="total-collection-card">
              <div className="total-icon">💰</div><div><p>Total Collection</p><h2>{formatAmount(moneyTotal + personal1Total + personal2Total)}</h2><small>Across all money collections</small></div><div className="total-bars" aria-hidden="true">▂ ▅ ▇</div>
            </article>
            <div className="overview-mini-grid">
              <article className="mini-card donors-card"><span>👥</span><div><strong>{totalDonors}</strong><small>Total Donors</small></div></article>
              <article className="mini-card materials-card"><span>📦</span><div><strong>{materialDonations.length}</strong><small>Material Donations</small></div></article>
            </div>
            <section className="dashboard-section reference-quick-actions">
              <h3>Quick Actions</h3>
              <button className="action-wide action-orange" onClick={() => openAddForm("money")}>＋ Add Money Collection</button>
              <button className="action-wide action-green" onClick={() => openMaterialForm()}>＋ Add Material Donation</button>
              <div className="dashboard-shortcuts">
                <button className="shortcut shortcut-purple" onClick={() => openCollection("personal1")}><span>♡</span><strong>Personal<br/>Collection 1</strong></button>
                <button className="shortcut shortcut-yellow" onClick={() => openCollection("personal2")}><span>🤝</span><strong>Personal<br/>Collection 2</strong></button>
                <button className="shortcut shortcut-green" onClick={() => setActiveScreen("money")}><span>▤</span><strong>View<br/>Money</strong></button>
                <button className="shortcut shortcut-blue" onClick={() => setActiveScreen("reports")}><span>▣</span><strong>View<br/>Reports</strong></button>
              </div>
            </section>
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