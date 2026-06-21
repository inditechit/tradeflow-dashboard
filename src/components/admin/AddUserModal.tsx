import React, { useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";

interface User {
  id?: number;
  name?: string;
  email?: string;
  password?: string;
  mobile?: string;
  telegram?: string;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  profit_percentage?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: User) => void;
}

const AddUserModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [formData, setFormData] = useState<User>({});

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "profit_percentage" ? Number(value) : value,
    }));
  };

  const handleSubmit = () => {
    onAdd(formData);
    // Reset the form data after submission so it's clean for the next time
    setFormData({});
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6">

        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            Add New User
          </h2>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-red-500 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="grid grid-cols-2 gap-5">

          {/* Name */}
          <div>
            <label className="label">Full Name</label>
            <input name="name" value={formData.name ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Email */}
          <div>
            <label className="label">Email</label>
            <input name="email" value={formData.email ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Mobile */}
          <div>
            <label className="label">Mobile</label>
            <input name="mobile" value={formData.mobile ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Telegram */}
          <div>
            <label className="label">Telegram</label>
            <input name="telegram" value={formData.telegram ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Country */}
          <div>
            <label className="label">Country</label>
            <input name="country" value={formData.country ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* State */}
          <div>
            <label className="label">State</label>
            <input name="state" value={formData.state ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* City */}
          <div>
            <label className="label">City</label>
            <input name="city" value={formData.city ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Pincode */}
          <div>
            <label className="label">Pincode</label>
            <input name="pincode" value={formData.pincode ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Password */}
          <div className="col-span-2">
            <label className="label">Password</label>
            <PasswordInput name="password" value={formData.password ?? ""} onChange={handleChange} className="input" />
          </div>

          {/* Profit */}
          <div className="col-span-2">
            <label className="label">Profit Percentage (%)</label>
            <input
              type="text"
              name="profit_percentage"
              value={formData.profit_percentage ?? ""}
              onChange={handleChange}
              className="input"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] shadow"
          >
            Add User
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddUserModal;