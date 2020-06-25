import React from 'react'
import PropTypes from 'prop-types'

import './css/Select.css'

export default function Select({ label, helpText, placeholder, options, onChange, ...props }) {
  return (
    <label className="form-select">
      {label}
      <select onChange={onChange} className="form-select--input" label={placeholder} {...props}>
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

Select.propTypes = {
  label: PropTypes.string.isRequired,
  helpText: PropTypes.string,
  placeholder: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
}
