import React from "react";

const ACCOUNT_TYPES = [
  { value: "Live", label: "Live" },
  { value: "Prop Evaluation", label: "Prop Evaluation" },
  { value: "Prop Verification", label: "Prop Verification" },
  { value: "Prop Funded", label: "Prop Funded" },
  { value: "Demo", label: "Demo" },
];

const AccountTypeSelect = ({ value, onChange, style = {} }) => {
  const handleChange = (e) => {
    if (onChange) {
      // Create a synthetic event that matches the expected format
      const syntheticEvent = {
        target: {
          name: "accountType",
          value: e.target.value,
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <select
      name="accountType"
      value={value}
      onChange={handleChange}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 6,
        border: "1px solid #d9d9d9",
        fontSize: 14,
        ...style,
      }}
    >
      {ACCOUNT_TYPES.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
};

export default AccountTypeSelect;
