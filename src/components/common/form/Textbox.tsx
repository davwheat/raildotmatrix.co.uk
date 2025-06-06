import React from 'react'

export default function TextBox({ label, helpText, placeholder }) {
  return (
    <label className="form-textbox">
      {label}
      <input className="form-textbox--input" type="text" placeholder={placeholder} />

      {helpText && <p className="form-textbox--help-text">{helpText}</p>}
    </label>
  )
}
