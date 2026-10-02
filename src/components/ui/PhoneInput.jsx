import { useEffect, useState } from "react";
import { Input } from "./index.js";

export const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;

export default function PhoneInput({ value, onChange, required, onValidityChange, className = "", placeholder = "01XXXXXXXXX", autoComplete = "tel" }) {
  const [error, setError] = useState("");
  // Errors show once the shopper has left the field or tried to submit,
  // never on a form they haven't started filling in.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let isValid = true;
    let err = "";
    
    if (!required && !value) {
      isValid = true;
    } else {
      const cleaned = value?.replace(/\s+/g, '') || "";
      if (!cleaned && required) {
        isValid = false;
        err = "Phone number is required";
      } else if (cleaned && !BD_PHONE_REGEX.test(cleaned)) {
        isValid = false;
        err = "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)";
      }
    }
    
    setError(err);
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [value, required]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const val = e.target.value.replace(/[^\d\s\-\+]/g, '');
    if (onChange) onChange(val);
  };

  return (
    <div className="w-full block">
      <Input
        type="tel"
        value={value || ""}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
        className={`${className} ${touched && error ? "ring-magenta" : ""}`}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
      {touched && error && <span className="mt-1.5 block text-xs font-semibold text-magenta">{error}</span>}
    </div>
  );
}
