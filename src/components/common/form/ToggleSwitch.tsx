import React from 'react'

import './css/ToggleSwitch.less'

interface IProps {
  label: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
  checked: boolean
  defaultChecked?: boolean
}

const ToggleSwitch = React.forwardRef<HTMLInputElement, IProps>(({ label, onChange, checked, defaultChecked }: IProps, ref) => {
  return (
    <div className="toggle-switch">
      <label className="toggle-switch--label">
        <span>{label}</span>
        <div className="toggle-switch__container">
          <input ref={ref} type="checkbox" onChange={onChange} checked={checked ?? defaultChecked} />
          <div className="toggle-switch__slider"></div>
        </div>
      </label>
    </div>
  )
})

export default ToggleSwitch
