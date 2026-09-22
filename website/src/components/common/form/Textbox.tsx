import React from 'react'

interface IProps {
  label: React.ReactNode
  helpText?: React.ReactNode
  placeholder?: string
}

export default function TextBox({ label, helpText, placeholder }: IProps) {
  return (
    <label className="form-textbox">
      {label}
      <input className="form-textbox--input" type="text" placeholder={placeholder} />

      {helpText && <p className="form-textbox--help-text">{helpText}</p>}
    </label>
  )
}
