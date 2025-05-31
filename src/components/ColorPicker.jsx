import React, { useState, useRef, useEffect } from "react";

function ColorPicker({ colors, value, onChange, size = 24 }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const selected = colors.find((c) => c.id === value);

  return (
    <div style={{ position: "relative", minHeight: size }}>
      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: selected?.color || "#eee",
          border: "2px solid #6C63FF",
          cursor: "pointer",
          padding: 0,
          outline: "none",
        }}
        title="Select color"
      />
      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: "absolute",
            left: 0,
            top: size + 8,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: 6,
            display: "flex",
            gap: 6,
            zIndex: 10,
          }}
        >
          {colors.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => {
                onChange(color.id);
                setShowPicker(false);
              }}
              style={{
                width: size - 6,
                height: size - 6,
                borderRadius: "50%",
                background: color.color,
                border:
                  value === color.id
                    ? "2px solid #6C63FF"
                    : "2px solid transparent",
                cursor: "pointer",
                padding: 0,
              }}
              title={color.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
