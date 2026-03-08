import React, { useEffect, useMemo, useState } from "react";

const AttributeManager = ({
  attributeName,
  apiEndpoint,
  placeholder,
  type = "alphanumeric", // "numeric" or "alphanumeric"
  showUnit = false,       // show cm unit
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState(null);
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState({});
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((i) => i.value.toLowerCase().includes(query));
  }, [q, items]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${apiEndpoint}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to load ${attributeName}`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [API_BASE_URL, apiEndpoint]);

  const validate = () => {
    const errs = {};

    if (!value.trim()) {
      errs.value = `${attributeName} is required`;
    } else if (type === "numeric" && isNaN(Number(value))) {
      errs.value = `${attributeName} must be a number`;
    }

    const clash = items.find(
      (i) => i.value.toLowerCase() === value.trim().toLowerCase()
    );
    if (clash && clash._id !== itemId)
      errs.value = `${attributeName} must be unique`;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setItemId(null);
    setValue("");
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = { value: value.trim() };
    try {
      const endpoint = itemId
        ? `${API_BASE_URL}${apiEndpoint}/${itemId}`
        : `${API_BASE_URL}${apiEndpoint}`;
      const method = itemId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save item");
      await fetchItems();
      resetForm();
    } catch (err) {
      console.error(err);
      alert(err.message || `Error saving ${attributeName}`);
    }
  };

  const handleEdit = (i) => {
    setItemId(i._id);
    setValue(i.value || "");
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${attributeName}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}${apiEndpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (err) {
      console.error(err);
      alert(`Error deleting ${attributeName}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow max-w-3xl mx-auto mb-8">
      <h2 className="text-xl font-bold mb-4">{itemId ? `Edit ${attributeName}` : `${attributeName} Manager`}</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 items-end">
        <div className="flex flex-col">
          <label className="font-medium">{attributeName}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="border rounded px-3 py-2 flex-1"
              placeholder={placeholder || `Enter ${attributeName}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {showUnit && <span className="text-gray-600">cm</span>}
          </div>
          {errors.value && <p className="text-sm text-red-600 mt-1">{errors.value}</p>}
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            {itemId ? "Update" : "Add"}
          </button>
          {itemId && (
            <button type="button" onClick={resetForm} className="border px-4 py-2 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>

      <hr className="my-6" />

      {/* Search */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">
          {loading ? `Loading ${attributeName}...` : `${attributeName} (${items.length})`}
        </h3>
        <input
          className="border rounded px-3 py-2"
          placeholder={`Search ${attributeName}...`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">{attributeName}</th>
              <th className="p-2 border w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="2" className="p-4 text-center text-gray-500">
                  No {attributeName.toLowerCase()} found
                </td>
              </tr>
            )}
            {filtered.map((i) => (
              <tr key={i._id}>
                <td className="p-2 border">{i.value}{showUnit ? " cm" : ""}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 rounded text-white bg-emerald-600"
                      onClick={() => handleEdit(i)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-2 py-1 rounded text-white bg-red-600"
                      onClick={() => handleDelete(i._id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan="2" className="p-4 text-center">Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttributeManager;
