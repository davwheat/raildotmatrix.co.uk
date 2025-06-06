import React from 'react'

import './css/Select.less'

interface IProps {
  label: string
  helpText?: string
  placeholder?: string
  options: {
    label: string
    value: string
  }[]
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
  value: string
}

export default function Select({ label, helpText, placeholder, options, onChange, ...props }: IProps) {
  return (
    <label className="form-select">
      {label}
      <select onChange={onChange} className="form-select--input" {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {helpText && <p className="form-select--help-text">{helpText}</p>}
    </label>
  )
}
