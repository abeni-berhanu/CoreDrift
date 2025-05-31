import React from "react";
import Select from "react-select";

export default function MinimalSelect({
  options,
  value,
  onChange,
  placeholder,
  styles: customStyles = {},
  ...props
}) {
  const defaultStyles = {
    control: (base, state) => ({
      ...base,
      fontSize: 11,
      padding: 2,
      minHeight: 28,
      boxShadow: "none",
      border: state.isFocused ? "1.5px solid #6C63FF" : "1px solid #ccc",
      borderRadius: 10,
      background: "#fff",
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 4px",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#222",
      fontWeight: 500,
      fontSize: 11,
      margin: 0,
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      fontSize: 11,
    }),
    placeholder: (base) => ({
      ...base,
      color: "#bbb",
      fontSize: 11,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? "#edeaff" : "#fff",
      color: state.isSelected ? "#6C63FF" : "#222",
      borderRadius: 8,
      fontWeight: state.isSelected ? 600 : 400,
      fontSize: 11,
      padding: "4px 10px",
      margin: 2,
      cursor: "pointer",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  // Merge custom styles with default styles
  const mergedStyles = {
    control: (base, state) => ({
      ...defaultStyles.control(base, state),
      ...(customStyles.control ? customStyles.control(base, state) : {}),
    }),
    valueContainer: (base) => ({
      ...defaultStyles.valueContainer(base),
      ...(customStyles.valueContainer ? customStyles.valueContainer(base) : {}),
    }),
    singleValue: (base) => ({
      ...defaultStyles.singleValue(base),
      ...(customStyles.singleValue ? customStyles.singleValue(base) : {}),
    }),
    input: (base) => ({
      ...defaultStyles.input(base),
      ...(customStyles.input ? customStyles.input(base) : {}),
    }),
    placeholder: (base) => ({
      ...defaultStyles.placeholder(base),
      ...(customStyles.placeholder ? customStyles.placeholder(base) : {}),
    }),
    option: (base, state) => ({
      ...defaultStyles.option(base, state),
      ...(customStyles.option ? customStyles.option(base, state) : {}),
    }),
    menu: (base) => ({
      ...defaultStyles.menu(base),
      ...(customStyles.menu ? customStyles.menu(base) : {}),
    }),
  };

  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      styles={mergedStyles}
      isSearchable
      isClearable={false}
      components={{
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
        ClearIndicator: () => null,
      }}
      {...props}
    />
  );
}
